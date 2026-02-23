import { useRef, useEffect, useState, useCallback } from 'react';
import type { SwarmEvent } from '../hooks/useSocket';

const TYPE_COLORS: Record<string, string> = {
  deploy: '#3fb950',
  recall: '#58a6ff',
  formation: '#a371f7',
  wind_change: '#f0883e',
  low_battery: '#d29922',
  consensus: '#58a6ff',
  jamming: '#f85149',
  node_fail: '#f85149',
  byzantine: '#f0883e',
  recovery: '#3fb950',
  info: '#8b949e',
};

const ALL_TYPES = Object.keys(TYPE_COLORS);

export function EventLog({ events }: { events: SwarmEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const prevLen = useRef(events.length);

  // Filter events
  const filtered = events.filter(e => {
    if (activeFilters.size > 0 && !activeFilters.has(e.type)) return false;
    if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Count new events when auto-scroll is paused
  useEffect(() => {
    if (events.length > prevLen.current) {
      if (!autoScroll) {
        setNewCount(prev => prev + (events.length - prevLen.current));
      }
    }
    prevLen.current = events.length;
  }, [events.length, autoScroll]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    }
  }, [filtered.length, autoScroll]);

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Event type counts
  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }

  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
      padding: 10, display: 'flex', flexDirection: 'column', maxHeight: 260,
    }}>
      {/* Header with controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, color: '#58a6ff', fontWeight: 'bold' }}>
          Event Log ({filtered.length}/{events.length})
        </span>
        <button
          onClick={() => { setAutoScroll(v => !v); if (!autoScroll) setNewCount(0); }}
          style={{
            background: 'none', border: `1px solid ${autoScroll ? '#3fb950' : '#484f58'}`,
            borderRadius: 3, padding: '1px 4px', fontSize: 8,
            color: autoScroll ? '#3fb950' : '#484f58', cursor: 'pointer',
          }}
        >
          {autoScroll ? 'AUTO' : 'PAUSED'}
        </button>
        {newCount > 0 && (
          <button
            onClick={() => { setAutoScroll(true); setNewCount(0); }}
            style={{
              background: '#1f6feb30', border: '1px solid #1f6feb',
              borderRadius: 3, padding: '1px 4px', fontSize: 8,
              color: '#58a6ff', cursor: 'pointer',
            }}
          >
            {newCount} new
          </button>
        )}
        <button
          onClick={exportJson}
          style={{
            background: 'none', border: '1px solid #30363d',
            borderRadius: 3, padding: '1px 4px', fontSize: 8,
            color: '#8b949e', cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          EXPORT
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search events..."
        style={{
          background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
          padding: '3px 6px', fontSize: 9, color: '#e6edf3', marginBottom: 4,
          outline: 'none', width: '100%',
        }}
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 4 }}>
        {ALL_TYPES.map(type => {
          const count = typeCounts[type] ?? 0;
          if (count === 0) return null;
          const isActive = activeFilters.size === 0 || activeFilters.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              style={{
                background: isActive ? `${TYPE_COLORS[type]}20` : '#0d1117',
                border: `1px solid ${isActive ? TYPE_COLORS[type] : '#21262d'}`,
                borderRadius: 3, padding: '1px 4px', fontSize: 7,
                color: isActive ? TYPE_COLORS[type] : '#484f58',
                cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              {type.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {filtered.length === 0 && (
          <div style={{ fontSize: 10, color: '#484f58', fontStyle: 'italic' }}>No events yet...</div>
        )}
        {filtered.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10, lineHeight: 1.4 }}>
            <span style={{ color: '#484f58', flexShrink: 0, fontFamily: 'monospace' }}>
              {(e.timeMs / 1000).toFixed(1)}s
            </span>
            <span style={{
              color: TYPE_COLORS[e.type] ?? '#8b949e',
              fontWeight: 'bold', flexShrink: 0, width: 60, textTransform: 'uppercase',
            }}>{e.type}</span>
            <span style={{ color: '#e6edf3' }}>{e.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
