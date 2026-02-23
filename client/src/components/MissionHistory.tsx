/**
 * MissionHistory.tsx — Shows past mission results and high scores
 */

import { useState, useEffect } from 'react';

interface MissionResult {
  type: string;
  score: number;
  classified: number;
  expired: number;
  totalTargets: number;
  durationMs: number;
  timestamp: number;
}

const TYPE_COLORS: Record<string, string> = {
  survey: '#3fb950',
  intercept: '#f85149',
  search_classify: '#58a6ff',
  perimeter: '#a371f7',
};

export function MissionHistory() {
  const [history, setHistory] = useState<MissionResult[]>([]);

  // Poll for history every 5 seconds
  useEffect(() => {
    const fetchHistory = () => {
      fetch('/mission/history')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setHistory(data);
        })
        .catch(() => {});
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  if (history.length === 0) {
    return (
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#d29922', marginBottom: 4 }}>
          MISSION HISTORY
        </div>
        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
          No missions completed yet
        </div>
      </div>
    );
  }

  const highScore = Math.max(...history.map(h => h.score));

  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 8, padding: 8,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#d29922',
        marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>MISSION HISTORY</span>
        <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>
          {history.length} missions
        </span>
      </div>

      <div style={{ maxHeight: 140, overflow: 'auto' }}>
        {[...history].reverse().map((m, i) => {
          const isHigh = m.score === highScore && m.score > 0;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 4px', marginBottom: 1,
              background: isHigh ? '#1a2740' : '#0d1117',
              borderRadius: 3,
              border: isHigh ? '1px solid #d2992240' : 'none',
            }}>
              <span style={{
                fontSize: 8, fontWeight: 700,
                color: TYPE_COLORS[m.type] ?? '#8b949e',
                width: 48, textTransform: 'uppercase',
              }}>
                {m.type.replace('_', ' ')}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: m.score > 0 ? '#3fb950' : '#f85149',
                width: 36, textAlign: 'right',
              }}>
                {m.score}
              </span>
              <span style={{ fontSize: 8, color: '#8b949e', flex: 1 }}>
                {m.classified}/{m.totalTargets}
              </span>
              <span style={{ fontSize: 8, color: '#484f58' }}>
                {(m.durationMs / 1000).toFixed(0)}s
              </span>
              {isHigh && <span style={{ fontSize: 8, color: '#d29922' }}>HI</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
