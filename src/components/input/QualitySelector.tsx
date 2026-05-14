import React from 'react';

type AnyQuality = string;

interface QualityOption { value: string; line1: string; line2: string; color: string; bg: string; }

const SERVICE_OPTS: QualityOption[] = [
  { value: 'S-', line1: 'S-', line2: 'Faute', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
  { value: 'S=', line1: 'S=', line2: 'Neutre', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
  { value: 'S+', line1: 'S+', line2: 'Agress.', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' },
  { value: 'S++', line1: 'S++', line2: 'Ace', color: '#FFD700', bg: 'rgba(255,215,0,0.2)' },
];
const RECEPTION_OPTS: QualityOption[] = [
  { value: 'Zip', line1: 'ZIP', line2: 'Parfaite', color: '#FFD700', bg: 'rgba(255,215,0,0.2)' },
  { value: 'R+', line1: 'R+', line2: 'Bonne', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' },
  { value: 'R=', line1: 'R=', line2: 'Moyenne', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
  { value: 'R-', line1: 'R-', line2: 'Faible', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
];
const SET_OPTS: QualityOption[] = [
  { value: 'P++', line1: 'P++', line2: '2e main', color: '#FFD700', bg: 'rgba(255,215,0,0.2)' },
  { value: 'P+', line1: 'P+', line2: 'Bonne', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' },
  { value: 'P-', line1: 'P-', line2: 'Mauvaise', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
];
const ATTACK_OPTS: QualityOption[] = [
  { value: 'A++', line1: 'A++', line2: 'Point', color: '#FFD700', bg: 'rgba(255,215,0,0.2)' },
  { value: 'A+', line1: 'A+', line2: 'Def.', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' },
  { value: 'A=', line1: 'A=', line2: 'Bloque', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' },
  { value: 'A-', line1: 'A-', line2: 'Faute', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
];

const OPTS_MAP: Record<string, QualityOption[]> = {
  service: SERVICE_OPTS, reception: RECEPTION_OPTS, set: SET_OPTS, attack: ATTACK_OPTS,
};

interface QualitySelectorProps {
  type: 'service' | 'reception' | 'set' | 'attack';
  value: AnyQuality | null;
  onChange: (q: AnyQuality) => void;
  label?: string;
}

export function QualitySelector({ type, value, onChange, label }: QualitySelectorProps) {
  const options = OPTS_MAP[type];
  return (
    <div>
      {label && <p style={{ fontSize: 10, color: '#a0998e', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>{label}</p>}
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((opt) => {
          const sel = value === opt.value;
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              style={{ flex: 1, minHeight: 48, background: sel ? opt.bg : '#2a2a2a', border: sel ? '2px solid ' + opt.color : '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: sel ? opt.color : '#a0998e', fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.3, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 800 }}>{opt.line1}</span>
              <span style={{ fontSize: 8 }}>{opt.line2}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}