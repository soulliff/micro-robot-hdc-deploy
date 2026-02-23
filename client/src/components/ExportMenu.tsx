import { useState, useRef, useEffect } from 'react';
import { exportSnapshotJson, exportTelemetryCsv, exportMissionReport, exportEventsCsv } from '../lib/export';
import type { SwarmSnapshot, SwarmEvent } from '../hooks/useSocket';

interface Props {
  snapshot: SwarmSnapshot | null;
  events: SwarmEvent[];
}

export function ExportMenu({ snapshot, events }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { label: 'Snapshot JSON', action: () => snapshot && exportSnapshotJson(snapshot) },
    { label: 'Telemetry CSV', action: () => snapshot && exportTelemetryCsv(snapshot) },
    { label: 'Events CSV', action: () => exportEventsCsv(events) },
    { label: 'Mission Report', action: async () => {
      try {
        const res = await fetch('/mission/history');
        const history = await res.json();
        exportMissionReport(history, snapshot?.stats?.hdcStats);
      } catch {
        /* ignore fetch errors */
      }
    }},
  ];

  return (
    <div ref={ref} style={{ display: 'inline-block', position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'none', border: '1px solid #30363d', borderRadius: 4,
          color: '#d29922', cursor: 'pointer', fontSize: 10, padding: '1px 6px',
        }}
      >
        EXPORT
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#161b22', border: '1px solid #30363d', borderRadius: 6,
          padding: 4, zIndex: 1000, minWidth: 140,
          boxShadow: '0 4px 12px #00000060',
        }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '5px 8px', fontSize: 10, color: '#e6edf3',
                background: 'transparent', border: 'none', borderRadius: 3,
                cursor: 'pointer',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#21262d')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
