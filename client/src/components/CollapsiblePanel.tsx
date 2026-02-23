/**
 * CollapsiblePanel.tsx — Generic collapsible panel wrapper
 */

import { useState, useEffect, useId } from 'react';

interface Props {
  title: string;
  color?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  children: React.ReactNode;
}

export function CollapsiblePanel({
  title,
  color = '#58a6ff',
  defaultOpen = true,
  storageKey,
  children,
}: Props) {
  const panelId = useId();
  const [open, setOpen] = useState(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`panel:${storageKey}`);
        if (stored !== null) return stored === 'true';
      } catch { /* localStorage unavailable */ }
    }
    return defaultOpen;
  });

  useEffect(() => {
    if (storageKey) {
      try { localStorage.setItem(`panel:${storageKey}`, String(open)); } catch { /* ignore */ }
    }
  }, [open, storageKey]);

  const contentId = `collapsible-content-${panelId}`;

  return (
    <div
      role="region"
      aria-label={title}
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 8, color: '#484f58',
          transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▶
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{title}</span>
      </button>
      {open && (
        <div id={contentId} style={{ padding: '0 8px 8px' }}>
          {children}
        </div>
      )}
    </div>
  );
}
