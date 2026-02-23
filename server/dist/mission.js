"use strict";
/**
 * mission.ts — Mission system with 4 distinct mission types
 *
 * survey:          Even coverage of all 6 zones, coverage-based scoring
 * intercept:       Fast-moving targets, small detection radius, double points
 * search_classify: Standard baseline (zone-based spawning, normal scoring)
 * perimeter:       Targets only on map edges, requires 3-robot consensus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionManager = void 0;
const types_1 = require("./types");
/* ─── Constants ────────────────────────────────────────────── */
const MAP_W = 120;
const MAP_H = 80;
const MISSION_DURATION_TICKS = 600; // 60 seconds at 10Hz
const TYPE_CONFIGS = {
    search_classify: {
        targetLifetimeTicks: 300,
        detectionRadius: 12,
        spawnIntervalTicks: 35,
        maxActiveTargets: 6,
        consensusRequired: 2,
        driftMultiplier: 0.8,
        scorePerClassified: 100,
        penaltyPerExpired: 10,
        initialTargets: 3,
    },
    survey: {
        targetLifetimeTicks: 250, // longer lifetime — area coverage focus
        detectionRadius: 10, // slightly larger detection radius
        spawnIntervalTicks: 25, // faster spawning
        maxActiveTargets: 8, // more simultaneous targets
        consensusRequired: 1, // single robot can classify
        driftMultiplier: 0.3, // targets barely move
        scorePerClassified: 80, // lower per-target score
        penaltyPerExpired: 30, // higher penalty for missing zones
        initialTargets: 6, // one per zone at start
    },
    intercept: {
        targetLifetimeTicks: 150, // slightly longer to give robots a chance
        detectionRadius: 7, // slightly larger detection radius
        spawnIntervalTicks: 25, // less frantic spawning
        maxActiveTargets: 5,
        consensusRequired: 2,
        driftMultiplier: 3, // still fast, but catchable
        scorePerClassified: 200, // double points — difficulty reward
        penaltyPerExpired: 5, // low penalty (expected to miss some)
        initialTargets: 2,
    },
    perimeter: {
        targetLifetimeTicks: 180,
        detectionRadius: 8,
        spawnIntervalTicks: 35,
        maxActiveTargets: 6,
        consensusRequired: 3, // requires 3-robot consensus
        driftMultiplier: 1.5, // moderate movement along edges
        scorePerClassified: 150, // bonus for difficulty
        penaltyPerExpired: 25,
        initialTargets: 4,
    },
};
/* ─── Mission Manager ──────────────────────────────────────── */
class MissionManager {
    state = {
        active: false,
        type: 'intercept',
        targets: [],
        score: 0,
        totalTargets: 0,
        classified: 0,
        expired: 0,
        startTick: 0,
        endTick: 0,
        timeRemainingMs: 0,
    };
    history = [];
    nextTargetId = 1;
    lastSpawnTick = 0;
    surveyZonesUsed = new Set();
    rng;
    constructor() {
        let seed = 12345;
        this.rng = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
    }
    get config() {
        return TYPE_CONFIGS[this.state.type];
    }
    startMission(type, currentTick) {
        this.state = {
            active: true,
            type,
            targets: [],
            score: 0,
            totalTargets: 0,
            classified: 0,
            expired: 0,
            startTick: currentTick,
            endTick: currentTick + MISSION_DURATION_TICKS,
            timeRemainingMs: MISSION_DURATION_TICKS * 100,
        };
        this.nextTargetId = 1;
        this.lastSpawnTick = currentTick;
        this.surveyZonesUsed = new Set();
        const cfg = this.config;
        // Survey: spawn one target per zone initially
        if (type === 'survey') {
            for (let zone = 0; zone < 6; zone++) {
                this.spawnTargetInZone(currentTick, zone);
            }
        }
        else {
            for (let i = 0; i < cfg.initialTargets; i++) {
                this.spawnTarget(currentTick);
            }
        }
        return { ...this.state, targets: this.state.targets.map(t => ({ ...t })) };
    }
    stopMission() {
        this.recordResult();
        this.state = { ...this.state, active: false };
        return { ...this.state, targets: this.state.targets.map(t => ({ ...t })) };
    }
    update(currentTick, robots) {
        if (!this.state.active) {
            return { ...this.state, targets: [] };
        }
        // Check mission timeout
        if (currentTick >= this.state.endTick) {
            this.recordResult();
            this.state = { ...this.state, active: false };
            return { ...this.state, targets: this.state.targets.map(t => ({ ...t })) };
        }
        this.state = {
            ...this.state,
            timeRemainingMs: (this.state.endTick - currentTick) * 100,
        };
        const cfg = this.config;
        // Spawn new targets periodically
        const activeTargets = this.state.targets.filter(t => t.status === 'active' || t.status === 'detected');
        if (currentTick - this.lastSpawnTick >= cfg.spawnIntervalTicks &&
            activeTargets.length < cfg.maxActiveTargets) {
            this.spawnTarget(currentTick);
            this.lastSpawnTick = currentTick;
        }
        // Update targets: drift, detection, classification, expiration
        const updatedTargets = this.state.targets.map(target => {
            if (target.status === 'classified' || target.status === 'expired') {
                return target;
            }
            if (currentTick >= target.expiresAtTick) {
                return { ...target, status: 'expired' };
            }
            // Drift movement
            const newPos = {
                x: Math.max(5, Math.min(MAP_W - 5, target.position.x + target.drift.x)),
                y: Math.max(5, Math.min(MAP_H - 5, target.position.y + target.drift.y)),
            };
            // Perimeter targets: keep near edges
            if (this.state.type === 'perimeter') {
                const edgeDist = Math.min(newPos.x, MAP_W - newPos.x, newPos.y, MAP_H - newPos.y);
                if (edgeDist > 25) {
                    // Push back toward nearest edge
                    const toEdge = 0.3;
                    if (newPos.x > MAP_W / 2)
                        newPos.x += toEdge;
                    else
                        newPos.x -= toEdge;
                }
            }
            let newDetectedBy = [...target.detectedBy];
            let newClassifiedBy = [...target.classifiedBy];
            let newStatus = target.status;
            for (const robot of robots) {
                if (!robot.isOnline || robot.isJammed)
                    continue;
                const dx = robot.position.x - newPos.x;
                const dy = robot.position.y - newPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < target.detectionRadius) {
                    if (!newDetectedBy.includes(robot.id)) {
                        newDetectedBy = [...newDetectedBy, robot.id];
                    }
                    if (newStatus === 'active') {
                        newStatus = 'detected';
                    }
                    const hdcState = robot.getHdcState();
                    if (hdcState.predictedClass === target.speciesIndex &&
                        !newClassifiedBy.includes(robot.id)) {
                        newClassifiedBy = [...newClassifiedBy, robot.id];
                    }
                    if (newClassifiedBy.length >= cfg.consensusRequired && newStatus !== 'classified') {
                        newStatus = 'classified';
                    }
                }
            }
            return {
                ...target,
                position: newPos,
                status: newStatus,
                detectedBy: newDetectedBy,
                classifiedBy: newClassifiedBy,
            };
        });
        const classified = updatedTargets.filter(t => t.status === 'classified').length;
        const expired = updatedTargets.filter(t => t.status === 'expired').length;
        // Score calculation — type-specific
        let score = Math.max(0, classified * cfg.scorePerClassified - expired * cfg.penaltyPerExpired);
        // Survey bonus: extra points for zone coverage
        if (this.state.type === 'survey') {
            const classifiedZones = new Set();
            for (const t of updatedTargets) {
                if (t.status === 'classified') {
                    classifiedZones.add(t.speciesIndex);
                }
            }
            // +50 bonus per unique zone covered
            score += classifiedZones.size * 50;
        }
        this.state = {
            ...this.state,
            targets: updatedTargets,
            classified,
            expired,
            score,
        };
        return { ...this.state, targets: updatedTargets.map(t => ({ ...t })) };
    }
    getState() {
        return { ...this.state, targets: this.state.targets.map(t => ({ ...t })) };
    }
    getHistory() {
        return [...this.history];
    }
    recordResult() {
        if (!this.state.active)
            return;
        this.history.push({
            type: this.state.type,
            score: this.state.score,
            classified: this.state.classified,
            expired: this.state.expired,
            totalTargets: this.state.totalTargets,
            durationMs: this.state.timeRemainingMs > 0
                ? (MISSION_DURATION_TICKS * 100 - this.state.timeRemainingMs)
                : MISSION_DURATION_TICKS * 100,
            timestamp: Date.now(),
        });
        // Keep last 20 results
        if (this.history.length > 20) {
            this.history.splice(0, this.history.length - 20);
        }
    }
    spawnTarget(currentTick) {
        if (this.state.type === 'perimeter') {
            this.spawnPerimeterTarget(currentTick);
        }
        else if (this.state.type === 'survey') {
            // Survey: ensure zone coverage — pick zone with fewest active targets
            const zoneCounts = new Array(6).fill(0);
            for (const t of this.state.targets) {
                if (t.status === 'active' || t.status === 'detected') {
                    zoneCounts[t.speciesIndex]++;
                }
            }
            const minCount = Math.min(...zoneCounts);
            const candidates = zoneCounts.reduce((acc, c, i) => {
                if (c === minCount)
                    acc.push(i);
                return acc;
            }, []);
            const zone = candidates[Math.floor(this.rng() * candidates.length)];
            this.spawnTargetInZone(currentTick, zone);
        }
        else {
            this.spawnStandardTarget(currentTick);
        }
    }
    spawnStandardTarget(currentTick) {
        const cfg = this.config;
        const speciesIndex = Math.floor(this.rng() * 6);
        const col = speciesIndex % 3;
        const row = Math.floor(speciesIndex / 3);
        const zoneW = MAP_W / 3;
        const zoneH = MAP_H / 2;
        const x = col * zoneW + this.rng() * zoneW;
        const y = row * zoneH + this.rng() * zoneH;
        const baseDrift = 0.08 * cfg.driftMultiplier;
        const target = {
            id: this.nextTargetId++,
            position: { x: Math.max(5, Math.min(MAP_W - 5, x)), y: Math.max(5, Math.min(MAP_H - 5, y)) },
            speciesIndex,
            speciesName: types_1.SPECIES_NAMES[speciesIndex],
            detectionRadius: cfg.detectionRadius,
            status: 'active',
            detectedBy: [],
            classifiedBy: [],
            spawnTick: currentTick,
            expiresAtTick: currentTick + cfg.targetLifetimeTicks,
            drift: {
                x: (this.rng() - 0.5) * baseDrift,
                y: (this.rng() - 0.5) * baseDrift,
            },
        };
        this.state = {
            ...this.state,
            targets: [...this.state.targets, target],
            totalTargets: this.state.totalTargets + 1,
        };
    }
    spawnTargetInZone(currentTick, zone) {
        const cfg = this.config;
        const col = zone % 3;
        const row = Math.floor(zone / 3);
        const zoneW = MAP_W / 3;
        const zoneH = MAP_H / 2;
        const x = col * zoneW + this.rng() * zoneW;
        const y = row * zoneH + this.rng() * zoneH;
        const baseDrift = 0.08 * cfg.driftMultiplier;
        const target = {
            id: this.nextTargetId++,
            position: { x: Math.max(5, Math.min(MAP_W - 5, x)), y: Math.max(5, Math.min(MAP_H - 5, y)) },
            speciesIndex: zone,
            speciesName: types_1.SPECIES_NAMES[zone],
            detectionRadius: cfg.detectionRadius,
            status: 'active',
            detectedBy: [],
            classifiedBy: [],
            spawnTick: currentTick,
            expiresAtTick: currentTick + cfg.targetLifetimeTicks,
            drift: {
                x: (this.rng() - 0.5) * baseDrift,
                y: (this.rng() - 0.5) * baseDrift,
            },
        };
        this.state = {
            ...this.state,
            targets: [...this.state.targets, target],
            totalTargets: this.state.totalTargets + 1,
        };
    }
    spawnPerimeterTarget(currentTick) {
        const cfg = this.config;
        const speciesIndex = Math.floor(this.rng() * 6);
        const edgeMargin = 20;
        // Pick a random edge: 0=top, 1=right, 2=bottom, 3=left
        const edge = Math.floor(this.rng() * 4);
        let x, y;
        switch (edge) {
            case 0: // top
                x = 5 + this.rng() * (MAP_W - 10);
                y = 5 + this.rng() * edgeMargin;
                break;
            case 1: // right
                x = MAP_W - 5 - this.rng() * edgeMargin;
                y = 5 + this.rng() * (MAP_H - 10);
                break;
            case 2: // bottom
                x = 5 + this.rng() * (MAP_W - 10);
                y = MAP_H - 5 - this.rng() * edgeMargin;
                break;
            default: // left
                x = 5 + this.rng() * edgeMargin;
                y = 5 + this.rng() * (MAP_H - 10);
                break;
        }
        const baseDrift = 0.08 * cfg.driftMultiplier;
        // Perimeter targets drift along edges
        const tangentAngle = edge % 2 === 0 ? 0 : Math.PI / 2;
        const driftAngle = tangentAngle + (this.rng() - 0.5) * 0.5;
        const target = {
            id: this.nextTargetId++,
            position: { x, y },
            speciesIndex,
            speciesName: types_1.SPECIES_NAMES[speciesIndex],
            detectionRadius: cfg.detectionRadius,
            status: 'active',
            detectedBy: [],
            classifiedBy: [],
            spawnTick: currentTick,
            expiresAtTick: currentTick + cfg.targetLifetimeTicks,
            drift: {
                x: Math.cos(driftAngle) * baseDrift,
                y: Math.sin(driftAngle) * baseDrift,
            },
        };
        this.state = {
            ...this.state,
            targets: [...this.state.targets, target],
            totalTargets: this.state.totalTargets + 1,
        };
    }
}
exports.MissionManager = MissionManager;
