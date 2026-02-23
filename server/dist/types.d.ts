export type SizeClass = 'small' | 'medium' | 'large' | 'hub';
export type WindClass = 'CALM' | 'LIGHT' | 'MODERATE' | 'STRONG';
export type PowerMode = 'FULL' | 'NORMAL' | 'ECO' | 'CRITICAL';
export type RobotPhase = 'docked' | 'deploying' | 'patrol' | 'returning' | 'landed' | 'charging' | 'nested' | 'deploying-from-parent' | 'returning-to-parent' | 'wpt-charging';
export type Formation = 'scatter' | 'grid' | 'ring' | 'wedge' | 'cluster';
export interface Vec2 {
    x: number;
    y: number;
}
export interface WindState {
    baseDirection: number;
    baseSpeed: number;
    gustActive: boolean;
    gustCenter: Vec2;
    gustRadius: number;
    gustSpeed: number;
    windClass: WindClass;
}
export interface BleLink {
    fromId: number;
    toId: number;
    rssi: number;
    quality: 'strong' | 'ok' | 'weak';
}
export interface HdcState {
    melFeatures: number[];
    hiddenActivations: number[];
    hdVector: number[];
    classSimilarities: number[];
    predictedClass: number;
    predictedName: string;
    confidence: number;
}
export interface RobotState {
    id: number;
    name: string;
    sizeClass: SizeClass;
    phase: RobotPhase;
    position: Vec2;
    velocity: Vec2;
    heading: number;
    speed: number;
    targetPosition: Vec2 | null;
    batterySoc: number;
    solarHarvestMw: number;
    powerMode: PowerMode;
    estimatedMinutes: number;
    localWindClass: WindClass;
    localWindSpeed: number;
    localWindDirection: number;
    hdc: HdcState;
    isCoordinator: boolean;
    zoneId: number;
    bleRangeM: number;
    parentId: number | null;
    childIds: number[];
    isNested: boolean;
    windHarvestMw: number;
    regenHarvestMw: number;
    wptReceiveMw: number;
    wptOutputMw: number;
    supercapSoc: number;
    isOnline: boolean;
    isJammed: boolean;
    isByzantine: boolean;
    tickCount: number;
}
export interface MissionTargetState {
    id: number;
    position: Vec2;
    speciesIndex: number;
    speciesName: string;
    detectionRadius: number;
    status: 'active' | 'detected' | 'classified' | 'expired';
    detectedBy: number[];
    classifiedBy: number[];
}
export interface MissionInfo {
    active: boolean;
    type: string;
    targets: MissionTargetState[];
    score: number;
    totalTargets: number;
    classified: number;
    expired: number;
    timeRemainingMs: number;
}
export interface EnergyFlowLink {
    fromId: number;
    toId: number;
    powerMw: number;
    type: 'wpt' | 'solar' | 'wind';
}
export interface SwarmSnapshot {
    tick: number;
    timeMs: number;
    formation: Formation;
    robots: RobotState[];
    wind: WindState;
    bleLinks: BleLink[];
    events: SwarmEvent[];
    stats: SwarmStats;
    mission?: MissionInfo;
    paths?: {
        robotId: number;
        waypoints: Vec2[];
    }[];
    energyFlows?: EnergyFlowLink[];
}
export interface SwarmEvent {
    tick: number;
    timeMs: number;
    type: 'deploy' | 'recall' | 'formation' | 'wind_change' | 'low_battery' | 'consensus' | 'jamming' | 'node_fail' | 'byzantine' | 'recovery' | 'info';
    message: string;
    robotId?: number;
}
export interface SwarmConsensus {
    species: string;
    speciesIndex: number;
    confidence: number;
    voters: number;
    totalOnline: number;
}
export interface HdcStats {
    totalInferences: number;
    correctClassifications: number;
    runningAccuracy: number;
    perSpecies: {
        species: string;
        correct: number;
        total: number;
    }[];
}
export interface NestingStats {
    deployed: number;
    nested: number;
    wptCharging: number;
}
export interface SwarmStats {
    totalRobots: number;
    onlineRobots: number;
    chargingRobots: number;
    avgBatterySoc: number;
    windClass: WindClass;
    formation: Formation;
    coordinatorId: number;
    uptimeSeconds: number;
    consensus?: SwarmConsensus;
    hdcStats?: HdcStats;
    nestingStats?: NestingStats;
}
export declare const SPECIES_NAMES: string[];
export declare const SPECIES_COLORS: string[];
export interface TerrainObstacle {
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    type: 'building' | 'tree' | 'rock';
}
export interface TerrainData {
    heightMap: number[][];
    rows: number;
    cols: number;
    maxHeight: number;
    obstacles: TerrainObstacle[];
}
export interface SizeClassParams {
    bleRange: number;
    maxSpeed: number;
    batteryDrain: number;
    solarRate: number;
    radius: number;
    windTurbineEff: number;
    regenPropEff: number;
    wptOutputMw: number;
    wptRangeM: number;
    maxChildren: number;
    supercapMah: number;
}
export declare const SIZE_PARAMS: Record<SizeClass, SizeClassParams>;
