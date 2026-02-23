import type { Vec2 } from './types';
import type { Obstacle } from './terrain';
export declare class NavGrid {
    /** True = blocked */
    private readonly blocked;
    /** Discretize world coord to grid cell, clamped to bounds */
    private toCell;
    /**
     * Build the navigation grid from terrain obstacles.
     * Marks each obstacle's bounding box (with 1-cell buffer) as blocked.
     */
    buildFromTerrain(obstacles: Obstacle[]): void;
    /** Check if a cell is blocked */
    isBlocked(cx: number, cy: number): boolean;
    /**
     * A* pathfinding from start to goal in world coordinates.
     * Returns an array of world-coordinate waypoints (including the goal).
     * If no path found, returns a straight-line fallback [goal].
     */
    findPath(startX: number, startY: number, goalX: number, goalY: number): Vec2[];
    /** Remove intermediate waypoints that lie on the same line */
    private smoothPath;
}
