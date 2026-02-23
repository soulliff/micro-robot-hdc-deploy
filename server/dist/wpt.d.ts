import { Robot } from './robot';
import { type EnergyFlowLink } from './types';
/**
 * Compute WPT energy flows between parent robots and their children.
 * Each parent splits its wptOutputMw equally among children within range.
 * Nested children receive power at 100% efficiency (distance = 0).
 */
export declare function computeWptFlows(robots: Robot[]): EnergyFlowLink[];
/**
 * Apply WPT charging to child robots based on computed flows.
 * Small robots charge supercap first (fast charge), then battery.
 * Medium/Large robots charge battery directly.
 */
export declare function applyWptCharging(robots: Robot[], flows: EnergyFlowLink[]): void;
