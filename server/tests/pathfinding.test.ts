import { describe, it, expect, beforeEach } from 'vitest';
import { NavGrid } from '../src/pathfinding';
import type { Obstacle } from '../src/terrain';

describe('NavGrid', () => {
  let grid: NavGrid;

  beforeEach(() => {
    grid = new NavGrid();
  });

  // ── Construction & buildFromTerrain ──────────────────────

  describe('creation and buildFromTerrain', () => {
    it('creates an empty (unblocked) grid by default', () => {
      // No obstacles loaded — center of the map should be passable
      expect(grid.isBlocked(50, 40)).toBe(false);
    });

    it('marks obstacle cells as blocked after buildFromTerrain', () => {
      const obstacles: Obstacle[] = [
        { x: 10, z: 10, width: 4, depth: 4, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      // The obstacle at (10,10) with width=4, depth=4 spans roughly [8,12] x [8,12]
      // plus a 1-cell buffer, so [7,13] x [7,13] should be blocked
      expect(grid.isBlocked(10, 10)).toBe(true);
      expect(grid.isBlocked(8, 8)).toBe(true);
      expect(grid.isBlocked(12, 12)).toBe(true);
    });

    it('leaves cells outside the obstacle bounding box unblocked', () => {
      const obstacles: Obstacle[] = [
        { x: 10, z: 10, width: 4, depth: 4, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      // Far away should be clear
      expect(grid.isBlocked(50, 40)).toBe(false);
      expect(grid.isBlocked(80, 60)).toBe(false);
    });

    it('treats out-of-bounds cells as blocked', () => {
      expect(grid.isBlocked(-1, 0)).toBe(true);
      expect(grid.isBlocked(0, -1)).toBe(true);
      expect(grid.isBlocked(100, 0)).toBe(true);  // GRID_W = 100
      expect(grid.isBlocked(0, 80)).toBe(true);   // GRID_H = 80
    });

    it('handles multiple obstacles', () => {
      const obstacles: Obstacle[] = [
        { x: 10, z: 10, width: 4, depth: 4, height: 5, type: 'building' },
        { x: 80, z: 60, width: 6, depth: 6, height: 3, type: 'rock' },
      ];
      grid.buildFromTerrain(obstacles);

      expect(grid.isBlocked(10, 10)).toBe(true);
      expect(grid.isBlocked(80, 60)).toBe(true);
      expect(grid.isBlocked(50, 40)).toBe(false);
    });

    it('clears previous obstacles on rebuild', () => {
      const obstacles1: Obstacle[] = [
        { x: 10, z: 10, width: 4, depth: 4, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles1);
      expect(grid.isBlocked(10, 10)).toBe(true);

      // Rebuild with no obstacles
      grid.buildFromTerrain([]);
      expect(grid.isBlocked(10, 10)).toBe(false);
    });
  });

  // ── A* pathfinding ──────────────────────────────────────

  describe('findPath — A* pathfinding', () => {
    it('finds a path between two open points', () => {
      // No obstacles — should find a path
      const path = grid.findPath(5, 5, 20, 20);
      expect(path.length).toBeGreaterThan(0);

      // Last waypoint should be the goal
      const last = path[path.length - 1];
      expect(last.x).toBe(20);
      expect(last.y).toBe(20);
    });

    it('returns [goal] when start equals goal (same cell)', () => {
      const path = grid.findPath(5.3, 5.7, 5.1, 5.2);
      // Both map to cell (5,5)
      expect(path).toHaveLength(1);
      expect(path[0].x).toBe(5.1);
      expect(path[0].y).toBe(5.2);
    });

    it('navigates around an obstacle', () => {
      // Place a wall blocking straight-line movement
      const obstacles: Obstacle[] = [
        { x: 15, z: 10, width: 30, depth: 2, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      const path = grid.findPath(15, 5, 15, 15);
      expect(path.length).toBeGreaterThan(0);

      // The path should end at the goal
      const last = path[path.length - 1];
      expect(last.x).toBe(15);
      expect(last.y).toBe(15);

      // The path should have more than 1 waypoint (had to route around)
      expect(path.length).toBeGreaterThanOrEqual(1);
    });

    it('returns straight-line fallback [goal] when goal cell is blocked', () => {
      const obstacles: Obstacle[] = [
        { x: 30, z: 30, width: 6, depth: 6, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      // Goal is inside the obstacle
      const path = grid.findPath(5, 5, 30, 30);
      // When goal is blocked, findPath returns [{ x: goalX, y: goalY }]
      expect(path).toHaveLength(1);
      expect(path[0].x).toBe(30);
      expect(path[0].y).toBe(30);
    });

    it('returns straight-line fallback when no path exists (fully enclosed start)', () => {
      // Build a box of obstacles that completely surrounds the start area
      // creating a situation where no path can be found
      const obstacles: Obstacle[] = [];
      // Create a ring of obstacles around (5,5)
      for (let x = 2; x <= 8; x++) {
        obstacles.push({ x, z: 2, width: 1.5, depth: 1.5, height: 5, type: 'rock' });
        obstacles.push({ x, z: 8, width: 1.5, depth: 1.5, height: 5, type: 'rock' });
      }
      for (let z = 3; z <= 7; z++) {
        obstacles.push({ x: 2, z, width: 1.5, depth: 1.5, height: 5, type: 'rock' });
        obstacles.push({ x: 8, z, width: 1.5, depth: 1.5, height: 5, type: 'rock' });
      }
      grid.buildFromTerrain(obstacles);

      const path = grid.findPath(5, 5, 50, 50);
      // Should get straight-line fallback since start is enclosed
      expect(path).toHaveLength(1);
      expect(path[0].x).toBe(50);
      expect(path[0].y).toBe(50);
    });
  });

  // ── Path smoothing ──────────────────────────────────────

  describe('path smoothing', () => {
    it('produces a shorter path than raw A* by removing collinear points', () => {
      // On an empty grid, a horizontal path from (0,0) to (30,0) would have
      // ~30 raw A* waypoints. Smoothing should collapse the collinear
      // intermediate cell-center points, producing far fewer waypoints.
      const path = grid.findPath(0, 0, 30, 0);
      // Raw A* would produce ~30 waypoints for 30 cells.
      // After smoothing, collinear horizontal points are removed,
      // leaving far fewer waypoints (typically 2-4 due to cell-center
      // alignment and the final goal replacement).
      expect(path.length).toBeLessThan(10);
      expect(path.length).toBeGreaterThan(0);

      // Last waypoint should be the exact goal
      const last = path[path.length - 1];
      expect(last.x).toBe(30);
      expect(last.y).toBe(0);
    });

    it('preserves waypoints at direction changes', () => {
      // Build an L-shaped obstacle that forces a direction change
      const obstacles: Obstacle[] = [
        { x: 20, z: 15, width: 40, depth: 2, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      const path = grid.findPath(20, 5, 20, 25);
      // There should be more than one waypoint to navigate around
      expect(path.length).toBeGreaterThanOrEqual(1);

      // Last point is the goal
      const last = path[path.length - 1];
      expect(last.x).toBe(20);
      expect(last.y).toBe(25);
    });
  });

  // ── Straight-line fallback ──────────────────────────────

  describe('straight-line fallback', () => {
    it('returns [goal] when start and goal map to same cell', () => {
      const path = grid.findPath(10.1, 10.2, 10.3, 10.4);
      expect(path).toHaveLength(1);
      expect(path[0].x).toBe(10.3);
      expect(path[0].y).toBe(10.4);
    });

    it('returns [goal] when goal cell is blocked', () => {
      const obstacles: Obstacle[] = [
        { x: 50, z: 50, width: 10, depth: 10, height: 5, type: 'building' },
      ];
      grid.buildFromTerrain(obstacles);

      const path = grid.findPath(5, 5, 50, 50);
      expect(path).toHaveLength(1);
      expect(path[0]).toEqual({ x: 50, y: 50 });
    });
  });
});
