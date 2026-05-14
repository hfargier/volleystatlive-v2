import React from 'react';
import type { PhaseType, InputStep } from '../../types';

interface PhaseBarProps { phase: PhaseType; step: InputStep; instruction: string; }

const PHASE_COLORS: Record<PhaseType, string> = { P1: '#4fc3f7', P2: '#81c784', P3: '#ff8a65' };
const PHASE_LABELS: Record<PhaseType, string> = { P1: 'P1 - Service', P2: 'P2 - Side-out', P3: 'P3 - Echange' };

const STEPS: Array<{ id: InputStep; label: string }> = [
  { id: 'reception_zone', label: 'Rec.' },
  { id: 'set_zone', label: 'Passe' },
  { id: 'attack_zone', label: 'Att.' },
  { id: 'quality_review', label: 'Qual.' },
];

export function PhaseBar({ phase, step, instruction }: PhaseBarProps) {
  const color = PHASE_COLORS[phase];
  const currentIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div style={{ background: '#222', borderBottom: '2px solid ' + color, padding: '6px 10px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: phase !== 'P1' ? 6 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '0.06em' }}>{PHASE_LABELS[phase]}</span>
        <span style={{ fontSize: 10, color: '#a0998e', fontStyle: 'italic' }}>{instruction}</span>
      </div>
      {phase !== 'P1' && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {STEPS.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? color : active ? color + '30' : '#2a2a2a', border: active ? '2px solid ' + color : done ? 'none' : '1px solid rgba(255,255,255,0.1)', fontSize: 8, fontWeight: 800, color: done ? '#111' : active ? color : '#5a554e' }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 9, color: active ? color : done ? '#a0998e' : '#5a554e', fontWeight: active ? 700 : 400 }}>{s.label}</span>
                {i < STEPS.length - 1 && <div style={{ width: 8, height: 1, background: done ? color : 'rgba(255,255,255,0.1)' }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}