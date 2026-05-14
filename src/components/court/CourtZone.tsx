import React from 'react';
import type { CourtZone } from '../../types';

export type SelectionType = 'reception' | 'set' | 'attack' | null;

export const ZONE_DISPLAY: Record<string, string> = {
  Z1: '1', Z2: '6', Z3: '5', Z4: '2', Z5: '3', Z6: '4', Z7: '-', Z8: '-', Z9: '-',
};

const SEL_BG: Record<string, string> = {
  reception: 'rgba(129,199,132,0.28)', set: 'rgba(206,147,216,0.28)', attack: 'rgba(255,138,101,0.28)',
};
const SEL_BORDER: Record<string, string> = {
  reception: '#81c784', set: '#ce93d8', attack: '#ff8a65',
};
const SEL_LABEL: Record<string, string> = {
  reception: 'REC', set: 'PSS', attack: 'ATT',
};

interface CourtZoneProps {
  zoneId: CourtZone;
  label: string;
  selectionType: SelectionType;
  isHighlighted: boolean;
  playerLabel?: string;
  onClick: (zone: CourtZone) => void;
}

export function CourtZoneComponent({ zoneId, label, selectionType, isHighlighted, playerLabel, onClick }: CourtZoneProps) {
  const isSelected = selectionType !== null;
  let bg = 'rgba(255,255,255,0.03)';
  let border = '1px solid rgba(255,255,255,0.10)';
  if (isSelected && selectionType) {
    bg = SEL_BG[selectionType];
    border = '2px solid ' + SEL_BORDER[selectionType];
  } else if (isHighlighted) {
    bg = 'rgba(255,215,0,0.07)';
    border = '1px solid rgba(255,215,0,0.35)';
  }
  return (
    <div onClick={() => onClick(zoneId)} role="button" aria-label={'Zone ' + label}
      style={{ position: 'relative', border, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 2, userSelect: 'none', WebkitTapHighlightColor: 'transparent', transition: 'background 0.1s' }}>
      <span style={{ fontSize: 18, fontWeight: 900, color: 'rgba(255,255,255,0.07)', pointerEvents: 'none', lineHeight: 1 }}>{label}</span>
      {playerLabel && (
        <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', background: '#FFD700', color: '#111', fontSize: 8, fontWeight: 800, borderRadius: 8, padding: '1px 4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{playerLabel}</span>
      )}
      {isSelected && selectionType && (
        <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 7, fontWeight: 800, color: SEL_BORDER[selectionType], letterSpacing: '0.04em', pointerEvents: 'none' }}>{SEL_LABEL[selectionType]}</span>
      )}
    </div>
  );
}