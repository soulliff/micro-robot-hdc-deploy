/**
 * DroneModel.tsx — Sci-fi drone with X-frame arms, spinning blades,
 * Float hover animation, per-drone ground light, motion Trail.
 * Terrain-aware: drones hover above actual terrain surface.
 */

import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Float, Trail, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { RobotState, TerrainData } from '../../hooks/useSocket';
import { SIZE_SCALE, SIZE_COLORS, SPECIES_COLORS, toWorld, getTerrainHeight } from './constants';

interface DroneProps {
  robot: RobotState;
  isSelected: boolean;
  onClick: () => void;
  terrain?: TerrainData | null;
}

const ARM_OFFSETS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function DroneModel({ robot, isSelected, onClick, terrain }: DroneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotorRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  const terrainH = getTerrainHeight(terrain, robot.position.x, robot.position.y);
  const pos = toWorld(robot.position.x, robot.position.y, terrainH);
  const scale = SIZE_SCALE[robot.sizeClass] ?? 1.0;
  const baseColor = SIZE_COLORS[robot.sizeClass] ?? '#58a6ff';

  const ledColor = robot.isByzantine
    ? '#a371f7'
    : robot.isJammed
    ? '#f85149'
    : !robot.isOnline
    ? '#484f58'
    : baseColor;

  useFrame((_, delta) => {
    // Rotor spin
    if (rotorRef.current && robot.isOnline) {
      rotorRef.current.rotation.y += delta * 18;
    }

    if (groupRef.current) {
      // Frame-rate-independent lerp
      const lerpFactor = 1 - Math.pow(0.001, delta);

      groupRef.current.position.x += (pos[0] - groupRef.current.position.x) * lerpFactor;
      groupRef.current.position.y += (pos[1] - groupRef.current.position.y) * lerpFactor;
      groupRef.current.position.z += (pos[2] - groupRef.current.position.z) * lerpFactor;

      // Forward tilt when moving
      const targetTilt = robot.speed > 0.5 ? -0.25 : 0;
      groupRef.current.rotation.x += (targetTilt - groupRef.current.rotation.x) * lerpFactor;

      // Smooth heading rotation (lerp, not snap)
      const targetYaw = -robot.heading + Math.PI / 2;
      let diff = targetYaw - groupRef.current.rotation.y;
      // Wrap angle difference to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      groupRef.current.rotation.y += diff * lerpFactor;
    }

    // Update trail target
    if (trailRef.current && groupRef.current) {
      trailRef.current.position.copy(groupRef.current.position);
    }
  });

  const showTrail = robot.isOnline && robot.speed > 0.3;

  return (
    <>
      {/* Trail (rendered outside Float so it doesn't bob) */}
      {showTrail && (
        <Trail
          width={1.2 * scale}
          length={6}
          color={ledColor}
          attenuation={(w: number) => w * w}
          decay={1.5}
        >
          <mesh ref={trailRef} visible={false}>
            <sphereGeometry args={[0.01]} />
            <meshBasicMaterial />
          </mesh>
        </Trail>
      )}

      <group
        ref={groupRef}
        position={pos}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
      >
        <Float
          speed={robot.isOnline ? 2 : 0}
          floatIntensity={0.25}
          rotationIntensity={0}
          floatingRange={[-0.12, 0.12]}
        >
          {/* Body — flattened octahedron for sci-fi look */}
          <mesh castShadow scale={[1.3 * scale, 0.35 * scale, 0.9 * scale]}>
            <octahedronGeometry args={[0.6, 0]} />
            <meshStandardMaterial
              color={robot.isOnline ? '#1a2233' : '#0a0a10'}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          {/* LED strip on top */}
          <mesh position={[0, 0.15 * scale, 0]}>
            <boxGeometry args={[0.7 * scale, 0.06 * scale, 0.35 * scale]} />
            <meshStandardMaterial
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={robot.isOnline ? 3.0 : 0.2}
            />
          </mesh>

          {/* X-Frame Arms + Rotors */}
          <group ref={rotorRef}>
            {ARM_OFFSETS.map(([dx, dz], i) => (
              <group key={i}>
                {/* Arm strut — horizontal cylinder from center to rotor mount */}
                <mesh
                  position={[dx * 0.45 * scale, 0.05 * scale, dz * 0.35 * scale]}
                  rotation={[0, Math.atan2(dz, dx), Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.03 * scale, 0.03 * scale, 0.7 * scale, 6]} />
                  <meshStandardMaterial color="#334455" metalness={0.7} roughness={0.3} />
                </mesh>

                {/* Rotor mount */}
                <group position={[dx * 0.75 * scale, 0.12 * scale, dz * 0.55 * scale]}>
                  {/* Blade pair 1 */}
                  <mesh>
                    <boxGeometry args={[0.5 * scale, 0.008 * scale, 0.06 * scale]} />
                    <meshStandardMaterial
                      color={ledColor}
                      emissive={ledColor}
                      emissiveIntensity={robot.isOnline ? 1.5 : 0.1}
                      transparent
                      opacity={0.7}
                    />
                  </mesh>
                  {/* Blade pair 2 (perpendicular) */}
                  <mesh rotation={[0, Math.PI / 2, 0]}>
                    <boxGeometry args={[0.5 * scale, 0.008 * scale, 0.06 * scale]} />
                    <meshStandardMaterial
                      color={ledColor}
                      emissive={ledColor}
                      emissiveIntensity={robot.isOnline ? 1.5 : 0.1}
                      transparent
                      opacity={0.7}
                    />
                  </mesh>
                  {/* Rotor guard ring (thin) */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.28 * scale, 0.01 * scale, 4, 16]} />
                    <meshStandardMaterial
                      color={ledColor}
                      transparent
                      opacity={0.25}
                    />
                  </mesh>
                </group>
              </group>
            ))}
          </group>

          {/* Battery bar */}
          <mesh position={[0, -0.2 * scale, 0]}>
            <boxGeometry args={[0.5 * scale * (robot.batterySoc / 100), 0.04 * scale, 0.08 * scale]} />
            <meshStandardMaterial
              color={robot.batterySoc > 30 ? '#3fb950' : robot.batterySoc > 10 ? '#d29922' : '#f85149'}
              emissive={robot.batterySoc > 30 ? '#3fb950' : '#f85149'}
              emissiveIntensity={1.5}
            />
          </mesh>

          {/* Selection ring */}
          {isSelected && (
            <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.8 * scale, 0.06, 16, 32]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#58a6ff"
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
          )}

          {/* Per-drone ground glow */}
          {robot.isOnline && (
            <pointLight
              position={[0, -0.5 * scale, 0]}
              intensity={0.5}
              distance={6}
              color={ledColor}
              castShadow={false}
            />
          )}
        </Float>

        {/* Name label (outside Float so it doesn't bob) */}
        <Text
          position={[0, 1.2 * scale, 0]}
          fontSize={0.5}
          color={isSelected ? '#ffffff' : '#8b949e'}
          anchorX="center"
          anchorY="middle"
        >
          {robot.name}
        </Text>

        {/* Species label */}
        <Text
          position={[0, 0.8 * scale, 0]}
          fontSize={0.35}
          color={SPECIES_COLORS[robot.hdc.predictedClass] ?? '#8b949e'}
          anchorX="center"
          anchorY="middle"
        >
          {robot.hdc.predictedName}
        </Text>
      </group>
    </>
  );
}
