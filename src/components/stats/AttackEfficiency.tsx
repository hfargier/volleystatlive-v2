import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { calcAttackEfficiency } from '../../utils/statsCalc';
import { useMatchStore } from '../../store/matchStore';
import type { PhaseType, TeamSide } from '../../types';

interface AttackEfficiencyProps { team: TeamSide; }

const PHASE_OPTS: Array<{ value: PhaseType | 'all'; label: string }> = [
  { value: 'all', label: 'Tout' }, { value: 'P2', label: 'P2' }, { value: 'P3', label: 'P3' },
];

export function AttackEfficiency({ team }: AttackEfficiencyProps) {
  const [filter, setFilter] = useState<PhaseType | 'all'>('all');
  const rallies = useMatchStore((s) => s.rallies);
  const data = calcAttackEfficiency(rallies, filter === 'all' ? undefined : filter, team);
  const chartData = data.map((d) => ({ name: d.playerId.substring(0, 6), eff: d.efficiency, pts: d.points }));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em' }}>Efficacite Attaquants</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASE_OPTS.map((opt) => (
            <button key={opt.value} onClick={() => setFilter(opt.value)}
              style={{ padding: '2px 8px', borderRadius: 12, fontSize: 9, fontWeight: 700, background: filter === opt.value ? '#FFD700' : '#2a2a2a', color: filter === opt.value ? '#111' : '#a0998e', border: 'none', minHeight: 24, cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {chartData.length === 0 ? (
        <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a554e', fontSize: 11, background: '#2a2a2a', borderRadius: 8 }}>Aucune donnee</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: '#a0998e', fontSize: 10 }} />
            <YAxis tick={{ fill: '#a0998e', fontSize: 9 }} />
            <Tooltip contentStyle={{ background: '#2a2a2a', border: 'none', borderRadius: 8, fontSize: 10 }} formatter={(v: number) => [v + '%', 'Efficacite']} />
            <Bar dataKey="eff" radius={[4, 4, 0, 0]}>
              {chartData.map((e, i) => <Cell key={i} fill={e.eff >= 50 ? '#4caf50' : e.eff >= 20 ? '#FFD700' : '#f44336'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}