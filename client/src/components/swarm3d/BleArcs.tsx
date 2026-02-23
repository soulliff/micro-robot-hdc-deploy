/**
 * BleArcs.tsx — Neon TubeGeometry BLE arcs with proper geometry lifecycle.
 * Terrain-aware: arc endpoints match drone heights above terrain.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { BleLink, RobotState, TerrainData } from '../../hooks/useSocket';
import { BLE_QUALITY_COLORS, toWorld, getTerrainHeight } from './constants';

interface BleArcsProps {
  links: BleLink[];
  robots: RobotState[];
  terrain?: TerrainData | null;
}

export function BleArcs({ links, robots, terrain }: BleArcsProps) {
  const arcData = useMemo(() => {
    const robotMap = new Map(robots.map(r => [r.id, r]));
    return links.map(link => {
      const from = robotMap.get(link.fromId);
      const to = robotMap.get(link.toId);
      if (!from || !to) return null;

      const fromH = getTerrainHeight(terrain, from.position.x, from.position.y);
      const toH = getTerrainHeight(terrain, to.position.x, to.position.y);

      const [fx, fy, fz] = toWorld(from.position.x, from.position.y, fromH);
      const [tx, ty, tz] = toWorld(to.position.x, to.position.y, toH);
      const start = new THREE.Vector3(fx, fy, fz);
      const end = new THREE.Vector3(tx, ty, tz);
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      mid.y += 3;
      return {
        curve: new THREE.QuadraticBezierCurve3(start, mid, end),
        color: BLE_QUALITY_COLORS[link.quality] ?? '#30363d',
      };
    }).filter((d): d is NonNullable<typeof d> => d !== null);
  }, [links, robots, terrain]);

  const geometries = useMemo(() => {
    return arcData.map(arc => new THREE.TubeGeometry(arc.curve, 16, 0.06, 4, false));
  }, [arcData]);

  // Dispose old geometries on change
  useEffect(() => {
    return () => {
      for (const geo of geometries) {
        geo.dispose();
      }
    };
  }, [geometries]);

  return (
    <group>
      {arcData.map((arc, i) => (
        <mesh key={i} geometry={geometries[i]}>
          <meshStandardMaterial
            color={arc.color}
            emissive={arc.color}
            emissiveIntensity={2.0}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
