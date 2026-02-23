import type { NestingStats } from '../hooks/useSocket';

interface Props {
  emit: (event: string, data?: unknown) => void;
  formation: string;
  nestingStats?: NestingStats;
}

const FORMATIONS = ['scatter', 'grid', 'ring', 'wedge', 'cluster'];

export function CommandBar({ emit, formation, nestingStats }: Props) {
  const deployed = nestingStats?.deployed ?? 0;
  const nested = nestingStats?.nested ?? 0;
  const total = deployed + nested + 1; // +1 for hub

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Fleet commands */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#58a6ff', fontWeight: 'bold' }}>Fleet Commands</span>
        <span style={{ fontSize: 9, color: '#8b949e' }}>
          {total} robots ({deployed} deployed, {nested} nested)
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <CmdBtn label="Deploy All" ariaLabel="Deploy all robots" color="#3fb950" onClick={() => emit('cmd:deploy')} />
        <CmdBtn label="Recall All" ariaLabel="Recall all robots to base" color="#58a6ff" onClick={() => emit('cmd:recall')} />
        <CmdBtn label="Trigger Gust" ariaLabel="Trigger a wind gust event" color="#f0883e" onClick={() => emit('cmd:gust')} />
      </div>

      {/* Formations */}
      <div style={{ fontSize: 10, color: '#58a6ff', fontWeight: 'bold', marginTop: 4 }}>Formation</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FORMATIONS.map(f => (
          <button
            key={f}
            onClick={() => emit('cmd:formation', f)}
            aria-label={`Set formation to ${f}`}
            style={{
              padding: '4px 10px', border: '1px solid #30363d', borderRadius: 4,
              background: formation === f ? '#58a6ff20' : '#0d1117',
              color: formation === f ? '#58a6ff' : '#8b949e',
              fontSize: 10, cursor: 'pointer', textTransform: 'capitalize',
            }}
          >{f}</button>
        ))}
      </div>

      {/* Adversarial */}
      <div style={{ fontSize: 10, color: '#f85149', fontWeight: 'bold', marginTop: 4 }}>Inject Scenario</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <CmdBtn label="RF Jamming" ariaLabel="Inject RF jamming scenario" color="#f85149" small onClick={() => emit('cmd:inject:jamming')} />
        <CmdBtn label="Clear Jam" ariaLabel="Clear RF jamming" color="#8b949e" small onClick={() => emit('cmd:inject:clear-jamming')} />
        <CmdBtn label="Node Fail" ariaLabel="Inject node failure scenario" color="#f0883e" small onClick={() => emit('cmd:inject:node-failure')} />
        <CmdBtn label="Byzantine" ariaLabel="Inject byzantine fault scenario" color="#a371f7" small onClick={() => emit('cmd:inject:byzantine')} />
        <CmdBtn label="Clear All" ariaLabel="Clear all injected scenarios" color="#8b949e" small onClick={() => emit('cmd:inject:clear-byzantine')} />
      </div>
    </div>
  );
}

function CmdBtn({ label, ariaLabel, color, onClick, small }: {
  label: string; ariaLabel?: string; color: string; onClick: () => void; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      style={{
        padding: small ? '3px 8px' : '6px 14px',
        border: `1px solid ${color}40`,
        borderRadius: 4,
        background: `${color}15`,
        color,
        fontSize: small ? 9 : 11,
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}
