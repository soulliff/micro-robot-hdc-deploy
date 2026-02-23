/**
 * SwarmMap3D.tsx — Three.js 3D visualization of the robot swarm
 *
 * Uses React Three Fiber (@react-three/fiber) + drei helpers.
 * Features: procedural terrain, obstacle rendering, wind particles,
 * camera modes (Orbit/Follow/Top-down), drone animations, BLE arcs.
 */

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { SwarmSnapshot, RobotState, TerrainData, TerrainObstacle } from '../hooks/useSocket';
import { MAP_W, MAP_H, HALF_W, HALF_H, SPECIES_COLORS, SPECIES_NAMES, toWorld, getTerrainHeight } from './swarm3d/constants';
import { SceneEnvironment } from './swarm3d/SceneEnvironment';
import { PostProcessingEffects } from './swarm3d/PostProcessing';
import { DroneModel } from './swarm3d/DroneModel';
import { BleArcs } from './swarm3d/BleArcs';
import { WindField } from './swarm3d/WindField';
import { MissionTargetMarkers } from './swarm3d/MissionTargetMarker';
import { PerformanceLayer } from './swarm3d/PerformanceLayer';
import { RobotCameraOverlay } from './swarm3d/RobotCameraOverlay';

// Grid resolution must match server terrain.ts (2m per cell)

type CameraMode = 'orbit' | 'follow' | 'topdown';

/* ─── Terrain Mesh ─────────────────────────────────────────────── */

function TerrainMesh({ terrain }: { terrain: TerrainData }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(MAP_W, MAP_H, terrain.cols - 1, terrain.rows - 1);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      // PlaneGeometry in XY, we rotate to XZ — modify Z (which becomes Y after rotation)
      const col = i % terrain.cols;
      const row = Math.floor(i / terrain.cols);
      const safeRow = Math.min(row, terrain.rows - 1);
      const safeCol = Math.min(col, terrain.cols - 1);
      const h = terrain.heightMap[safeRow]?.[safeCol] ?? 0;
      pos.setZ(i, h);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [terrain]);

  // Color vertices by height — visible dark-to-blue gradient
  const colors = useMemo(() => {
    const pos = geometry.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getZ(i) / terrain.maxHeight;
      // Visible dark navy base → brighter blue-teal peaks
      arr[i * 3] = 0.06 + h * 0.12;      // R
      arr[i * 3 + 1] = 0.08 + h * 0.18;  // G — greenish tint at peaks
      arr[i * 3 + 2] = 0.14 + h * 0.30;  // B — bright blue at peaks
    }
    return new THREE.BufferAttribute(arr, 3);
  }, [geometry, terrain.maxHeight]);

  useEffect(() => {
    geometry.setAttribute('color', colors);
  }, [geometry, colors]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} />
    </mesh>
  );
}

/* ─── Obstacles (terrain-aware: offset by terrain height) ─────── */

function ObstacleMeshes({ obstacles, terrain }: { obstacles: TerrainObstacle[]; terrain: TerrainData }) {
  return (
    <group>
      {obstacles.map((o, i) => {
        const wx = o.x - HALF_W;
        const wz = o.z - HALF_H;
        const terrainH = getTerrainHeight(terrain, o.x, o.z);

        if (o.type === 'building') {
          return (
            <mesh key={i} position={[wx, terrainH + o.height / 2, wz]} castShadow receiveShadow>
              <boxGeometry args={[o.width, o.height, o.depth]} />
              <meshStandardMaterial color="#1a2233" roughness={0.6} metalness={0.5} emissive="#0a1628" emissiveIntensity={0.5} />
            </mesh>
          );
        }

        if (o.type === 'tree') {
          return (
            <group key={i} position={[wx, terrainH, wz]}>
              {/* Trunk */}
              <mesh position={[0, o.height * 0.4, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.25, o.height * 0.6, 6]} />
                <meshStandardMaterial color="#5c4033" roughness={0.9} />
              </mesh>
              {/* Canopy */}
              <mesh position={[0, o.height * 0.75, 0]} castShadow>
                <coneGeometry args={[1.2, o.height * 0.5, 8]} />
                <meshStandardMaterial color="#1a6b2a" roughness={0.8} />
              </mesh>
            </group>
          );
        }

        // rock
        return (
          <mesh key={i} position={[wx, terrainH + o.height * 0.4, wz]} castShadow>
            <dodecahedronGeometry args={[o.height * 0.6, 1]} />
            <meshStandardMaterial color="#556677" roughness={0.95} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

/* ─── Ground Grid ──────────────────────────────────────────────── */

function GroundPlane({ hasTerrain }: { hasTerrain: boolean }) {
  return (
    <>
      {/* Dark ground (only when no terrain) */}
      {!hasTerrain && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[MAP_W, MAP_H]} />
          <meshStandardMaterial color="#0a0a18" />
        </mesh>
      )}

      {/* Grid overlay — raised above terrain max (4) to avoid Z-fighting */}
      <Grid
        args={[MAP_W, MAP_H]}
        position={[0, hasTerrain ? 4.5 : 0.02, 0]}
        cellSize={10}
        cellThickness={0.4}
        cellColor="#1a2840"
        sectionSize={20}
        sectionThickness={0.8}
        sectionColor="#1e3a5f"
        fadeDistance={150}
        infiniteGrid={false}
      />

      {/* Border edges */}
      {[
        [[-HALF_W, 0.2, 0], [0, 0, Math.PI / 2]],
        [[HALF_W, 0.2, 0], [0, 0, Math.PI / 2]],
        [[0, 0.2, -HALF_H], [0, 0, 0]],
        [[0, 0.2, HALF_H], [0, 0, 0]],
      ].map(([pos, rot], i) => (
        <mesh
          key={i}
          position={pos as [number, number, number]}
          rotation={rot as [number, number, number]}
        >
          <boxGeometry args={[i < 2 ? 0.1 : MAP_W, 0.3, i < 2 ? MAP_H : 0.1]} />
          <meshStandardMaterial color="#3a4a5a" emissive="#2a3a4a" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </>
  );
}

/* ─── Species Zone Labels ──────────────────────────────────────── */

function ZoneLabels({ hasTerrain }: { hasTerrain: boolean }) {
  const zones: { x: number; z: number; name: string; color: string }[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      zones.push({
        x: (col + 0.5) * (MAP_W / 3) - HALF_W,
        z: (row + 0.5) * (MAP_H / 2) - HALF_H,
        name: SPECIES_NAMES[idx],
        color: SPECIES_COLORS[idx],
      });
    }
  }

  // Place labels above terrain to prevent clipping
  const labelY = hasTerrain ? 4.8 : 0.15;

  return (
    <group>
      {zones.map((z, i) => (
        <group key={i}>
          <Text
            position={[z.x, labelY, z.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={1.8}
            color={z.color}
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.2}
          >
            {z.name}
          </Text>
          <mesh position={[z.x, hasTerrain ? 4.6 : 0.02, z.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[MAP_W / 3 - 1, MAP_H / 2 - 1]} />
            <meshStandardMaterial color={z.color} transparent opacity={0.04} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Camera Controller ────────────────────────────────────────── */

interface CameraControllerProps {
  mode: CameraMode;
  followTarget: RobotState | null;
  terrain?: TerrainData | null;
}

function CameraController({ mode, followTarget, terrain }: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame(() => {
    if (mode === 'follow' && followTarget && controlsRef.current) {
      const terrainH = getTerrainHeight(terrain, followTarget.position.x, followTarget.position.y);
      const [tx, ty, tz] = toWorld(followTarget.position.x, followTarget.position.y, terrainH);
      const target = controlsRef.current.target;
      target.x += (tx - target.x) * 0.08;
      target.y += (ty - target.y) * 0.08;
      target.z += (tz - target.z) * 0.08;

      // Third-person offset
      const dist = 25;
      const camX = tx - Math.cos(followTarget.heading) * dist;
      const camZ = tz + Math.sin(followTarget.heading) * dist;
      camera.position.x += (camX - camera.position.x) * 0.05;
      camera.position.y += (ty + 15 - camera.position.y) * 0.05;
      camera.position.z += (camZ - camera.position.z) * 0.05;
    }

    if (mode === 'topdown') {
      camera.position.x += (0 - camera.position.x) * 0.05;
      camera.position.y += (100 - camera.position.y) * 0.05;
      camera.position.z += (0.1 - camera.position.z) * 0.05;
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, 0, 0]}
      maxPolarAngle={mode === 'topdown' ? 0.01 : Math.PI / 2.1}
      minDistance={mode === 'topdown' ? 50 : 10}
      maxDistance={mode === 'topdown' ? 150 : 150}
      enableDamping
      dampingFactor={0.1}
      enableRotate={mode !== 'topdown'}
    />
  );
}

/* ─── Main Component ───────────────────────────────────────────── */

interface Props {
  snapshot: SwarmSnapshot | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMapClick: (x: number, y: number) => void;
  terrain?: TerrainData | null;
}

export function SwarmMap3D({ snapshot, selectedId, onSelect, onMapClick, terrain }: Props) {
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const selectedRobot = snapshot?.robots.find(r => r.id === selectedId) ?? null;

  const handlePointerMissed = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    const point = e.point;
    const mapX = point.x + HALF_W;
    const mapY = point.z + HALF_H;
    if (mapX >= 0 && mapX <= MAP_W && mapY >= 0 && mapY <= MAP_H) {
      onMapClick(mapX, mapY);
    }
  }, [onMapClick]);

  return (
    <div style={{ width: '100%', height: 500, borderRadius: 8, border: '2px solid #30363d', overflow: 'hidden', background: '#010409', position: 'relative' }}>
      {/* Camera mode buttons */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        display: 'flex', gap: 3,
      }}>
        {(['orbit', 'follow', 'topdown'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setCameraMode(mode)}
            style={{
              padding: '3px 8px', fontSize: 10, fontWeight: 600,
              border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer',
              background: cameraMode === mode ? '#1f6feb' : '#21262d',
              color: cameraMode === mode ? '#fff' : '#8b949e',
            }}
          >
            {mode === 'orbit' ? 'Orbit' : mode === 'follow' ? 'Follow' : 'Top'}
          </button>
        ))}
      </div>

      <Canvas
        camera={{ position: [0, 60, 50], fov: 50, near: 1, far: 350 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        dpr={[1, 2]}
        onPointerMissed={handlePointerMissed}
      >
        <PerformanceLayer>
          {/* Sci-fi night scene environment */}
          <SceneEnvironment />

          {/* Camera */}
          <CameraController mode={cameraMode} followTarget={selectedRobot} terrain={terrain} />

          {/* Ground + Terrain */}
          <GroundPlane hasTerrain={!!terrain} />
          {terrain && <TerrainMesh terrain={terrain} />}
          {terrain && <ObstacleMeshes obstacles={terrain.obstacles} terrain={terrain} />}
          <ZoneLabels hasTerrain={!!terrain} />

          {/* Clickable ground plane (invisible) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} onClick={handleGroundClick}>
            <planeGeometry args={[MAP_W, MAP_H]} />
            <meshBasicMaterial visible={false} />
          </mesh>

          {/* Robots — terrain-aware */}
          {snapshot?.robots.map(robot => (
            <DroneModel
              key={robot.id}
              robot={robot}
              isSelected={robot.id === selectedId}
              onClick={() => onSelect(robot.id)}
              terrain={terrain}
            />
          ))}

          {/* BLE Arcs — terrain-aware neon TubeGeometry with bloom */}
          {snapshot && <BleArcs links={snapshot.bleLinks} robots={snapshot.robots} terrain={terrain} />}

          {/* Wind Field — dual-layer particles + gust zone dome */}
          {snapshot?.wind && (
            <WindField
              direction={snapshot.wind.baseDirection}
              speed={snapshot.wind.baseSpeed}
              windClass={snapshot.wind.windClass}
              gustActive={snapshot.wind.gustActive}
              gustCenter={snapshot.wind.gustCenter}
              gustRadius={snapshot.wind.gustRadius}
              terrain={terrain}
            />
          )}

          {/* Mission Targets — terrain-aware holographic markers */}
          {snapshot?.mission?.targets && (
            <MissionTargetMarkers targets={snapshot.mission.targets} terrain={terrain} />
          )}

          {/* Robot Camera — PIP from selected drone's POV */}
          {selectedRobot && (
            <RobotCameraOverlay robot={selectedRobot} terrain={terrain} />
          )}

          {/* Post-processing: Bloom, Vignette */}
          <PostProcessingEffects />
        </PerformanceLayer>
      </Canvas>

      {/* Overlay: tick counter + camera mode */}
      {snapshot && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          color: '#484f58', fontSize: 10, fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          3D | tick {snapshot.tick} | {snapshot.robots.length} robots | cam: {cameraMode}
          {terrain ? ` | terrain: ${terrain.rows}x${terrain.cols} | ${terrain.obstacles.length} obstacles` : ''}
        </div>
      )}
    </div>
  );
}
