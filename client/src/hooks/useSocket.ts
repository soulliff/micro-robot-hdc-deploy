import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface MissionTarget {
  id: number;
  position: { x: number; y: number };
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
  targets: MissionTarget[];
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
  formation: string;
  robots: RobotState[];
  wind: WindState;
  bleLinks: BleLink[];
  events: SwarmEvent[];
  stats: SwarmStats;
  mission?: MissionInfo;
  paths?: { robotId: number; waypoints: { x: number; y: number }[] }[];
  energyFlows?: EnergyFlowLink[];
}

export interface RobotState {
  id: number;
  name: string;
  sizeClass: string;
  phase: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  heading: number;
  speed: number;
  targetPosition: { x: number; y: number } | null;
  batterySoc: number;
  solarHarvestMw: number;
  powerMode: string;
  estimatedMinutes: number;
  localWindClass: string;
  localWindSpeed: number;
  localWindDirection: number;
  hdc: HdcState;
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
  supercapSoc: number;
  // Status
  isOnline: boolean;
  isJammed: boolean;
  isByzantine: boolean;
  tickCount: number;
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

export interface WindState {
  baseDirection: number;
  baseSpeed: number;
  gustActive: boolean;
  gustCenter: { x: number; y: number };
  gustRadius: number;
  gustSpeed: number;
  windClass: string;
}

export interface BleLink {
  fromId: number;
  toId: number;
  rssi: number;
  quality: string;
}

export interface SwarmEvent {
  tick: number;
  timeMs: number;
  type: string;
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

export interface HdcStatsData {
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
  windClass: string;
  formation: string;
  coordinatorId: number;
  uptimeSeconds: number;
  consensus?: SwarmConsensus;
  hdcStats?: HdcStatsData;
  nestingStats?: NestingStats;
}

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

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<SwarmSnapshot | null>(null);
  const [events, setEvents] = useState<SwarmEvent[]>([]);
  const [terrain, setTerrain] = useState<TerrainData | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('swarm:terrain', (data: TerrainData) => {
      setTerrain(data);
    });

    socket.on('swarm:state', (data: SwarmSnapshot) => {
      setSnapshot(data);
      if (data.events.length > 0) {
        setEvents(prev => [...prev, ...data.events].slice(-100));
      }
    });

    socket.on('swarm:history', (history: SwarmEvent[]) => {
      setEvents(history);
    });

    return () => { socket.disconnect(); };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { connected, snapshot, events, terrain, emit };
}
