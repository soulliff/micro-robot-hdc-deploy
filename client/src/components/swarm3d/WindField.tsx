/**
 * WindField.tsx — Circular wind particles (two layers) + gust zone dome
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { TerrainData } from '../../hooks/useSocket';
import { MAP_W, MAP_H, HALF_W, HALF_H, toWorld, getTerrainHeight } from './constants';

/* ─── Wind Particles ───────────────────────────────────────────── */

const FAST_COUNT = 200;
const SLOW_COUNT = 100;

interface WindParticleLayerProps {
  count: number;
  baseSize: number;
  baseOpacity: number;
  speedMultiplier: number;
  direction: number;
  speed: number;
  color: string;
}

function WindParticleLayer({
  count, baseSize, baseOpacity, speedMultiplier, direction, speed, color,
}: WindParticleLayerProps) {
  const ref = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * MAP_W;
      pos[i * 3 + 1] = 0.5 + Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * MAP_H;
    }
    return { positions: pos, velocities: vel };
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;

    const wx = Math.cos(direction) * speed * 2 * speedMultiplier;
    const wz = Math.sin(direction) * speed * 2 * speedMultiplier;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      velocities[i3] = velocities[i3] * 0.95 + (wx + (Math.random() - 0.5) * speed * 0.5) * 0.05;
      velocities[i3 + 1] = velocities[i3 + 1] * 0.98 + (Math.random() - 0.5) * 0.08;
      velocities[i3 + 2] = velocities[i3 + 2] * 0.95 + (wz + (Math.random() - 0.5) * speed * 0.5) * 0.05;

      arr[i3] += velocities[i3] * delta * 10;
      arr[i3 + 1] += velocities[i3 + 1] * delta * 2;
      arr[i3 + 2] += velocities[i3 + 2] * delta * 10;

      if (arr[i3] > HALF_W) arr[i3] = -HALF_W;
      if (arr[i3] < -HALF_W) arr[i3] = HALF_W;
      if (arr[i3 + 2] > HALF_H) arr[i3 + 2] = -HALF_H;
      if (arr[i3 + 2] < -HALF_H) arr[i3 + 2] = HALF_H;
      if (arr[i3 + 1] < 0.3) arr[i3 + 1] = 0.5 + Math.random() * 6;
      if (arr[i3 + 1] > 10) arr[i3 + 1] = 0.5;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <PointMaterial
        color={color}
        size={baseSize + speed * 0.05}
        transparent
        opacity={baseOpacity + speed * 0.04}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Wind Arrow Indicator ─────────────────────────────────────── */

function WindArrow({ direction, speed, windClass }: { direction: number; speed: number; windClass: string }) {
  const arrowLen = Math.min(speed * 3, 15);
  const color = windClass === 'STRONG' ? '#f85149'
    : windClass === 'MODERATE' ? '#f0883e'
    : windClass === 'LIGHT' ? '#58a6ff'
    : '#3fb950';

  return (
    <group position={[HALF_W - 8, 5, -HALF_H + 5]} rotation={[0, -direction + Math.PI / 2, 0]}>
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, arrowLen, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, arrowLen / 2 + 0.5, 0]}>
        <coneGeometry args={[0.5, 1.5, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
      </mesh>
    </group>
  );
}

/* ─── Gust Zone Dome ───────────────────────────────────────────── */

interface GustZoneProps {
  gustActive: boolean;
  gustCenter: { x: number; y: number };
  gustRadius: number;
  terrain?: TerrainData | null;
}

function GustZone({ gustActive, gustCenter, gustRadius, terrain }: GustZoneProps) {
  if (!gustActive || gustRadius <= 0) return null;

  const terrainH = getTerrainHeight(terrain, gustCenter.x, gustCenter.y);
  const [cx, , cz] = toWorld(gustCenter.x, gustCenter.y);

  return (
    <group position={[cx, terrainH + 0.1, cz]}>
      {/* Translucent red dome */}
      <mesh>
        <sphereGeometry args={[gustRadius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#f85149"
          emissive="#f85149"
          emissiveIntensity={0.8}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ground ring — bloom trigger */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <torusGeometry args={[gustRadius, 0.12, 8, 48]} />
        <meshStandardMaterial
          color="#f85149"
          emissive="#f85149"
          emissiveIntensity={2.5}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Sparkles inside gust */}
      <Sparkles
        count={30}
        scale={[gustRadius * 2, 4, gustRadius * 2]}
        size={2}
        speed={3}
        opacity={0.4}
        color="#f85149"
      />
    </group>
  );
}

/* ─── Exported Composite ───────────────────────────────────────── */

interface WindFieldProps {
  direction: number;
  speed: number;
  windClass: string;
  gustActive: boolean;
  gustCenter: { x: number; y: number };
  gustRadius: number;
  terrain?: TerrainData | null;
}

export function WindField({ direction, speed, windClass, gustActive, gustCenter, gustRadius, terrain }: WindFieldProps) {
  const color = windClass === 'STRONG' ? '#f85149'
    : windClass === 'MODERATE' ? '#f0883e'
    : windClass === 'LIGHT' ? '#58a6ff'
    : '#3fb950';

  return (
    <>
      {/* Fast small particles — foreground */}
      <WindParticleLayer
        count={FAST_COUNT}
        baseSize={0.12}
        baseOpacity={0.45}
        speedMultiplier={1.2}
        direction={direction}
        speed={speed}
        color={color}
      />
      {/* Slow large particles — background haze */}
      <WindParticleLayer
        count={SLOW_COUNT}
        baseSize={0.3}
        baseOpacity={0.2}
        speedMultiplier={0.6}
        direction={direction}
        speed={speed}
        color={color}
      />
      {/* Wind arrow indicator */}
      <WindArrow direction={direction} speed={speed} windClass={windClass} />
      {/* Gust zone dome */}
      <GustZone gustActive={gustActive} gustCenter={gustCenter} gustRadius={gustRadius} terrain={terrain} />
    </>
  );
}
