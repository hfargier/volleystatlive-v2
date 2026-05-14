import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { calcSetterDistribution } from '../../utils/statsCalc';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide } from '../../types';

const ZONE_COLORS = ['#FFD700', '#4fc3f7', '#81c784', '#ce93d8', '#ff8a65', '#ff5252'];

interface SetterDistributionProps { phase: 'P2' | 'P3'; team: TeamSide; }

export function SetterDistribution({ phase, team }: SetterDistributionProps) {
  const rallies = useMatchStore((s) => s.rallies);
  const data = calcSetterDistribution(rallies, phase, team);

  if (data.length === 0) {
    return (
      <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a554e', fontSize: 11, background: '#2a2a2a', borderRadius: 8 }}>
        Distribution passeur {phase} - Aucune donnee
      </div>
    );
  }

  const chartData = data.map((d) => ({ name: d.zone, value: d.count }));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', marginBottom: 6 }}>Distribution Passeur - {phase}</p>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value"
            label={({ name, percent }) => name + ' ' + Math.round(percent * 100) + '%'} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#2a2a2a', border: 'none', borderRadius: 8, fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}