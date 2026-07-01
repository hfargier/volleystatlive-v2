// src/components/input/useRallyHandlers.ts
// Hook qui centralise tout l'état et les handlers de saisie live.
// InputView.tsx ne s'occupe que du rendu et du mode édition.

import { useCallback, useRef, useState } from 'react';
import { useMatchStore } from '../../store/matchStore';
import type { TeamSide, ActionKind, AnyQuality, RallyAction } from '../../types';
import { DEFAULT_QUALITY, nextExpectedAction, computeQualityEffect, getSetZone, receptionQualityFromSetZone } from './gameLogic';
import { ATTACK_ZONE_BOUNDS } from '../court/CourtWithServer';

// ── Types internes ────────────────────────────────────────────────────────────
type PendingBlock = { blockActionId: string; blockerTeam: TeamSide };

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useRallyHandlers(editMode: boolean) {
  // ── État local ──────────────────────────────────────────────────────────
  const [isBlockPending,  setIsBlockPending]  = useState(false);
  const [hasStartedNew,   setHasStartedNew]   = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [displayedRallyId, setDisplayedRallyId] = useState<string | null>(null);
  const pendingBlock = useRef<PendingBlock | null>(null);

  // ── Store ───────────────────────────────────────────────────────────────
  const {
    servingTeam, activeRallyId, rallies,
    teamHomeName, teamAwayName,
    rotationHome, rotationAway,
    sideOutHome, sideOutAway,
    blocDefHome, blocDefAway,
    blocDefSHome, blocDefSAway,
    startRally, addAction,
    updateActionQuality, updateActionPlayer,
    removeLastAction, endRally, undoLastPoint,
  } = useMatchStore();

  // ── Dérivés ─────────────────────────────────────────────────────────────
  const activeRally    = rallies.find(r => r.id === activeRallyId) ?? null;
  const displayedRally = displayedRallyId
    ? (rallies.find(r => r.id === displayedRallyId) ?? activeRally)
    : activeRally;
  const nextAction  = activeRally ? nextExpectedAction(activeRally.actions, servingTeam) : null;
  const netHighlight = !!(activeRally && activeRally.actions[activeRally.actions.length - 1]?.kind === 'attack');

  const instruction = (() => {
    if (editMode) return '';
    if (displayedRallyId) return 'Tap terrain pour revenir';
    if (isBlockPending) return 'Bloc → clic terrain adverse (défense), terrain propre (soutiens) ou OUT';
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

  // ── Player finders ──────────────────────────────────────────────────────
  const findSideOutPlayer = useCallback((x: number, y: number, team: TeamSide): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? sideOutHome : sideOutAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    const pool  = config.filter(sp => sp.roles.includes('receiver'));
    const cands = pool.length > 0 ? pool : config;
    let minDist = Infinity; let closest: string | null = null;
    cands.forEach(sp => {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < minDist) { minDist = d; closest = sp.playerId; }
    });
    return closest;
  }, [rotationHome, rotationAway, sideOutHome, sideOutAway]);

  const findBlocDefPlayer = useCallback((x: number, y: number, team: TeamSide, isBlock: boolean): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? blocDefHome : blocDefAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    const targetRole = isBlock ? 'blocker' : 'defender';
    const pool  = config.filter(sp => sp.roles.includes(targetRole));
    const cands = pool.length > 0 ? pool : config;
    let minDist = Infinity; let closest: string | null = null;
    cands.forEach(sp => {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < minDist) { minDist = d; closest = sp.playerId; }
    });
    return closest;
  }, [rotationHome, rotationAway, blocDefHome, blocDefAway]);

  const findBlocDefSPlayer = useCallback((x: number, y: number, team: TeamSide, isBlock: boolean): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? blocDefSHome : blocDefSAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    const targetRole = isBlock ? 'blocker' : 'defender';
    const pool  = config.filter(sp => sp.roles.includes(targetRole));
    const cands = pool.length > 0 ? pool : config;
    let minDist = Infinity; let closest: string | null = null;
    cands.forEach(sp => {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < minDist) { minDist = d; closest = sp.playerId; }
    });
    return closest;
  }, [rotationHome, rotationAway, blocDefSHome, blocDefSAway]);

  const findSetter = useCallback((team: TeamSide): string | null => {
    const rot = team === 'home' ? rotationHome : rotationAway;
    return Object.values(rot).find(p => p.isSetter || p.defaultRoles.includes('setter'))?.id ?? null;
  }, [rotationHome, rotationAway]);

  const findAttackPlayer = useCallback((x: number, y: number, team: TeamSide): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? sideOutHome : sideOutAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    const zones  = ATTACK_ZONE_BOUNDS[team];
    const tapped = zones.find(z => z.role && x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);
    if (!tapped?.role) return null;
    return config.find(sp => sp.roles.includes(tapped.role!))?.playerId ?? null;
  }, [rotationHome, rotationAway, sideOutHome, sideOutAway]);

  // ── Applique les effets d'une qualité (retro + fin de rally) ────────────
  const applyQualityEffect = useCallback((
    rallyId: string,
    action: { id: string; kind: ActionKind; team: TeamSide; quality: AnyQuality | null },
    quality: AnyQuality,
    allActions: RallyAction[],
  ) => {
    const effect = computeQualityEffect(action as any, quality, allActions as any);

    // Mises à jour rétroactives (fonctionnent aussi sur les rallyes terminés)
    effect.retro.forEach(u => {
      if (u.type === 'quality')      updateActionQuality(rallyId, u.actionId, u.quality);
      if (u.type === 'clearPlayer')  updateActionPlayer(rallyId, u.actionId, null);
    });

    // Fin de rally (uniquement si le rally est encore actif)
    if (effect.winner && rallyId === activeRallyId) {
      setTimeout(() => { endRally(effect.winner!); setHasStartedNew(false); }, 120);
    }
  }, [activeRallyId, updateActionQuality, updateActionPlayer, endRally]);

  // ── Handler : clic sur un dot de la frise ───────────────────────────────
  const handleDotTap = useCallback((actionId: string) => {
    setSelectedActionId(prev => prev === actionId ? null : actionId);
  }, []);

  // ── Handler : sélection d'un rally dans le log ──────────────────────────
  const handleSelectRally = useCallback((rallyId: string) => {
    setDisplayedRallyId(prev => prev === rallyId ? null : rallyId);
    setSelectedActionId(null);
  }, []);

  // ── Handler : mise à jour manuelle du joueur depuis la frise ────────────
  const handleUpdatePlayer = useCallback((rallyId: string, actionId: string, playerId: string | null) => {
    updateActionPlayer(rallyId, actionId, playerId);
  }, [updateActionPlayer]);

  // ── Handler : qualité choisie (inline picker ou quality review) ──────────
  const handleQualityChosen = useCallback((rallyId: string, actionId: string, q: AnyQuality) => {
    updateActionQuality(rallyId, actionId, q);
    setSelectedActionId(null);

    if (pendingBlock.current?.blockActionId === actionId) {
      pendingBlock.current = null;
      setIsBlockPending(false);
    }

    const rally = useMatchStore.getState().rallies.find(r => r.id === rallyId);
    if (!rally) return;
    const action = rally.actions.find(a => a.id === actionId);
    if (!action) return;

    applyQualityEffect(rallyId, action, q, rally.actions);
  }, [applyQualityEffect, updateActionQuality]);

  // ── Handler : clic filet → bloc ─────────────────────────────────────────
  const handleNetClick = useCallback((x: number) => {
    if (editMode) return;
    if (!activeRallyId) return;
    if (pendingBlock.current) return;

    const rally = useMatchStore.getState().rallies.find(r => r.id === activeRallyId);
    if (!rally) return;
    const lastAction = rally.actions[rally.actions.length - 1];
    if (!lastAction || lastAction.kind !== 'attack') return;

    const attackerTeam  = lastAction.team;
    const blockerTeam: TeamSide = attackerTeam === 'home' ? 'away' : 'home';
    const sub    = lastAction.phase === 'P3' ? lastAction.subPhase + 1 : 1;
    const blockY = blockerTeam === 'away' ? 0.95 : 0.05;
    const isRecvBlocking = lastAction.phase === 'P3' && blockerTeam !== servingTeam;
    const blockPlayerId  = isRecvBlocking
      ? findBlocDefSPlayer(x, 0.2, blockerTeam, true)
      : findBlocDefPlayer(x, 0.2, blockerTeam, true);

    addAction(activeRallyId, {
      kind: 'block', phase: 'P3', subPhase: sub,
      team: blockerTeam, zone: null, quality: 'B++',
      x, y: blockY, playerId: blockPlayerId,
    } as any);
    setHasStartedNew(true);

    const newRally  = useMatchStore.getState().rallies.find(r => r.id === activeRallyId);
    const blockAct  = newRally?.actions[newRally.actions.length - 1];
    if (!blockAct) return;
    pendingBlock.current = { blockActionId: blockAct.id, blockerTeam };
    setIsBlockPending(true);
  }, [editMode, activeRallyId, servingTeam, addAction, findBlocDefPlayer, findBlocDefSPlayer]);

  // ── Handler : clic terrain ───────────────────────────────────────────────
  const handleCourtClick = useCallback((x: number, y: number, team: TeamSide) => {
    if (editMode) return;
    if (displayedRallyId) {
      setDisplayedRallyId(null); setSelectedActionId(null); return;
    }

    // Résolution d'un bloc en attente
    if (pendingBlock.current) {
      const { blockActionId, blockerTeam } = pendingBlock.current;
      pendingBlock.current = null;
      setIsBlockPending(false);

      const rid = activeRallyId!;
      const rally = useMatchStore.getState().rallies.find(r => r.id === rid);
      if (!rally) return;
      const blockAct = rally.actions.find(a => a.id === blockActionId);
      if (!blockAct) return;
      const attackerTeam: TeamSide = blockerTeam === 'home' ? 'away' : 'home';

      if (team === blockerTeam) {
        // Côté bloqueur → B+, défense (quality picker s'ouvre)
        updateActionQuality(rid, blockActionId, 'B+');
        const isRecvDef = blockAct.phase === 'P3' && blockerTeam !== servingTeam;
        const defPlayerId = isRecvDef
          ? findBlocDefSPlayer(x, y, blockerTeam, false)
          : findBlocDefPlayer(x, y, blockerTeam, false);
        addAction(rid, {
          kind: 'defense', phase: 'P3', subPhase: blockAct.subPhase,
          team: blockerTeam, zone: null, quality: DEFAULT_QUALITY.defense ?? 'D+',
          x, y, playerId: defPlayerId,
        } as any);
        const afterAdd = useMatchStore.getState().rallies.find(r => r.id === rid);
        const defAct   = afterAdd?.actions[afterAdd.actions.length - 1];
        if (defAct?.kind === 'defense') setSelectedActionId(defAct.id);
      } else {
        // Côté attaquant → bloc reste B++, soutiens (quality picker s'ouvre)
        addAction(rid, {
          kind: 'support', phase: 'P3', subPhase: blockAct.subPhase + 1,
          team: attackerTeam, zone: null, quality: DEFAULT_QUALITY.support ?? 'D+',
          x, y, playerId: null,
        } as any);
        const afterAdd = useMatchStore.getState().rallies.find(r => r.id === rid);
        const supAct   = afterAdd?.actions[afterAdd.actions.length - 1];
        if (supAct?.kind === 'support') setSelectedActionId(supAct.id);
      }
      setHasStartedNew(true);
      return;
    }

    // Début de rally si nécessaire
    let rid = activeRallyId;
    if (!rid) {
      rid = startRally();
      setHasStartedNew(true);
      const server = (servingTeam === 'home' ? rotationHome : rotationAway)[1];
      addAction(rid, {
        kind: 'service', phase: 'P1', subPhase: 1,
        team: servingTeam, zone: null,
        playerId: server?.id ?? null, quality: DEFAULT_QUALITY.service ?? 'S=',
      } as any);
    }

    const rally = useMatchStore.getState().rallies.find(r => r.id === rid);
    if (!rally) return;
    const exp = nextExpectedAction(rally.actions, servingTeam);
    if (!exp) return;

    const last = rally.actions[rally.actions.length - 1];
    let kind         = exp.kind;
    let quality: AnyQuality = DEFAULT_QUALITY[kind] ?? 'A+';
    let resolvedTeam = exp.team;
    let actPhase     = exp.phase;
    let actSubPhase  = exp.subPhase;

    // Passe + clic côté adverse → 2e main
    if (last?.kind === 'set' && team !== exp.team) {
      updateActionQuality(rid, last.id, 'P++');
      kind = 'defense'; quality = 'D='; resolvedTeam = team;
    // Réception / défense / soutiens + clic côté adverse → balle libre
    } else if (
      last && (last.kind === 'reception' || last.kind === 'defense' || last.kind === 'support')
      && team !== exp.team
    ) {
      actPhase    = 'P3';
      actSubPhase = last.phase === 'P3' ? last.subPhase + 1 : 1;
      resolvedTeam = team;
      const isFrontZone = team === 'home' ? y < 1 / 3 : y > 2 / 3;
      kind    = isFrontZone ? 'attack'  : 'defense';
      quality = isFrontZone ? (DEFAULT_QUALITY.attack ?? 'A+') : (DEFAULT_QUALITY.defense ?? 'D+');
    }

    const receivingInP3 = actPhase === 'P3' && resolvedTeam !== servingTeam;
    const autoPlayerId  =
      kind === 'reception' ? findSideOutPlayer(x, y, resolvedTeam) :
      kind === 'set'       ? findSetter(resolvedTeam) :
      kind === 'attack'    ? findAttackPlayer(x, y, resolvedTeam) :
      kind === 'block'     ? (receivingInP3 ? findBlocDefSPlayer(x, y, resolvedTeam, true)  : findBlocDefPlayer(x, y, resolvedTeam, true)) :
      kind === 'defense'   ? (receivingInP3 ? findBlocDefSPlayer(x, y, resolvedTeam, false) : findBlocDefPlayer(x, y, resolvedTeam, false)) :
      null;

    addAction(rid, { kind, phase: actPhase, subPhase: actSubPhase, team: resolvedTeam, zone: null, quality, x, y, playerId: autoPlayerId } as any);
    setHasStartedNew(true);

    // Zone de passe → qualité rétroactive de la réception (P2 uniquement)
    if (kind === 'set' && actPhase === 'P2') {
      const zone   = getSetZone(x, y, resolvedTeam);
      const recQ   = receptionQualityFromSetZone(zone);
      const r2     = useMatchStore.getState().rallies.find(r => r.id === rid);
      const recAct = r2?.actions.find(a => a.kind === 'reception');
      if (recAct) updateActionQuality(rid, recAct.id, recQ);
    }

    if (kind === 'attack' && quality === 'A++')
      setTimeout(() => { endRally(resolvedTeam); setHasStartedNew(false); }, 120);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    editMode, activeRallyId, servingTeam, displayedRallyId,
    rotationHome, rotationAway,
    startRally, addAction, updateActionQuality, endRally,
    findSideOutPlayer, findSetter, findBlocDefPlayer, findBlocDefSPlayer, findAttackPlayer,
  ]);

  // ── Handler : clic hors terrain ─────────────────────────────────────────
  const handleOutZoneClick = useCallback((_x: number, _y: number) => {
    if (editMode) return;

    // Bloc en attente → OUT : B-, attaque A++, attaquant marque
    if (pendingBlock.current) {
      const { blockActionId, blockerTeam } = pendingBlock.current;
      pendingBlock.current = null;
      setIsBlockPending(false);
      const attackerTeam: TeamSide = blockerTeam === 'home' ? 'away' : 'home';
      const rid = activeRallyId!;
      updateActionQuality(rid, blockActionId, 'B-');
      const rally = useMatchStore.getState().rallies.find(r => r.id === rid);
      if (rally) {
        const blockIdx  = rally.actions.findIndex(a => a.id === blockActionId);
        const attackAct = [...rally.actions.slice(0, blockIdx)].reverse().find(a => a.kind === 'attack');
        if (attackAct) updateActionQuality(rid, attackAct.id, 'A++');
      }
      setHasStartedNew(true);
      setTimeout(() => { endRally(attackerTeam); setHasStartedNew(false); }, 80);
      return;
    }

    const recv: TeamSide = servingTeam === 'home' ? 'away' : 'home';

    // Pas encore de rally → service out direct
    if (!activeRallyId) {
      const rid    = startRally();
      setHasStartedNew(true);
      const server = (servingTeam === 'home' ? rotationHome : rotationAway)[1];
      addAction(rid, {
        kind: 'service_fault', phase: 'P1', subPhase: 1,
        team: servingTeam, zone: null, quality: 'S-',
        x: 0.5, y: servingTeam === 'home' ? 0.9 : 0.1,
        playerId: server?.id ?? null,
      } as any);
      setTimeout(() => { endRally(recv); setHasStartedNew(false); }, 80);
      return;
    }

    const rally = useMatchStore.getState().rallies.find(r => r.id === activeRallyId);
    if (!rally) return;
    const lastAction = rally.actions[rally.actions.length - 1];
    const exp        = nextExpectedAction(rally.actions, servingTeam);

    // Service déjà enregistré → S-
    if (lastAction?.kind === 'service') {
      updateActionQuality(activeRallyId, lastAction.id, 'S-');
      const srvRecv: TeamSide = lastAction.team === 'home' ? 'away' : 'home';
      setTimeout(() => { endRally(srvRecv); setHasStartedNew(false); }, 80);
      return;
    }

    // Attaque out → A-
    let attackingTeam: TeamSide;
    if (lastAction?.kind === 'attack') {
      attackingTeam = lastAction.team;
      updateActionQuality(activeRallyId, lastAction.id, 'A-');
    } else if (exp?.kind === 'attack') {
      attackingTeam = exp.team;
      const attackY = attackingTeam === 'home' ? 0.2 : 0.8;
      addAction(activeRallyId, {
        kind: 'attack', phase: exp.phase, subPhase: exp.subPhase,
        team: attackingTeam, zone: null, quality: 'A-',
        x: 0.5, y: attackY, playerId: null,
      } as any);
    } else {
      return;
    }

    const defendingTeam: TeamSide = attackingTeam === 'home' ? 'away' : 'home';
    setHasStartedNew(true);
    setTimeout(() => { endRally(defendingTeam); setHasStartedNew(false); }, 80);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    editMode, activeRallyId, servingTeam, rotationHome, rotationAway,
    startRally, updateActionQuality, addAction, endRally,
  ]);

  // ── Handler : faute de service ───────────────────────────────────────────
  const handleServiceFault = useCallback(() => {
    const rid    = startRally();
    setHasStartedNew(true);
    const server = (servingTeam === 'home' ? rotationHome : rotationAway)[1];
    addAction(rid, {
      kind: 'service_fault', phase: 'P1', subPhase: 1,
      team: servingTeam, zone: null,
      playerId: server?.id ?? null, quality: 'S-',
    } as any);
    const recv: TeamSide = servingTeam === 'home' ? 'away' : 'home';
    setTimeout(() => { endRally(recv); setHasStartedNew(false); }, 80);
  }, [servingTeam, rotationHome, rotationAway, startRally, addAction, endRally]);

  // ── Handler : annuler ───────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (pendingBlock.current) {
      // Annule aussi l'état de bloc en attente
      pendingBlock.current = null;
      setIsBlockPending(false);
    }
    if (activeRallyId) removeLastAction(activeRallyId);
    else undoLastPoint();
  }, [activeRallyId, removeLastAction, undoLastPoint]);

  // ── Handler : ajouter un point manuel ───────────────────────────────────
  const handleAddPoint = useCallback((team: TeamSide) => {
    if (activeRallyId) { endRally(team); setHasStartedNew(false); }
  }, [activeRallyId, endRally]);

  return {
    // État
    isBlockPending,
    hasStartedNew,
    selectedActionId,
    setSelectedActionId,
    displayedRallyId,
    // Dérivés
    activeRally,
    displayedRally,
    nextAction,
    netHighlight,
    instruction,
    // Handlers
    handleDotTap,
    handleSelectRally,
    handleUpdatePlayer,
    handleQualityChosen,
    handleNetClick,
    handleCourtClick,
    handleOutZoneClick,
    handleServiceFault,
    handleUndo,
    handleAddPoint,
  };
}
