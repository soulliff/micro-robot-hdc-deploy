const MODE_COLORS: Record<string, string> = {
  FULL: '#3fb950', NORMAL: '#58a6ff', ECO: '#d29922', CRITICAL: '#f85149',
};

interface EnergyBarProps {
  soc: number;
  solarMw: number;
  mode: string;
  minutes: number;
  windMw?: number;
  regenMw?: number;
  wptMw?: number;
  supercapSoc?: number;
  sizeClass?: string;
}

function MiniBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: '#8b949e', minWidth: 52 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: '#0d1117', borderRadius: 3, overflow: 'hidden', border: '1px solid #21262d' }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 8, color: '#8b949e', minWidth: 30, textAlign: 'right' }}>{value.toFixed(1)}%</span>
    </div>
  );
}

export function EnergyBar({ soc, solarMw, mode, minutes, windMw = 0, regenMw = 0, wptMw = 0, supercapSoc, sizeClass }: EnergyBarProps) {
  const batColor = soc > 50 ? '#3fb950' : soc > 20 ? '#d29922' : '#f85149';
  const showSupercap = sizeClass === 'small' && supercapSoc !== undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <MiniBar value={soc} color={batColor} label="Battery" />
      {showSupercap && (
        <MiniBar value={supercapSoc} color="#a371f7" label="Supercap" />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 9, color: '#8b949e' }}>
        <span style={{ color: '#d29922' }}>☀{solarMw.toFixed(1)}</span>
        {windMw > 0.01 && <span style={{ color: '#58a6ff' }}>⚙{windMw.toFixed(1)}</span>}
        {regenMw > 0.01 && <span style={{ color: '#3fb950' }}>↻{regenMw.toFixed(1)}</span>}
        {wptMw > 0.01 && <span style={{ color: '#a371f7' }}>⚡{wptMw.toFixed(1)}</span>}
        <span style={{ marginLeft: 'auto', color: MODE_COLORS[mode] ?? '#8b949e' }}>{mode}</span>
        <span>~{minutes}m</span>
      </div>
    </div>
  );
}
