const WIND_BADGE_COLORS: Record<string, string> = {
  CALM: '#3fb950', LIGHT: '#58a6ff', MODERATE: '#f0883e', STRONG: '#f85149',
};

export function WindIndicator({ windClass, speed, direction }: {
  windClass: string; speed: number; direction: number;
}) {
  const deg = (direction * 180 / Math.PI + 360) % 360;
  const color = WIND_BADGE_COLORS[windClass] ?? '#8b949e';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* Wind compass */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`,
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 2, height: 14, background: color, borderRadius: 1,
          transformOrigin: 'top center',
          transform: `translate(-50%, 0) rotate(${deg + 180}deg)`,
        }} />
        <div style={{
          position: 'absolute', top: 1, left: '50%', transform: 'translateX(-50%)',
          fontSize: 7, color: '#8b949e',
        }}>N</div>
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 'bold',
            background: color + '20', color,
          }}>{windClass}</span>
          <span style={{ fontSize: 10, color: '#8b949e' }}>{speed.toFixed(1)} m/s</span>
        </div>
        <div style={{ fontSize: 9, color: '#8b949e', marginTop: 2 }}>
          Direction: {deg.toFixed(0)}°
        </div>
      </div>
    </div>
  );
}
