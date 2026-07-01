// src/components/input/QualityPicker.tsx
// Sélecteur de qualité inline — s'affiche sous une action de la frise.
// Pas de bouton valider : le clic sur une qualité ferme automatiquement.

import React from 'react';
import type { ActionKind, AnyQuality } from '../../types';

interface Props {
  kind: ActionKind;
  current: AnyQuality | null;
  onPick: (q: AnyQuality) => void;
}

type Option = { value: AnyQuality; label: string; color: string };

const OPTS: Record<string, Option[]> = {
  service: [
    { value:'S-',  label:'S− Faute',   color:'#f44336' },
    { value:'S=',  label:'S= Neutre',  color:'#ff9800' },
    { value:'S+',  label:'S+ Agressif',color:'#4caf50' },
    { value:'S++', label:'S++ Ace',    color:'#FFD700' },
  ],
  reception: [
    { value:'Zip', label:'Zip (ace)',     color:'#FFD700' },
    { value:'R+',  label:'R+ Bonne',     color:'#4caf50' },
    { value:'R=',  label:'R= Moyenne',   color:'#ff9800' },
    { value:'R-',  label:'R− Faible',    color:'#f44336' },
  ],
  set: [
    { value:'P++', label:'P++ 2e main', color:'#FFD700' },
    { value:'P+',  label:'P+ Bonne',    color:'#4caf50' },
    { value:'P-',  label:'P− Mauvaise', color:'#f44336' },
  ],
  attack: [
    { value:'A++', label:'A++ Point',   color:'#FFD700' },
    { value:'A+',  label:'A+ Défendu',  color:'#4caf50' },
    { value:'A=',  label:'A= Bloqué',   color:'#ff9800' },
    { value:'A-',  label:'A− Faute',    color:'#f44336' },
  ],
  defense: [
    { value:'D+',  label:'D+ défendu',        color:'#4caf50' },
    { value:'D=',  label:'D= Peu mieux Faire', color:'#ff9800' },
    { value:'D-',  label:'D− Non touché', color:'#f44336' },
  ],
  block: [
    { value:'B++', label:'B++ Point',   color:'#FFD700' },
    { value:'B+',  label:'B+ Ralenti',  color:'#4caf50' },
    { value:'B=',  label:'B= Soutenu',   color:'#ff9800' },
    { value:'B-',  label:'B− Out',      color:'#f44336' },
  ],
  support: [
    { value:'D+', label:'D+ Soutenu',  color:'#4caf50' },
    { value:'D-', label:'D− Non touché',     color:'#f44336' },
  ],
  service_fault: [],
};

export function QualityPicker({ kind, current, onPick }: Props) {
  const opts = OPTS[kind] ?? [];
  if (opts.length === 0) return null;

  return (
    <div style={{ display:'flex', gap:4, padding:'4px 6px 4px 36px',
      background:'rgba(255,215,0,0.04)', borderLeft:'2px solid #FFD700',
      marginBottom:2, flexWrap:'wrap' }}>
      {opts.map(o => (
        <button key={o.value} onClick={() => onPick(o.value)}
          style={{ padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700,
            background: current===o.value ? o.color+'30' : '#1e1e1e',
            border: current===o.value ? '1.5px solid '+o.color : '1px solid rgba(255,255,255,0.1)',
            color: current===o.value ? o.color : '#a0998e',
            cursor:'pointer', minHeight:28, whiteSpace:'nowrap' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
