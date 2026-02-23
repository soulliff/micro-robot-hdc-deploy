import { Vec2, Formation, SwarmSnapshot, SwarmEvent, TerrainData } from './types';
import { Robot } from './robot';
import { WindField } from './wind';
import { MissionManager, type MissionType, type MissionState } from './mission';
import { Recorder, type RecordedFrame } from './recorder';
export declare class SwarmSimulator {
    readonly robots: Robot[];
    readonly wind: WindField;
    readonly terrain: TerrainData;
    private readonly obstacles;
    private readonly navGrid;
    private tick;
    private startTime;
    private formation;
    private events;
    private eventHistory;
    private deployed;
    readonly missionManager: MissionManager;
    readonly recorder: Recorder;
    private deployStage;
    private deployTriggerTick;
    private recallStage;
    private hdcTotalInferences;
    private hdcCorrectClassifications;
    private hdcPerSpecies;
    constructor();
    step(): SwarmSnapshot;
    deploy(): void;
    /** Cascade deploy tick — called each step to advance stages */
    private tickCascadeDeploy;
    recall(): void;
    /** Cascade recall tick — advances stages as nesting completes */
    private tickCascadeRecall;
    setFormation(type: Formation): void;
    moveRobot(robotId: number, target: Vec2): void;
    setPowerMode(robotId: number, mode: string): void;
    triggerGust(): void;
    injectJamming(): void;
    clearJamming(): void;
    injectNodeFailure(robotId?: number): void;
    recoverNode(robotId: number): void;
    injectByzantine(robotId?: number): void;
    clearByzantine(): void;
    startMission(type: MissionType): MissionState;
    stopMission(): MissionState;
    getMissionState(): MissionState;
    getMissionHistory(): import("./mission").MissionResult[];
    getReplayRange(fromTick: number, toTick: number): RecordedFrame[];
    getReplayInfo(): {
        totalRecorded: number;
        bufferedFrames: number;
        oldestTick: number;
        newestTick: number;
    };
    getEventHistory(): SwarmEvent[];
    private addEvent;
    /** Collect active A* paths from all robots for visualization (Task 124) */
    private collectRobotPaths;
    /** Inter-robot repulsion — prevent overlapping (Task 86) */
    private applyRepulsion;
    /** Compute swarm consensus from BLE-connected robots (Task 87) */
    private computeConsensus;
    /** Track HDC classification accuracy during missions (Task 91) */
    private trackHdcAccuracy;
    private getHdcStats;
    private autoAssignTargets;
    private electCoordinator;
    /** Gaussian random (Box-Muller) for RSSI noise */
    private gaussRandom;
    /** Test if line segment (x1,y1)→(x2,y2) intersects axis-aligned obstacle box */
    private lineIntersectsObstacle;
    private computeBleLinks;
    private generateFormation;
}
