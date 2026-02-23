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
export declare function generateTerrain(seed?: number): TerrainData;
/** Check if a point is inside any obstacle (for collision avoidance) */
export declare function isInsideObstacle(x: number, z: number, obstacles: Obstacle[], margin?: number): boolean;
