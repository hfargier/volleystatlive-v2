import React, { useState } from 'react';
import { QualitySelector } from './QualitySelector';
import type { ServiceQuality } from '../../types';
import { useMatchStore } from '../../store/matchStore';

interface ServicePanelProps { onDone: () => void; }

export function ServicePanel({ onDone }: ServicePanelProps) {
  const [quality, setQuality] = useState<ServiceQuality | null>(null);
  const recordService = useMatchStore((s) => s.recordService);
  const servingTeam = useMatchStore((s) => s.servingTeam);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);

  const isAce = quality === 'S++';
  const isFault = quality === 'S-';

  const handleValidate = () => {
    if (!quality) return;
    recordService(quality);
    onDone();
  };

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#2a2a2a', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4fc3f7' }} />
        <span style={{ fontSize: 11, color: '#a0998e' }}>
          Service : <strong style={{ color: '#f0ede6' }}>{servingTeam === 'home' ? teamHomeName : teamAwayName}</strong>
        </span>
      </div>

      <QualitySelector type="service" value={quality} onChange={(q) => setQuality(q as ServiceQuality)} label="Qualite du service" />

      {(isAce || isFault) && (
        <div style={{ background: isAce ? 'rgba(255,215,0,0.1)' : 'rgba(244,67,54,0.1)', border: '1px solid ' + (isAce ? '#FFD700' : '#f44336'), borderRadius: 8, padding: '8px 12px', fontSize: 11, color: isAce ? '#FFD700' : '#f44336', fontWeight: 700 }}>
          {isAce ? 'ACE - Point direct ! Terminez le rally.' : 'FAUTE - Point adverse. Terminez le rally.'}
        </div>
      )}

      <button onClick={handleValidate} disabled={!quality}
        style={{ background: quality ? '#FFD700' : '#2a2a2a', color: quality ? '#111' : '#5a554e', fontWeight: 700, padding: '10px 18px', borderRadius: 10, border: 'none', fontSize: 12, cursor: quality ? 'pointer' : 'not-allowed', minHeight: 44, width: '100%' }}>
        Valider le service
      </button>
    </div>
  );
}