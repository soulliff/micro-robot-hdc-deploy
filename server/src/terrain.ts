/**
 * terrain.ts — Procedural terrain + obstacles for the 3D scene
 *
 * Generates a height map and obstacle list once on startup.
 * Sent to clients on WebSocket connect (not per-tick).
 */

export interface TerrainData {
  /** Height map: rows × cols grid, values in [0, maxHeight] */
  heightMap: number[][];
  rows: number;
  cols: number;
  maxHeight: number;
  /** Static obstacles (buildings, trees) */
  obstacles: Obstacle[];
}

export interface Obstacle {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type: 'building' | 'tree' | 'rock';
}

const MAP_W = 120;
const MAP_H = 80;
const GRID_RESOLUTION = 2; // 1 height sample per 2 map units
const ROWS = Math.floor(MAP_H / GRID_RESOLUTION) + 1;
const COLS = Math.floor(MAP_W / GRID_RESOLUTION) + 1;
const MAX_HEIGHT = 4; // gentle hills

/**
 * Simple value noise (not Perlin, but close enough for demo terrain).
 * Deterministic seed-based for consistency across restarts.
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function smoothNoise(x: number, z: number, freq: number, seed: number): number {
  const fx = x * freq;
  const fz = z * freq;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const fracX = fx - ix;
  const fracZ = fz - iz;

  // Smooth interpolation
  const sx = fracX * fracX * (3 - 2 * fracX);
  const sz = fracZ * fracZ * (3 - 2 * fracZ);

  const n00 = seededRandom(ix * 17 + iz * 31 + seed);
  const n10 = seededRandom((ix + 1) * 17 + iz * 31 + seed);
  const n01 = seededRandom(ix * 17 + (iz + 1) * 31 + seed);
  const n11 = seededRandom((ix + 1) * 17 + (iz + 1) * 31 + seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  return nx0 * (1 - sz) + nx1 * sz;
}

function fbm(x: number, z: number, seed: number): number {
  // Fractal Brownian Motion: 3 octaves
  let v = 0;
  v += smoothNoise(x, z, 0.03, seed) * 1.0;
  v += smoothNoise(x, z, 0.06, seed + 100) * 0.5;
  v += smoothNoise(x, z, 0.12, seed + 200) * 0.25;
  return v / 1.75; // Normalize to ~[0, 1]
}

export function generateTerrain(seed = 42): TerrainData {
  // Generate height map
  const heightMap: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const mapX = c * GRID_RESOLUTION;
      const mapZ = r * GRID_RESOLUTION;

      let h = fbm(mapX, mapZ, seed) * MAX_HEIGHT;

      // Flatten center area (where hub spawns at 50, 40)
      const distToCenter = Math.sqrt((mapX - 50) ** 2 + (mapZ - 40) ** 2);
      if (distToCenter < 15) {
        h *= Math.min(1, distToCenter / 15);
      }

      // Flatten edges slightly
      const edgeDist = Math.min(mapX, MAP_W - mapX, mapZ, MAP_H - mapZ);
      if (edgeDist < 5) {
        h *= edgeDist / 5;
      }

      row.push(Math.round(h * 100) / 100); // 2 decimal places
    }
    heightMap.push(row);
  }

  // Generate obstacles (deterministic)
  const obstacles: Obstacle[] = [];
  const obstacleSeeds = [
    // Buildings (corners and edges)
    { x: 15, z: 12, w: 6, d: 4, h: 5, type: 'building' as const },
    { x: 95, z: 15, w: 5, d: 5, h: 7, type: 'building' as const },
    { x: 100, z: 60, w: 4, d: 6, h: 4, type: 'building' as const },
    { x: 20, z: 65, w: 5, d: 3, h: 6, type: 'building' as const },
    // Rocks (scattered)
    { x: 40, z: 20, w: 3, d: 3, h: 2, type: 'rock' as const },
    { x: 75, z: 35, w: 2, d: 2, h: 1.5, type: 'rock' as const },
    { x: 30, z: 55, w: 2.5, d: 2, h: 1.8, type: 'rock' as const },
    { x: 85, z: 50, w: 2, d: 3, h: 2.2, type: 'rock' as const },
    // Trees (scattered, tall and thin)
    { x: 25, z: 30, w: 1, d: 1, h: 4, type: 'tree' as const },
    { x: 70, z: 20, w: 1, d: 1, h: 3.5, type: 'tree' as const },
    { x: 55, z: 65, w: 1, d: 1, h: 4.5, type: 'tree' as const },
    { x: 90, z: 70, w: 1, d: 1, h: 3, type: 'tree' as const },
    { x: 10, z: 45, w: 1, d: 1, h: 3.8, type: 'tree' as const },
    { x: 110, z: 40, w: 1, d: 1, h: 4.2, type: 'tree' as const },
  ];

  for (const s of obstacleSeeds) {
    obstacles.push({
      x: s.x,
      z: s.z,
      width: s.w,
      depth: s.d,
      height: s.h,
      type: s.type,
    });
  }

  return { heightMap, rows: ROWS, cols: COLS, maxHeight: MAX_HEIGHT, obstacles };
}

/** Check if a point is inside any obstacle (for collision avoidance) */
export function isInsideObstacle(x: number, z: number, obstacles: Obstacle[], margin = 1): boolean {
  for (const o of obstacles) {
    if (
      x >= o.x - o.width / 2 - margin &&
      x <= o.x + o.width / 2 + margin &&
      z >= o.z - o.depth / 2 - margin &&
      z <= o.z + o.depth / 2 + margin
    ) {
      return true;
    }
  }
  return false;
}
