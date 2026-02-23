/**
 * KeyboardHelp.tsx — Floating overlay showing keyboard shortcuts
 */

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'D', desc: 'Deploy fleet' },
  { key: 'R', desc: 'Recall fleet' },
  { key: 'G', desc: 'Trigger wind gust' },
  { key: '1', desc: 'Formation: Scatter' },
  { key: '2', desc: 'Formation: Grid' },
  { key: '3', desc: 'Formation: Ring' },
  { key: '4', desc: 'Formation: Wedge' },
  { key: '5', desc: 'Formation: Cluster' },
  { key: 'Tab', desc: 'Select next robot' },
  { key: 'Esc', desc: 'Deselect robot' },
  { key: 'Space', desc: 'Toggle 2D/3D view' },
  { key: 'M', desc: 'Toggle sound' },
  { key: '?', desc: 'Toggle this help' },
];

export function KeyboardHelp({ visible, onClose }: Props) {
  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161b22', border: '1px solid #30363d',
          borderRadius: 12, padding: 20, minWidth: 280, maxWidth: 360,
        }}
      >
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#58a6ff',
          marginBottom: 12, textAlign: 'center',
        }}>
          KEYBOARD SHORTCUTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SHORTCUTS.map(s => (
            <div key={s.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0',
            }}>
              <kbd style={{
                background: '#21262d', border: '1px solid #30363d',
                borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace',
                fontSize: 11, fontWeight: 700, color: '#e6edf3',
                minWidth: 36, textAlign: 'center',
              }}>
                {s.key}
              </kbd>
              <span style={{ fontSize: 12, color: '#8b949e' }}>{s.desc}</span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, textAlign: 'center', fontSize: 10, color: '#484f58',
        }}>
          Press ? or Esc to close
        </div>
      </div>
    </div>
  );
}
