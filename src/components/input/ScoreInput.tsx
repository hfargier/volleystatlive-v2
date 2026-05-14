import React from 'react';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide } from '../../types';

interface ScoreInputProps { onStartRally: () => void; rallyActive: boolean; }

interface TeamBlockProps { name: string; score: number; isServing: boolean; color: string; onPoint: () => void; onRotate: () => void; disabled: boolean; }

function TeamBlock({ name, score, isServing, color, onPoint, onRotate, disabled }: TeamBlockProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isServing && <span style={{ fontSize: 8, color }}>●</span>}
        <span style={{ fontSize: 10, color: '#a0998e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{name.substring(0, 10)}</span>
      </div>
      <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={onPoint} disabled={disabled}
          style={{ minHeight: 36, minWidth: 48, background: disabled ? '#2a2a2a' : color + '20', border: '1px solid ' + (disabled ? 'rgba(255,255,255,0.06)' : color), borderRadius: 8, color: disabled ? '#5a554e' : color, fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          + Pt
        </button>
        <button onClick={onRotate}
          style={{ minHeight: 36, minWidth: 36, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#a0998e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>
          ↻
        </button>
      </div>
    </div>
  );
}

export function ScoreInput({ onStartRally, rallyActive }: ScoreInputProps) {
  const homeScore = useMatchStore((s) => s.homeScore);
  const awayScore = useMatchStore((s) => s.awayScore);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);
  const servingTeam = useMatchStore((s) => s.servingTeam);
  const addPoint = useMatchStore((s) => s.addPoint);
  const rotate = useMatchStore((s) => s.rotate);
  const endRally = useMatchStore((s) => s.endRally);

  const handlePoint = (team: TeamSide) => { addPoint(team); endRally(team); };

  return (
    <div style={{ background: '#222', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: rallyActive ? 0 : 8 }}>
        <TeamBlock name={teamHomeName} score={homeScore} isServing={servingTeam === 'home'} color="#FFD700" onPoint={() => handlePoint('home')} onRotate={() => rotate('home')} disabled={!rallyActive} />
        <div style={{ fontSize: 20, fontWeight: 900, color: '#5a554e', padding: '0 4px' }}>—</div>
        <TeamBlock name={teamAwayName} score={awayScore} isServing={servingTeam === 'away'} color="#ff8a65" onPoint={() => handlePoint('away')} onRotate={() => rotate('away')} disabled={!rallyActive} />
      </div>
      {!rallyActive && (
        <button onClick={onStartRally} style={{ width: '100%', background: '#FFD700', color: '#111', fontWeight: 700, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
          Nouveau Rally
        </button>
      )}
    </div>
  );
}