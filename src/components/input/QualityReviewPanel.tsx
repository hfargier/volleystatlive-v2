import React, { useState } from 'react';
import { QualitySelector } from './QualitySelector';
import type { CourtZone, ReceptionQuality, SetQuality, AttackQuality } from '../../types';

interface QualityReviewProps {
  receptionZone: CourtZone | null;
  setZone: CourtZone | null;
  attackZone: CourtZone | null;
  onValidate: (rec: ReceptionQuality, set: SetQuality, atk: AttackQuality) => void;
  onSkip: () => void;
}

export function QualityReviewPanel({ receptionZone, setZone, attackZone, onValidate, onSkip }: QualityReviewProps) {
  const [recQ, setRecQ] = useState<ReceptionQuality | null>(null);
  const [setQ, setSetQ] = useState<SetQuality>('P+');
  const [atkQ, setAtkQ] = useState<AttackQuality>('A=');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
      <div style={{ background: '#2a2a2a', borderRadius: 8, padding: '6px 10px', fontSize: 10, color: '#a0998e', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {receptionZone && <span>Rec: <b style={{ color: '#81c784' }}>{receptionZone}</b></span>}
        {setZone && <span>Pss: <b style={{ color: '#ce93d8' }}>{setZone}</b></span>}
        {attackZone && <span>Att: <b style={{ color: '#ff8a65' }}>{attackZone}</b></span>}
      </div>
      <QualitySelector type="reception" value={recQ} onChange={(q) => setRecQ(q as ReceptionQuality)} label="Reception" />
      <QualitySelector type="set" value={setQ} onChange={(q) => setSetQ(q as SetQuality)} label="Passe" />
      <QualitySelector type="attack" value={atkQ} onChange={(q) => setAtkQ(q as AttackQuality)} label="Attaque" />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onValidate(recQ ?? 'R=', setQ, atkQ)}
          style={{ flex: 2, background: '#FFD700', color: '#111', fontWeight: 700, padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
          Valider
        </button>
        <button onClick={onSkip}
          style={{ flex: 1, background: '#2a2a2a', color: '#a0998e', fontWeight: 600, padding: '10px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, cursor: 'pointer', minHeight: 44 }}>
          Passer
        </button>
      </div>
    </div>
  );
}