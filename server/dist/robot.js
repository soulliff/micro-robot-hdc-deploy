"use strict";
/* robot.ts — Individual robot: physics, patrol, charging, HDC accumulation */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Robot = void 0;
const types_1 = require("./types");
const hdc_engine_1 = require("./hdc-engine");
const terrain_1 = require("./terrain");
const MAP_W = 120;
const MAP_H = 80;
const HUB_POS = { x: 50, y: 40 };
const LOW_BATTERY_THRESHOLD = 15;
const RECHARGE_TARGET = 80;
/** Tolerance for reaching a waypoint (world units) */
const WAYPOINT_REACH_DIST = 1.0;
/** Tolerance for detecting target change (triggers path recalculation) */
const TARGET_CHANGE_TOLERANCE = 2.0;
class Robot {
    id;
    name;
    sizeClass;
    position;
    velocity = { x: 0, y: 0 };
    heading = 0;
    phase = 'docked';
    targetPosition = null;
    batterySoc = 100;
    solarHarvestMw = 0;
    powerMode = 'FULL';
    estimatedMinutes = 999;
    localWindClass = 'CALM';
    localWindSpeed = 0;
    localWindDirection = 0;
    isCoordinator = false;
    zoneId = -1;
    isOnline = true;
    isJammed = false;
    isByzantine = false;
    tickCount = 0;
    // Nesting (套娃 hierarchy)
    parentId = null;
    childIds = [];
    isNested = false;
    // Three-source energy
    windHarvestMw = 0;
    regenHarvestMw = 0;
    wptReceiveMw = 0;
    wptOutputMw = 0;
    supercapSoc = 0;
    // Patrol (Task 84)
    patrolWaypoints = [];
    currentWaypointIdx = 0;
    preChargeWaypointIdx = 0;
    // A* pathfinding (Task 124)
    currentPath = [];
    cachedTargetX = NaN;
    cachedTargetY = NaN;
    navGrid = null;
    // HDC accumulation (Task 87)
    hdcAccumulator = [];
    hdcAccumulatedFrames = 0;
    accumulatedPrediction = null;
    // Low-battery event throttle
    lowBatteryEventTick = -100;
    obstacles;
    constructor(id, sizeClass, hubPos, obstacles = []) {
        this.id = id;
        this.sizeClass = sizeClass;
        this.name = `R${id}-${sizeClass[0].toUpperCase()}`;
        this.position = { ...hubPos };
        this.obstacles = obstacles;
    }
    /** Set the NavGrid reference for A* pathfinding */
    setNavGrid(grid) {
        this.navGrid = grid;
    }
    /** Generate patrol waypoints for a given zone */
    generatePatrolWaypoints(zoneId) {
        const cols = 3;
        const rows = 2;
        const zoneW = MAP_W / cols;
        const zoneH = MAP_H / rows;
        const col = zoneId % cols;
        const row = Math.floor(zoneId / cols) % rows;
        const baseX = col * zoneW;
        const baseY = row * zoneH;
        this.patrolWaypoints = [];
        const count = 3 + Math.floor(Math.random() * 3); // 3-5 waypoints
        for (let i = 0; i < count; i++) {
            for (let attempt = 0; attempt < 10; attempt++) {
                const x = baseX + 5 + Math.random() * (zoneW - 10);
                const y = baseY + 5 + Math.random() * (zoneH - 10);
                const clamped = { x: clamp(x, 3, MAP_W - 3), y: clamp(y, 3, MAP_H - 3) };
                if (this.obstacles.length === 0 || !(0, terrain_1.isInsideObstacle)(clamped.x, clamped.y, this.obstacles, 2.0)) {
                    this.patrolWaypoints.push(clamped);
                    break;
                }
            }
        }
        // Fallback: ensure at least one waypoint
        if (this.patrolWaypoints.length === 0) {
            this.patrolWaypoints.push({ x: baseX + zoneW / 2, y: baseY + zoneH / 2 });
        }
        this.currentWaypointIdx = 0;
    }
    tick(wind, dt, parentRobot) {
        const result = {};
        if (!this.isOnline)
            return result;
        this.tickCount++;
        // Nested robots: no movement, no energy drain, just track parent position
        if (this.isNested) {
            if (parentRobot) {
                this.position = { ...parentRobot.position };
            }
            this.velocity = { x: 0, y: 0 };
            this.currentPath = [];
            // WPT charging applied externally by wpt.ts
            return result;
        }
        // Wind at our position
        const w = wind.getWindAt(this.position);
        this.localWindSpeed = w.speed;
        this.localWindDirection = w.direction;
        this.localWindClass = wind.classifyWind(w.speed);
        const params = types_1.SIZE_PARAMS[this.sizeClass];
        // Charging phase (Task 85)
        if (this.phase === 'charging') {
            this.velocity = { x: 0, y: 0 };
            this.currentPath = [];
            // Fast charging at hub
            this.batterySoc = Math.min(100, this.batterySoc + params.solarRate * 10);
            this.solarHarvestMw = params.solarRate * 300;
            if (this.batterySoc >= RECHARGE_TARGET) {
                // Recharge complete — redeploy to patrol
                this.phase = 'deploying';
                this.powerMode = 'FULL';
                this.currentWaypointIdx = this.preChargeWaypointIdx;
                if (this.patrolWaypoints.length > 0) {
                    this.targetPosition = { ...this.patrolWaypoints[this.currentWaypointIdx] };
                }
                this.invalidatePathCache();
                result.event = `${this.name} recharged to ${this.batterySoc.toFixed(0)}%, redeploying`;
            }
            return result;
        }
        // Low battery auto-return (Task 85 + Task 142: return to parent for small/medium)
        if (this.sizeClass !== 'hub' && this.batterySoc < LOW_BATTERY_THRESHOLD &&
            this.phase !== 'returning' && this.phase !== 'returning-to-parent' &&
            this.phase !== 'docked' && this.phase !== 'landed' && this.phase !== 'nested') {
            this.preChargeWaypointIdx = this.currentWaypointIdx;
            if (this.parentId !== null && (this.sizeClass === 'small' || this.sizeClass === 'medium')) {
                // Small/Medium return to parent for WPT charging
                this.phase = 'returning-to-parent';
                // Target will be updated each tick by simulator (parent may be moving)
                this.invalidatePathCache();
                if (this.tickCount - this.lowBatteryEventTick > 100) {
                    result.event = `${this.name} low battery (${this.batterySoc.toFixed(0)}%), returning to parent`;
                    this.lowBatteryEventTick = this.tickCount;
                }
            }
            else {
                // Large (or robots without parent) return to hub
                this.phase = 'returning';
                this.targetPosition = { ...HUB_POS };
                this.invalidatePathCache();
                if (this.tickCount - this.lowBatteryEventTick > 100) {
                    result.event = `${this.name} low battery (${this.batterySoc.toFixed(0)}%), returning to hub`;
                    this.lowBatteryEventTick = this.tickCount;
                }
            }
        }
        // Move toward target using A* path-following
        const movingPhases = ['deploying', 'patrol', 'returning', 'deploying-from-parent', 'returning-to-parent'];
        if (this.targetPosition && movingPhases.includes(this.phase)) {
            this.ensurePath();
            this.moveAlongPath(w, params, dt);
        }
        else if (this.phase === 'patrol' && this.patrolWaypoints.length > 0) {
            // No target but in patrol — set next waypoint
            this.advancePatrolWaypoint();
        }
        else {
            this.currentPath = [];
            const drift = w.speed * 0.02;
            this.velocity = {
                x: drift * Math.cos(w.direction),
                y: drift * Math.sin(w.direction),
            };
        }
        // Update position with obstacle avoidance
        const nextX = clamp(this.position.x + this.velocity.x * dt, 2, 118);
        const nextY = clamp(this.position.y + this.velocity.y * dt, 2, 78);
        if (this.obstacles.length > 0 && (0, terrain_1.isInsideObstacle)(nextX, nextY, this.obstacles, 1.5)) {
            const perpX = clamp(this.position.x - this.velocity.y * dt, 2, 118);
            const perpY = clamp(this.position.y + this.velocity.x * dt, 2, 78);
            if (!(0, terrain_1.isInsideObstacle)(perpX, perpY, this.obstacles, 1.5)) {
                this.position = { x: perpX, y: perpY };
            }
        }
        else {
            this.position = { x: nextX, y: nextY };
        }
        // Three-source energy model (套娃)
        let drain = params.batteryDrain;
        if (this.localWindClass === 'MODERATE' || this.localWindClass === 'STRONG') {
            drain *= 2.0;
        }
        if (this.powerMode === 'ECO')
            drain *= 0.5;
        if (this.powerMode === 'CRITICAL')
            drain *= 0.2;
        this.batterySoc = Math.max(0, this.batterySoc - drain);
        // 1. Solar harvest — scales with solarRate, reduced near tall obstacles
        const shadowFactor = this.computeShadowFactor();
        this.solarHarvestMw = params.solarRate * 30 * shadowFactor * (0.8 + 0.4 * Math.random());
        // 2. Wind turbine harvest — windSpeed² × efficiency (zero for small)
        if (params.windTurbineEff > 0 && this.localWindSpeed > 1.0) {
            this.windHarvestMw = params.windTurbineEff * this.localWindSpeed * this.localWindSpeed * 100;
        }
        else {
            this.windHarvestMw = 0;
        }
        // 3. Regenerative propeller — tailwind component only
        if (params.regenPropEff > 0 && this.localWindSpeed > 0.5) {
            const tailwind = Math.max(0, this.localWindSpeed * Math.cos(this.localWindDirection - this.heading));
            this.regenHarvestMw = params.regenPropEff * tailwind * 100;
        }
        else {
            this.regenHarvestMw = 0;
        }
        // Total harvest → battery charge
        const totalHarvestMw = this.solarHarvestMw + this.windHarvestMw + this.regenHarvestMw;
        this.batterySoc = Math.min(100, this.batterySoc + totalHarvestMw * 0.001);
        // Supercap management (small only): discharges to battery when battery < 20%
        if (params.supercapMah > 0 && this.supercapSoc > 0 && this.batterySoc < 20) {
            const transfer = Math.min(this.supercapSoc, 2.0); // 2% per tick
            this.supercapSoc -= transfer;
            this.batterySoc = Math.min(100, this.batterySoc + transfer * 0.5);
        }
        // Auto power mode
        if (this.batterySoc < 5)
            this.powerMode = 'CRITICAL';
        else if (this.batterySoc < 15)
            this.powerMode = 'ECO';
        else if (this.batterySoc < 40)
            this.powerMode = 'NORMAL';
        this.estimatedMinutes = drain > 0 ? Math.round(this.batterySoc / drain * 0.1) : 999;
        // HDC accumulation (Task 87) — every tick, accumulate HD vector
        this.accumulateHdc();
        return result;
    }
    /** Advance to the next patrol waypoint (circular) */
    advancePatrolWaypoint() {
        if (this.patrolWaypoints.length === 0)
            return;
        this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.patrolWaypoints.length;
        this.targetPosition = { ...this.patrolWaypoints[this.currentWaypointIdx] };
        this.invalidatePathCache();
    }
    /** Invalidate the cached A* path so it is recomputed on the next tick */
    invalidatePathCache() {
        this.cachedTargetX = NaN;
        this.cachedTargetY = NaN;
        this.currentPath = [];
    }
    /**
     * Ensure we have a valid A* path to the current target.
     * Recomputes if the target has moved beyond tolerance or if no path is cached.
     */
    ensurePath() {
        if (!this.targetPosition)
            return;
        const tx = this.targetPosition.x;
        const ty = this.targetPosition.y;
        // Check if target changed significantly
        const targetChanged = isNaN(this.cachedTargetX) ||
            Math.abs(tx - this.cachedTargetX) > TARGET_CHANGE_TOLERANCE ||
            Math.abs(ty - this.cachedTargetY) > TARGET_CHANGE_TOLERANCE;
        if (targetChanged || this.currentPath.length === 0) {
            this.cachedTargetX = tx;
            this.cachedTargetY = ty;
            if (this.navGrid) {
                this.currentPath = this.navGrid.findPath(this.position.x, this.position.y, tx, ty);
            }
            else {
                // No navGrid available — straight line fallback
                this.currentPath = [{ x: tx, y: ty }];
            }
        }
    }
    /**
     * Move along the A* path, advancing to the next waypoint when close enough.
     * Falls back to direct movement toward the ultimate target if path is empty.
     */
    moveAlongPath(w, params, _dt) {
        // Determine the immediate movement goal
        let goalX;
        let goalY;
        if (this.currentPath.length > 0) {
            // Move toward the first waypoint in the path
            goalX = this.currentPath[0].x;
            goalY = this.currentPath[0].y;
            // Check if we've reached this waypoint
            const dxWp = goalX - this.position.x;
            const dyWp = goalY - this.position.y;
            const distWp = Math.sqrt(dxWp * dxWp + dyWp * dyWp);
            if (distWp <= WAYPOINT_REACH_DIST) {
                // Remove this waypoint and advance
                this.currentPath = this.currentPath.slice(1);
                if (this.currentPath.length > 0) {
                    goalX = this.currentPath[0].x;
                    goalY = this.currentPath[0].y;
                }
                else if (this.targetPosition) {
                    goalX = this.targetPosition.x;
                    goalY = this.targetPosition.y;
                }
                else {
                    this.velocity = { x: 0, y: 0 };
                    return;
                }
            }
        }
        else if (this.targetPosition) {
            // Fallback: direct movement to target (same as original behavior)
            goalX = this.targetPosition.x;
            goalY = this.targetPosition.y;
        }
        else {
            this.velocity = { x: 0, y: 0 };
            return;
        }
        const dx = goalX - this.position.x;
        const dy = goalY - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > WAYPOINT_REACH_DIST) {
            const desiredAngle = Math.atan2(dy, dx);
            this.heading = desiredAngle;
            let speed = Math.min(params.maxSpeed, Math.max(1.5, dist * 0.3));
            const headwindFactor = Math.cos(w.direction - desiredAngle);
            if (headwindFactor > 0) {
                speed *= Math.max(0.3, 1.0 - headwindFactor * w.speed * 0.1);
            }
            const windForce = w.speed * 0.15 * (this.sizeClass === 'small' ? 2.0 : 1.0);
            this.velocity = {
                x: speed * Math.cos(desiredAngle) + windForce * Math.cos(w.direction),
                y: speed * Math.sin(desiredAngle) + windForce * Math.sin(w.direction),
            };
        }
        else {
            this.velocity = { x: 0, y: 0 };
            this.currentPath = [];
            if (this.phase === 'deploying' || this.phase === 'deploying-from-parent') {
                this.phase = 'patrol';
                // Start patrol cycle (Task 84)
                this.advancePatrolWaypoint();
            }
            else if (this.phase === 'returning') {
                // Arrived at hub — start charging (Task 85)
                if (this.batterySoc < RECHARGE_TARGET) {
                    this.phase = 'charging';
                }
                else {
                    this.phase = 'landed';
                }
            }
            else if (this.phase === 'returning-to-parent') {
                // Auto-nest is handled by simulator; if we arrive here just stop
                this.velocity = { x: 0, y: 0 };
            }
            else if (this.phase === 'patrol') {
                // Reached patrol waypoint — advance to next (Task 84)
                this.advancePatrolWaypoint();
            }
        }
    }
    /** Accumulate HDC vectors for multi-frame classification (Task 87) */
    accumulateHdc() {
        const hdc = this.getHdcState();
        const vec = hdc.hdVector;
        if (this.hdcAccumulator.length === 0) {
            this.hdcAccumulator = [...vec];
        }
        else {
            for (let i = 0; i < vec.length && i < this.hdcAccumulator.length; i++) {
                this.hdcAccumulator[i] += vec[i];
            }
        }
        this.hdcAccumulatedFrames++;
        // Every 10 frames, classify the accumulated vector
        if (this.hdcAccumulatedFrames % 10 === 0) {
            const hdc2 = this.getHdcState();
            // The accumulated prediction should be more confident
            const accConfidence = Math.min(0.99, hdc2.confidence + Math.log10(this.hdcAccumulatedFrames) * 0.05);
            this.accumulatedPrediction = {
                predictedClass: hdc2.predictedClass,
                confidence: accConfidence,
                predictedName: hdc2.predictedName,
            };
        }
    }
    /** Compute solar shadow factor: reduced near tall obstacles (buildings) */
    computeShadowFactor() {
        if (this.obstacles.length === 0)
            return 1.0;
        for (const o of this.obstacles) {
            if (o.type !== 'building')
                continue;
            const dx = this.position.x - o.x;
            const dy = this.position.y - o.z; // terrain uses z for y
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5.0)
                return 0.3; // shadowed by tall building
        }
        return 1.0;
    }
    // ── Nesting mechanics (套娃) ──────────────────────────────
    /** Nest this robot inside a parent carrier */
    nestInto(parent) {
        this.phase = 'nested';
        this.isNested = true;
        this.parentId = parent.id;
        this.position = { ...parent.position };
        this.velocity = { x: 0, y: 0 };
        this.currentPath = [];
        this.targetPosition = null;
        if (!parent.childIds.includes(this.id)) {
            parent.childIds = [...parent.childIds, this.id];
        }
    }
    /** Unnest this robot from parent and deploy with offset */
    unnestFrom(parent, deployOffset) {
        this.phase = 'deploying-from-parent';
        this.isNested = false;
        this.position = {
            x: parent.position.x + deployOffset.x,
            y: parent.position.y + deployOffset.y,
        };
        parent.childIds = parent.childIds.filter(id => id !== this.id);
        // Target will be set by the caller (patrol waypoint or formation position)
    }
    /** Begin returning to parent robot */
    returnToParent(parent) {
        this.phase = 'returning-to-parent';
        this.targetPosition = { ...parent.position };
        this.invalidatePathCache();
    }
    /** Check if close enough to parent to auto-nest */
    checkAutoNest(parent) {
        const dx = this.position.x - parent.position.x;
        const dy = this.position.y - parent.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3.0) {
            this.nestInto(parent);
            return true;
        }
        return false;
    }
    /** Reset accumulator (called when zone changes significantly) */
    resetAccumulator() {
        this.hdcAccumulator = [];
        this.hdcAccumulatedFrames = 0;
        this.accumulatedPrediction = null;
    }
    getHdcState() {
        return hdc_engine_1.hdcEngine.inferHdcState(this.id, this.position.x, this.position.y, this.tickCount, this.isByzantine);
    }
    getState() {
        return {
            id: this.id,
            name: this.name,
            sizeClass: this.sizeClass,
            phase: this.phase,
            position: { ...this.position },
            velocity: { ...this.velocity },
            heading: this.heading,
            speed: Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2),
            targetPosition: this.targetPosition ? { ...this.targetPosition } : null,
            batterySoc: this.batterySoc,
            solarHarvestMw: this.solarHarvestMw,
            powerMode: this.powerMode,
            estimatedMinutes: this.estimatedMinutes,
            localWindClass: this.localWindClass,
            localWindSpeed: this.localWindSpeed,
            localWindDirection: this.localWindDirection,
            hdc: this.getHdcState(),
            isCoordinator: this.isCoordinator,
            zoneId: this.zoneId,
            bleRangeM: types_1.SIZE_PARAMS[this.sizeClass].bleRange,
            parentId: this.parentId,
            childIds: [...this.childIds],
            isNested: this.isNested,
            windHarvestMw: this.windHarvestMw,
            regenHarvestMw: this.regenHarvestMw,
            wptReceiveMw: this.wptReceiveMw,
            wptOutputMw: this.wptOutputMw,
            supercapSoc: this.supercapSoc,
            isOnline: this.isOnline,
            isJammed: this.isJammed,
            isByzantine: this.isByzantine,
            tickCount: this.tickCount,
        };
    }
}
exports.Robot = Robot;
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
