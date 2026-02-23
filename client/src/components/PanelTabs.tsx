/**
 * PanelTabs.tsx — Tab group component for organizing related panels
 *
 * Supports both controlled (activeTab + onTabChange) and uncontrolled modes.
 */

import { useState, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  color?: string;
  content: React.ReactNode;
}

interface Props {
  tabs: Tab[];
  storageKey?: string;
  /** Controlled mode: override active tab from parent */
  activeTab?: string;
  /** Controlled mode: callback when user clicks a tab */
  onTabChange?: (tabId: string) => void;
}

export function PanelTabs({ tabs, storageKey, activeTab: controlledTab, onTabChange }: Props) {
  const [internalTab, setInternalTab] = useState(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`tabs:${storageKey}`);
        if (stored && tabs.some(t => t.id === stored)) return stored;
      } catch { /* localStorage unavailable */ }
    }
    return tabs[0]?.id ?? '';
  });

  const isControlled = controlledTab !== undefined;
  const currentTab = isControlled ? controlledTab : internalTab;

  useEffect(() => {
    if (storageKey && !isControlled) {
      try { localStorage.setItem(`tabs:${storageKey}`, internalTab); } catch { /* ignore */ }
    }
  }, [internalTab, storageKey, isControlled]);

  const handleTabClick = (tabId: string) => {
    if (isControlled) {
      onTabChange?.(tabId);
    } else {
      setInternalTab(tabId);
    }
  };

  // Fallback to first tab if current tab doesn't exist
  const active = tabs.find(t => t.id === currentTab) ?? tabs[0];

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 8,
      overflow: 'hidden',
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab bar */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid #21262d',
          flexShrink: 0,
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === active?.id;
          const tabButtonId = `tab-${storageKey ?? 'default'}-${tab.id}`;
          const tabPanelId = `tabpanel-${storageKey ?? 'default'}-${tab.id}`;
          return (
            <button
              key={tab.id}
              id={tabButtonId}
              role="tab"
              aria-selected={isActive}
              aria-controls={tabPanelId}
              onClick={() => handleTabClick(tab.id)}
              style={{
                flex: 1,
                padding: '5px 4px',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tab.color ?? '#58a6ff'}` : '2px solid transparent',
                background: isActive ? '#0d111720' : 'transparent',
                color: isActive ? (tab.color ?? '#58a6ff') : '#484f58',
                fontSize: 9,
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div
        role="tabpanel"
        id={`tabpanel-${storageKey ?? 'default'}-${active?.id ?? ''}`}
        aria-labelledby={`tab-${storageKey ?? 'default'}-${active?.id ?? ''}`}
        style={{ padding: 8, overflow: 'auto', flex: 1, minHeight: 0 }}
      >
        {active?.content}
      </div>
    </div>
  );
}
