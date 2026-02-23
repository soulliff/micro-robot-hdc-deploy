/**
 * MissionPanel.tsx — Mission HUD showing targets, score, and timer
 */

import type { MissionInfo } from '../hooks/useSocket';

const MISSION_TYPES = ['intercept', 'survey', 'search_classify', 'perimeter'] as const;

const STATUS_COLORS: Record<string, string> = {
  active: '#8b949e',
  detected: '#d29922',
  classified: '#3fb950',
  expired: '#484f58',
};

const TYPE_DESCRIPTIONS: Record<string, { label: string; desc: string; color: string }> = {
  survey: {
    label: 'SURVEY',
    desc: '6-zone coverage. 1 robot needed. +50 zone bonus.',
    color: '#3fb950',
  },
  intercept: {
    label: 'INTERCEPT',
    desc: 'Fast targets, small radius. 2x points. Hard mode.',
    color: '#f85149',
  },
  search_classify: {
    label: 'SEARCH & CLASSIFY',
    desc: 'Standard mode. 2 robots to classify. Baseline.',
    color: '#58a6ff',
  },
  perimeter: {
    label: 'PERIMETER',
    desc: 'Edge targets only. 3 robots needed for consensus.',
    color: '#a371f7',
  },
};

interface Props {
  mission: MissionInfo | undefined;
  emit: (event: string, data?: unknown) => void;
}

export function MissionPanel({ mission, emit }: Props) {
  const isActive = mission?.active ?? false;

  return (
    <div>

      {!isActive ? (
        <div>
          <div style={{ color: '#8b949e', fontSize: 10, marginBottom: 6 }}>
            Choose a mission type — each has unique rules and scoring.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {MISSION_TYPES.map(type => {
              const info = TYPE_DESCRIPTIONS[type];
              return (
                <button
                  key={type}
                  onClick={() => emit('cmd:start-mission', type)}
                  style={{
                    padding: '5px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    border: `1px solid ${info.color}40`,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: '#21262d',
                    color: info.color,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                  }}
                >
                  <span>{info.label}</span>
                  <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>
                    {info.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : mission ? (
        <div>
          {/* Type-specific rule banner */}
          {TYPE_DESCRIPTIONS[mission.type] && (
            <div style={{
              fontSize: 9, color: TYPE_DESCRIPTIONS[mission.type].color,
              background: TYPE_DESCRIPTIONS[mission.type].color + '10',
              padding: '3px 6px', borderRadius: 3, marginBottom: 4,
            }}>
              {TYPE_DESCRIPTIONS[mission.type].desc}
            </div>
          )}

          {/* Timer + Score */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>
              <span style={{ color: '#8b949e', fontSize: 10 }}>Type: </span>
              <span style={{ color: TYPE_DESCRIPTIONS[mission.type]?.color ?? '#e6edf3', fontSize: 10, fontWeight: 600 }}>
                {TYPE_DESCRIPTIONS[mission.type]?.label ?? mission.type.toUpperCase()}
              </span>
            </div>
            <div>
              <span style={{ color: '#8b949e', fontSize: 10 }}>Time: </span>
              <span style={{
                color: mission.timeRemainingMs < 10000 ? '#f85149' : '#e6edf3',
                fontSize: 10,
                fontWeight: 600,
              }}>
                {Math.ceil(mission.timeRemainingMs / 1000)}s
              </span>
            </div>
          </div>

          {/* Score bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#3fb950', fontSize: 18, fontWeight: 700 }}>{mission.score}</div>
              <div style={{ color: '#8b949e', fontSize: 9 }}>SCORE</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#3fb950', fontSize: 14, fontWeight: 600 }}>{mission.classified}</div>
              <div style={{ color: '#8b949e', fontSize: 9 }}>CLASSIFIED</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#f85149', fontSize: 14, fontWeight: 600 }}>{mission.expired}</div>
              <div style={{ color: '#8b949e', fontSize: 9 }}>EXPIRED</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#8b949e', fontSize: 14, fontWeight: 600 }}>{mission.totalTargets}</div>
              <div style={{ color: '#8b949e', fontSize: 9 }}>TOTAL</div>
            </div>
          </div>

          {/* Target list */}
          <div style={{ maxHeight: 100, overflow: 'auto' }}>
            {mission.targets
              .filter(t => t.status !== 'expired')
              .map(t => (
                <div key={t.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '2px 4px',
                  marginBottom: 1,
                  background: '#0d1117',
                  borderRadius: 3,
                  fontSize: 10,
                }}>
                  <span style={{ color: STATUS_COLORS[t.status] ?? '#8b949e' }}>
                    #{t.id} {t.speciesName}
                  </span>
                  <span style={{
                    color: STATUS_COLORS[t.status],
                    fontWeight: 600,
                    fontSize: 9,
                    textTransform: 'uppercase',
                  }}>
                    {t.status}
                    {t.detectedBy.length > 0 && ` (${t.detectedBy.length})`}
                  </span>
                </div>
              ))}
          </div>

          {/* Stop button */}
          <button
            onClick={() => emit('cmd:stop-mission')}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '4px 0',
              fontSize: 10,
              fontWeight: 600,
              border: '1px solid #f85149',
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
              color: '#f85149',
            }}
          >
            Stop Mission
          </button>
        </div>
      ) : null}
    </div>
  );
}
