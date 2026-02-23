/**
 * Shared constants and helpers for 3D swarm visualization
 */

import type { TerrainData } from '../../hooks/useSocket';

export const MAP_W = 120;
export const MAP_H = 80;
export const HALF_W = MAP_W / 2;
export const HALF_H = MAP_H / 2;
export const GRID_RESOLUTION = 2; // must match server terrain.ts

export const SIZE_SCALE: Record<string, number> = { small: 0.6, medium: 1.0, large: 1.5, hub: 2.0 };
export const SIZE_COLORS: Record<string, string> = { small: '#58a6ff', medium: '#3fb950', large: '#f0883e', hub: '#a371f7' };
export const BLE_QUALITY_COLORS: Record<string, string> = { strong: '#58a6ff', ok: '#3fb950', weak: '#d29922' };

export const SPECIES_COLORS = ['#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#d29922', '#f47067'];
export const SPECIES_NAMES = [
  'Ae. aegypti', 'Ae. albopictus', 'An. gambiae',
  'An. arabiensis', 'C. pipiens', 'C. quinque.',
];

export const TARGET_STATUS_COLORS: Record<string, string> = {
  active: '#ffffff',
  detected: '#d29922',
  classified: '#3fb950',
  expired: '#484f58',
};

/** Convert map coords (0-120, 0-80) to 3D world coords centered at origin.
 *  terrainY is the terrain height at this position (0-4). */
export function toWorld(x: number, y: number, terrainY = 0): [number, number, number] {
  return [x - HALF_W, 1.5 + terrainY, y - HALF_H];
}

/** Look up interpolated terrain height at map coordinates (x, y).
 *  Returns 0 if no terrain data provided. Uses bilinear interpolation. */
export function getTerrainHeight(terrain: TerrainData | null | undefined, mapX: number, mapY: number): number {
  if (!terrain) return 0;

  // Convert map coords to grid coords
  const col = mapX / GRID_RESOLUTION;
  const row = mapY / GRID_RESOLUTION;

  // Clamp to grid bounds
  const c0 = Math.max(0, Math.min(Math.floor(col), terrain.cols - 2));
  const r0 = Math.max(0, Math.min(Math.floor(row), terrain.rows - 2));
  const c1 = c0 + 1;
  const r1 = r0 + 1;

  // Fractional parts for interpolation
  const fx = col - c0;
  const fz = row - r0;

  // Bilinear interpolation
  const h00 = terrain.heightMap[r0]?.[c0] ?? 0;
  const h10 = terrain.heightMap[r0]?.[c1] ?? 0;
  const h01 = terrain.heightMap[r1]?.[c0] ?? 0;
  const h11 = terrain.heightMap[r1]?.[c1] ?? 0;

  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  return h0 * (1 - fz) + h1 * fz;
}
