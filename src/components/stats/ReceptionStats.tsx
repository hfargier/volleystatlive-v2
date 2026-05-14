import React from 'react';
import { calcReceptionStats } from '../../utils/statsCalc';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide } from '../../types';

interface ReceptionStatsProps { team: TeamSide; }

export function ReceptionStats({ team }: ReceptionStatsProps) {
  const rallies = useMatchStore((s) => s.rallies);
  const data = calcReceptionStats(rallies, team);

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', marginBottom: 8 }}>Reception par Joueur</p>
      {data.length === 0 ? (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a554e', fontSize: 11, background: '#2a2a2a', borderRadius: 8 }}>Aucune reception</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 36px 28px 28px 28px 44px', gap: 4, fontSize: 9, color: '#5a554e', fontWeight: 700, padding: '0 6px' }}>
            <span>Joueur</span><span style={{ textAlign: 'center' }}>Tot.</span>
            <span style={{ textAlign: 'center', color: '#FFD700' }}>ZIP</span>
            <span style={{ textAlign: 'center', color: '#4caf50' }}>R+</span>
            <span style={{ textAlign: 'center', color: '#f44336' }}>R-</span>
            <span style={{ textAlign: 'center' }}>Taux</span>
          </div>
          {data.map((item) => (
            <div key={item.playerId} style={{ display: 'grid', gridTemplateColumns: '1fr 36px 28px 28px 28px 44px', gap: 4, background: '#2a2a2a', borderRadius: 6, padding: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f0ede6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.playerId.substring(0, 8)}</span>
              <span style={{ textAlign: 'center', fontSize: 11, color: '#a0998e' }}>{item.total}</span>
              <span style={{ textAlign: 'center', fontSize: 11, color: '#FFD700' }}>{item.zip}</span>
              <span style={{ textAlign: 'center', fontSize: 11, color: '#4caf50' }}>{item.rPlus}</span>
              <span style={{ textAlign: 'center', fontSize: 11, color: '#f44336' }}>{item.rMinus}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ flex: 1, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: item.positiveRate + '%', height: '100%', background: item.positiveRate >= 60 ? '#4caf50' : item.positiveRate >= 40 ? '#FFD700' : '#f44336', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, color: '#a0998e', minWidth: 24 }}>{item.positiveRate}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}