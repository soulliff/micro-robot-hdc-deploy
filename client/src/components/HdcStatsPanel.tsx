/**
 * HdcStatsPanel.tsx — Real-time HDC classification accuracy tracking
 */

import { useState, useEffect, useRef } from 'react';
import type { HdcStatsData } from '../hooks/useSocket';

interface Props {
  hdcStats: HdcStatsData | undefined;
}

const SPECIES_COLORS = [
  '#58a6ff', '#3fb950', '#f0883e', '#a371f7', '#f85149', '#d29922',
];

export function HdcStatsPanel({ hdcStats }: Props) {
  const [recentAccuracies, setRecentAccuracies] = useState<number[]>([]);
  const prevTotal = useRef(0);

  // Track rolling accuracy over recent inferences
  useEffect(() => {
    if (!hdcStats || hdcStats.totalInferences === 0) return;
    if (hdcStats.totalInferences === prevTotal.current) return;
    prevTotal.current = hdcStats.totalInferences;

    setRecentAccuracies(prev => {
      const next = [...prev, hdcStats.runningAccuracy];
      return next.length > 30 ? next.slice(-30) : next;
    });
  }, [hdcStats?.totalInferences, hdcStats?.runningAccuracy]);

  if (!hdcStats) {
    return (
      <div style={{
        background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#f0883e', marginBottom: 4 }}>
          HDC ACCURACY
        </div>
        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 8 }}>
          Run a mission to track HDC accuracy
        </div>
      </div>
    );
  }

  const accPct = (hdcStats.runningAccuracy * 100).toFixed(1);
  const accColor = hdcStats.runningAccuracy >= 0.75 ? '#3fb950'
    : hdcStats.runningAccuracy >= 0.5 ? '#d29922' : '#f85149';

  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: 8, padding: 8,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#f0883e',
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>HDC ACCURACY</span>
        <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>
          {hdcStats.totalInferences} inferences
        </span>
      </div>

      {/* Main accuracy display */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 6,
        background: '#0d1117', borderRadius: 6, padding: 6,
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: accColor, fontFamily: 'monospace' }}>
            {accPct}%
          </div>
          <div style={{ fontSize: 8, color: '#8b949e' }}>ACCURACY</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#3fb950', fontFamily: 'monospace' }}>
            {hdcStats.correctClassifications}
          </div>
          <div style={{ fontSize: 8, color: '#8b949e' }}>CORRECT</div>
        </div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f85149', fontFamily: 'monospace' }}>
            {hdcStats.totalInferences - hdcStats.correctClassifications}
          </div>
          <div style={{ fontSize: 8, color: '#8b949e' }}>WRONG</div>
        </div>
      </div>

      {/* Sparkline of rolling accuracy */}
      {recentAccuracies.length > 1 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 8, color: '#8b949e', marginBottom: 2 }}>
            ROLLING ACCURACY (last {recentAccuracies.length} samples)
          </div>
          <Sparkline data={recentAccuracies} height={24} />
        </div>
      )}

      {/* Per-species accuracy */}
      <div style={{ fontSize: 8, color: '#8b949e', marginBottom: 2 }}>PER-SPECIES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {hdcStats.perSpecies.map((sp, i) => {
          if (sp.total === 0) return null;
          const spAcc = sp.total > 0 ? sp.correct / sp.total : 0;
          const spPct = (spAcc * 100).toFixed(0);
          return (
            <div key={sp.species} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 4px', background: '#0d1117', borderRadius: 3,
            }}>
              <span style={{
                fontSize: 8, color: SPECIES_COLORS[i] ?? '#8b949e',
                width: 50, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontWeight: 600,
              }}>
                {sp.species}
              </span>
              <div style={{
                flex: 1, height: 4, background: '#21262d', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${spPct}%`, height: '100%',
                  background: SPECIES_COLORS[i] ?? '#58a6ff', borderRadius: 2,
                }} />
              </div>
              <span style={{
                fontSize: 8, fontWeight: 600, width: 28, textAlign: 'right',
                color: spAcc >= 0.75 ? '#3fb950' : spAcc >= 0.5 ? '#d29922' : '#f85149',
              }}>
                {spPct}%
              </span>
              <span style={{ fontSize: 7, color: '#484f58', width: 24, textAlign: 'right' }}>
                {sp.correct}/{sp.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sparkline({ data, height = 24 }: { data: number[]; height?: number }) {
  const width = 280;
  const maxVal = 1;
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - minVal) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* 50% line */}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2}
        stroke="#30363d" strokeWidth={0.5} strokeDasharray="4,4" />
      {/* 75% line */}
      <line x1={0} y1={height * 0.25} x2={width} y2={height * 0.25}
        stroke="#30363d" strokeWidth={0.5} strokeDasharray="2,4" />
      <polyline
        points={points}
        fill="none"
        stroke="#f0883e"
        strokeWidth={1.5}
      />
    </svg>
  );
}
