"use strict";
/* simulator.ts — SwarmSimulator: patrol, charging, collision avoidance, consensus */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmSimulator = void 0;
const types_1 = require("./types");
const robot_1 = require("./robot");
const wind_1 = require("./wind");
const terrain_1 = require("./terrain");
const mission_1 = require("./mission");
const recorder_1 = require("./recorder");
const pathfinding_1 = require("./pathfinding");
const wpt_1 = require("./wpt");
const DT = 0.15; // seconds per tick
const MAP_W = 120;
const MAP_H = 80;
const HUB_POS = { x: 50, y: 40 };
// Inter-robot repulsion (Task 86)
const REPULSION_DIST = 3; // meters
const REPULSION_STRENGTH = 0.8;
const RECHARGE_TARGET_WPT = 80; // SoC% threshold to redeploy after WPT charge
// Fleet composition (套娃 hierarchy): 1 hub + 1 large + 4 medium + 16 small = 22
// Hub(0) → Large(1) → Medium(2,3,4,5) → Small(6-21)
const FLEET = [
    { size: 'hub', parentIdx: null }, // 0: Hub
    { size: 'large', parentIdx: 0 }, // 1: Large → Hub
    { size: 'medium', parentIdx: 1 }, // 2: Medium → Large
    { size: 'medium', parentIdx: 1 }, // 3: Medium → Large
    { size: 'medium', parentIdx: 1 }, // 4: Medium → Large
    { size: 'medium', parentIdx: 1 }, // 5: Medium → Large
    { size: 'small', parentIdx: 2 }, // 6-9: Small → Medium[2]
    { size: 'small', parentIdx: 2 },
    { size: 'small', parentIdx: 2 },
    { size: 'small', parentIdx: 2 },
    { size: 'small', parentIdx: 3 }, // 10-13: Small → Medium[3]
    { size: 'small', parentIdx: 3 },
    { size: 'small', parentIdx: 3 },
    { size: 'small', parentIdx: 3 },
    { size: 'small', parentIdx: 4 }, // 14-17: Small → Medium[4]
    { size: 'small', parentIdx: 4 },
    { size: 'small', parentIdx: 4 },
    { size: 'small', parentIdx: 4 },
    { size: 'small', parentIdx: 5 }, // 18-21: Small → Medium[5]
    { size: 'small', parentIdx: 5 },
    { size: 'small', parentIdx: 5 },
    { size: 'small', parentIdx: 5 },
];
class SwarmSimulator {
    robots;
    wind;
    terrain;
    obstacles;
    navGrid;
    tick = 0;
    startTime = Date.now();
    formation = 'scatter';
    events = [];
    eventHistory = [];
    deployed = false;
    missionManager = new mission_1.MissionManager();
    recorder = new recorder_1.Recorder();
    // Cascade deploy/recall state machine (套娃)
    deployStage = 0; // 0=idle, 1=large, 2=medium, 3=small
    deployTriggerTick = 0;
    recallStage = 0; // 0=idle, 1=small returning, 2=medium returning, 3=large returning
    // HDC stats (Task 87/91)
    hdcTotalInferences = 0;
    hdcCorrectClassifications = 0;
    hdcPerSpecies = Array.from({ length: 6 }, () => ({ correct: 0, total: 0 }));
    constructor() {
        this.wind = new wind_1.WindField(Math.PI * 0.25, 2.0, 0.5);
        const rawTerrain = (0, terrain_1.generateTerrain)(42);
        this.obstacles = rawTerrain.obstacles;
        this.terrain = {
            heightMap: rawTerrain.heightMap,
            rows: rawTerrain.rows,
            cols: rawTerrain.cols,
            maxHeight: rawTerrain.maxHeight,
            obstacles: rawTerrain.obstacles.map(o => ({
                x: o.x, z: o.z, width: o.width, depth: o.depth,
                height: o.height, type: o.type,
            })),
        };
        // Build A* navigation grid from obstacles (Task 124)
        this.navGrid = new pathfinding_1.NavGrid();
        this.navGrid.buildFromTerrain(this.obstacles);
        this.robots = FLEET.map((f, i) => new robot_1.Robot(i, f.size, HUB_POS, this.obstacles));
        // Inject NavGrid into each robot for pathfinding
        for (const r of this.robots) {
            r.setNavGrid(this.navGrid);
        }
        // Set up 套娃 nesting hierarchy
        for (let i = 0; i < FLEET.length; i++) {
            const entry = FLEET[i];
            if (entry.parentIdx !== null) {
                const parent = this.robots[entry.parentIdx];
                this.robots[i].nestInto(parent);
            }
        }
        this.robots[0].isCoordinator = true;
        // Assign zones and generate patrol waypoints for all non-hub robots
        this.robots.forEach((r, i) => {
            if (r.sizeClass === 'hub') {
                r.zoneId = -1;
                return;
            }
            // Medium robots get zone 0-3, Small robots inherit parent medium's zone sub-divided
            if (r.sizeClass === 'large') {
                r.zoneId = 0;
            }
            else if (r.sizeClass === 'medium') {
                r.zoneId = (i - 2) % 4; // medium ids 2-5 → zones 0-3
            }
            else {
                // Small robots: use parent medium's zone but with slight variation
                r.zoneId = ((r.parentId ?? 2) - 2) % 6;
            }
            r.generatePatrolWaypoints(r.zoneId % 6);
        });
    }
    step() {
        this.tick++;
        this.events = [];
        this.wind.update();
        // Build parent lookup for tick
        const robotMap = new Map();
        for (const r of this.robots)
            robotMap.set(r.id, r);
        // Update each robot — collect events
        for (const r of this.robots) {
            const parent = r.parentId !== null ? robotMap.get(r.parentId) : undefined;
            const result = r.tick(this.wind, DT, parent);
            if (result.event) {
                this.addEvent('info', result.event, r.id);
            }
        }
        // Check auto-nest for robots returning to parent
        for (const r of this.robots) {
            if (r.phase === 'returning-to-parent' && r.parentId !== null) {
                const parent = robotMap.get(r.parentId);
                if (parent) {
                    // Keep target updated to parent's current position
                    r.targetPosition = { ...parent.position };
                    r.checkAutoNest(parent);
                }
            }
        }
        // Advance cascade deploy/recall state machines
        this.tickCascadeDeploy();
        this.tickCascadeRecall();
        // WPT energy cascade (套娃)
        const energyFlows = (0, wpt_1.computeWptFlows)(this.robots);
        (0, wpt_1.applyWptCharging)(this.robots, energyFlows);
        // Auto-redeploy nested robots that have recharged via WPT
        for (const r of this.robots) {
            if (r.isNested && r.batterySoc >= RECHARGE_TARGET_WPT && r.parentId !== null) {
                // Only redeploy if not in recall mode
                if (this.deployed && this.recallStage === 0) {
                    const parent = robotMap.get(r.parentId);
                    if (parent && !parent.isNested) {
                        const angle = Math.random() * Math.PI * 2;
                        r.unnestFrom(parent, { x: 3 * Math.cos(angle), y: 3 * Math.sin(angle) });
                        r.currentWaypointIdx = r.preChargeWaypointIdx;
                        if (r.patrolWaypoints.length > 0) {
                            r.targetPosition = { ...r.patrolWaypoints[r.currentWaypointIdx] };
                        }
                        this.addEvent('info', `${r.name} recharged via WPT (${r.batterySoc.toFixed(0)}%), redeploying`);
                    }
                }
            }
        }
        // Inter-robot collision avoidance (Task 86) — skip nested robots
        this.applyRepulsion(DT);
        const bleLinks = this.computeBleLinks();
        this.electCoordinator();
        // Compute swarm consensus (Task 87)
        const consensus = this.computeConsensus(bleLinks);
        const onlineRobots = this.robots.filter(r => r.isOnline);
        const chargingRobots = this.robots.filter(r => r.phase === 'charging');
        const deployedRobots = this.robots.filter(r => !r.isNested && r.sizeClass !== 'hub');
        const nestedRobots = this.robots.filter(r => r.isNested);
        const wptChargingRobots = this.robots.filter(r => r.phase === 'wpt-charging');
        const stats = {
            totalRobots: this.robots.length,
            onlineRobots: onlineRobots.length,
            chargingRobots: chargingRobots.length,
            avgBatterySoc: onlineRobots.length > 0
                ? onlineRobots.reduce((s, r) => s + r.batterySoc, 0) / onlineRobots.length
                : 0,
            windClass: this.wind.getState().windClass,
            formation: this.formation,
            coordinatorId: this.robots.find(r => r.isCoordinator)?.id ?? -1,
            uptimeSeconds: (Date.now() - this.startTime) / 1000,
            consensus,
            hdcStats: this.getHdcStats(),
            nestingStats: {
                deployed: deployedRobots.length,
                nested: nestedRobots.length,
                wptCharging: wptChargingRobots.length,
            },
        };
        // Low battery warnings
        for (const r of this.robots) {
            if (r.isOnline && r.batterySoc < 10 && this.tick % 50 === 0) {
                this.addEvent('low_battery', `${r.name} battery critical: ${r.batterySoc.toFixed(1)}%`, r.id);
            }
        }
        // Update mission
        const missionState = this.missionManager.update(this.tick, this.robots);
        // Track HDC accuracy during missions (Task 91)
        if (missionState.active) {
            this.trackHdcAccuracy(missionState);
        }
        // Smart target assignment
        if (missionState.active && this.deployed) {
            this.autoAssignTargets(missionState.targets);
        }
        // Collect robot paths for client visualization (Task 124)
        const paths = this.collectRobotPaths();
        const snapshot = {
            tick: this.tick,
            timeMs: Date.now() - this.startTime,
            formation: this.formation,
            robots: this.robots.map(r => r.getState()),
            wind: this.wind.getState(),
            bleLinks,
            events: [...this.events],
            stats,
            mission: missionState.active ? missionState : undefined,
            paths: paths.length > 0 ? paths : undefined,
            energyFlows: energyFlows.length > 0 ? energyFlows : undefined,
        };
        this.recorder.record(snapshot, missionState.active ? missionState : null);
        return snapshot;
    }
    // ── Commands ──────────────────────────────────────────────
    deploy() {
        if (this.deployed)
            return;
        this.deployed = true;
        this.deployStage = 1;
        this.deployTriggerTick = this.tick;
        this.recallStage = 0;
        // Hub stays at HUB_POS
        const hub = this.robots[0];
        hub.phase = 'patrol';
        hub.targetPosition = { ...HUB_POS };
        // Stage 1: Deploy Large from Hub
        this.addEvent('deploy', 'Stage 1/3: Large deploying from Hub');
        const large = this.robots.find(r => r.sizeClass === 'large' && r.isNested);
        if (large) {
            const hubBot = this.robots.find(r => r.sizeClass === 'hub');
            if (hubBot) {
                large.unnestFrom(hubBot, { x: 3, y: 0 });
                // Deploy Large to center area
                if (large.patrolWaypoints.length > 0) {
                    large.targetPosition = { ...large.patrolWaypoints[0] };
                }
                else {
                    large.targetPosition = { x: 60, y: 40 };
                }
            }
        }
        this.formation = 'scatter';
    }
    /** Cascade deploy tick — called each step to advance stages */
    tickCascadeDeploy() {
        if (this.deployStage === 0)
            return;
        const elapsed = this.tick - this.deployTriggerTick;
        // Stage 2: Deploy Medium from Large (after 30 ticks)
        if (this.deployStage === 1 && elapsed >= 30) {
            this.deployStage = 2;
            this.addEvent('deploy', 'Stage 2/3: Medium deploying from Large');
            const large = this.robots.find(r => r.sizeClass === 'large');
            if (!large)
                return;
            const mediums = this.robots.filter(r => r.sizeClass === 'medium' && r.isNested);
            const offsets = [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: -5, y: 5 }, { x: 5, y: 5 }];
            mediums.forEach((m, i) => {
                m.unnestFrom(large, offsets[i % offsets.length]);
                if (m.patrolWaypoints.length > 0) {
                    m.currentWaypointIdx = 0;
                    m.targetPosition = { ...m.patrolWaypoints[0] };
                }
            });
        }
        // Stage 3: Deploy Small from Medium (after 60 ticks)
        if (this.deployStage === 2 && elapsed >= 60) {
            this.deployStage = 3;
            this.addEvent('deploy', 'Stage 3/3: Small deploying from Medium');
            const mediums = this.robots.filter(r => r.sizeClass === 'medium');
            for (const med of mediums) {
                const smalls = this.robots.filter(r => r.sizeClass === 'small' && r.parentId === med.id && r.isNested);
                const smallOffsets = [{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 }];
                smalls.forEach((s, i) => {
                    s.unnestFrom(med, smallOffsets[i % smallOffsets.length]);
                    if (s.patrolWaypoints.length > 0) {
                        s.currentWaypointIdx = 0;
                        s.targetPosition = { ...s.patrolWaypoints[0] };
                    }
                });
            }
        }
        // Check if all robots deployed — mark stage complete
        if (this.deployStage === 3) {
            const allDeployed = this.robots.every(r => !r.isNested || r.sizeClass === 'hub');
            if (allDeployed) {
                this.deployStage = 0;
                this.addEvent('deploy', 'Cascade deployment complete — all 21 robots active');
            }
        }
    }
    recall() {
        this.addEvent('recall', 'Cascade recall initiated');
        this.deployed = false;
        this.deployStage = 0;
        this.recallStage = 1;
        // Stage 1: All Small return to their Medium parent
        this.addEvent('recall', 'Stage 1/3: Small returning to Medium');
        for (const r of this.robots) {
            if (r.sizeClass === 'small' && !r.isNested && r.parentId !== null) {
                const parent = this.robots.find(p => p.id === r.parentId);
                if (parent)
                    r.returnToParent(parent);
            }
        }
    }
    /** Cascade recall tick — advances stages as nesting completes */
    tickCascadeRecall() {
        if (this.recallStage === 0)
            return;
        // Stage 1→2: All small nested? → Medium returns to Large
        if (this.recallStage === 1) {
            const smallsOut = this.robots.filter(r => r.sizeClass === 'small' && !r.isNested);
            // Force-nest stuck smalls after 200 ticks
            for (const s of smallsOut) {
                if (s.phase === 'returning-to-parent' && s.parentId !== null) {
                    const parent = this.robots.find(p => p.id === s.parentId);
                    if (parent && s.tickCount > 200) {
                        s.nestInto(parent);
                    }
                }
            }
            if (smallsOut.length === 0) {
                this.recallStage = 2;
                this.addEvent('recall', 'Stage 2/3: Medium returning to Large');
                for (const r of this.robots) {
                    if (r.sizeClass === 'medium' && !r.isNested && r.parentId !== null) {
                        const parent = this.robots.find(p => p.id === r.parentId);
                        if (parent)
                            r.returnToParent(parent);
                    }
                }
            }
        }
        // Stage 2→3: All medium nested? → Large returns to Hub
        if (this.recallStage === 2) {
            const medOut = this.robots.filter(r => r.sizeClass === 'medium' && !r.isNested);
            for (const m of medOut) {
                if (m.phase === 'returning-to-parent' && m.parentId !== null) {
                    const parent = this.robots.find(p => p.id === m.parentId);
                    if (parent && m.tickCount > 200) {
                        m.nestInto(parent);
                    }
                }
            }
            if (medOut.length === 0) {
                this.recallStage = 3;
                this.addEvent('recall', 'Stage 3/3: Large returning to Hub');
                for (const r of this.robots) {
                    if (r.sizeClass === 'large' && !r.isNested) {
                        r.phase = 'returning';
                        r.targetPosition = { ...HUB_POS };
                    }
                }
            }
        }
        // Stage 3: Large at hub → nest into hub
        if (this.recallStage === 3) {
            const largeOut = this.robots.filter(r => r.sizeClass === 'large' && !r.isNested);
            for (const l of largeOut) {
                if (l.phase === 'landed' || l.phase === 'charging') {
                    const hub = this.robots.find(p => p.sizeClass === 'hub');
                    if (hub)
                        l.nestInto(hub);
                }
            }
            if (largeOut.length === 0) {
                this.recallStage = 0;
                this.addEvent('recall', 'Cascade recall complete — all robots nested');
            }
        }
    }
    setFormation(type) {
        this.formation = type;
        this.addEvent('formation', `Formation → ${type}`);
        const positions = this.generateFormation(type);
        this.robots.forEach((r, i) => {
            if (r.sizeClass === 'hub')
                return;
            if (positions[i]) {
                r.targetPosition = positions[i];
                r.phase = 'deploying';
            }
        });
    }
    moveRobot(robotId, target) {
        const r = this.robots.find(rb => rb.id === robotId);
        if (!r || !r.isOnline)
            return;
        r.targetPosition = target;
        if (r.phase === 'landed' || r.phase === 'docked') {
            r.phase = 'deploying';
        }
    }
    setPowerMode(robotId, mode) {
        const r = this.robots.find(rb => rb.id === robotId);
        if (!r)
            return;
        r.powerMode = mode;
    }
    triggerGust() {
        this.wind.triggerGust();
        this.addEvent('wind_change', 'Gust event triggered!');
    }
    injectJamming() {
        const jammingCenter = { x: 85, y: 35 };
        const range = 25;
        let jammed = 0;
        for (const r of this.robots) {
            const dx = r.position.x - jammingCenter.x;
            const dy = r.position.y - jammingCenter.y;
            if (Math.sqrt(dx * dx + dy * dy) < range) {
                r.isJammed = true;
                jammed++;
            }
        }
        this.addEvent('jamming', `RF jamming zone active — ${jammed} robots affected`);
    }
    clearJamming() {
        for (const r of this.robots)
            r.isJammed = false;
        this.addEvent('recovery', 'RF jamming cleared');
    }
    injectNodeFailure(robotId) {
        const target = robotId ?? Math.floor(1 + Math.random() * (this.robots.length - 1));
        const r = this.robots[target];
        if (r && r.sizeClass !== 'hub') {
            r.isOnline = false;
            this.addEvent('node_fail', `${r.name} went offline!`, r.id);
        }
    }
    recoverNode(robotId) {
        const r = this.robots.find(rb => rb.id === robotId);
        if (r) {
            r.isOnline = true;
            r.isJammed = false;
            r.isByzantine = false;
            this.addEvent('recovery', `${r.name} recovered`, r.id);
        }
    }
    injectByzantine(robotId) {
        const target = robotId ?? Math.floor(1 + Math.random() * (this.robots.length - 1));
        const r = this.robots[target];
        if (r && r.sizeClass !== 'hub') {
            r.isByzantine = true;
            this.addEvent('byzantine', `${r.name} sending false classifications!`, r.id);
        }
    }
    clearByzantine() {
        for (const r of this.robots)
            r.isByzantine = false;
        this.addEvent('recovery', 'Byzantine nodes cleared');
    }
    startMission(type) {
        if (!this.deployed)
            this.deploy();
        const state = this.missionManager.startMission(type, this.tick);
        this.addEvent('info', `Mission started: ${type}`);
        return state;
    }
    stopMission() {
        const state = this.missionManager.stopMission();
        this.addEvent('info', 'Mission stopped');
        return state;
    }
    getMissionState() {
        return this.missionManager.getState();
    }
    getMissionHistory() {
        return this.missionManager.getHistory();
    }
    getReplayRange(fromTick, toTick) {
        return this.recorder.getRange(fromTick, toTick);
    }
    getReplayInfo() {
        return this.recorder.getInfo();
    }
    getEventHistory() {
        return [...this.eventHistory];
    }
    // ── Private ───────────────────────────────────────────────
    addEvent(type, message, robotId) {
        const evt = {
            tick: this.tick,
            timeMs: Date.now() - this.startTime,
            type,
            message,
            robotId,
        };
        this.events.push(evt);
        this.eventHistory.push(evt);
        if (this.eventHistory.length > 200) {
            this.eventHistory = this.eventHistory.slice(-200);
        }
    }
    /** Collect active A* paths from all robots for visualization (Task 124) */
    collectRobotPaths() {
        const paths = [];
        for (const r of this.robots) {
            if (r.currentPath.length > 0) {
                paths.push({
                    robotId: r.id,
                    waypoints: r.currentPath.map(w => ({ x: w.x, y: w.y })),
                });
            }
        }
        return paths;
    }
    /** Inter-robot repulsion — prevent overlapping (Task 86) */
    applyRepulsion(dt) {
        for (let i = 0; i < this.robots.length; i++) {
            const a = this.robots[i];
            if (!a.isOnline || a.sizeClass === 'hub' || a.phase === 'charging' || a.isNested)
                continue;
            let repX = 0;
            let repY = 0;
            for (let j = 0; j < this.robots.length; j++) {
                if (i === j)
                    continue;
                const b = this.robots[j];
                if (!b.isOnline || b.sizeClass === 'hub' || b.isNested)
                    continue;
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < REPULSION_DIST && dist > 0.1) {
                    const force = REPULSION_STRENGTH / (dist * dist);
                    repX += (dx / dist) * force;
                    repY += (dy / dist) * force;
                }
            }
            if (repX !== 0 || repY !== 0) {
                const newX = a.position.x + repX * dt;
                const newY = a.position.y + repY * dt;
                const clampedX = Math.max(2, Math.min(MAP_W - 2, newX));
                const clampedY = Math.max(2, Math.min(MAP_H - 2, newY));
                if (this.obstacles.length === 0 || !(0, terrain_1.isInsideObstacle)(clampedX, clampedY, this.obstacles, 1.5)) {
                    a.position = { x: clampedX, y: clampedY };
                }
            }
        }
    }
    /** Compute swarm consensus from BLE-connected robots (Task 87) */
    computeConsensus(bleLinks) {
        // Only compute every 10 ticks
        if (this.tick % 10 !== 0)
            return undefined;
        const onlineRobots = this.robots.filter(r => r.isOnline && !r.isJammed && !r.isByzantine);
        if (onlineRobots.length < 2)
            return undefined;
        // Build connected set from BLE links
        const connected = new Set();
        for (const link of bleLinks) {
            connected.add(link.fromId);
            connected.add(link.toId);
        }
        // Majority vote among connected robots
        const votes = {};
        let totalVoters = 0;
        for (const r of onlineRobots) {
            if (!connected.has(r.id))
                continue;
            const hdc = r.getHdcState();
            const cls = hdc.predictedClass;
            votes[cls] = (votes[cls] || 0) + 1;
            totalVoters++;
        }
        if (totalVoters < 2)
            return undefined;
        // Find majority
        let bestClass = 0;
        let bestCount = 0;
        for (const [cls, count] of Object.entries(votes)) {
            if (count > bestCount) {
                bestCount = count;
                bestClass = parseInt(cls, 10);
            }
        }
        const confidence = totalVoters > 0 ? bestCount / totalVoters : 0;
        // Log high-confidence consensus
        if (confidence > 0.85 && this.tick % 50 === 0) {
            this.addEvent('consensus', `Swarm consensus: ${types_1.SPECIES_NAMES[bestClass]} (${(confidence * 100).toFixed(0)}%, ${totalVoters} voters)`);
        }
        return {
            species: types_1.SPECIES_NAMES[bestClass] ?? 'unknown',
            speciesIndex: bestClass,
            confidence,
            voters: totalVoters,
            totalOnline: onlineRobots.length,
        };
    }
    /** Track HDC classification accuracy during missions (Task 91) */
    trackHdcAccuracy(missionState) {
        if (!missionState.active)
            return;
        for (const target of missionState.targets) {
            if (target.status !== 'detected' && target.status !== 'classified')
                continue;
            for (const robotId of target.detectedBy) {
                const robot = this.robots.find(r => r.id === robotId);
                if (!robot || !robot.isOnline)
                    continue;
                const hdc = robot.getHdcState();
                // Only count once per robot-target pair (use tick modulo to avoid double-counting)
                if (this.tick % 20 === 0) {
                    this.hdcTotalInferences++;
                    const speciesIdx = target.speciesIndex;
                    if (speciesIdx >= 0 && speciesIdx < 6) {
                        this.hdcPerSpecies[speciesIdx].total++;
                        if (hdc.predictedClass === speciesIdx) {
                            this.hdcCorrectClassifications++;
                            this.hdcPerSpecies[speciesIdx].correct++;
                        }
                    }
                }
            }
        }
    }
    getHdcStats() {
        const acc = this.hdcTotalInferences > 0
            ? this.hdcCorrectClassifications / this.hdcTotalInferences
            : 0;
        return {
            totalInferences: this.hdcTotalInferences,
            correctClassifications: this.hdcCorrectClassifications,
            runningAccuracy: Number.isFinite(acc) ? acc : 0,
            perSpecies: this.hdcPerSpecies.map((s, i) => ({
                species: types_1.SPECIES_NAMES[i],
                correct: s.correct,
                total: s.total,
            })),
        };
    }
    autoAssignTargets(targets) {
        const activeTargets = targets.filter(t => t.status === 'active' || t.status === 'detected');
        if (activeTargets.length === 0)
            return;
        if (this.tick % 10 !== 0)
            return;
        const availableRobots = this.robots.filter(r => r.isOnline && !r.isJammed && r.sizeClass !== 'hub' &&
            (r.phase === 'patrol' || r.phase === 'deploying'));
        for (const target of activeTargets) {
            const sorted = [...availableRobots].sort((a, b) => {
                const da = Math.sqrt((a.position.x - target.position.x) ** 2 + (a.position.y - target.position.y) ** 2);
                const db = Math.sqrt((b.position.x - target.position.x) ** 2 + (b.position.y - target.position.y) ** 2);
                return da - db;
            });
            const toAssign = sorted.slice(0, 2);
            for (const robot of toAssign) {
                const dist = Math.sqrt((robot.position.x - target.position.x) ** 2 +
                    (robot.position.y - target.position.y) ** 2);
                if (dist > target.detectionRadius * 1.5) {
                    robot.targetPosition = { ...target.position };
                }
            }
        }
    }
    electCoordinator() {
        const sizeOrder = { hub: 4, large: 3, medium: 2, small: 1 };
        let best = null;
        for (const r of this.robots) {
            r.isCoordinator = false;
            if (!r.isOnline)
                continue;
            if (!best || sizeOrder[r.sizeClass] > sizeOrder[best.sizeClass]) {
                best = r;
            }
        }
        if (best)
            best.isCoordinator = true;
    }
    /* ─── BLE Channel Model: Log-distance path loss + obstacle shadow fading ── */
    /** Gaussian random (Box-Muller) for RSSI noise */
    gaussRandom(sigma) {
        const u1 = Math.random() || 1e-10;
        const u2 = Math.random();
        return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    /** Test if line segment (x1,y1)→(x2,y2) intersects axis-aligned obstacle box */
    lineIntersectsObstacle(x1, y1, x2, y2, o) {
        const minX = o.x - o.width / 2;
        const maxX = o.x + o.width / 2;
        const minY = o.z - o.depth / 2;
        const maxY = o.z + o.depth / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        let tMin = 0, tMax = 1;
        // Slab test for X axis
        if (Math.abs(dx) < 1e-8) {
            if (x1 < minX || x1 > maxX)
                return false;
        }
        else {
            let t1 = (minX - x1) / dx;
            let t2 = (maxX - x1) / dx;
            if (t1 > t2) {
                const tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax)
                return false;
        }
        // Slab test for Y axis
        if (Math.abs(dy) < 1e-8) {
            if (y1 < minY || y1 > maxY)
                return false;
        }
        else {
            let t1 = (minY - y1) / dy;
            let t2 = (maxY - y1) / dy;
            if (t1 > t2) {
                const tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax)
                return false;
        }
        return true;
    }
    computeBleLinks() {
        const RSSI_D0 = -40; // RSSI at 1 meter reference distance
        const PATH_LOSS_N = 2.5; // Path loss exponent (indoor/outdoor mix)
        const NOISE_SIGMA = 4; // Gaussian noise standard deviation (dBm)
        const WALL_ATTN = -8; // Attenuation per obstacle intersection (dBm)
        const DROP_RSSI = -85; // Below this, link is dropped
        const links = [];
        for (let i = 0; i < this.robots.length; i++) {
            const a = this.robots[i];
            if (!a.isOnline || a.isJammed || a.isNested)
                continue;
            for (let j = i + 1; j < this.robots.length; j++) {
                const b = this.robots[j];
                if (!b.isOnline || b.isJammed || b.isNested)
                    continue;
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 0.1)
                    continue; // Same position
                // Log-distance path loss: RSSI = RSSI_d0 - 10*n*log10(d/d0) + noise
                let rssi = RSSI_D0 - 10 * PATH_LOSS_N * Math.log10(dist) + this.gaussRandom(NOISE_SIGMA);
                // Obstacle shadow fading: each intersected obstacle adds attenuation
                for (const obs of this.obstacles) {
                    if (this.lineIntersectsObstacle(a.position.x, a.position.y, b.position.x, b.position.y, obs)) {
                        rssi += WALL_ATTN;
                    }
                }
                // Packet loss probability: sigmoid centered at DROP_RSSI
                const pLoss = 1 / (1 + Math.exp(-0.3 * (rssi + 85)));
                if (pLoss > 0.7)
                    continue; // Too unreliable, drop link
                // Clamp to range check (physical BLE range limit still applies)
                const maxRange = Math.min(types_1.SIZE_PARAMS[a.sizeClass].bleRange, types_1.SIZE_PARAMS[b.sizeClass].bleRange);
                if (dist > maxRange)
                    continue;
                const quality = rssi > -50 ? 'strong' : rssi > -70 ? 'ok' : 'weak';
                links.push({ fromId: a.id, toId: b.id, rssi, quality });
            }
        }
        return links;
    }
    generateFormation(type) {
        const n = this.robots.length;
        const positions = new Array(n).fill(null);
        const cx = HUB_POS.x;
        const cy = HUB_POS.y;
        positions[0] = { x: cx, y: cy };
        const nonHub = this.robots.filter(r => r.sizeClass !== 'hub');
        const count = nonHub.length;
        switch (type) {
            case 'grid': {
                const cols = Math.ceil(Math.sqrt(count));
                const spacing = 12;
                nonHub.forEach((r, i) => {
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    positions[r.id] = {
                        x: cx - (cols * spacing) / 2 + col * spacing + spacing / 2,
                        y: cy - 10 + row * spacing,
                    };
                });
                break;
            }
            case 'ring': {
                const radius = 25;
                nonHub.forEach((r, i) => {
                    const angle = (i / count) * Math.PI * 2;
                    positions[r.id] = {
                        x: cx + radius * Math.cos(angle),
                        y: cy + radius * Math.sin(angle),
                    };
                });
                break;
            }
            case 'wedge': {
                nonHub.forEach((r, i) => {
                    const row = Math.floor((-1 + Math.sqrt(1 + 8 * i)) / 2);
                    const col = i - (row * (row + 1)) / 2;
                    const rowWidth = row + 1;
                    positions[r.id] = {
                        x: cx + row * 8,
                        y: cy + (col - rowWidth / 2) * 10,
                    };
                });
                break;
            }
            case 'cluster': {
                nonHub.forEach((r, i) => {
                    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
                    const dist = 8 + Math.random() * 10;
                    positions[r.id] = {
                        x: cx + dist * Math.cos(angle),
                        y: cy + dist * Math.sin(angle),
                    };
                });
                break;
            }
            default: {
                nonHub.forEach((r, i) => {
                    const angle = (i / count) * Math.PI * 2;
                    const dist = 15 + Math.random() * 20;
                    positions[r.id] = {
                        x: cx + dist * Math.cos(angle),
                        y: cy + dist * Math.sin(angle),
                    };
                });
            }
        }
        return positions;
    }
}
exports.SwarmSimulator = SwarmSimulator;
