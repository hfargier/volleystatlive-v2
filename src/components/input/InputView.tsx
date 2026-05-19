// src/components/input/InputView.tsx
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { CourtWithServer, ATTACK_ZONE_BOUNDS } from '../court/CourtWithServer';
import type { SideOutDot, EditDot } from '../court/CourtWithServer';
import { PointLog } from './PointLog';
import { useMatchStore, doRotate } from '../../store/matchStore';
import type { TeamSide, ActionKind, AnyQuality, PlayerRole, Position, SideOutPlayer } from '../../types';
import { DEFAULT_QUALITY, nextExpectedAction } from './gameLogic';
import './InputView.css';

// ── Defaults de positions (coords half-court brutes, pas de flip) ────────────
const HOME_DEFAULTS: Record<'sideOut'|'blocDef', Record<Position,[number,number]>> = {
  sideOut: { 1:[0.83,0.75], 2:[0.83,0.25], 3:[0.50,0.25], 4:[0.17,0.25], 5:[0.17,0.75], 6:[0.50,0.75] },
  blocDef: { 1:[0.83,0.72], 2:[0.83,0.20], 3:[0.50,0.20], 4:[0.17,0.20], 5:[0.17,0.70], 6:[0.50,0.82] },
};
const AWAY_DEFAULTS: Record<'sideOut'|'blocDef', Record<Position,[number,number]>> = {
  sideOut: { 1:[0.17,0.25], 2:[0.17,0.75], 3:[0.50,0.75], 4:[0.83,0.75], 5:[0.83,0.25], 6:[0.50,0.25] },
  blocDef: { 1:[0.17,0.28], 2:[0.17,0.80], 3:[0.50,0.80], 4:[0.83,0.80], 5:[0.83,0.30], 6:[0.50,0.18] },
};

function defaultRoles(p: Position, isSetter: boolean, cfg: 'sideOut'|'blocDef'): PlayerRole[] {
  if (cfg === 'blocDef') return ([2,3,4] as Position[]).includes(p) ? ['blocker'] : ['defender'];
  if (isSetter) return ['setter'];
  return ([2,3,4] as Position[]).includes(p) ? ['receiver'] : [];
}

const SIDEOUT_ROLES: PlayerRole[] = ['setter','receiver','attacker_4','attacker_3','attacker_2','attacker_1','attacker_pipe'];
const BLOCDEF_ROLES: PlayerRole[] = ['blocker','defender'];
const ROLE_LABELS: Record<PlayerRole,string> = {
  setter:'Passeur', receiver:'Récepteur', attacker_4:'Att. 4', attacker_3:'Att. 3',
  attacker_2:'Att. 2', attacker_1:'Att. 1', attacker_pipe:'Pipe',
  blocker:'Bloqueur', defender:'Défenseur',
};
const ROLE_COLORS: Record<PlayerRole,string> = {
  setter:'#ce93d8', receiver:'#81c784', attacker_4:'#ff8a65', attacker_3:'#ffb74d',
  attacker_2:'#ff7043', attacker_1:'#ef5350', attacker_pipe:'#ffa726',
  blocker:'#4fc3f7', defender:'#a5d6a7',
};

// ── State d'édition par rotation ─────────────────────────────────────────────
type RotState = { pos: Record<string,{x:number,y:number}>; roles: Record<string,PlayerRole[]> };

export function InputView() {
  const {
    servingTeam, activeRallyId, rallies,
    teamHomeName, teamAwayName,
    rotationHome, rotationAway,
    sideOutHome, sideOutAway,
    blocDefHome, blocDefAway,
    saveSideOut, saveBlocDef,
    startRally, addAction, updateActionQuality,
    removeLastAction, endRally, undoLastPoint,
    scoreHome, scoreAway,
  } = useMatchStore();

  // ── Stats state ──────────────────────────────────────────────────────────
  const [hasStartedNew, setHasStartedNew]       = useState(false);
  const [displayedRallyId, setDisplayedRallyId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]           = useState(false);
  const touchStartX = useRef<number | null>(null);

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editMode, setEditMode]                 = useState(false);
  const [editConfigType, setEditConfigType]     = useState<'sideOut'|'blocDef'>('sideOut');
  const [editRotIdx, setEditRotIdx]             = useState(0);
  const [editHome, setEditHome]                 = useState<Record<number,RotState>>({});
  const [editAway, setEditAway]                 = useState<Record<number,RotState>>({});
  const [editSelectedId, setEditSelectedId]     = useState<string | null>(null);
  const [editSelectedTeam, setEditSelectedTeam] = useState<TeamSide | null>(null);

  // ── Rotations (toutes les 6 à partir de l'état actuel du match) ──────────
  const homeRotations = useMemo(() => {
    const r = [rotationHome];
    for (let i = 1; i < 6; i++) r.push(doRotate(r[i-1]));
    return r;
  }, [rotationHome]);

  const awayRotations = useMemo(() => {
    const r = [rotationAway];
    for (let i = 1; i < 6; i++) r.push(doRotate(r[i-1]));
    return r;
  }, [rotationAway]);

  // ── Chargement de l'état d'édition (toutes les 6 rotations × 2 équipes) ──
  useEffect(() => {
    if (!editMode) return;

    const cfgMapHome = editConfigType === 'sideOut' ? sideOutHome : blocDefHome;
    const cfgMapAway = editConfigType === 'sideOut' ? sideOutAway : blocDefAway;
    const defHome    = HOME_DEFAULTS[editConfigType];
    const defAway    = AWAY_DEFAULTS[editConfigType];

    const newHome: Record<number,RotState> = {};
    const newAway: Record<number,RotState> = {};

    for (let i = 0; i < 6; i++) {
      const hRot = homeRotations[i];
      const aRot = awayRotations[i];

      const loadTeam = (
        rot: typeof rotationHome,
        cfgMap: typeof sideOutHome,
        def: Record<Position,[number,number]>,
      ): RotState => {
        const saved = cfgMap[rot[1].id];
        const pos:   Record<string,{x:number,y:number}> = {};
        const roles: Record<string,PlayerRole[]>         = {};
        if (saved && saved.length > 0) {
          saved.forEach(sp => {
            pos[sp.playerId]   = { x: sp.x, y: sp.y };
            roles[sp.playerId] = sp.roles;
          });
        } else {
          ([1,2,3,4,5,6] as Position[]).forEach(p => {
            const player = rot[p];
            if (!player) return;
            pos[player.id]   = { x: def[p][0], y: def[p][1] };
            roles[player.id] = defaultRoles(p, player.isSetter, editConfigType);
          });
        }
        return { pos, roles };
      };

      newHome[i] = loadTeam(hRot, cfgMapHome, defHome);
      newAway[i] = loadTeam(aRot, cfgMapAway, defAway);
    }

    setEditHome(newHome);
    setEditAway(newAway);
    setEditSelectedId(null);
    setEditSelectedTeam(null);
  }, [editMode, editConfigType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit dots pour CourtWithServer ───────────────────────────────────────
  const editDots = useMemo((): { home: EditDot[]; away: EditDot[] } | undefined => {
    if (!editMode) return undefined;
    const hs = editHome[editRotIdx];
    const as_ = editAway[editRotIdx];
    if (!hs || !as_) return undefined;

    const makeDots = (rot: typeof rotationHome, state: RotState): EditDot[] =>
      ([1,2,3,4,5,6] as Position[]).flatMap(p => {
        const player = rot[p];
        if (!player) return [];
        const pos = state.pos[player.id];
        if (!pos) return [];
        return [{ playerId: player.id, number: player.number, x: pos.x, y: pos.y, roles: state.roles[player.id] ?? [] }];
      });

    return { home: makeDots(homeRotations[editRotIdx], hs), away: makeDots(awayRotations[editRotIdx], as_) };
  }, [editMode, editRotIdx, editHome, editAway, homeRotations, awayRotations]);

  // ── Handlers édition ─────────────────────────────────────────────────────
  const handleEditDotDrag = useCallback((playerId: string, team: TeamSide, x: number, y: number) => {
    const setter = team === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      return { ...prev, [editRotIdx]: { ...cur, pos: { ...cur.pos, [playerId]: { x, y } } } };
    });
  }, [editRotIdx]);

  const handleEditDotTap = useCallback((playerId: string, team: TeamSide) => {
    setEditSelectedId(prev => {
      if (prev === playerId) { setEditSelectedTeam(null); return null; } // re-tap = désélectionne
      setEditSelectedTeam(team);
      return playerId;
    });
  }, []);

  const handleEditRoleToggle = useCallback((role: PlayerRole) => {
    if (!editSelectedId || !editSelectedTeam) return;
    const setter = editSelectedTeam === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      const curRoles = cur.roles[editSelectedId] ?? [];
      let newRoles: PlayerRole[];
      if (editConfigType === 'blocDef') {
        newRoles = curRoles.includes(role) ? [] : [role];
      } else if (role === 'setter') {
        newRoles = curRoles.includes('setter') ? [] : ['setter'];
      } else {
        newRoles = curRoles.includes(role)
          ? curRoles.filter(r => r !== role)
          : [...curRoles.filter(r => r !== 'setter'), role];
      }
      return { ...prev, [editRotIdx]: { ...cur, roles: { ...cur.roles, [editSelectedId]: newRoles } } };
    });
  }, [editSelectedId, editSelectedTeam, editRotIdx, editConfigType]);

  const handleSaveEdit = useCallback(() => {
    const buildPlayers = (rot: typeof rotationHome, state: RotState): SideOutPlayer[] =>
      ([1,2,3,4,5,6] as Position[]).flatMap(p => {
        const player = rot[p];
        if (!player) return [];
        const pos = state.pos[player.id];
        if (!pos) return [];
        return [{ playerId: player.id, x: pos.x, y: pos.y, roles: state.roles[player.id] ?? [] }];
      });

    for (let i = 0; i < 6; i++) {
      const hs = editHome[i];
      const as_ = editAway[i];
      if (!hs || !as_) continue;
      if (editConfigType === 'sideOut') {
        saveSideOut('home', homeRotations[i][1].id, buildPlayers(homeRotations[i], hs));
        saveSideOut('away', awayRotations[i][1].id, buildPlayers(awayRotations[i], as_));
      } else {
        saveBlocDef('home', homeRotations[i][1].id, buildPlayers(homeRotations[i], hs));
        saveBlocDef('away', awayRotations[i][1].id, buildPlayers(awayRotations[i], as_));
      }
    }
    setEditMode(false);
  }, [editHome, editAway, editConfigType, homeRotations, awayRotations, saveSideOut, saveBlocDef]);

  // ── Zone link (assigns attacker_* role by tapping a zone) ───────────────
  const handleZoneLink = useCallback((playerId: string, team: TeamSide, role: PlayerRole) => {
    const setter = team === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      const curRoles = cur.roles[playerId] ?? [];
      let newRoles: PlayerRole[];
      if (curRoles.includes(role)) {
        // toggle off
        newRoles = curRoles.filter(r => r !== role);
      } else {
        // replace any other attacker_* role, keep non-attacker roles
        newRoles = [...curRoles.filter(r => !r.startsWith('attacker_')), role];
      }
      return { ...prev, [editRotIdx]: { ...cur, roles: { ...cur.roles, [playerId]: newRoles } } };
    });
  }, [editRotIdx]);

  // ── Stats ────────────────────────────────────────────────────────────────
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

  // Ghost overlay — coords brutes demi-terrain, pas de flip needed
  const sideOutDots = useMemo((): { home: SideOutDot[]; away: SideOutDot[] } | undefined => {
    if (editMode) return undefined;

    const buildFromConfig = (
      rot: typeof rotationHome,
      configMap: typeof sideOutHome,
    ): SideOutDot[] => {
      const config = configMap[rot[1].id];
      if (!config || config.length === 0) return [];
      return config.flatMap(sp => {
        const player = Object.values(rot).find(p => p.id === sp.playerId);
        if (!player) return [];
        return [{ playerId: sp.playerId, number: player.number, x: sp.x, y: sp.y, mainRole: (sp.roles[0] ?? null) as PlayerRole | null }];
      });
    };

    const nextKind  = nextAction?.kind ?? null;
    const isBlocDef = nextKind === 'block' || nextKind === 'defense';

    if (isBlocDef) {
      const t = nextAction!.team;
      return {
        home: t === 'home' ? buildFromConfig(rotationHome, blocDefHome) : [],
        away: t === 'away' ? buildFromConfig(rotationAway, blocDefAway) : [],
      };
    }

    const recvTeam: TeamSide = servingTeam === 'home' ? 'away' : 'home';
    return {
      home: recvTeam === 'home' ? buildFromConfig(rotationHome, sideOutHome) : [],
      away: recvTeam === 'away' ? buildFromConfig(rotationAway, sideOutAway) : [],
    };
  }, [editMode, nextAction, servingTeam, rotationHome, rotationAway, sideOutHome, sideOutAway, blocDefHome, blocDefAway]);

  // Auto-assign closest player — coords brutes, pas de flip
  const findSideOutPlayer = useCallback((x: number, y: number, team: TeamSide): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? sideOutHome : sideOutAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    let minDist = Infinity; let closest: string | null = null;
    config.forEach(sp => {
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
    const pool = config.filter(sp => sp.roles.includes(targetRole));
    const cands = pool.length > 0 ? pool : config;
    let minDist = Infinity; let closest: string | null = null;
    cands.forEach(sp => {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < minDist) { minDist = d; closest = sp.playerId; }
    });
    return closest;
  }, [rotationHome, rotationAway, blocDefHome, blocDefAway]);

  const findAttackPlayer = useCallback((x: number, y: number, team: TeamSide): string | null => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const config = (team === 'home' ? sideOutHome : sideOutAway)[rot[1].id];
    if (!config || config.length === 0) return null;
    const zones = ATTACK_ZONE_BOUNDS[team];
    const tapped = zones.find(z => z.role && x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1);
    if (!tapped?.role) return null;
    return config.find(sp => sp.roles.includes(tapped.role!))?.playerId ?? null;
  }, [rotationHome, rotationAway, sideOutHome, sideOutAway]);

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
    if (editMode) return;
    if (displayedRallyId) {
      setDisplayedRallyId(null); setSelectedActionId(null); return;
    }
    let rid = activeRallyId;
    if (!rid) {
      rid = startRally();
      setHasStartedNew(true);
      const serverOnStart = (servingTeam === 'home' ? rotationHome : rotationAway)[1];
      addAction(rid, { kind: 'service', phase: 'P1', subPhase: 1, team: servingTeam, zone: null, playerId: serverOnStart?.id ?? null, quality: DEFAULT_QUALITY['service'] ?? 'S=' } as any);
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

    const autoPlayerId =
      kind === 'reception' ? findSideOutPlayer(x, y, resolvedTeam) :
      kind === 'attack'    ? findAttackPlayer(x, y, resolvedTeam) :
      kind === 'block'     ? findBlocDefPlayer(x, y, resolvedTeam, true) :
      kind === 'defense'   ? findBlocDefPlayer(x, y, resolvedTeam, false) :
      null;
    addAction(rid, { kind, phase: exp.phase, subPhase: exp.subPhase, team: resolvedTeam, zone: null, quality, x, y, playerId: autoPlayerId } as any);
    setHasStartedNew(true);

    if (kind === 'attack' && quality === 'A++')
      setTimeout(() => { endRally(resolvedTeam); setHasStartedNew(false); }, 120);
  }, [editMode, activeRallyId, servingTeam, displayedRallyId, startRally, addAction, updateActionQuality, endRally, findSideOutPlayer, findBlocDefPlayer, findAttackPlayer]);

  const handleServiceFault = useCallback(() => {
    const rid = startRally(); setHasStartedNew(true);
    const serverFault = (servingTeam === 'home' ? rotationHome : rotationAway)[1];
    addAction(rid, { kind: 'service_fault', phase: 'P1', subPhase: 1, team: servingTeam, zone: null, playerId: serverFault?.id ?? null, quality: 'S-' } as any);
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
    if (editMode) return '';
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

  // ── Selected player info for role picker ─────────────────────────────────
  const editSelectedPlayer = editSelectedId && editSelectedTeam ? (() => {
    const rot = editSelectedTeam === 'home' ? homeRotations[editRotIdx] : awayRotations[editRotIdx];
    return Object.values(rot).find(p => p.id === editSelectedId) ?? null;
  })() : null;

  const editSelectedRoles = editSelectedId
    ? ((editSelectedTeam === 'home' ? editHome : editAway)[editRotIdx]?.roles[editSelectedId] ?? [])
    : [];

  const availableRoles = editConfigType === 'blocDef' ? BLOCDEF_ROLES : SIDEOUT_ROLES;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="input-view">

      {/* Terrain */}
      <div className="input-view__court" style={{ position: 'relative' }}>
        <CourtWithServer
          servingTeam={servingTeam}
          onCourtClick={handleCourtClick}
          onServiceFault={handleServiceFault}
          dots={dots}
          highlightTeam={editMode ? null : highlightTeam}
          instruction={instruction}
          selectedActionId={selectedActionId}
          onDotTap={handleDotTap}
          sideOutDots={sideOutDots}
          editDots={editDots}
          editSelectedId={editSelectedId}
          onEditDotDrag={handleEditDotDrag}
          onEditDotTap={handleEditDotTap}
          showAttackZones={editMode && editConfigType === 'sideOut'}
          onZoneLink={handleZoneLink}
        />

        {/* ── Edit mode : bandeau haut ──────────────────────────── */}
        {editMode && (
          <div style={{
            position:'absolute', top:0, left:0, right:0, zIndex:30,
            background:'rgba(10,25,16,0.92)',
            borderBottom:'1px solid rgba(255,255,255,0.10)',
            display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
          }}>
            {/* Config toggle */}
            <button
              onClick={() => setEditConfigType('sideOut')}
              style={{
                padding:'3px 8px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                background: editConfigType==='sideOut' ? 'rgba(129,199,132,0.18)' : 'rgba(255,255,255,0.05)',
                border: editConfigType==='sideOut' ? '1px solid #81c784' : '1px solid rgba(255,255,255,0.12)',
                color: editConfigType==='sideOut' ? '#81c784' : '#a0998e',
              }}
            >↩ Side Out</button>
            <button
              onClick={() => setEditConfigType('blocDef')}
              style={{
                padding:'3px 8px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                background: editConfigType==='blocDef' ? 'rgba(79,195,247,0.18)' : 'rgba(255,255,255,0.05)',
                border: editConfigType==='blocDef' ? '1px solid #4fc3f7' : '1px solid rgba(255,255,255,0.12)',
                color: editConfigType==='blocDef' ? '#4fc3f7' : '#a0998e',
              }}
            >✋ Bloc/Déf</button>

            {/* Rotation nav */}
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <button
                onClick={() => setEditRotIdx(i => (i + 5) % 6)}
                style={{ background:'none', border:'none', color:'#a0998e', fontSize:16, cursor:'pointer', padding:'0 4px', lineHeight:1 }}
              >‹</button>
              <span style={{ fontSize:10, fontWeight:700, color:'#f0ede6', minWidth:80, textAlign:'center' }}>
                R{editRotIdx+1} — #{homeRotations[editRotIdx]?.[1]?.number} / #{awayRotations[editRotIdx]?.[1]?.number}
              </span>
              <button
                onClick={() => setEditRotIdx(i => (i + 1) % 6)}
                style={{ background:'none', border:'none', color:'#a0998e', fontSize:16, cursor:'pointer', padding:'0 4px', lineHeight:1 }}
              >›</button>
            </div>

            {/* Fermer sans sauvegarder */}
            <button
              onClick={() => setEditMode(false)}
              style={{ background:'none', border:'none', color:'#5a554e', fontSize:18, cursor:'pointer', padding:0, lineHeight:1 }}
            >×</button>
          </div>
        )}

        {/* ── Edit mode : bandeau bas (rôles + save) ───────────── */}
        {editMode && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, zIndex:30,
            background:'rgba(10,25,16,0.92)',
            borderTop:'1px solid rgba(255,255,255,0.10)',
            padding:'6px 8px',
          }}>
            {/* Role picker pour le joueur sélectionné */}
            {editSelectedPlayer ? (
              <div style={{ marginBottom:6 }}>
                <div style={{ fontSize:9, fontWeight:700, color:'#f0ede6', marginBottom:4 }}>
                  #{editSelectedPlayer.number} {editSelectedPlayer.name}
                  <span style={{ color:'#5a554e', fontWeight:400, marginLeft:4 }}>
                    ({editSelectedTeam === 'home' ? teamHomeName.substring(0,8) : teamAwayName.substring(0,8)})
                  </span>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {availableRoles.map(role => {
                    const active = editSelectedRoles.includes(role);
                    const c = ROLE_COLORS[role];
                    return (
                      <button key={role}
                        onClick={() => handleEditRoleToggle(role)}
                        style={{
                          padding:'2px 7px', fontSize:9, fontWeight:700, borderRadius:4, cursor:'pointer',
                          background: active ? c+'25' : 'rgba(255,255,255,0.05)',
                          border: active ? `1px solid ${c}` : '1px solid rgba(255,255,255,0.12)',
                          color: active ? c : '#a0998e',
                        }}
                      >{ROLE_LABELS[role]}</button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize:9, color:'#5a554e', fontStyle:'italic', marginBottom:6, textAlign:'center' }}>
                {editConfigType === 'sideOut'
                  ? 'Touchez un joueur, puis sa zone d\'attaque'
                  : 'Touchez un joueur pour modifier son rôle'}
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleSaveEdit}
              style={{
                width:'100%', padding:'8px', fontSize:11, fontWeight:800,
                background:'rgba(255,215,0,0.15)', border:'1px solid rgba(255,215,0,0.4)',
                borderRadius:5, color:'#FFD700', cursor:'pointer', letterSpacing:'0.05em',
              }}
            >Enregistrer toutes les rotations</button>
          </div>
        )}

        {/* ── Bouton Edit (mode saisie seulement) ──────────────── */}
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            style={{
              position:'absolute', bottom:8, left:8, zIndex:20,
              background:'rgba(255,215,0,0.12)', border:'1px solid rgba(255,215,0,0.35)',
              borderRadius:5, padding:'3px 8px',
              color:'#FFD700', fontSize:9, fontWeight:800,
              cursor:'pointer', letterSpacing:'0.05em',
            }}
          >✎ EDIT</button>
        )}
      </div>

      {/* Colonne droite — drawer en portrait, fixe en paysage */}
      <div
        className={`input-view__sidebar${sidebarOpen ? ' input-view__sidebar--open' : ''}`}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 40) setSidebarOpen(false);
          if (dx < -40) setSidebarOpen(true);
          touchStartX.current = null;
        }}
      >
        {/* Onglet visible en portrait */}
        <button
          className="input-view__sidebar-tab"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Ouvrir/fermer la timeline"
        >
          {sidebarOpen ? '›' : '‹'}
        </button>

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
              className="input-view__point-btn input-view__point-btn--home"
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
              className="input-view__point-btn input-view__point-btn--away"
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
            onUndo={handleUndo}
          />
        </div>

      </div>
    </div>
  );
}
