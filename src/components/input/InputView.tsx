// src/components/input/InputView.tsx
import React, { useState, useCallback } from 'react';
import { CourtWithServer } from '../court/CourtWithServer';
import { PointLog } from './PointLog';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide, ActionKind, AnyQuality } from '../../types';
import { DEFAULT_QUALITY, nextExpectedAction } from './gameLogic';
import './InputView.css';

export function InputView() {
  const {
    servingTeam, activeRallyId, rallies,
    teamHomeName, teamAwayName,
    startRally, addAction, updateActionQuality,
    removeLastAction, endRally, undoLastPoint,
    scoreHome, scoreAway,
  } = useMatchStore();

  const [hasStartedNew, setHasStartedNew]       = useState(false);
  const [displayedRallyId, setDisplayedRallyId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

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
      addAction(rid, { kind: 'service', phase: 'P1', subPhase: 1, team: servingTeam, zone: null, quality: DEFAULT_QUALITY['service'] ?? 'S=' } as any);
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

    addAction(rid, { kind, phase: exp.phase, subPhase: exp.subPhase, team: resolvedTeam, zone: null, quality, x, y } as any);
    setHasStartedNew(true);

    if (kind === 'attack' && quality === 'A++')
      setTimeout(() => { endRally(resolvedTeam); setHasStartedNew(false); }, 120);
  }, [activeRallyId, servingTeam, displayedRallyId, startRally, addAction, updateActionQuality, endRally]);

  const handleServiceFault = useCallback(() => {
    const rid = startRally(); setHasStartedNew(true);
    addAction(rid, { kind: 'service_fault', phase: 'P1', subPhase: 1, team: servingTeam, zone: null, quality: 'S-' } as any);
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
        service: 'Service', service_fault: 'Faute svc', reception: 'Réception',
        set: 'Passe', attack: 'Attaque', defense: 'Défense', block: 'Bloc', support: 'Soutiens',
      };
      return side.substring(0, 10) + ' — ' + k[nextAction.kind];
    }
    return 'Terminez le point (+1)';
  })();

  return (
    <div className="input-view">

      {/* Terrain */}
      <div className="input-view__court">
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
      <div className="input-view__sidebar">

        {/* Titre + score */}
        <div className="input-view__header">
          <div className="input-view__brand">
            <span className="input-view__brand-name">VOLLEYSTAT</span>
            <span className="input-view__brand-live">LIVE</span>
          </div>
          <div className="input-view__score-bar">
            <button
              onClick={() => handleAddPoint('home')}
              disabled={!activeRallyId}
              className={`input-view__point-btn input-view__point-btn--home`}
            >
              +1 {teamHomeName.substring(0, 6)}
            </button>
            <div className="input-view__score-display">
              <span className="input-view__score-home">{scoreHome}</span>
              <span className="input-view__score-separator">–</span>
              <span className="input-view__score-away">{scoreAway}</span>
            </div>
            <button
              onClick={() => handleAddPoint('away')}
              disabled={!activeRallyId}
              className={`input-view__point-btn input-view__point-btn--away`}
            >
              +1 {teamAwayName.substring(0, 6)}
            </button>
          </div>
        </div>

        {/* En-tête frise */}
        <div className="input-view__log-header">
          <span />
          <span className="input-view__log-header-home">
            {teamHomeName.substring(0, 8).toUpperCase()}
          </span>
          <span className="input-view__log-header-away">
            {teamAwayName.substring(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Frise des points */}
        <div className="input-view__log">
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
