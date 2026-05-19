// src/components/layout/AppShell.tsx
// Header supprimé — titre + score déplacés dans la colonne droite (frise).
// Le terrain peut ainsi occuper toute la hauteur écran.

import React, { useState } from 'react';
import { TabBar } from './TabBar';
import type { AppTab } from './TabBar';
import { InputView } from '../input/InputView';
import { StatsPanel } from '../stats/StatsPanel';
import { MatchSetup } from '../setup/MatchSetup';
import { useMatchStore } from '../../store/matchStore';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('input');
  const isSetupComplete = useMatchStore((s) => s.isSetupComplete);
  const tab: AppTab = !isSetupComplete ? 'setup' : activeTab;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', overflow: 'hidden', background: '#1a1a1a',
    }}>
      {/* Pas de header — le terrain prend toute la hauteur */}
      <main style={{
        flex: 1, overflow: 'hidden',
        paddingBottom: 56,
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {tab === 'input'  && <InputView />}
        {tab === 'stats'  && <StatsPanel />}
        {tab === 'setup'  && <MatchSetup onComplete={() => setActiveTab('input')} />}
      </main>

      <TabBar active={tab} onChange={(t) => { if (isSetupComplete) setActiveTab(t); }} />
    </div>
  );
}
