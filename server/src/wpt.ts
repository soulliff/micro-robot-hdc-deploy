/* wpt.ts — Wireless Power Transfer (WPT) for 套娃 energy cascade */

import { Robot } from './robot';
import { SIZE_PARAMS, type EnergyFlowLink } from './types';

/**
 * Compute WPT energy flows between parent robots and their children.
 * Each parent splits its wptOutputMw equally among children within range.
 * Nested children receive power at 100% efficiency (distance = 0).
 */
export function computeWptFlows(robots: Robot[]): EnergyFlowLink[] {
  const flows: EnergyFlowLink[] = [];
  const robotMap = new Map<number, Robot>();
  for (const r of robots) {
    robotMap.set(r.id, r);
  }

  for (const parent of robots) {
    if (parent.childIds.length === 0) continue;
    if (!parent.isOnline) continue;

    const params = SIZE_PARAMS[parent.sizeClass];
    if (params.wptOutputMw <= 0) continue;

    const children = parent.childIds
      .map(id => robotMap.get(id))
      .filter((c): c is Robot => c !== undefined && c.isOnline);

    if (children.length === 0) continue;

    const perChildMw = params.wptOutputMw / children.length;

    for (const child of children) {
      let distanceFactor: number;

      if (child.isNested) {
        // Nested = inside parent, full efficiency
        distanceFactor = 1.0;
      } else {
        // Distance-dependent attenuation
        const dx = child.position.x - parent.position.x;
        const dy = child.position.y - parent.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        distanceFactor = Math.max(0, 1.0 - dist / params.wptRangeM);
      }

      const powerMw = perChildMw * distanceFactor;
      if (powerMw > 0.1) {
        flows.push({
          fromId: parent.id,
          toId: child.id,
          powerMw,
          type: 'wpt',
        });
      }
    }
  }

  return flows;
}

/**
 * Apply WPT charging to child robots based on computed flows.
 * Small robots charge supercap first (fast charge), then battery.
 * Medium/Large robots charge battery directly.
 */
export function applyWptCharging(robots: Robot[], flows: EnergyFlowLink[]): void {
  const robotMap = new Map<number, Robot>();
  for (const r of robots) {
    robotMap.set(r.id, r);
    // Reset WPT fields each tick
    r.wptReceiveMw = 0;
    r.wptOutputMw = 0;
  }

  // Tally output per parent
  const parentOutput = new Map<number, number>();
  for (const flow of flows) {
    parentOutput.set(flow.fromId, (parentOutput.get(flow.fromId) ?? 0) + flow.powerMw);
  }
  for (const [parentId, totalMw] of parentOutput) {
    const parent = robotMap.get(parentId);
    if (parent) parent.wptOutputMw = totalMw;
  }

  // Apply charging to children
  for (const flow of flows) {
    const child = robotMap.get(flow.toId);
    if (!child) continue;

    child.wptReceiveMw += flow.powerMw;
    const params = SIZE_PARAMS[child.sizeClass];

    if (params.supercapMah > 0) {
      // Small robots: charge supercap first at 10× rate
      if (child.supercapSoc < 100) {
        child.supercapSoc = Math.min(100, child.supercapSoc + flow.powerMw * 0.01);
      } else {
        // Supercap full — charge battery
        child.batterySoc = Math.min(100, child.batterySoc + flow.powerMw * 0.0005);
      }
    } else {
      // Medium/Large: charge battery directly
      child.batterySoc = Math.min(100, child.batterySoc + flow.powerMw * 0.0005);
    }
  }
}
