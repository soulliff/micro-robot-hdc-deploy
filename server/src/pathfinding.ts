/* pathfinding.ts — A* pathfinding on a discretized NavGrid for swarm robots */

import type { Vec2 } from './types';
import type { Obstacle } from './terrain';

const GRID_W = 100;
const GRID_H = 80;

const SQRT2 = Math.SQRT2;

/** Directions: 8-way movement (dx, dy, cost) */
const DIRS: ReadonlyArray<{ dx: number; dy: number; cost: number }> = [
  { dx:  1, dy:  0, cost: 1 },
  { dx: -1, dy:  0, cost: 1 },
  { dx:  0, dy:  1, cost: 1 },
  { dx:  0, dy: -1, cost: 1 },
  { dx:  1, dy:  1, cost: SQRT2 },
  { dx:  1, dy: -1, cost: SQRT2 },
  { dx: -1, dy:  1, cost: SQRT2 },
  { dx: -1, dy: -1, cost: SQRT2 },
];

/** Binary min-heap keyed by f-score for the A* open set */
class MinHeap {
  private readonly data: { key: number; f: number }[] = [];

  get size(): number { return this.data.length; }

  push(key: number, f: number): void {
    this.data.push({ key, f });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): number {
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top.key;
  }

  private bubbleUp(i: number): void {
    const node = this.data[i];
    while (i > 0) {
      const parentIdx = (i - 1) >> 1;
      if (this.data[parentIdx].f <= node.f) break;
      this.data[i] = this.data[parentIdx];
      i = parentIdx;
    }
    this.data[i] = node;
  }

  private sinkDown(i: number): void {
    const length = this.data.length;
    const node = this.data[i];
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;

      if (left < length && this.data[left].f < this.data[smallest].f) {
        smallest = left;
      }
      if (right < length && this.data[right].f < this.data[smallest].f) {
        smallest = right;
      }
      if (smallest === i) break;
      this.data[i] = this.data[smallest];
      this.data[smallest] = node;
      i = smallest;
    }
  }
}

/** Euclidean distance heuristic */
function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Flatten 2D grid coords into a single index */
function toIndex(cx: number, cy: number): number {
  return cy * GRID_W + cx;
}

/** Check if two consecutive segments are collinear (for path smoothing) */
function isCollinear(a: Vec2, b: Vec2, c: Vec2): boolean {
  // Cross product of vectors (b-a) and (c-b); if ~0, they're collinear
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  return Math.abs(cross) < 1e-6;
}

export class NavGrid {
  /** True = blocked */
  private readonly blocked: Uint8Array = new Uint8Array(GRID_W * GRID_H);

  /** Discretize world coord to grid cell, clamped to bounds */
  private toCell(worldVal: number, max: number): number {
    return Math.max(0, Math.min(max - 1, Math.floor(worldVal)));
  }

  /**
   * Build the navigation grid from terrain obstacles.
   * Marks each obstacle's bounding box (with 1-cell buffer) as blocked.
   */
  buildFromTerrain(obstacles: Obstacle[]): void {
    // Clear
    this.blocked.fill(0);

    const buffer = 2; // 2-cell buffer — must exceed obstacle avoidance margin (1.5 world units)

    for (const o of obstacles) {
      // Obstacle bounding box in world coords (terrain uses x,z not x,y)
      const halfW = o.width / 2;
      const halfD = o.depth / 2;
      const minX = o.x - halfW - buffer;
      const maxX = o.x + halfW + buffer;
      const minZ = o.z - halfD - buffer;
      const maxZ = o.z + halfD + buffer;

      // Convert to grid cells
      const cMinX = Math.max(0, Math.floor(minX));
      const cMaxX = Math.min(GRID_W - 1, Math.ceil(maxX));
      const cMinZ = Math.max(0, Math.floor(minZ));
      const cMaxZ = Math.min(GRID_H - 1, Math.ceil(maxZ));

      for (let cy = cMinZ; cy <= cMaxZ; cy++) {
        for (let cx = cMinX; cx <= cMaxX; cx++) {
          this.blocked[toIndex(cx, cy)] = 1;
        }
      }
    }
  }

  /** Check if a cell is blocked */
  isBlocked(cx: number, cy: number): boolean {
    if (cx < 0 || cx >= GRID_W || cy < 0 || cy >= GRID_H) return true;
    return this.blocked[toIndex(cx, cy)] === 1;
  }

  /**
   * A* pathfinding from start to goal in world coordinates.
   * Returns an array of world-coordinate waypoints (including the goal).
   * If no path found, returns a straight-line fallback [goal].
   */
  findPath(startX: number, startY: number, goalX: number, goalY: number): Vec2[] {
    const sx = this.toCell(startX, GRID_W);
    const sy = this.toCell(startY, GRID_H);
    const gx = this.toCell(goalX, GRID_W);
    const gy = this.toCell(goalY, GRID_H);

    // If start == goal, nothing to do
    if (sx === gx && sy === gy) {
      return [{ x: goalX, y: goalY }];
    }

    // If goal is blocked, return straight-line fallback
    if (this.isBlocked(gx, gy)) {
      return [{ x: goalX, y: goalY }];
    }

    const totalCells = GRID_W * GRID_H;
    const gScore = new Float32Array(totalCells);
    gScore.fill(Infinity);
    const cameFrom = new Int32Array(totalCells);
    cameFrom.fill(-1);
    const closed = new Uint8Array(totalCells);

    const startIdx = toIndex(sx, sy);
    const goalIdx = toIndex(gx, gy);

    gScore[startIdx] = 0;
    const heap = new MinHeap();
    heap.push(startIdx, heuristic(sx, sy, gx, gy));

    let found = false;

    while (heap.size > 0) {
      const currentIdx = heap.pop();
      if (currentIdx === goalIdx) {
        found = true;
        break;
      }
      if (closed[currentIdx]) continue;
      closed[currentIdx] = 1;

      const curX = currentIdx % GRID_W;
      const curY = (currentIdx - curX) / GRID_W;
      const curG = gScore[currentIdx];

      for (const dir of DIRS) {
        const nx = curX + dir.dx;
        const ny = curY + dir.dy;

        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;

        const nIdx = toIndex(nx, ny);
        if (closed[nIdx] || this.blocked[nIdx]) continue;

        // For diagonal moves, also check that both adjacent cardinal cells are open
        // to prevent cutting through obstacle corners
        if (dir.dx !== 0 && dir.dy !== 0) {
          if (this.blocked[toIndex(curX + dir.dx, curY)] ||
              this.blocked[toIndex(curX, curY + dir.dy)]) {
            continue;
          }
        }

        const tentativeG = curG + dir.cost;
        if (tentativeG < gScore[nIdx]) {
          gScore[nIdx] = tentativeG;
          cameFrom[nIdx] = currentIdx;
          const f = tentativeG + heuristic(nx, ny, gx, gy);
          heap.push(nIdx, f);
        }
      }
    }

    if (!found) {
      // No path found — return straight-line fallback
      return [{ x: goalX, y: goalY }];
    }

    // Reconstruct path
    const rawPath: Vec2[] = [];
    let idx = goalIdx;
    while (idx !== -1 && idx !== startIdx) {
      const px = idx % GRID_W;
      const py = (idx - px) / GRID_W;
      // Convert cell center back to world coords (add 0.5 for cell center)
      rawPath.push({ x: px + 0.5, y: py + 0.5 });
      idx = cameFrom[idx];
    }
    rawPath.reverse();

    // Replace last waypoint with exact goal position
    if (rawPath.length > 0) {
      rawPath[rawPath.length - 1] = { x: goalX, y: goalY };
    } else {
      rawPath.push({ x: goalX, y: goalY });
    }

    // Path smoothing: remove collinear intermediate points
    return this.smoothPath(rawPath);
  }

  /** Remove intermediate waypoints that lie on the same line */
  private smoothPath(path: Vec2[]): Vec2[] {
    if (path.length <= 2) return path;

    const smoothed: Vec2[] = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      if (!isCollinear(smoothed[smoothed.length - 1], path[i], path[i + 1])) {
        smoothed.push(path[i]);
      }
    }
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
}
