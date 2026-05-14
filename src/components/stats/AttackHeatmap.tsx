import React, { useState } from 'react';
import { calcAttackHeatmap } from '../../utils/statsCalc';
import { useMatchStore } from '../../store/matchStore';
import type { PhaseType, TeamSide, CourtZone } from '../../types';

interface AttackHeatmapProps { team: TeamSide; }

const PHASE_OPTS: Array<{ value: PhaseType | 'all'; label: string }> = [
  { value: 'all', label: 'Tout' }, { value: 'P2', label: 'P2' }, { value: 'P3', label: 'P3' },
];

const ZONE_GRID: CourtZone[] = ['Z3', 'Z2', 'Z1', 'Z6', 'Z5', 'Z4'];

function intensityColor(i: number): string {
  const r = Math.round(255 * i);
  const g = Math.round(100 * (1 - i));
  return 'rgba(' + r + ',' + g + ',50,' + (0.2 + i * 0.6) + ')';
}

export function AttackHeatmap({ team }: AttackHeatmapProps) {
  const [filter, setFilter] = useState<PhaseType | 'all'>('all');
  const rallies = useMatchStore((s) => s.rallies);
  const data = calcAttackHeatmap(rallies, filter === 'all' ? undefined : filter, team);
  const zoneMap: Record<string, number> = {};
  data.forEach((d) => { zoneMap[d.zone] = d.intensity; });

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em' }}>Heatmap Attaque</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASE_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              style={{ padding: '2px 8px', borderRadius: 12, fontSize: 9, fontWeight: 700, background: filter === opt.value ? '#FFD700' : '#2a2a2a', color: filter === opt.value ? '#111' : '#a0998e', border: 'none', minHeight: 24, cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: 2, background: '#1c3a2a', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, overflow: 'hidden', height: 90 }}>
        {ZONE_GRID.map((zone) => {
          const intensity = zoneMap[zone] ?? 0;
          return (
            <div key={zone} style={{ background: intensity > 0 ? intensityColor(intensity) : 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{zone}</span>
              {intensity > 0 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>{Math.round(intensity * 100)}%</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#5a554e' }}>Faible</span>
        <div style={{ flex: 1, height: 4, background: 'linear-gradient(to right, rgba(50,100,50,0.3), rgba(255,50,50,0.8))', borderRadius: 2 }} />
        <span style={{ fontSize: 9, color: '#5a554e' }}>Eleve</span>
      </div>
    </div>
  );
}