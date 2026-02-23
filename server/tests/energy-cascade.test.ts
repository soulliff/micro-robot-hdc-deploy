import { describe, it, expect, beforeEach } from 'vitest';
import { Robot } from '../src/robot';
import { computeWptFlows, applyWptCharging } from '../src/wpt';
import { SIZE_PARAMS } from '../src/types';

const HUB_POS = { x: 50, y: 40 };

describe('Energy Cascade (套娃)', () => {

  // ── Nesting mechanics ──────────────────────────────────

  describe('Nesting mechanics', () => {
    it('nestInto sets correct state', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);

      child.nestInto(parent);

      expect(child.isNested).toBe(true);
      expect(child.phase).toBe('nested');
      expect(child.parentId).toBe(1);
      expect(parent.childIds).toContain(2);
      expect(child.position).toEqual(parent.position);
    });

    it('unnestFrom restores deployable state', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.nestInto(parent);

      child.unnestFrom(parent, { x: 5, y: 3 });

      expect(child.isNested).toBe(false);
      expect(child.phase).toBe('deploying-from-parent');
      expect(parent.childIds).not.toContain(2);
      expect(child.position.x).toBeCloseTo(55);
      expect(child.position.y).toBeCloseTo(43);
    });

    it('checkAutoNest nests when close enough', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.position = { x: 51, y: 40 }; // within 3m
      child.phase = 'returning-to-parent';
      child.parentId = 1;

      const nested = child.checkAutoNest(parent);

      expect(nested).toBe(true);
      expect(child.isNested).toBe(true);
      expect(child.phase).toBe('nested');
    });

    it('checkAutoNest does not nest when too far', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.position = { x: 60, y: 40 }; // >3m
      child.phase = 'returning-to-parent';
      child.parentId = 1;

      const nested = child.checkAutoNest(parent);

      expect(nested).toBe(false);
      expect(child.isNested).toBe(false);
    });

    it('double-nest does not duplicate childIds', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.nestInto(parent);
      child.nestInto(parent); // second nest

      expect(parent.childIds.filter(id => id === 2)).toHaveLength(1);
    });
  });

  // ── WPT energy flows ──────────────────────────────────

  describe('WPT flows', () => {
    it('parent with 4 nested children splits power equally', () => {
      const parent = new Robot(2, 'medium', HUB_POS);
      const children = [6, 7, 8, 9].map(id => {
        const c = new Robot(id, 'small', HUB_POS);
        c.nestInto(parent);
        return c;
      });

      const allRobots = [parent, ...children];
      const flows = computeWptFlows(allRobots);

      expect(flows).toHaveLength(4);
      const perChild = SIZE_PARAMS.medium.wptOutputMw / 4;
      for (const f of flows) {
        expect(f.fromId).toBe(2);
        expect(f.powerMw).toBeCloseTo(perChild, 0);
        expect(f.type).toBe('wpt');
      }
    });

    it('children at max range receive ~0 power', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.parentId = 1;
      parent.childIds = [2];
      child.isNested = false;
      // Place child at max WPT range
      child.position = {
        x: HUB_POS.x + SIZE_PARAMS.large.wptRangeM,
        y: HUB_POS.y,
      };

      const flows = computeWptFlows([parent, child]);
      // At exact max range, distanceFactor = 0
      expect(flows).toHaveLength(0);
    });

    it('offline parent produces no flows', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      parent.isOnline = false;
      const child = new Robot(2, 'medium', HUB_POS);
      child.nestInto(parent);

      const flows = computeWptFlows([parent, child]);
      expect(flows).toHaveLength(0);
    });
  });

  // ── WPT charging application ──────────────────────────

  describe('WPT charging', () => {
    it('applyWptCharging increases child battery', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.nestInto(parent);
      child.batterySoc = 50;

      const flows = computeWptFlows([parent, child]);
      applyWptCharging([parent, child], flows);

      expect(child.batterySoc).toBeGreaterThan(50);
      expect(child.wptReceiveMw).toBeGreaterThan(0);
      expect(parent.wptOutputMw).toBeGreaterThan(0);
    });

    it('small robots charge supercap first', () => {
      const parent = new Robot(2, 'medium', HUB_POS);
      const child = new Robot(6, 'small', HUB_POS);
      child.nestInto(parent);
      child.supercapSoc = 0;
      child.batterySoc = 50;

      const flows = computeWptFlows([parent, child]);
      applyWptCharging([parent, child], flows);

      expect(child.supercapSoc).toBeGreaterThan(0);
    });
  });

  // ── Three-source energy ──────────────────────────────

  describe('Three-source energy model', () => {
    it('SIZE_PARAMS has wind/regen/wpt fields for all sizes', () => {
      for (const size of ['small', 'medium', 'large', 'hub'] as const) {
        const p = SIZE_PARAMS[size];
        expect(p.windTurbineEff).toBeDefined();
        expect(p.regenPropEff).toBeDefined();
        expect(p.wptOutputMw).toBeDefined();
        expect(p.wptRangeM).toBeDefined();
        expect(p.maxChildren).toBeDefined();
        expect(p.supercapMah).toBeDefined();
      }
    });

    it('small has no wind turbine', () => {
      expect(SIZE_PARAMS.small.windTurbineEff).toBe(0);
    });

    it('hub has no regen propeller', () => {
      expect(SIZE_PARAMS.hub.regenPropEff).toBe(0);
    });

    it('small has supercap, others do not', () => {
      expect(SIZE_PARAMS.small.supercapMah).toBeGreaterThan(0);
      expect(SIZE_PARAMS.medium.supercapMah).toBe(0);
      expect(SIZE_PARAMS.large.supercapMah).toBe(0);
      expect(SIZE_PARAMS.hub.supercapMah).toBe(0);
    });
  });

  // ── Robot state emission ──────────────────────────────

  describe('Robot getState includes nesting fields', () => {
    it('emits nesting fields', () => {
      const parent = new Robot(1, 'large', HUB_POS);
      const child = new Robot(2, 'medium', HUB_POS);
      child.nestInto(parent);

      const state = child.getState();
      expect(state.isNested).toBe(true);
      expect(state.parentId).toBe(1);
      expect(state.childIds).toEqual([]);

      const parentState = parent.getState();
      expect(parentState.childIds).toContain(2);
    });

    it('emits energy fields', () => {
      const r = new Robot(0, 'hub', HUB_POS);
      const state = r.getState();
      expect(state.windHarvestMw).toBeDefined();
      expect(state.regenHarvestMw).toBeDefined();
      expect(state.wptReceiveMw).toBeDefined();
      expect(state.wptOutputMw).toBeDefined();
      expect(state.supercapSoc).toBeDefined();
    });
  });
});
