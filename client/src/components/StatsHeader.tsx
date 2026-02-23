import type { SwarmStats } from '../hooks/useSocket';

const WIND_COLORS: Record<string, string> = {
  CALM: '#3fb950', LIGHT: '#58a6ff', MODERATE: '#f0883e', STRONG: '#f85149',
};

export function StatsHeader({ stats, connected }: { stats: SwarmStats | null; connected: boolean }) {
  const s = stats;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', padding: '10px 0' }}>
      <Stat label="Status" value={connected ? 'LIVE' : 'OFFLINE'} color={connected ? '#3fb950' : '#f85149'} />
      <Stat label="Robots" value={s ? `${s.onlineRobots}/${s.totalRobots}` : '-'} />
      {s && s.chargingRobots > 0 && (
        <Stat label="Charging" value={`${s.chargingRobots}`} color="#d29922" />
      )}
      <Stat label="Battery" value={s ? `${s.avgBatterySoc.toFixed(0)}%` : '-'} color={s && s.avgBatterySoc < 20 ? '#f85149' : '#58a6ff'} />
      <Stat label="Wind" value={s?.windClass ?? '-'} color={s ? WIND_COLORS[s.windClass] ?? '#58a6ff' : '#58a6ff'} />
      <Stat label="Formation" value={s?.formation ?? '-'} />
      <Stat label="Coordinator" value={s ? `R${s.coordinatorId}` : '-'} />
      <Stat label="Uptime" value={s ? `${s.uptimeSeconds.toFixed(0)}s` : '-'} />
    </div>
  );
}

function Stat({ label, value, color = '#58a6ff' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
      padding: '8px 16px', textAlign: 'center', minWidth: 80,
    }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{label}</div>
    </div>
  );
}
