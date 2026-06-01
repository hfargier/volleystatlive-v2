// src/components/layout/AppShell.tsx
import React, { useState } from 'react';
import { TabBar } from './TabBar';
import { InputView } from '../input/InputView';
import { StatsPanel } from '../stats/StatsPanel';
import { MatchSetup } from '../setup/MatchSetup';
import { ModelEditor } from '../setup/ModelEditor';
import { HomeScreen } from '../home/HomeScreen';
import { useMatchStore } from '../../store/matchStore';

/**
 * Machine d'états de navigation :
 *   home       → écran d'accueil (choix nouveau match / chargement)
 *   new-match  → configuration d'un nouveau match (MatchSetup)
 *   game       → match en cours (InputView / StatsPanel + TabBar)
 */
type AppView = 'home' | 'new-match' | 'game' | 'models';

export function AppShell() {
  // Si un match est déjà en cours (état persisté), on démarre directement en jeu
  const [view, setView] = useState<AppView>(() =>
    useMatchStore.getState().isSetupComplete ? 'game' : 'home',
  );
  const [gameTab, setGameTab] = useState<'input' | 'stats'>('input');

  // ── Écran d'accueil ──────────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <HomeScreen
        onNewMatch={() => setView('new-match')}
        onContinue={() => setView('game')}
        onLoaded={() => { setGameTab('input'); setView('game'); }}
        onManageModels={() => setView('models')}
      />
    );
  }

  // ── Éditeur de modèles ───────────────────────────────────────────────────
  // ModelEditor gère lui-même son layout height: 100dvh (aucun scroll global)
  if (view === 'models') {
    return <ModelEditor onBack={() => setView('home')} />;
  }

  // ── Configuration nouveau match ──────────────────────────────────────────
  if (view === 'new-match') {
    return (
      <div style={{
        height: '100dvh', background: '#131a13',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Barre retour */}
        <div style={{
          padding: '12px 16px 8px',
          background: '#0b130b',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <button
            onPointerDown={() => setView('home')}
            style={{
              background: 'none', border: 'none', color: '#a0998e',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}
          >
            ← Retour
          </button>
        </div>

        {/* Contenu du setup */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 32px' }}>
          <MatchSetup onComplete={() => { setGameTab('input'); setView('game'); }} />
        </div>
      </div>
    );
  }

  // ── Match en cours ───────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', overflow: 'hidden', background: '#1a1a1a',
    }}>
      <main style={{
        flex: 1, overflow: 'hidden',
        paddingBottom: 56,
        display: 'flex', flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        {gameTab === 'input' && <InputView />}
        {gameTab === 'stats' && <StatsPanel />}
      </main>

      <TabBar
        active={gameTab}
        onChange={t => {
          if (t === 'setup') {
            // L'onglet Config ramène à l'accueil (changer de match / nouveau match)
            setView('home');
          } else {
            setGameTab(t as 'input' | 'stats');
          }
        }}
      />
    </div>
  );
}
