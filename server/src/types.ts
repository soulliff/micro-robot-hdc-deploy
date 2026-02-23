/* types.ts — Shared TypeScript types for swarm simulation */

export type SizeClass = 'small' | 'medium' | 'large' | 'hub';
export type WindClass = 'CALM' | 'LIGHT' | 'MODERATE' | 'STRONG';
export type PowerMode = 'FULL' | 'NORMAL' | 'ECO' | 'CRITICAL';
export type RobotPhase = 'docked' | 'deploying' | 'patrol' | 'returning' | 'landed' | 'charging'
  | 'nested' | 'deploying-from-parent' | 'returning-to-parent' | 'wpt-charging';
export type Formation = 'scatter' | 'grid' | 'ring' | 'wedge' | 'cluster';

export interface Vec2 {
  x: number;
  y: number;
}

export interface WindState {
  baseDirection: number;   // radians
  baseSpeed: number;       // m/s
  gustActive: boolean;
  gustCenter: Vec2;
  gustRadius: number;
  gustSpeed: number;
  windClass: WindClass;
}

export interface BleLink {
  fromId: number;
  toId: number;
  rssi: number;   // dBm (-30 to -90)
  quality: 'strong' | 'ok' | 'weak';
}

export interface HdcState {
  melFeatures: number[];        // 32 bins
  hiddenActivations: number[];  // 64 dims
  hdVector: number[];           // 64 dims (packed for display)
  classSimilarities: number[];  // 6 classes
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
  heading: number;         // radians
  speed: number;           // m/s
  targetPosition: Vec2 | null;

  // Energy
  batterySoc: number;      // 0-100%
  solarHarvestMw: number;
  powerMode: PowerMode;
  estimatedMinutes: number;

  // Wind
  localWindClass: WindClass;
  localWindSpeed: number;
  localWindDirection: number;

  // HDC inference (simulated)
  hdc: HdcState;

  // Swarm
  isCoordinator: boolean;
  zoneId: number;
  bleRangeM: number;

  // Nesting (套娃 hierarchy)
  parentId: number | null;
  childIds: number[];
  isNested: boolean;

  // Three-source energy
  windHarvestMw: number;
  regenHarvestMw: number;
  wptReceiveMw: number;
  wptOutputMw: number;
  supercapSoc: number;       // 0-100, small only

  // Status
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
  paths?: { robotId: number; waypoints: Vec2[] }[];
  energyFlows?: EnergyFlowLink[];
}

export interface SwarmEvent {
  tick: number;
  timeMs: number;
  type: 'deploy' | 'recall' | 'formation' | 'wind_change' | 'low_battery'
      | 'consensus' | 'jamming' | 'node_fail' | 'byzantine' | 'recovery' | 'info';
  message: string;
  robotId?: number;
}

export interface SwarmConsensus {
  species: string;
  speciesIndex: number;
  confidence: number;
  voters: number;           // how many robots participated
  totalOnline: number;
}

export interface HdcStats {
  totalInferences: number;
  correctClassifications: number;
  runningAccuracy: number;
  perSpecies: { species: string; correct: number; total: number }[];
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

// Species for HDC simulation
export const SPECIES_NAMES = [
  'Ae. aegypti', 'Ae. albopictus', 'An. gambiae',
  'An. arabiensis', 'C. pipiens', 'C. quinque.'
];

export const SPECIES_COLORS = [
  '#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#d29922', '#f47067'
];

// Terrain types
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

// Size class parameters
export interface SizeClassParams {
  bleRange: number;
  maxSpeed: number;
  batteryDrain: number;
  solarRate: number;
  radius: number;
  // Three-source energy (套娃)
  windTurbineEff: number;   // wind harvest efficiency
  regenPropEff: number;     // regenerative propeller efficiency
  wptOutputMw: number;      // WPT transmit power (mW)
  wptRangeM: number;        // WPT effective range (meters)
  maxChildren: number;      // max nested children
  supercapMah: number;      // supercapacitor capacity (0 = no supercap)
}

export const SIZE_PARAMS: Record<SizeClass, SizeClassParams> = {
  small:  { bleRange: 20, maxSpeed: 3,  batteryDrain: 0.025, solarRate: 0.01, radius: 1.0,
            windTurbineEff: 0.0, regenPropEff: 0.002, wptOutputMw: 0, wptRangeM: 0, maxChildren: 0, supercapMah: 5 },
  medium: { bleRange: 35, maxSpeed: 5,  batteryDrain: 0.018, solarRate: 0.015, radius: 2.0,
            windTurbineEff: 0.003, regenPropEff: 0.004, wptOutputMw: 50, wptRangeM: 8, maxChildren: 4, supercapMah: 0 },
  large:  { bleRange: 60, maxSpeed: 8,  batteryDrain: 0.010, solarRate: 0.02, radius: 3.0,
            windTurbineEff: 0.008, regenPropEff: 0.006, wptOutputMw: 150, wptRangeM: 15, maxChildren: 4, supercapMah: 0 },
  hub:    { bleRange: 80, maxSpeed: 6,  batteryDrain: 0.005, solarRate: 0.025, radius: 4.0,
            windTurbineEff: 0.012, regenPropEff: 0.0, wptOutputMw: 300, wptRangeM: 25, maxChildren: 1, supercapMah: 0 },
};
