/**
 * ConsensusPanel.tsx — Shows per-robot HDC classification and swarm consensus
 */

import type { SwarmSnapshot } from '../hooks/useSocket';

interface Props {
  snapshot: SwarmSnapshot | null;
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? '#3fb950' : pct >= 50 ? '#d29922' : '#f85149';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: '#8b949e', width: 36, textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 600, width: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export function ConsensusPanel({ snapshot }: Props) {
  if (!snapshot) return null;

  const consensus = snapshot.stats.consensus;
  const onlineRobots = snapshot.robots.filter(r => r.isOnline);

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      padding: 8,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#a371f7',
        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>HDC CONSENSUS</span>
        {consensus && (
          <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>
            {consensus.voters}/{consensus.totalOnline} voters
          </span>
        )}
      </div>

      {/* Swarm consensus result */}
      {consensus ? (
        <div style={{
          background: '#0d1117', borderRadius: 6, padding: 6, marginBottom: 6,
          border: `1px solid ${consensus.confidence > 0.75 ? '#3fb950' : '#30363d'}40`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>
              {consensus.species}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: consensus.confidence > 0.85 ? '#3fb950' : consensus.confidence > 0.6 ? '#d29922' : '#f85149',
            }}>
              {(consensus.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <ConfidenceBar value={consensus.confidence} label="Conf" />
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#484f58', textAlign: 'center', padding: 4 }}>
          Waiting for consensus...
        </div>
      )}

      {/* Per-robot classifications */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflow: 'auto' }}>
        {onlineRobots.map(r => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 4px', background: '#0d1117', borderRadius: 3,
            border: r.isByzantine ? '1px solid #f8514950' : 'none',
          }}>
            <span style={{
              fontSize: 9, fontWeight: 600, color: '#e6edf3',
              width: 32, overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {r.name}
            </span>
            <span style={{ fontSize: 9, color: '#58a6ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.hdc.predictedName}
            </span>
            <span style={{
              fontSize: 8, fontWeight: 600, width: 28, textAlign: 'right',
              color: r.hdc.confidence > 0.7 ? '#3fb950' : r.hdc.confidence > 0.4 ? '#d29922' : '#f85149',
            }}>
              {(r.hdc.confidence * 100).toFixed(0)}%
            </span>
            {r.isByzantine && (
              <span style={{ fontSize: 7, color: '#f85149', fontWeight: 700 }}>BYZ</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
