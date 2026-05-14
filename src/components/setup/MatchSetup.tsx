import React, { useState } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { RotationSetup } from './RotationSetup';

interface MatchSetupProps { onComplete: () => void; }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 12px', color: '#f0ede6', fontSize: 14, outline: 'none', marginBottom: 4,
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#a0998e', fontWeight: 700,
  letterSpacing: '0.06em', marginBottom: 6, marginTop: 14,
};
const btnStyle: React.CSSProperties = {
  width: '100%', marginTop: 20, background: '#FFD700', color: '#111',
  fontWeight: 700, padding: '12px 18px', borderRadius: 10, border: 'none',
  fontSize: 13, cursor: 'pointer', minHeight: 44,
};

export function MatchSetup({ onComplete }: MatchSetupProps) {
  const initMatch = useMatchStore((s) => s.initMatch);
  const setSetupComplete = useMatchStore((s) => s.setSetupComplete);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);
  const [homeName, setHomeName] = useState(teamHomeName);
  const [awayName, setAwayName] = useState(teamAwayName);
  const [step, setStep] = useState<'names' | 'rotations'>('names');

  if (step === 'rotations') {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
        <RotationSetup onComplete={() => { setSetupComplete(); onComplete(); }} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
      <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Nouveau Match</h2>
      <p style={{ color: '#a0998e', fontSize: 12, marginBottom: 20 }}>Configuration initiale</p>
      <label style={labelStyle}>Equipe Domicile</label>
      <input value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="Mon Equipe" style={inputStyle} />
      <label style={labelStyle}>Equipe Adverse</label>
      <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Adversaire" style={inputStyle} />
      <button onClick={() => { initMatch(homeName || 'Mon Equipe', awayName || 'Adversaire'); setStep('rotations'); }} style={btnStyle}>
        Configurer les rotations
      </button>
    </div>
  );
}