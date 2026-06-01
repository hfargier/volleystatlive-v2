// src/components/stats/StatsPanel.tsx
// Adapté au nouveau store : scoreHome / scoreAway (et non homeScore/awayScore).

import React, { useState } from 'react';
import { SetterDistribution } from './SetterDistribution';
import { AttackEfficiency } from './AttackEfficiency';
import { ReceptionStats } from './ReceptionStats';
import { AttackHeatmap } from './AttackHeatmap';
import { AttackAngles } from './AttackAngles';
import { StatsTable } from './StatsTable';
import { useMatchStore } from '../../store/matchStore';
import { exportToCSV } from '../../utils/exportCSV';
import { exportToPDF } from '../../utils/exportPDF';
import type { TeamSide } from '../../types';

const card: React.CSSProperties = {
  background: '#222',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 12,
};

export function StatsPanel() {
  const [teamFilter, setTeamFilter] = useState<TeamSide>('home');

  // Nouveau store : scoreHome / scoreAway / rallies
  const rallies      = useMatchStore((s) => s.rallies);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);
  const matchState   = useMatchStore((s) => s);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Filtre équipe */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['home', 'away'] as TeamSide[]).map((t) => {
          const name  = t === 'home' ? teamHomeName : teamAwayName;
          const color = t === 'home' ? '#FFD700' : '#ff8a65';
          const active = teamFilter === t;
          return (
            <button key={t} onClick={() => setTeamFilter(t)}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: 8,
                fontSize: 11, fontWeight: 700,
                background: active ? color + '22' : '#2a2a2a',
                color: active ? color : '#a0998e',
                border: active ? '1px solid ' + color : '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', minHeight: 36,
              }}>
              {name.substring(0, 12)}
            </button>
          );
        })}
      </div>

      {/* Tableau comparatif */}
      <div style={card}><StatsTable /></div>

      <div style={card}><SetterDistribution phase="P2" team={teamFilter} /></div>
      <div style={card}><SetterDistribution phase="P3" team={teamFilter} /></div>
      <div style={card}><ReceptionStats team={teamFilter} /></div>
      <div style={card}><AttackEfficiency team={teamFilter} /></div>
      <div style={card}><AttackHeatmap team={teamFilter} /></div>
      <div style={card}><AttackAngles team={teamFilter === 'home' ? 'away' : 'home'} /></div>

      {/* Export */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => exportToCSV(rallies, teamHomeName + '_vs_' + teamAwayName)}
          style={{ flex: 1, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 0', color: '#f0ede6', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
          CSV
        </button>
        <button
          onClick={() => exportToPDF(matchState)}
          style={{ flex: 1, background: 'rgba(255,215,0,0.12)', border: '1px solid #FFD700', borderRadius: 10, padding: '10px 0', color: '#FFD700', fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
          PDF
        </button>
      </div>

      {rallies.length === 0 && (
        <p style={{ textAlign: 'center', color: '#5a554e', fontSize: 12, padding: '20px 0' }}>
          Aucune donnée — saisissez des points.
        </p>
      )}
    </div>
  );
}
