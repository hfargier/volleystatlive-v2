// src/components/input/RallyTimeline.tsx
import React from 'react';
import type { Rally, RallyAction, AnyQuality } from '../../types';
import { QualityPicker } from './QualityPicker';

interface Props {
  rally: Rally;
  isActive: boolean;
  editable: boolean;
  isDisplayed: boolean;
  onQualityChosen: (rallyId: string, actionId: string, q: AnyQuality) => void;
  selectedActionId: string | null;
  onSelectRally: (rallyId: string) => void;
  onSelectAction: (actionId: string | null) => void;
}

const KIND_LABEL: Record<string,string> = {
  service:'Service', service_fault:'Faute svc', reception:'Réception',
  set:'Passe', attack:'Attaque', defense:'Défense', block:'Bloc', support:'Soutiens',
};
const KIND_COLOR: Record<string,string> = {
  service:'#FFD700', service_fault:'#f44336', reception:'#81c784',
  set:'#ce93d8', attack:'#ff8a65', defense:'#4fc3f7', block:'#ff5252', support:'#a5d6a7',
};

function phaseLabel(a: RallyAction): string {
  if (a.phase === 'P1') return 'P1';
  if (a.phase === 'P2') return 'P2';
  return 'P3.' + a.subPhase;
}

function ActionChip({ label, quality, color }: { label:string; quality:AnyQuality|null; color:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      <div style={{ width:3, height:14, background:color, borderRadius:2, flexShrink:0 }}/>
      <span style={{ color:'#f0ede6', fontSize:10, fontWeight:600 }}>{label}</span>
      {quality && (
        <span style={{ fontSize:9, color, fontWeight:800, background:color+'18', borderRadius:3, padding:'0 4px' }}>
          {quality}
        </span>
      )}
    </div>
  );
}

export function RallyTimeline({
  rally, isActive, editable, isDisplayed,
  onQualityChosen, selectedActionId, onSelectRally, onSelectAction,
}: Props) {

  const handlePick = (actionId: string, q: AnyQuality) => {
    onQualityChosen(rally.id, actionId, q);
    onSelectAction(null);
  };

  const toggleAction = (actionId: string) => {
    onSelectAction(selectedActionId === actionId ? null : actionId);
  };

  return (
    <div style={{ fontSize:11 }}>
      {/* En-tête — tap pour afficher sur terrain */}
      <div
        onPointerDown={() => onSelectRally(rally.id)}
        style={{
          display:'flex', justifyContent:'space-between',
          padding:'3px 6px',
          background: isDisplayed ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
          border: isDisplayed ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent',
          borderRadius:4, marginBottom:3, cursor:'pointer',
        }}
      >
        <span style={{ color: isDisplayed ? '#FFD700' : '#a0998e', fontSize:10, fontWeight: isDisplayed ? 700 : 400 }}>
          Pt #{rally.pointNumber}
        </span>
        <span style={{ color:'#FFD700', fontWeight:700, fontSize:10 }}>
          {rally.scoreHome} - {rally.scoreAway}
        </span>
        {rally.winner && (
          <span style={{ fontSize:9, color:rally.winner==='home'?'#FFD700':'#ff8a65', background:'rgba(255,255,255,0.06)', borderRadius:3, padding:'1px 5px' }}>
            +1 {rally.winner==='home'?'≡':'⊞'}
          </span>
        )}
      </div>

      {/* Actions */}
      {rally.actions.map((a) => {
        const isHome     = a.team === 'home';
        const color      = KIND_COLOR[a.kind] ?? '#888';
        const isSelected = selectedActionId === a.id;

        return (
          <div key={a.id}>
            <div
              onPointerDown={() => toggleAction(a.id)}
              style={{
                display:'grid', gridTemplateColumns:'32px 1fr 1fr',
                alignItems:'center', gap:2, padding:'2px 4px', borderRadius:3,
                cursor:'pointer',
                background: isSelected ? 'rgba(255,215,0,0.08)' : 'transparent',
                outline: isSelected ? '1px solid rgba(255,215,0,0.2)' : 'none',
              }}
            >
              <span style={{ fontSize:9, color:'#5a554e', fontWeight:700 }}>{phaseLabel(a)}</span>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6 }}>
                {isHome && <ActionChip label={KIND_LABEL[a.kind]??a.kind} quality={a.quality} color={color}/>}
              </div>
              <div style={{ display:'flex', alignItems:'center', paddingLeft:6 }}>
                {!isHome && <ActionChip label={KIND_LABEL[a.kind]??a.kind} quality={a.quality} color={color}/>}
              </div>
            </div>
            {isSelected && editable && (
              <QualityPicker kind={a.kind} current={a.quality} onPick={(q) => handlePick(a.id, q)}/>
            )}
          </div>
        );
      })}

      {!isActive && rally.winner && (
        <div style={{ marginTop:3, padding:'2px 6px', fontSize:9, color:'#5a554e', borderTop:'1px solid rgba(255,255,255,0.06)', textAlign:'center' }}>
          Fin point #{rally.pointNumber}
        </div>
      )}
    </div>
  );
}
