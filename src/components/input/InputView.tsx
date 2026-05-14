// src/components/input/InputView.tsx
import React, { useState, useCallback } from 'react';
import { CourtWithServer } from '../court/CourtWithServer';
import { PointLog } from './PointLog';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide, ActionKind, AnyQuality } from '../../types';
import { DEFAULT_QUALITY, nextExpectedAction } from './gameLogic';

export function InputView() {
  const {
    servingTeam, activeRallyId, rallies,
    teamHomeName, teamAwayName,
    startRally, addAction, updateActionQuality,
    removeLastAction, endRally, undoLastPoint,
    scoreHome, scoreAway,
  } = useMatchStore();

  const [hasStartedNew, setHasStartedNew]       = useState(false);
  const [displayedRallyId, setDisplayedRallyId] = useState<string|null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string|null>(null);

  const activeRally    = rallies.find((r) => r.id === activeRallyId) ?? null;
  const displayedRally = displayedRallyId
    ? rallies.find((r) => r.id === displayedRallyId) ?? activeRally
    : activeRally;

  const nextAction    = activeRally ? nextExpectedAction(activeRally.actions, servingTeam) : null;
  const highlightTeam: TeamSide | null = !activeRally
    ? (servingTeam === 'home' ? 'away' : 'home')
    : nextAction?.team ?? null;

  const dots = (displayedRally?.actions ?? [])
    .filter((a) => (a as any).x != null)
    .map((a) => ({
      id:      a.id,
      x:       (a as any).x as number,
      y:       (a as any).y as number,
      team:    a.team,
      kind:    a.kind,
      quality: a.quality,
    }));

  const handleDotTap = useCallback((actionId: string) => {
    setSelectedActionId((prev) => prev === actionId ? null : actionId);
  }, []);

  const handleSelectRally = useCallback((rallyId: string) => {
    setDisplayedRallyId((prev) => prev === rallyId ? null : rallyId);
    setSelectedActionId(null);
  }, []);

  const handleQualityChosen = useCallback((rallyId: string, actionId: string, q: AnyQuality) => {
    updateActionQuality(rallyId, actionId, q);
    setSelectedActionId(null);
    const rally = useMatchStore.getState().rallies.find((r) => r.id === rallyId);
    if (!rally) return;
    const action = rally.actions.find((a) => a.id === actionId);
    if (!action) return;
    if (action.kind === 'attack' && q === 'A++') {
      setTimeout(() => { endRally(action.team); setHasStartedNew(false); }, 120); return;
    }
    if (action.kind === 'service' && q === 'S++') {
      setTimeout(() => { endRally(action.team); setHasStartedNew(false); }, 120); return;
    }
    if (action.kind === 'service' && q === 'S-') {
      const recv: TeamSide = action.team === 'home' ? 'away' : 'home';
      setTimeout(() => { endRally(recv); setHasStartedNew(false); }, 120); return;
    }
    if (action.kind === 'attack' && q === 'A-') {
      const recv: TeamSide = action.team === 'home' ? 'away' : 'home';
      setTimeout(() => { endRally(recv); setHasStartedNew(false); }, 120);
    }
  }, [updateActionQuality, endRally]);

  const handleCourtClick = useCallback((x: number, y: number, team: TeamSide) => {
    if (displayedRallyId) {
      setDisplayedRallyId(null); setSelectedActionId(null); return;
    }
    let rid = activeRallyId;
    if (!rid) {
      rid = startRally();
      setHasStartedNew(true);
      addAction(rid, { kind:'service', phase:'P1', subPhase:1, team:servingTeam, zone:null, quality: DEFAULT_QUALITY['service'] ?? 'S=' } as any);
    }
    const rally = useMatchStore.getState().rallies.find((r) => r.id === rid);
    if (!rally) return;
    const exp = nextExpectedAction(rally.actions, servingTeam);
    if (!exp) return;

    const last = rally.actions[rally.actions.length - 1];
    let kind         = exp.kind;
    let quality: AnyQuality = DEFAULT_QUALITY[kind] ?? 'A+';
    let resolvedTeam = exp.team;

    if (last?.kind === 'set' && team !== exp.team) {
      updateActionQuality(rid, last.id, 'P++');
      kind = 'defense'; quality = 'A='; resolvedTeam = team;
    }

    addAction(rid, { kind, phase:exp.phase, subPhase:exp.subPhase, team:resolvedTeam, zone:null, quality, x, y } as any);
    setHasStartedNew(true);

    if (kind === 'attack' && quality === 'A++')
      setTimeout(() => { endRally(resolvedTeam); setHasStartedNew(false); }, 120);
  }, [activeRallyId, servingTeam, displayedRallyId, startRally, addAction, updateActionQuality, endRally]);

  const handleServiceFault = useCallback(() => {
    const rid = startRally(); setHasStartedNew(true);
    addAction(rid, { kind:'service_fault', phase:'P1', subPhase:1, team:servingTeam, zone:null, quality:'S-' } as any);
    const recv: TeamSide = servingTeam === 'home' ? 'away' : 'home';
    setTimeout(() => { endRally(recv); setHasStartedNew(false); }, 80);
  }, [servingTeam, startRally, addAction, endRally]);

  const handleUndo = useCallback(() => {
    if (activeRallyId) removeLastAction(activeRallyId);
    else undoLastPoint();
  }, [activeRallyId, removeLastAction, undoLastPoint]);

  const handleAddPoint = useCallback((team: TeamSide) => {
    if (activeRallyId) { endRally(team); setHasStartedNew(false); }
  }, [activeRallyId, endRally]);

  const instruction = (() => {
    if (displayedRallyId) return 'Tap terrain pour revenir';
    if (!activeRally) return 'Cliquez sur le terrain adverse';
    if (nextAction) {
      const side = nextAction.team === 'home' ? teamHomeName : teamAwayName;
      const k: Record<ActionKind, string> = {
        service:'Service', service_fault:'Faute svc', reception:'Réception',
        set:'Passe', attack:'Attaque', defense:'Défense', block:'Bloc', support:'Soutiens',
      };
      return side.substring(0,10) + ' — ' + k[nextAction.kind];
    }
    return 'Terminez le point (+1)';
  })();

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* Terrain */}
      <div style={{ flex:3, position:'relative', overflow:'visible', minWidth:0 }}>
        <CourtWithServer
          servingTeam={servingTeam}
          onCourtClick={handleCourtClick}
          onServiceFault={handleServiceFault}
          onUndo={handleUndo}
          dots={dots}
          highlightTeam={highlightTeam}
          instruction={instruction}
          selectedActionId={selectedActionId}
          onDotTap={handleDotTap}
        />
      </div>

      {/* Colonne droite */}
      <div style={{ flex:2, display:'flex', flexDirection:'column', borderLeft:'1px solid rgba(255,255,255,0.06)', overflow:'hidden', minWidth:0 }}>
        {/* Titre + score */}
        <div style={{ padding:'8px 10px 6px', flexShrink:0, background:'#1e1e1e', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.15em', color:'#FFD700' }}>VOLLEYSTAT</span>
            <span style={{ fontSize:11, color:'#5a554e' }}>LIVE</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <button onClick={() => handleAddPoint('home')} disabled={!activeRallyId}
              style={{ padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:700, background:activeRallyId?'rgba(255,215,0,0.15)':'transparent', border:'1px solid '+(activeRallyId?'#FFD700':'rgba(255,255,255,0.06)'), color:activeRallyId?'#FFD700':'#5a554e', cursor:activeRallyId?'pointer':'not-allowed', minHeight:24, whiteSpace:'nowrap' }}>
              +1 {teamHomeName.substring(0,6)}
            </button>
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <span style={{ fontSize:20, fontWeight:900, color:'#FFD700', lineHeight:1 }}>{scoreHome}</span>
              <span style={{ fontSize:12, color:'#5a554e' }}>–</span>
              <span style={{ fontSize:20, fontWeight:900, color:'#ff8a65', lineHeight:1 }}>{scoreAway}</span>
            </div>
            <button onClick={() => handleAddPoint('away')} disabled={!activeRallyId}
              style={{ padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:700, background:activeRallyId?'rgba(255,138,101,0.15)':'transparent', border:'1px solid '+(activeRallyId?'#ff8a65':'rgba(255,255,255,0.06)'), color:activeRallyId?'#ff8a65':'#5a554e', cursor:activeRallyId?'pointer':'not-allowed', minHeight:24, whiteSpace:'nowrap' }}>
              +1 {teamAwayName.substring(0,6)}
            </button>
          </div>
        </div>

        {/* En-tête frise */}
        <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr', padding:'3px 4px', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#1e1e1e' }}>
          <span/>
          <span style={{ fontSize:9, fontWeight:700, color:'#FFD700', textAlign:'right', paddingRight:8, letterSpacing:'0.06em' }}>{teamHomeName.substring(0,8).toUpperCase()}</span>
          <span style={{ fontSize:9, fontWeight:700, color:'#ff8a65', textAlign:'left', paddingLeft:8, letterSpacing:'0.06em' }}>{teamAwayName.substring(0,8).toUpperCase()}</span>
        </div>

        <div style={{ flex:1, overflow:'hidden' }}>
          <PointLog
            hasStartedNewPoint={hasStartedNew}
            onQualityChosen={handleQualityChosen}
            selectedActionId={selectedActionId}
            onSelectRally={handleSelectRally}
            onSelectAction={setSelectedActionId}
            displayedRallyId={displayedRallyId}
          />
        </div>
      </div>
    </div>
  );
}
