/**
 * export.ts — Data export utilities: CSV telemetry, JSON snapshot, mission reports
 */

import type { SwarmSnapshot, SwarmEvent } from '../hooks/useSocket';

/** Escape a value for safe CSV output (prevents CSV injection) */
function csvEscape(val: string | number): string {
  const s = String(val);
  if (/[",\n\r]/.test(s) || /^[=+\-@\t\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Trigger a file download in the browser */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Generate timestamp string for filenames */
function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Export current SwarmSnapshot as JSON */
export function exportSnapshotJson(snapshot: SwarmSnapshot) {
  const json = JSON.stringify(snapshot, null, 2);
  downloadFile(json, `swarm-snapshot-${timestamp()}.json`, 'application/json');
}

/** Export robot telemetry as CSV */
export function exportTelemetryCsv(snapshots: SwarmSnapshot | SwarmSnapshot[]) {
  const data = Array.isArray(snapshots) ? snapshots : [snapshots];

  const headers = [
    'tick', 'robot_id', 'name', 'x', 'y', 'heading_deg', 'speed',
    'battery_soc', 'power_mode', 'wind_class', 'wind_speed',
    'hdc_species', 'hdc_confidence', 'is_online', 'is_jammed', 'phase'
  ];

  const rows: string[] = [headers.join(',')];

  for (const snap of data) {
    for (const r of (snap.robots || [])) {
      rows.push([
        snap.tick,
        r.id,
        csvEscape(r.name),
        r.position.x.toFixed(2),
        r.position.y.toFixed(2),
        ((r.heading * 180 / Math.PI) % 360).toFixed(1),
        r.speed.toFixed(2),
        r.batterySoc.toFixed(1),
        csvEscape(r.powerMode),
        csvEscape(r.localWindClass),
        r.localWindSpeed.toFixed(2),
        csvEscape(r.hdc.predictedName),
        (r.hdc.confidence * 100).toFixed(1),
        r.isOnline,
        r.isJammed,
        csvEscape(r.phase),
      ].join(','));
    }
  }

  downloadFile(rows.join('\n'), `swarm-telemetry-${timestamp()}.csv`, 'text/csv');
}

/** Export mission history as JSON report */
export function exportMissionReport(history: Array<{ score: number }>, hdcStats: unknown) {
  const report = {
    exportedAt: new Date().toISOString(),
    missionCount: history.length,
    totalScore: history.reduce((sum: number, m) => sum + m.score, 0),
    missions: history,
    hdcAccuracy: hdcStats ?? null,
  };
  const json = JSON.stringify(report, null, 2);
  downloadFile(json, `mission-report-${timestamp()}.json`, 'application/json');
}

/** Export events as CSV */
export function exportEventsCsv(events: SwarmEvent[]) {
  const headers = ['tick', 'time_ms', 'type', 'message', 'robot_id'];
  const rows: string[] = [headers.join(',')];

  for (const e of events) {
    rows.push([
      e.tick,
      e.timeMs,
      csvEscape(e.type),
      csvEscape(e.message || ''),
      csvEscape(e.robotId ?? ''),
    ].join(','));
  }

  downloadFile(rows.join('\n'), `swarm-events-${timestamp()}.csv`, 'text/csv');
}
