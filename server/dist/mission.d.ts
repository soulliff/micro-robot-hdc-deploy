/**
 * mission.ts — Mission system with 4 distinct mission types
 *
 * survey:          Even coverage of all 6 zones, coverage-based scoring
 * intercept:       Fast-moving targets, small detection radius, double points
 * search_classify: Standard baseline (zone-based spawning, normal scoring)
 * perimeter:       Targets only on map edges, requires 3-robot consensus
 */
import { Vec2 } from './types';
import { Robot } from './robot';
export type MissionType = 'survey' | 'intercept' | 'search_classify' | 'perimeter';
export type TargetStatus = 'active' | 'detected' | 'classified' | 'expired';
export interface MissionTarget {
    id: number;
    position: Vec2;
    speciesIndex: number;
    speciesName: string;
    detectionRadius: number;
    status: TargetStatus;
    detectedBy: number[];
    classifiedBy: number[];
    spawnTick: number;
    expiresAtTick: number;
    drift: Vec2;
}
export interface MissionState {
    active: boolean;
    type: MissionType;
    targets: MissionTarget[];
    score: number;
    totalTargets: number;
    classified: number;
    expired: number;
    startTick: number;
    endTick: number;
    timeRemainingMs: number;
}
export interface MissionResult {
    type: MissionType;
    score: number;
    classified: number;
    expired: number;
    totalTargets: number;
    durationMs: number;
    timestamp: number;
}
export declare class MissionManager {
    private state;
    readonly history: MissionResult[];
    private nextTargetId;
    private lastSpawnTick;
    private surveyZonesUsed;
    private rng;
    constructor();
    private get config();
    startMission(type: MissionType, currentTick: number): MissionState;
    stopMission(): MissionState;
    update(currentTick: number, robots: Robot[]): MissionState;
    getState(): MissionState;
    getHistory(): MissionResult[];
    private recordResult;
    private spawnTarget;
    private spawnStandardTarget;
    private spawnTargetInZone;
    private spawnPerimeterTarget;
}
