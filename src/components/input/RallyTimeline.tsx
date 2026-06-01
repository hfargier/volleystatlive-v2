// src/components/input/RallyTimeline.tsx
import React, { useState, useEffect } from 'react';
import type { Rally, RallyAction, AnyQuality } from '../../types';
import { QualityPicker } from './QualityPicker';

interface Props {
  rally: Rally;
  isActive: boolean;
  editable: boolean;
  isDisplayed: boolean;
  onQualityChosen: (rallyId: string, actionId: string, q: AnyQuality) => void;
  onUpdatePlayer:  (rallyId: string, actionId: string, playerId: string | null) => void;
  selectedActionId: string | null;
  onSelectRally: (rallyId: string) => void;
  onSelectAction: (actionId: string | null) => void;
  onUndo?: () => void;
  /** Supprime ce point terminé (uniquement pour le dernier point quand pas de rally actif) */
  onDelete?: () => void;
}

const KIND_LABEL: Record<string,string> = {
  service:'Service', service_fault:'Service', reception:'Réception',
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

function resolvePlayerNumber(action: RallyAction, rally: Rally): number | undefined {
  if (!action.playerId) return undefined;
  const rotation = action.team === 'home' ? rally.rotationHome : rally.rotationAway;
  return Object.values(rotation).find(p => p.id === action.playerId)?.number;
}

// ── Chip action avec numéro de joueur tappable ───────────────────────────────
function ActionChip({
  label, quality, color, playerNumber, playerPickOpen, onPlayerTap, editable,
}: {
  label: string;
  quality: AnyQuality | null;
  color: string;
  playerNumber?: number;
  playerPickOpen?: boolean;
  onPlayerTap?: (e: React.PointerEvent) => void;
  editable?: boolean;
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
      <div style={{ width:3, height:14, background:color, borderRadius:2, flexShrink:0 }}/>
      <span style={{ color:'#f0ede6', fontSize:10, fontWeight:600 }}>{label}</span>

      {/* Numéro joueur — tappable si editable */}
      {playerNumber != null ? (
        <span
          onPointerDown={editable && onPlayerTap ? onPlayerTap : undefined}
          style={{
            fontSize:9, fontWeight:800,
            color: playerPickOpen ? '#f0ede6' : '#a0998e',
            background: playerPickOpen ? 'rgba(255,255,255,0.14)' : 'transparent',
            border: playerPickOpen ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
            borderRadius:3, padding:'0 4px',
            cursor: editable ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >#{playerNumber}</span>
      ) : editable && onPlayerTap ? (
        /* Aucun joueur encore → petite cible pour en assigner un */
        <span
          onPointerDown={onPlayerTap}
          style={{
            fontSize:9, fontWeight:800, color:'#5a554e',
            border:'1px dashed rgba(255,255,255,0.15)', borderRadius:3,
            padding:'0 4px', cursor:'pointer', userSelect:'none',
          }}
        >·</span>
      ) : null}

      {quality && (
        <span style={{ fontSize:9, color, fontWeight:800, background:color+'18', borderRadius:3, padding:'0 4px' }}>
          {quality}
        </span>
      )}
    </div>
  );
}

// ── Sélecteur de joueur inline ────────────────────────────────────────────────
function PlayerPicker({
  rally, action, onPick,
}: {
  rally: Rally;
  action: RallyAction;
  onPick: (playerId: string | null) => void;
}) {
  const rotation = action.team === 'home' ? rally.rotationHome : rally.rotationAway;
  const players  = Object.values(rotation)
    .filter(p => p.number > 0)
    .sort((a, b) => a.number - b.number);

  return (
    <div style={{
      display:'flex', flexWrap:'wrap', gap:3,
      padding:'5px 6px', marginTop:1,
      background:'rgba(255,255,255,0.04)',
      border:'1px solid rgba(255,255,255,0.09)',
      borderRadius:5,
    }}>
      {players.map(p => {
        const active = action.playerId === p.id;
        return (
          <button key={p.id}
            onPointerDown={(e) => { e.stopPropagation(); onPick(p.id); }}
            style={{
              padding:'2px 7px', fontSize:9, fontWeight:800,
              borderRadius:4, cursor:'pointer', border:'none', outline:'none',
              background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              color:       active ? '#f0ede6'                : '#a0998e',
              boxShadow:   active ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
            }}
          >#{p.number}{p.name ? ` ${p.name.substring(0,6)}` : ''}</button>
        );
      })}
      {/* Bouton "aucun joueur" */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); onPick(null); }}
        style={{
          padding:'2px 7px', fontSize:9, fontWeight:800, borderRadius:4,
          cursor:'pointer', border:'none',
          background:'rgba(255,255,255,0.03)', color:'#5a554e',
        }}
      >—</button>
    </div>
  );
}

// ── Timeline d'un rally ───────────────────────────────────────────────────────
export function RallyTimeline({
  rally, isActive, editable, isDisplayed,
  onQualityChosen, onUpdatePlayer,
  selectedActionId, onSelectRally, onSelectAction, onUndo, onDelete,
}: Props) {
  // Quelle action a le picker joueur ouvert
  const [playerPickActionId, setPlayerPickActionId] = useState<string | null>(null);

  // Ferme le picker joueur dès qu'une qualité est sélectionnée (les deux sont mutuellement exclusifs)
  useEffect(() => {
    if (selectedActionId) setPlayerPickActionId(null);
  }, [selectedActionId]);

  const handlePick = (actionId: string, q: AnyQuality) => {
    onQualityChosen(rally.id, actionId, q);
    onSelectAction(null);
  };

  const toggleAction = (actionId: string) => {
    setPlayerPickActionId(null);          // ferme picker joueur si ouvert
    onSelectAction(selectedActionId === actionId ? null : actionId);
  };

  const togglePlayerPick = (e: React.PointerEvent, actionId: string) => {
    e.stopPropagation();                  // n'ouvre pas le picker qualité
    onSelectAction(null);                 // ferme le picker qualité si ouvert
    setPlayerPickActionId(prev => prev === actionId ? null : actionId);
  };

  return (
    <div style={{ fontSize:11 }}>
      {/* En-tête — tap pour afficher sur terrain */}
      <div
        onPointerDown={() => onSelectRally(rally.id)}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
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
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {rally.winner && (
            <span style={{ fontSize:9, color:rally.winner==='home'?'#FFD700':'#ff8a65', background:'rgba(255,255,255,0.06)', borderRadius:3, padding:'1px 5px' }}>
              +1 {rally.winner==='home'?'≡':'⊞'}
            </span>
          )}
          {onDelete && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}
              title="Supprimer ce point"
              style={{
                background:'rgba(244,67,54,0.15)', border:'1px solid rgba(244,67,54,0.4)',
                borderRadius:4, color:'#f44336', fontSize:11, fontWeight:800,
                cursor:'pointer', lineHeight:1, padding:'1px 5px',
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Actions */}
      {rally.actions.map((a, idx) => {
        const isHome         = a.team === 'home';
        const color          = KIND_COLOR[a.kind] ?? '#888';
        const isSelected     = selectedActionId === a.id;
        const isLast         = isActive && idx === rally.actions.length - 1;
        const playerNumber   = resolvePlayerNumber(a, rally);
        const pickOpen       = playerPickActionId === a.id;

        return (
          <div key={a.id}>
            <div
              onPointerDown={() => toggleAction(a.id)}
              style={{
                display:'grid', gridTemplateColumns: isLast ? '32px 1fr 1fr 16px' : '32px 1fr 1fr',
                alignItems:'center', gap:2, padding:'2px 4px', borderRadius:3,
                cursor:'pointer',
                background: isSelected || pickOpen ? 'rgba(255,215,0,0.08)' : 'transparent',
                outline:    isSelected || pickOpen ? '1px solid rgba(255,215,0,0.2)' : 'none',
              }}
            >
              <span style={{ fontSize:9, color:'#5a554e', fontWeight:700 }}>{phaseLabel(a)}</span>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:6 }}>
                {isHome && (
                  <ActionChip
                    label={KIND_LABEL[a.kind] ?? a.kind}
                    quality={a.quality}
                    color={color}
                    playerNumber={playerNumber}
                    playerPickOpen={pickOpen}
                    onPlayerTap={editable ? (e) => togglePlayerPick(e, a.id) : undefined}
                    editable={editable}
                  />
                )}
              </div>

              <div style={{ display:'flex', alignItems:'center', paddingLeft:6 }}>
                {!isHome && (
                  <ActionChip
                    label={KIND_LABEL[a.kind] ?? a.kind}
                    quality={a.quality}
                    color={color}
                    playerNumber={playerNumber}
                    playerPickOpen={pickOpen}
                    onPlayerTap={editable ? (e) => togglePlayerPick(e, a.id) : undefined}
                    editable={editable}
                  />
                )}
              </div>

              {isLast && (
                <button
                  onPointerDown={(e) => { e.stopPropagation(); onUndo?.(); }}
                  style={{ background:'none', border:'none', color:'#5a554e', fontSize:12, cursor:'pointer', padding:0, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}
                >×</button>
              )}
            </div>

            {/* Picker qualité */}
            {isSelected && editable && (
              <QualityPicker kind={a.kind} current={a.quality} onPick={(q) => handlePick(a.id, q)}/>
            )}

            {/* Picker joueur */}
            {pickOpen && editable && (
              <PlayerPicker
                rally={rally}
                action={a}
                onPick={(pid) => {
                  onUpdatePlayer(rally.id, a.id, pid);
                  setPlayerPickActionId(null);
                }}
              />
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
