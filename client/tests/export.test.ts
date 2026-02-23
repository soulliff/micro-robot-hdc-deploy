import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportSnapshotJson,
  exportTelemetryCsv,
  exportMissionReport,
} from '../src/lib/export';
import type { SwarmSnapshot } from '../src/hooks/useSocket';

// Track what was "downloaded"
let capturedContent: string;
let capturedFilename: string;
let clickSpy: ReturnType<typeof vi.fn>;

// Keep a reference to the real createElement BEFORE any mocking
const realCreateElement = document.createElement.bind(document);

beforeEach(() => {
  capturedContent = '';
  capturedFilename = '';
  clickSpy = vi.fn();

  // Mock URL.createObjectURL to capture blob content
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      blob.text().then((t: string) => { capturedContent = t; });
      return 'blob:mock-url';
    }),
    revokeObjectURL: vi.fn(),
  });

  // Mock document.createElement to intercept anchor creation
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      const anchor = realCreateElement('a');
      Object.defineProperty(anchor, 'download', {
        set(value: string) { capturedFilename = value; },
        get() { return capturedFilename; },
        configurable: true,
      });
      anchor.click = clickSpy;
      return anchor;
    }
    return realCreateElement(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Minimal valid SwarmSnapshot for testing */
function makeSnapshot(overrides?: Partial<SwarmSnapshot>): SwarmSnapshot {
  return {
    tick: 42,
    timeMs: 12345,
    formation: 'grid',
    robots: [
      {
        id: 0,
        name: 'R0',
        sizeClass: 'small',
        phase: 'patrol',
        position: { x: 1.5, y: 2.5 },
        velocity: { x: 0, y: 0 },
        heading: Math.PI / 4,
        speed: 0.5,
        targetPosition: null,
        batterySoc: 85.3,
        solarHarvestMw: 10,
        powerMode: 'normal',
        estimatedMinutes: 120,
        localWindClass: 'CALM',
        localWindSpeed: 1.2,
        localWindDirection: 0,
        hdc: {
          melFeatures: [],
          hiddenActivations: [],
          hdVector: [],
          classSimilarities: [],
          predictedClass: 3,
          predictedName: 'Aedes',
          confidence: 0.92,
        },
        isCoordinator: true,
        zoneId: 0,
        bleRangeM: 50,
        isOnline: true,
        isJammed: false,
        isByzantine: false,
        tickCount: 42,
      },
    ],
    wind: {
      baseDirection: 0,
      baseSpeed: 2,
      gustActive: false,
      gustCenter: { x: 0, y: 0 },
      gustRadius: 0,
      gustSpeed: 0,
      windClass: 'CALM',
    },
    bleLinks: [],
    events: [],
    stats: {
      totalRobots: 1,
      onlineRobots: 1,
      chargingRobots: 0,
      avgBatterySoc: 85.3,
      windClass: 'CALM',
      formation: 'grid',
      coordinatorId: 0,
      uptimeSeconds: 123,
    },
    ...overrides,
  };
}

describe('exportSnapshotJson', () => {
  it('creates valid JSON from a SwarmSnapshot', async () => {
    const snapshot = makeSnapshot();
    exportSnapshotJson(snapshot);

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const parsed = JSON.parse(capturedContent);
    expect(parsed.tick).toBe(42);
    expect(parsed.robots).toHaveLength(1);
    expect(parsed.robots[0].name).toBe('R0');
  });

  it('triggers a file download with .json extension', async () => {
    exportSnapshotJson(makeSnapshot());
    await vi.waitFor(() => {
      expect(capturedFilename).toMatch(/^swarm-snapshot-.*\.json$/);
    });
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

describe('exportTelemetryCsv', () => {
  it('creates CSV with correct headers', async () => {
    exportTelemetryCsv(makeSnapshot());

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const lines = capturedContent.split('\n');
    const headers = lines[0].split(',');
    expect(headers).toContain('tick');
    expect(headers).toContain('robot_id');
    expect(headers).toContain('battery_soc');
    expect(headers).toContain('hdc_species');
    expect(headers).toContain('hdc_confidence');
  });

  it('includes one data row per robot', async () => {
    exportTelemetryCsv(makeSnapshot());

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const lines = capturedContent.split('\n').filter(l => l.length > 0);
    // 1 header + 1 data row
    expect(lines).toHaveLength(2);
  });

  it('handles an array of snapshots', async () => {
    exportTelemetryCsv([makeSnapshot(), makeSnapshot({ tick: 43 })]);

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const lines = capturedContent.split('\n').filter(l => l.length > 0);
    // 1 header + 2 data rows (one per snapshot, each has 1 robot)
    expect(lines).toHaveLength(3);
  });

  it('triggers download with .csv extension', async () => {
    exportTelemetryCsv(makeSnapshot());
    await vi.waitFor(() => {
      expect(capturedFilename).toMatch(/^swarm-telemetry-.*\.csv$/);
    });
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});

describe('exportMissionReport', () => {
  it('creates valid JSON with mission stats', async () => {
    const history = [
      { score: 100 },
      { score: 200 },
      { score: 50 },
    ];
    const hdcStats = { totalInferences: 100, runningAccuracy: 0.85 };

    exportMissionReport(history, hdcStats);

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const parsed = JSON.parse(capturedContent);
    expect(parsed.missionCount).toBe(3);
    expect(parsed.totalScore).toBe(350);
    expect(parsed.missions).toHaveLength(3);
    expect(parsed.hdcAccuracy).toEqual(hdcStats);
    expect(parsed.exportedAt).toBeTruthy();
  });

  it('handles empty history', async () => {
    exportMissionReport([], null);

    await vi.waitFor(() => {
      expect(capturedContent).not.toBe('');
    });

    const parsed = JSON.parse(capturedContent);
    expect(parsed.missionCount).toBe(0);
    expect(parsed.totalScore).toBe(0);
    expect(parsed.missions).toEqual([]);
    expect(parsed.hdcAccuracy).toBeNull();
  });

  it('triggers download with mission-report filename', async () => {
    exportMissionReport([{ score: 10 }], null);
    await vi.waitFor(() => {
      expect(capturedFilename).toMatch(/^mission-report-.*\.json$/);
    });
    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
