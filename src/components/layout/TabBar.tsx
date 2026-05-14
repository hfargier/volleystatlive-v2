import React from 'react';

export type AppTab = 'input' | 'stats' | 'setup';

interface TabBarProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS = [
  { id: 'input' as AppTab, label: 'Saisie', symbol: '✏' },
  { id: 'stats' as AppTab, label: 'Stats', symbol: '📊' },
  { id: 'setup' as AppTab, label: 'Config', symbol: '⚙' },
];

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: '#1e1e1e',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        zIndex: 50,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              color: isActive ? '#FFD700' : '#5a554e',
              background: 'none',
              border: 'none',
              minHeight: 56,
              fontSize: 10,
              fontWeight: isActive ? 700 : 400,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
            aria-label={tab.label}
          >
            <span style={{ fontSize: 18 }}>{tab.symbol}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}