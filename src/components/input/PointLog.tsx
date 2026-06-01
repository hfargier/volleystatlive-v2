// src/components/input/PointLog.tsx
import React, { useEffect, useRef } from 'react';
import { RallyTimeline } from './RallyTimeline';
import { useMatchStore } from '../../store/matchStore';
import type { AnyQuality } from '../../types';

interface Props {
  hasStartedNewPoint: boolean;
  onQualityChosen: (rallyId: string, actionId: string, q: AnyQuality) => void;
  onUpdatePlayer:  (rallyId: string, actionId: string, playerId: string | null) => void;
  selectedActionId: string | null;
  onSelectRally: (rallyId: string) => void;
  onSelectAction: (actionId: string | null) => void;
  displayedRallyId: string | null;
  onUndo: () => void;
  onDeleteLastPoint: () => void;
}

export function PointLog({
  hasStartedNewPoint, onQualityChosen, onUpdatePlayer,
  selectedActionId, onSelectRally, onSelectAction, displayedRallyId, onUndo, onDeleteLastPoint,
}: Props) {
  const rallies       = useMatchStore((s) => s.rallies);
  const activeRallyId = useMatchStore((s) => s.activeRallyId);

  // Le dernier point supprimable = dernier rally terminé, uniquement quand pas de rally actif
  const deletableRallyId = !activeRallyId && rallies.length > 0 && rallies[rallies.length - 1].winner
    ? rallies[rallies.length - 1].id
    : null;
  const bottomRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [rallies.length, rallies[rallies.length-1]?.actions.length]);

  if (rallies.length === 0) {
    return (
      <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#5a554e', fontSize:11, textAlign:'center', padding:12 }}>
        Cliquez sur le terrain<br/>pour commencer un point
      </div>
    );
  }

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'6px 4px', display:'flex', flexDirection:'column', gap:6 }}>
      {rallies.map((rally) => {
        const isActive = rally.id === activeRallyId;
        // Tous les points sont éditables (qualité + joueur) à tout moment
        const editable = true;
        const isDisplayed    = rally.id === displayedRallyId;
        return (
          <RallyTimeline
            key={rally.id}
            rally={rally}
            isActive={isActive}
            editable={editable}
            isDisplayed={isDisplayed}
            onQualityChosen={onQualityChosen}
            onUpdatePlayer={onUpdatePlayer}
            selectedActionId={selectedActionId}
            onSelectRally={onSelectRally}
            onSelectAction={onSelectAction}
            onUndo={isActive ? onUndo : undefined}
            onDelete={rally.id === deletableRallyId ? onDeleteLastPoint : undefined}
          />
        );
      })}
      <div ref={bottomRef}/>
    </div>
  );
}
