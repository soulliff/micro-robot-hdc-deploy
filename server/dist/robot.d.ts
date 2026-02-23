import { Vec2, SizeClass, RobotPhase, PowerMode, WindClass, RobotState } from './types';
import { WindField } from './wind';
import { type Obstacle } from './terrain';
import { NavGrid } from './pathfinding';
export declare class Robot {
    readonly id: number;
    readonly name: string;
    readonly sizeClass: SizeClass;
    position: Vec2;
    velocity: Vec2;
    heading: number;
    phase: RobotPhase;
    targetPosition: Vec2 | null;
    batterySoc: number;
    solarHarvestMw: number;
    powerMode: PowerMode;
    estimatedMinutes: number;
    localWindClass: WindClass;
    localWindSpeed: number;
    localWindDirection: number;
    isCoordinator: boolean;
    zoneId: number;
    isOnline: boolean;
    isJammed: boolean;
    isByzantine: boolean;
    tickCount: number;
    parentId: number | null;
    childIds: number[];
    isNested: boolean;
    windHarvestMw: number;
    regenHarvestMw: number;
    wptReceiveMw: number;
    wptOutputMw: number;
    supercapSoc: number;
    patrolWaypoints: Vec2[];
    currentWaypointIdx: number;
    preChargeWaypointIdx: number;
    currentPath: Vec2[];
    private cachedTargetX;
    private cachedTargetY;
    private navGrid;
    hdcAccumulator: number[];
    hdcAccumulatedFrames: number;
    accumulatedPrediction: {
        predictedClass: number;
        confidence: number;
        predictedName: string;
    } | null;
    private lowBatteryEventTick;
    private readonly obstacles;
    constructor(id: number, sizeClass: SizeClass, hubPos: Vec2, obstacles?: Obstacle[]);
    /** Set the NavGrid reference for A* pathfinding */
    setNavGrid(grid: NavGrid): void;
    /** Generate patrol waypoints for a given zone */
    generatePatrolWaypoints(zoneId: number): void;
    tick(wind: WindField, dt: number, parentRobot?: Robot): {
        event?: string;
    };
    /** Advance to the next patrol waypoint (circular) */
    private advancePatrolWaypoint;
    /** Invalidate the cached A* path so it is recomputed on the next tick */
    private invalidatePathCache;
    /**
     * Ensure we have a valid A* path to the current target.
     * Recomputes if the target has moved beyond tolerance or if no path is cached.
     */
    private ensurePath;
    /**
     * Move along the A* path, advancing to the next waypoint when close enough.
     * Falls back to direct movement toward the ultimate target if path is empty.
     */
    private moveAlongPath;
    /** Accumulate HDC vectors for multi-frame classification (Task 87) */
    private accumulateHdc;
    /** Compute solar shadow factor: reduced near tall obstacles (buildings) */
    private computeShadowFactor;
    /** Nest this robot inside a parent carrier */
    nestInto(parent: Robot): void;
    /** Unnest this robot from parent and deploy with offset */
    unnestFrom(parent: Robot, deployOffset: Vec2): void;
    /** Begin returning to parent robot */
    returnToParent(parent: Robot): void;
    /** Check if close enough to parent to auto-nest */
    checkAutoNest(parent: Robot): boolean;
    /** Reset accumulator (called when zone changes significantly) */
    resetAccumulator(): void;
    getHdcState(): import("./types").HdcState;
    getState(): RobotState;
}
