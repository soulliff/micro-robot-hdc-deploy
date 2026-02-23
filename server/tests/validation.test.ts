import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  moveSchema,
  powerSchema,
  robotIdSchema,
  formationSchema,
  missionTypeSchema,
  replayParamsSchema,
} from '../src/validation';

// ── moveSchema ────────────────────────────────────────────

describe('moveSchema', () => {
  it('accepts valid move input', () => {
    const result = moveSchema.parse({ robotId: 0, x: 50, y: 40 });
    expect(result).toEqual({ robotId: 0, x: 50, y: 40 });
  });

  it('accepts boundary values', () => {
    expect(moveSchema.parse({ robotId: 0, x: 0, y: 0 })).toEqual({ robotId: 0, x: 0, y: 0 });
    expect(moveSchema.parse({ robotId: 7, x: 120, y: 80 })).toEqual({ robotId: 7, x: 120, y: 80 });
  });

  it('rejects robotId below 0', () => {
    expect(() => moveSchema.parse({ robotId: -1, x: 50, y: 40 })).toThrow(ZodError);
  });

  it('rejects robotId above 7', () => {
    expect(() => moveSchema.parse({ robotId: 8, x: 50, y: 40 })).toThrow(ZodError);
  });

  it('rejects non-integer robotId', () => {
    expect(() => moveSchema.parse({ robotId: 1.5, x: 50, y: 40 })).toThrow(ZodError);
  });

  it('rejects x below 0', () => {
    expect(() => moveSchema.parse({ robotId: 0, x: -1, y: 40 })).toThrow(ZodError);
  });

  it('rejects x above 120', () => {
    expect(() => moveSchema.parse({ robotId: 0, x: 121, y: 40 })).toThrow(ZodError);
  });

  it('rejects y below 0', () => {
    expect(() => moveSchema.parse({ robotId: 0, x: 50, y: -1 })).toThrow(ZodError);
  });

  it('rejects y above 80', () => {
    expect(() => moveSchema.parse({ robotId: 0, x: 50, y: 81 })).toThrow(ZodError);
  });

  it('rejects missing fields', () => {
    expect(() => moveSchema.parse({})).toThrow(ZodError);
    expect(() => moveSchema.parse({ robotId: 0 })).toThrow(ZodError);
    expect(() => moveSchema.parse({ x: 50, y: 40 })).toThrow(ZodError);
  });

  it('rejects wrong types', () => {
    expect(() => moveSchema.parse({ robotId: 'zero', x: 50, y: 40 })).toThrow(ZodError);
    expect(() => moveSchema.parse({ robotId: 0, x: 'fifty', y: 40 })).toThrow(ZodError);
  });
});

// ── powerSchema ───────────────────────────────────────────

describe('powerSchema', () => {
  it('accepts valid power modes', () => {
    for (const mode of ['FULL', 'NORMAL', 'ECO', 'CRITICAL'] as const) {
      const result = powerSchema.parse({ robotId: 3, mode });
      expect(result).toEqual({ robotId: 3, mode });
    }
  });

  it('rejects invalid power mode', () => {
    expect(() => powerSchema.parse({ robotId: 0, mode: 'TURBO' })).toThrow(ZodError);
  });

  it('rejects missing mode', () => {
    expect(() => powerSchema.parse({ robotId: 0 })).toThrow(ZodError);
  });

  it('rejects robotId out of range', () => {
    expect(() => powerSchema.parse({ robotId: 10, mode: 'ECO' })).toThrow(ZodError);
    expect(() => powerSchema.parse({ robotId: -1, mode: 'ECO' })).toThrow(ZodError);
  });
});

// ── robotIdSchema ─────────────────────────────────────────

describe('robotIdSchema', () => {
  it('accepts valid robot IDs 0-7', () => {
    for (let id = 0; id <= 7; id++) {
      expect(robotIdSchema.parse({ robotId: id })).toEqual({ robotId: id });
    }
  });

  it('rejects robotId above 7', () => {
    expect(() => robotIdSchema.parse({ robotId: 8 })).toThrow(ZodError);
  });

  it('rejects robotId below 0', () => {
    expect(() => robotIdSchema.parse({ robotId: -1 })).toThrow(ZodError);
  });

  it('rejects non-integer robotId', () => {
    expect(() => robotIdSchema.parse({ robotId: 2.5 })).toThrow(ZodError);
  });

  it('rejects missing robotId', () => {
    expect(() => robotIdSchema.parse({})).toThrow(ZodError);
  });
});

// ── formationSchema ───────────────────────────────────────

describe('formationSchema', () => {
  it('accepts all valid formation types', () => {
    for (const f of ['scatter', 'grid', 'ring', 'wedge', 'cluster'] as const) {
      expect(formationSchema.parse(f)).toBe(f);
    }
  });

  it('rejects invalid formation type', () => {
    expect(() => formationSchema.parse('diamond')).toThrow(ZodError);
  });

  it('rejects empty string', () => {
    expect(() => formationSchema.parse('')).toThrow(ZodError);
  });

  it('rejects number input', () => {
    expect(() => formationSchema.parse(42)).toThrow(ZodError);
  });

  it('rejects null and undefined', () => {
    expect(() => formationSchema.parse(null)).toThrow(ZodError);
    expect(() => formationSchema.parse(undefined)).toThrow(ZodError);
  });
});

// ── missionTypeSchema ─────────────────────────────────────

describe('missionTypeSchema', () => {
  it('accepts all valid mission types', () => {
    for (const t of ['intercept', 'survey', 'search_classify', 'perimeter'] as const) {
      expect(missionTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects invalid mission type', () => {
    expect(() => missionTypeSchema.parse('patrol')).toThrow(ZodError);
  });

  it('rejects non-string input', () => {
    expect(() => missionTypeSchema.parse(123)).toThrow(ZodError);
  });
});

// ── replayParamsSchema ────────────────────────────────────

describe('replayParamsSchema', () => {
  it('parses valid string integer params and transforms to numbers', () => {
    const result = replayParamsSchema.parse({ from: '100', to: '200' });
    expect(result).toEqual({ from: 100, to: 200 });
  });

  it('transforms "0" correctly', () => {
    const result = replayParamsSchema.parse({ from: '0', to: '50' });
    expect(result).toEqual({ from: 0, to: 50 });
  });

  it('rejects non-integer strings', () => {
    expect(() => replayParamsSchema.parse({ from: 'abc', to: '200' })).toThrow(ZodError);
    expect(() => replayParamsSchema.parse({ from: '100', to: '3.14' })).toThrow(ZodError);
  });

  it('rejects negative number strings', () => {
    expect(() => replayParamsSchema.parse({ from: '-5', to: '200' })).toThrow(ZodError);
  });

  it('rejects missing fields', () => {
    expect(() => replayParamsSchema.parse({})).toThrow(ZodError);
    expect(() => replayParamsSchema.parse({ from: '100' })).toThrow(ZodError);
  });

  it('rejects number inputs (expects strings)', () => {
    expect(() => replayParamsSchema.parse({ from: 100, to: 200 })).toThrow(ZodError);
  });
});
