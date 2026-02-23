/**
 * MissionTargetMarker.tsx — Holographic mission targets with bloom glow
 * Terrain-aware: targets hover above actual terrain surface.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { MissionTarget, TerrainData } from '../../hooks/useSocket';
import { TARGET_STATUS_COLORS, SPECIES_COLORS, toWorld, getTerrainHeight } from './constants';

interface Props {
  targets: MissionTarget[];
  terrain?: TerrainData | null;
}

export function MissionTargetMarkers({ targets, terrain }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 1;

    groupRef.current.children.forEach((child, i) => {
      const target = targets[i];
      if (target && (target.status === 'active' || target.status === 'detected')) {
        child.scale.setScalar(pulse);
      }
    });

    // Rotate detection rings
    for (const ring of ringRefs.current) {
      if (ring) {
        ring.rotation.z += 0.005;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {targets.filter(t => t.status !== 'expired').map((t, idx) => {
        const terrainH = getTerrainHeight(terrain, t.position.x, t.position.y);
        const [wx, , wz] = toWorld(t.position.x, t.position.y);
        const worldY = 2 + terrainH; // hover above terrain
        const color = TARGET_STATUS_COLORS[t.status] ?? '#8b949e';
        const speciesColor = SPECIES_COLORS[t.speciesIndex] ?? '#8b949e';

        return (
          <group key={t.id} position={[wx, worldY, wz]}>
            {/* Core glow sphere */}
            <mesh>
              <sphereGeometry args={[0.6, 16, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={t.status === 'classified' ? 4 : 2.5}
                transparent
                opacity={0.75}
              />
            </mesh>

            {/* Wireframe holographic shell */}
            <mesh>
              <icosahedronGeometry args={[0.9, 1]} />
              <meshBasicMaterial
                color={color}
                wireframe
                transparent
                opacity={0.12}
              />
            </mesh>

            {/* Small point light */}
            <pointLight color={color} intensity={0.5} distance={8} />

            {/* Rotating detection radius ring */}
            <mesh
              ref={(el) => { if (el) ringRefs.current[idx] = el; }}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, -worldY + terrainH + 0.2, 0]}
            >
              <torusGeometry args={[t.detectionRadius, 0.08, 8, 64]} />
              <meshStandardMaterial
                color={speciesColor}
                emissive={speciesColor}
                emissiveIntensity={1.5}
                transparent
                opacity={0.2}
              />
            </mesh>

            {/* Sparkles for classified targets */}
            {t.status === 'classified' && (
              <Sparkles
                count={15}
                scale={[2, 2, 2]}
                size={1.5}
                speed={2}
                opacity={0.5}
                color={speciesColor}
              />
            )}

            {/* Species label */}
            <Text
              position={[0, 1.8, 0]}
              fontSize={0.5}
              color={speciesColor}
              anchorX="center"
              anchorY="middle"
            >
              {t.speciesName}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
