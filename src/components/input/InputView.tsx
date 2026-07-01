// src/components/input/InputView.tsx
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { CourtWithServer } from '../court/CourtWithServer';
import type { SideOutDot, EditDot } from '../court/CourtWithServer';
import { PointLog } from './PointLog';
import { useMatchStore, doRotate } from '../../store/matchStore';
import type { TeamSide, PlayerRole, Position, SideOutPlayer, Player, RallyAction } from '../../types';
import { CloudSync } from '../cloud/CloudSync';
import { listModels } from '../../api/volleyApi';
import type { ApiModel } from '../../api/volleyApi';
import { BUILTIN_MODELS } from '../../api/modelTemplates';
import { useRallyHandlers } from './useRallyHandlers';
import './InputView.css';

// ── Defaults de positions (coords half-court brutes, pas de flip) ────────────
type EditModuleType = 'mod12' | 'mod3';
type InternalCfg   = 'sideOut' | 'blocDef' | 'blocDefS';

const HOME_DEFAULTS: Record<InternalCfg, Record<Position,[number,number]>> = {
  sideOut:  { 1:[0.83,0.75], 2:[0.83,0.25], 3:[0.50,0.25], 4:[0.17,0.25], 5:[0.17,0.75], 6:[0.50,0.75] },
  blocDef:  { 1:[0.83,0.72], 2:[0.83,0.20], 3:[0.50,0.20], 4:[0.17,0.20], 5:[0.17,0.70], 6:[0.50,0.82] },
  blocDefS: { 1:[0.83,0.72], 2:[0.83,0.20], 3:[0.50,0.20], 4:[0.17,0.20], 5:[0.17,0.70], 6:[0.50,0.82] },
};
const AWAY_DEFAULTS: Record<InternalCfg, Record<Position,[number,number]>> = {
  sideOut:  { 1:[0.17,0.25], 2:[0.17,0.75], 3:[0.50,0.75], 4:[0.83,0.75], 5:[0.83,0.25], 6:[0.50,0.25] },
  blocDef:  { 1:[0.17,0.28], 2:[0.17,0.80], 3:[0.50,0.80], 4:[0.83,0.80], 5:[0.83,0.30], 6:[0.50,0.18] },
  blocDefS: { 1:[0.17,0.28], 2:[0.17,0.80], 3:[0.50,0.80], 4:[0.83,0.80], 5:[0.83,0.30], 6:[0.50,0.18] },
};

function defaultRoles(p: Position, isSetter: boolean, cfg: InternalCfg): PlayerRole[] {
  if (cfg === 'blocDef' || cfg === 'blocDefS') return ([2,3,4] as Position[]).includes(p) ? ['blocker'] : ['defender'];
  if (isSetter) return ['setter'];
  return ([2,3,4] as Position[]).includes(p) ? ['receiver'] : [];
}

// ── Dérivation automatique BlocDef_S depuis SideOut ──────────────────────────
function deriveBlocDefSFromSideOut(
  rot: Record<Position, Player>,
  sideOutConfig: SideOutPlayer[],
  isHome: boolean,
): SideOutPlayer[] {
  const defs = isHome ? HOME_DEFAULTS.blocDefS : AWAY_DEFAULTS.blocDefS;

  // Quelqu'un a-t-il la zone 2 ?
  const hasAttacker2 = sideOutConfig.some(sp => sp.roles.includes('attacker_2'));

  return ([1,2,3,4,5,6] as Position[]).flatMap(p => {
    const player = rot[p];
    if (!player) return [];
    const sp    = sideOutConfig.find(s => s.playerId === player.id);
    const roles = sp?.roles ?? [];
    const front = ([2,3,4] as Position[]).includes(p);

    let coords: [number,number];
    let outRole: PlayerRole[];

    if (front) {
      outRole = ['blocker'];
      if      (roles.includes('attacker_4'))                    coords = defs[4];
      else if (roles.includes('attacker_3') || roles.includes('central')) coords = defs[3];
      else if (roles.includes('attacker_2'))                    coords = defs[2];
      else if (roles.includes('setter') && !hasAttacker2)       coords = defs[2]; // passeur avant → poste 2
      else if (roles.includes('setter'))                        coords = defs[2]; // passeur avant avec Z2 → reste à poste 2
      else                                                       coords = defs[p];
    } else {
      outRole = ['defender'];
      if      (roles.includes('libero'))                        coords = defs[5]; // poste 5
      else if (roles.includes('central'))                       coords = defs[5]; // poste 5
      else if (roles.includes('receiver'))                      coords = defs[6]; // poste 6
      else if (roles.includes('setter') || roles.includes('pointu')) coords = defs[1]; // poste 1
      else                                                       coords = defs[p];
    }

    return [{ playerId: player.id, x: coords[0], y: coords[1], roles: outRole }];
  });
}

const SIDEOUT_ROLES: PlayerRole[] = ['setter','receiver','central','pointu','libero','attacker_pipe','attacker_1'];
const BLOCDEF_ROLES: PlayerRole[]  = ['blocker','defender'];
const ROLE_LABELS: Record<PlayerRole,string> = {
  setter:'Passeur △', receiver:'Réceptionneur', central:'Central',
  pointu:'Pointu', libero:'Libero',
  attacker_4:'Zone 4', attacker_3:'Zone 3', attacker_2:'Zone 2',
  attacker_pipe:'Pipe', attacker_1:'Zone 1',
  blocker:'Bloqueur', defender:'Défenseur',
};
const ROLE_COLORS: Record<PlayerRole,string> = {
  setter:'#ce93d8', receiver:'#81c784', central:'#ffb74d',
  pointu:'#ff7043', libero:'#4fc3f7',
  attacker_4:'#ff8a65', attacker_3:'#ffb74d', attacker_2:'#ff7043',
  attacker_pipe:'#ffa726', attacker_1:'#ef5350',
  blocker:'#4fc3f7', defender:'#a5d6a7',
};

// ── Fenêtres de navigation des modules (trajectoires) ────────────────────────
// W0 = M1+M2, W1 = M2+M3.1, Wk = M3.(k-1)+M3.k
function maxWindowIdx(actions: RallyAction[]): number {
  const p3 = actions.filter(a => a.phase === 'P3');
  if (p3.length === 0) return 0;
  return Math.max(...p3.map(a => a.subPhase));
}

function filterActionsForWindow(actions: RallyAction[], win: number): RallyAction[] {
  if (win === 0) return actions.filter(a => a.phase === 'P1' || a.phase === 'P2');
  if (win === 1) return actions.filter(a => a.phase === 'P2' || (a.phase === 'P3' && a.subPhase === 1));
  return actions.filter(a => a.phase === 'P3' && (a.subPhase === win - 1 || a.subPhase === win));
}

function windowLabel(win: number): string {
  if (win === 0) return 'M1 · M2';
  if (win === 1) return 'M2 · M3.1';
  return `M3.${win - 1} · M3.${win}`;
}

// ── State d'édition par rotation ─────────────────────────────────────────────
type RotState = { pos: Record<string,{x:number,y:number}>; roles: Record<string,PlayerRole[]> };

export function InputView() {
  const {
    servingTeam, activeRallyId, rallies,
    teamHomeName, teamAwayName,
    rotationHome, rotationAway,
    sideOutHome, sideOutAway,
    blocDefHome, blocDefAway,
    blocDefSHome, blocDefSAway,
    saveSideOut, saveBlocDef, saveBlocDefS,
    undoLastPoint,
    scoreHome, scoreAway,
  } = useMatchStore();
  const applyModelStore = useMatchStore(s => s.applyModel);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cloudOpen, setCloudOpen]     = useState(false);
  const [viewWindow, setViewWindow]   = useState(0);
  const touchStartX = useRef<number | null>(null);

  // ── Edit state ───────────────────────────────────────────────────────────
  const [editMode, setEditMode]                 = useState(false);
  const [editModule, setEditModule]             = useState<EditModuleType>('mod12');
  const [editRotIdx, setEditRotIdx]             = useState(0);
  const [editHome, setEditHome]                 = useState<Record<number,RotState>>({});
  const [editAway, setEditAway]                 = useState<Record<number,RotState>>({});
  const [editSelectedId, setEditSelectedId]     = useState<string | null>(null);
  const [editSelectedTeam, setEditSelectedTeam] = useState<TeamSide | null>(null);
  // Clé qui force le rechargement de l'état d'édition depuis le store (après apply model)
  const [editRefreshKey, setEditRefreshKey]     = useState(0);

  // ── Modèles disponibles pour l'apply en edit ─────────────────────────────
  const [editApiModels, setEditApiModels]       = useState<ApiModel[]>([]);
  const [editApplyModelId, setEditApplyModelId] = useState<string>('__none__');

  // ── Handlers de saisie centralisés ───────────────────────────────────────
  const {
    isBlockPending, hasStartedNew,
    selectedActionId, setSelectedActionId,
    displayedRallyId,
    activeRally, displayedRally,
    nextAction, netHighlight, instruction,
    handleDotTap, handleSelectRally,
    handleUpdatePlayer, handleQualityChosen,
    handleNetClick, handleCourtClick,
    handleOutZoneClick, handleServiceFault,
    handleUndo, handleAddPoint,
  } = useRallyHandlers(editMode);

  useEffect(() => {
    listModels().then(ms => setEditApiModels(ms)).catch(() => {});
  }, []);

  // Remet la fenêtre à 0 au démarrage de chaque nouveau rally
  useEffect(() => { setViewWindow(0); }, [activeRallyId]);

  // Auto-avance la fenêtre dès qu'un nouveau subPhase P3 commence (échange en cours)
  useEffect(() => {
    if (!activeRallyId) return;
    const rally = rallies.find(r => r.id === activeRallyId);
    if (!rally) return;
    const p3 = rally.actions.filter(a => a.phase === 'P3');
    if (p3.length === 0) return;
    const sub = Math.max(...p3.map(a => a.subPhase));
    setViewWindow(sub); // fenêtre k = M3.(k-1)+M3.k
  }, [rallies, activeRallyId]);

  const editAllModels = useMemo(() => {
    const apiByName = Object.fromEntries(editApiModels.map(m => [m.name, m]));
    return [
      { id: '__none__', name: 'Choisir un modèle…', config: null },
      ...BUILTIN_MODELS.map(b => {
        const api = apiByName[b.name];
        return { id: api ? String(api.id) : b.id, name: b.name, config: api?.config ?? b.config };
      }),
      ...editApiModels
        .filter(m => !BUILTIN_MODELS.some(b => b.name === m.name))
        .map(m => ({ id: String(m.id), name: m.name, config: m.config ?? null })),
    ];
  }, [editApiModels]);

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

    const homeIsServer = servingTeam === 'home';

    // Charge une config depuis le store, avec fallback sur les positions par défaut
    const loadSaved = (
      rot: typeof rotationHome,
      cfgMap: typeof sideOutHome,
      def: Record<Position,[number,number]>,
      cfg: InternalCfg,
    ): RotState => {
      const saved = cfgMap[rot[1].id];
      const pos:   Record<string,{x:number,y:number}> = {};
      const roles: Record<string,PlayerRole[]>         = {};
      if (saved && saved.length > 0) {
        saved.forEach(sp => { pos[sp.playerId] = { x: sp.x, y: sp.y }; roles[sp.playerId] = sp.roles; });
      } else {
        ([1,2,3,4,5,6] as Position[]).forEach(p => {
          const player = rot[p];
          if (!player) return;
          pos[player.id]   = { x: def[p][0], y: def[p][1] };
          roles[player.id] = defaultRoles(p, player.isSetter, cfg);
        });
      }
      return { pos, roles };
    };

    // Charge BlocDefS : depuis le store si configuré, sinon auto-déduit de SideOut, sinon defaults
    const loadBlocDefS = (
      rot: typeof rotationHome,
      bdSMap: typeof blocDefSHome,
      soMap: typeof sideOutHome,
      def: Record<Position,[number,number]>,
      isHome: boolean,
    ): RotState => {
      const sid   = rot[1].id;
      const saved = bdSMap[sid];
      if (saved && saved.length > 0) {
        const pos: Record<string,{x:number,y:number}> = {};
        const roles: Record<string,PlayerRole[]>       = {};
        saved.forEach(sp => { pos[sp.playerId] = { x: sp.x, y: sp.y }; roles[sp.playerId] = sp.roles; });
        return { pos, roles };
      }
      const soConfig = soMap[sid];
      if (soConfig && soConfig.length > 0) {
        const derived = deriveBlocDefSFromSideOut(rot, soConfig, isHome);
        const pos: Record<string,{x:number,y:number}> = {};
        const roles: Record<string,PlayerRole[]>       = {};
        derived.forEach(sp => { pos[sp.playerId] = { x: sp.x, y: sp.y }; roles[sp.playerId] = sp.roles; });
        return { pos, roles };
      }
      return loadSaved(rot, {} as typeof sideOutHome, def, 'blocDefS');
    };

    const newHome: Record<number,RotState> = {};
    const newAway: Record<number,RotState> = {};

    for (let i = 0; i < 6; i++) {
      const hRot = homeRotations[i];
      const aRot = awayRotations[i];

      if (editModule === 'mod12') {
        newHome[i] = homeIsServer
          ? loadSaved(hRot, blocDefHome,  HOME_DEFAULTS.blocDef,  'blocDef')
          : loadSaved(hRot, sideOutHome,  HOME_DEFAULTS.sideOut,  'sideOut');
        newAway[i] = homeIsServer
          ? loadSaved(aRot, sideOutAway,  AWAY_DEFAULTS.sideOut,  'sideOut')
          : loadSaved(aRot, blocDefAway,  AWAY_DEFAULTS.blocDef,  'blocDef');
      } else { // mod3
        newHome[i] = homeIsServer
          ? loadSaved(hRot, blocDefHome,  HOME_DEFAULTS.blocDef,  'blocDef')           // serveur → même BlocDef
          : loadBlocDefS(hRot, blocDefSHome, sideOutHome, HOME_DEFAULTS.blocDefS, true);
        newAway[i] = homeIsServer
          ? loadBlocDefS(aRot, blocDefSAway, sideOutAway, AWAY_DEFAULTS.blocDefS, false)
          : loadSaved(aRot, blocDefAway,  AWAY_DEFAULTS.blocDef,  'blocDef');           // serveur → même BlocDef
      }
    }

    setEditHome(newHome);
    setEditAway(newAway);
    setEditSelectedId(null);
    setEditSelectedTeam(null);
  }, [editMode, editModule, editRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcule le Module 3 depuis le Module 1/2 courant (toutes les rotations)
  const handleResetMod3 = useCallback(() => {
    const homeIsServer = servingTeam === 'home';
    const setReceiver = homeIsServer ? setEditAway : setEditHome;
    const recvRotations = homeIsServer ? awayRotations : homeRotations;
    const isHome = !homeIsServer; // la team receveuse

    setReceiver(prev => {
      const next = { ...prev };
      for (let i = 0; i < 6; i++) {
        const rot = recvRotations[i];
        // Récupère le sideOut courant depuis editHome/editAway mod12 en mémoire
        // En pratique on re-lit depuis le store sideOut (déjà sauvegardé)
        const soMap = isHome ? sideOutHome : sideOutAway;
        const soConfig = soMap[rot[1].id] ?? [];
        if (soConfig.length === 0) continue;
        const derived = deriveBlocDefSFromSideOut(rot, soConfig, isHome);
        const pos: Record<string,{x:number,y:number}> = {};
        const roles: Record<string,PlayerRole[]>       = {};
        derived.forEach(sp => { pos[sp.playerId] = { x: sp.x, y: sp.y }; roles[sp.playerId] = sp.roles; });
        next[i] = { pos, roles };
      }
      return next;
    });
  }, [servingTeam, homeRotations, awayRotations, sideOutHome, sideOutAway]);

  // ── Appliquer un modèle en mode édition ──────────────────────────────────
  const handleApplyModelEdit = useCallback(() => {
    const config = editAllModels.find(m => m.id === editApplyModelId)?.config;
    if (!config) return;
    applyModelStore('home', config as any);
    applyModelStore('away', config as any);
    setEditRefreshKey(k => k + 1); // recharge l'état d'édition depuis le store mis à jour
  }, [editApplyModelId, editAllModels, applyModelStore]);

  // ── Réinitialiser les positions par défaut ────────────────────────────────
  const handleResetPositions = useCallback(() => {
    const homeIsServer = servingTeam === 'home';

    const resetState = (
      rot: typeof rotationHome,
      def: Record<Position, [number, number]>,
      cfg: InternalCfg,
    ): RotState => {
      const pos:   Record<string, { x: number; y: number }> = {};
      const roles: Record<string, PlayerRole[]>              = {};
      ([1, 2, 3, 4, 5, 6] as Position[]).forEach(p => {
        const player = rot[p];
        if (!player) return;
        pos[player.id]   = { x: def[p][0], y: def[p][1] };
        roles[player.id] = defaultRoles(p, player.isSetter, cfg);
      });
      return { pos, roles };
    };

    const newHome: Record<number, RotState> = {};
    const newAway: Record<number, RotState> = {};

    for (let i = 0; i < 6; i++) {
      if (editModule === 'mod12') {
        const hCfg: InternalCfg = homeIsServer ? 'blocDef' : 'sideOut';
        const aCfg: InternalCfg = homeIsServer ? 'sideOut' : 'blocDef';
        newHome[i] = resetState(homeRotations[i], HOME_DEFAULTS[hCfg], hCfg);
        newAway[i] = resetState(awayRotations[i], AWAY_DEFAULTS[aCfg], aCfg);
      } else { // mod3 : seule l'équipe en réception est modifiable
        if (homeIsServer) {
          // home = service (BlocDef fixe), away = BlocDefS réinitialisé
          newHome[i] = resetState(homeRotations[i], HOME_DEFAULTS.blocDef, 'blocDef');
          newAway[i] = resetState(awayRotations[i], AWAY_DEFAULTS.blocDefS, 'blocDefS');
        } else {
          newHome[i] = resetState(homeRotations[i], HOME_DEFAULTS.blocDefS, 'blocDefS');
          newAway[i] = resetState(awayRotations[i], AWAY_DEFAULTS.blocDef, 'blocDef');
        }
      }
    }
    setEditHome(newHome);
    setEditAway(newAway);
    setEditSelectedId(null);
    setEditSelectedTeam(null);
  }, [editModule, servingTeam, homeRotations, awayRotations]);

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

  // ── Helpers : est-ce l'équipe servante ? ─────────────────────────────────
  const teamIsServer = (team: TeamSide) => team === servingTeam;

  // ── Handlers édition ─────────────────────────────────────────────────────
  const handleEditDotDrag = useCallback((playerId: string, team: TeamSide, x: number, y: number) => {
    // En mod3, l'équipe au service ne bouge pas
    if (editModule === 'mod3' && teamIsServer(team)) return;
    const setter = team === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      return { ...prev, [editRotIdx]: { ...cur, pos: { ...cur.pos, [playerId]: { x, y } } } };
    });
  }, [editModule, servingTeam, editRotIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditDotTap = useCallback((playerId: string, team: TeamSide) => {
    // En mod3, l'équipe au service n'est pas sélectionnable
    if (editModule === 'mod3' && teamIsServer(team)) return;
    setEditSelectedId(prev => {
      if (prev === playerId) { setEditSelectedTeam(null); return null; }
      setEditSelectedTeam(team);
      return playerId;
    });
  }, [editModule, servingTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditRoleToggle = useCallback((role: PlayerRole) => {
    if (!editSelectedId || !editSelectedTeam) return;
    const isBlocMode = editModule === 'mod3' || teamIsServer(editSelectedTeam);
    const setter = editSelectedTeam === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      const curRoles = cur.roles[editSelectedId] ?? [];
      let newRoles: PlayerRole[];
      if (isBlocMode) {
        newRoles = curRoles.includes(role) ? [] : [role];
      } else {
        const POSITION_ROLES: PlayerRole[] = ['setter','receiver','central','pointu','libero'];
        const isPositionRole = POSITION_ROLES.includes(role);
        if (isPositionRole) {
          newRoles = curRoles.includes(role)
            ? curRoles.filter(r => r !== role)
            : [...curRoles.filter(r => !POSITION_ROLES.includes(r)), role];
        } else {
          newRoles = curRoles.includes(role)
            ? curRoles.filter(r => r !== role)
            : [...curRoles, role];
        }
      }
      return { ...prev, [editRotIdx]: { ...cur, roles: { ...cur.roles, [editSelectedId]: newRoles } } };
    });
  }, [editSelectedId, editSelectedTeam, editRotIdx, editModule, servingTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveEdit = useCallback(() => {
    const buildPlayers = (rot: typeof rotationHome, state: RotState): SideOutPlayer[] =>
      ([1,2,3,4,5,6] as Position[]).flatMap(p => {
        const player = rot[p];
        if (!player) return [];
        const pos = state.pos[player.id];
        if (!pos) return [];
        return [{ playerId: player.id, x: pos.x, y: pos.y, roles: state.roles[player.id] ?? [] }];
      });

    const homeIsServer = servingTeam === 'home';
    for (let i = 0; i < 6; i++) {
      const hs  = editHome[i];
      const as_ = editAway[i];
      if (!hs || !as_) continue;
      if (editModule === 'mod12') {
        if (homeIsServer) {
          saveBlocDef('home', homeRotations[i][1].id, buildPlayers(homeRotations[i], hs));
          saveSideOut('away', awayRotations[i][1].id, buildPlayers(awayRotations[i], as_));
        } else {
          saveSideOut('home', homeRotations[i][1].id, buildPlayers(homeRotations[i], hs));
          saveBlocDef('away', awayRotations[i][1].id, buildPlayers(awayRotations[i], as_));
        }
      } else { // mod3 : seule l'équipe en réception est sauvegardée (BlocDefS)
        if (homeIsServer) {
          saveBlocDefS('away', awayRotations[i][1].id, buildPlayers(awayRotations[i], as_));
        } else {
          saveBlocDefS('home', homeRotations[i][1].id, buildPlayers(homeRotations[i], hs));
        }
      }
    }
    setEditMode(false);
  }, [editHome, editAway, editModule, servingTeam, homeRotations, awayRotations, saveSideOut, saveBlocDef, saveBlocDefS]);

  // ── Zone link (assigns attacker_* role by tapping a zone) — mod12 only ──
  const handleZoneLink = useCallback((playerId: string, team: TeamSide, role: PlayerRole) => {
    const setter = team === 'home' ? setEditHome : setEditAway;
    setter(prev => {
      const cur = prev[editRotIdx];
      if (!cur) return prev;
      const curRoles  = cur.roles[playerId] ?? [];
      const isZoneRole = (r: PlayerRole) => r.startsWith('attacker_');
      const newRoles   = curRoles.includes(role)
        ? curRoles.filter(r => r !== role)
        : [...curRoles.filter(r => !isZoneRole(r)), role];
      return { ...prev, [editRotIdx]: { ...cur, roles: { ...cur.roles, [playerId]: newRoles } } };
    });
  }, [editRotIdx]);

  // ── Dérivés rendu ────────────────────────────────────────────────────────
  const highlightTeam: TeamSide | null = !activeRally
    ? (servingTeam === 'home' ? 'away' : 'home')
    : nextAction?.team ?? null;

  const rallyActions  = displayedRally?.actions ?? [];
  const rallyMaxWin   = maxWindowIdx(rallyActions);

  const dots = filterActionsForWindow(rallyActions, viewWindow)
    .filter((a) => (a as any).x != null)
    .map((a) => ({
      id:      a.id,
      x:       (a as any).x as number,
      y:       (a as any).y as number,
      team:    a.team,
      kind:    a.kind,
      quality: a.quality,
    }));

  // Ghost overlay — toujours les 2 côtés
  // Serveur       → BlocDef (fallback sideOut)
  // Receveur P1/P2 → SideOut
  // Receveur P3+   → BlocDefS (fallback sideOut)
  const isP3 = nextAction?.phase === 'P3';

  const sideOutDots = useMemo((): { home: SideOutDot[]; away: SideOutDot[] } | undefined => {
    if (editMode) return undefined;

    // Quand on consulte un ancien point : utilise le snapshot de rotation/serveur
    // enregistré AU MOMENT du point, pas l'état courant du match.
    const viewRotHome = displayedRally?.rotationHome ?? rotationHome;
    const viewRotAway = displayedRally?.rotationAway ?? rotationAway;
    const viewServing = displayedRally?.servingTeam  ?? servingTeam;

    const toGhosts = (
      rot: typeof rotationHome,
      config: SideOutPlayer[],
    ): SideOutDot[] =>
      config.flatMap(sp => {
        const player = Object.values(rot).find(p => p.id === sp.playerId);
        if (!player) return [];
        // Fusionne les rôles tactiques (blocker/defender) avec les rôles de position du joueur
        // → permet d'afficher la lettre (R/C/P/L) et le triangle passeur (△)
        // sur TOUTES les configs (sideOut, blocDef, blocDefS)
        const extra = player.defaultRoles.filter(r => !sp.roles.includes(r));
        return [{ playerId: sp.playerId, number: player.number, x: sp.x, y: sp.y, roles: [...sp.roles, ...extra] }];
      });

    const pickConfig = (
      rot: typeof rotationHome,
      sideOutMap: typeof sideOutHome,
      blocDefMap: typeof blocDefHome,
      blocDefSMap: typeof blocDefSHome,
      isServer: boolean,
    ): SideOutDot[] => {
      const sid = rot[1].id;
      if (isServer) {
        const bd = blocDefMap[sid];
        if (bd && bd.length > 0) return toGhosts(rot, bd);
        // fallback sur sideOut si blocDef pas encore configuré
      } else if (isP3) {
        // Réception en P3 → BlocDefS (uniquement pour le rally en cours)
        const bds = blocDefSMap[sid];
        if (bds && bds.length > 0) return toGhosts(rot, bds);
        // fallback sur sideOut si blocDefS pas encore configuré
      }
      const so = sideOutMap[sid];
      if (!so || so.length === 0) return [];
      return toGhosts(rot, so);
    };

    const homeServes = viewServing === 'home';
    return {
      home: pickConfig(viewRotHome, sideOutHome, blocDefHome, blocDefSHome, homeServes),
      away: pickConfig(viewRotAway, sideOutAway, blocDefAway, blocDefSAway, !homeServes),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, isP3, displayedRally, servingTeam, rotationHome, rotationAway, sideOutHome, sideOutAway, blocDefHome, blocDefAway, blocDefSHome, blocDefSAway]);




  // ── Selected player info for role picker ─────────────────────────────────
  const editSelectedPlayer = editSelectedId && editSelectedTeam ? (() => {
    const rot = editSelectedTeam === 'home' ? homeRotations[editRotIdx] : awayRotations[editRotIdx];
    return Object.values(rot).find(p => p.id === editSelectedId) ?? null;
  })() : null;

  const editSelectedRoles = editSelectedId
    ? ((editSelectedTeam === 'home' ? editHome : editAway)[editRotIdx]?.roles[editSelectedId] ?? [])
    : [];

  // Rôles disponibles : réception en mod12 → SideOut ; tout le reste → BlocDef
  const availableRoles = (() => {
    if (!editSelectedTeam) return SIDEOUT_ROLES;
    if (editModule === 'mod12' && !teamIsServer(editSelectedTeam)) return SIDEOUT_ROLES;
    return BLOCDEF_ROLES;
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
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
          showAttackZones={editMode && editModule === 'mod12'}
          onZoneLink={handleZoneLink}
          onOutZoneClick={handleOutZoneClick}
          onNetClick={handleNetClick}
          netHighlight={netHighlight}
        />

        {/* ── Edit mode : bandeau haut ──────────────────────────── */}
        {editMode && (
          <div style={{
            position:'absolute', top:0, left:0, right:0, zIndex:30,
            background:'rgba(10,25,16,0.92)',
            borderBottom:'1px solid rgba(255,255,255,0.10)',
            display:'flex', flexDirection:'column', padding:'5px 8px', gap:5,
          }}>
            {/* Ligne 1 : module tabs + rotation nav + fermer */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button
                onClick={() => setEditModule('mod12')}
                style={{
                  padding:'3px 8px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                  background: editModule==='mod12' ? 'rgba(129,199,132,0.18)' : 'rgba(255,255,255,0.05)',
                  border: editModule==='mod12' ? '1px solid #81c784' : '1px solid rgba(255,255,255,0.12)',
                  color: editModule==='mod12' ? '#81c784' : '#a0998e',
                }}
              >① Module 1/2</button>
              <button
                onClick={() => setEditModule('mod3')}
                style={{
                  padding:'3px 8px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                  background: editModule==='mod3' ? 'rgba(255,167,38,0.18)' : 'rgba(255,255,255,0.05)',
                  border: editModule==='mod3' ? '1px solid #ffa726' : '1px solid rgba(255,255,255,0.12)',
                  color: editModule==='mod3' ? '#ffa726' : '#a0998e',
                }}
              >② Module 3</button>

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

              <button
                onClick={() => setEditMode(false)}
                style={{ background:'none', border:'none', color:'#5a554e', fontSize:18, cursor:'pointer', padding:0, lineHeight:1 }}
              >×</button>
            </div>

            {/* Ligne 2 : appliquer modèle + réinitialiser */}
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <select
                value={editApplyModelId}
                onChange={e => setEditApplyModelId(e.target.value)}
                style={{
                  flex:1, minWidth:0, background:'#1e2e1e',
                  border:'1px solid rgba(255,255,255,0.15)',
                  borderRadius:4, color:'#f0ede6', fontSize:9,
                  padding:'3px 4px', outline:'none', cursor:'pointer',
                }}
              >
                {editAllModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={handleApplyModelEdit}
                disabled={editApplyModelId === '__none__'}
                title="Applique le modèle sélectionné aux 6 rotations (home + away)"
                style={{
                  padding:'3px 7px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                  background: editApplyModelId !== '__none__' ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                  border: editApplyModelId !== '__none__' ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: editApplyModelId !== '__none__' ? '#FFD700' : '#5a554e',
                  whiteSpace:'nowrap',
                }}
              >⚡ Appliquer</button>
              <button
                onClick={handleResetPositions}
                title="Réinitialise toutes les positions aux valeurs par défaut"
                style={{
                  padding:'3px 7px', fontSize:9, fontWeight:800, borderRadius:4, cursor:'pointer',
                  background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.12)',
                  color:'#a0998e', whiteSpace:'nowrap',
                }}
              >↺ Réinit.</button>
            </div>
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
                {editModule === 'mod12'
                  ? 'Module 1/2 — placez les joueurs, touchez une zone d\'attaque pour lier'
                  : 'Module 3 — positions auto-déduites du Module 1/2, modifiables'}
              </div>
            )}

            {/* Bouton reset mod3 */}
            {editModule === 'mod3' && (
              <button
                onClick={handleResetMod3}
                style={{
                  width:'100%', padding:'5px', fontSize:9, fontWeight:700, marginBottom:4,
                  background:'rgba(255,167,38,0.10)', border:'1px solid rgba(255,167,38,0.35)',
                  borderRadius:5, color:'#ffa726', cursor:'pointer',
                }}
              >↺ Recalculer depuis Module 1/2</button>
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

        {/* ── Navigation fenêtres de modules (visible dès qu'il y a du P3) ── */}
        {!editMode && rallyMaxWin > 0 && (
          <div style={{
            position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)',
            display:'flex', alignItems:'center', gap:4, zIndex:20,
            background:'rgba(0,0,0,0.60)', borderRadius:8,
            padding:'3px 6px', border:'1px solid rgba(255,255,255,0.10)',
          }}>
            <button
              onPointerDown={() => setViewWindow(w => Math.max(0, w - 1))}
              disabled={viewWindow === 0}
              style={{
                background:'none', border:'none', lineHeight:1,
                color: viewWindow > 0 ? '#f0ede6' : '#3a3530',
                fontSize:16, cursor: viewWindow > 0 ? 'pointer' : 'default',
                padding:'0 2px',
              }}
            >‹</button>
            <span style={{
              fontSize:9, fontWeight:800, color:'#a0998e',
              minWidth:62, textAlign:'center', letterSpacing:'0.04em',
            }}>
              {windowLabel(viewWindow)}
            </span>
            <button
              onPointerDown={() => setViewWindow(w => Math.min(rallyMaxWin, w + 1))}
              disabled={viewWindow >= rallyMaxWin}
              style={{
                background:'none', border:'none', lineHeight:1,
                color: viewWindow < rallyMaxWin ? '#f0ede6' : '#3a3530',
                fontSize:16, cursor: viewWindow < rallyMaxWin ? 'pointer' : 'default',
                padding:'0 2px',
              }}
            >›</button>
          </div>
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
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="input-view__brand">
              <span className="input-view__brand-name">VOLLEYSTAT</span>
              <span className="input-view__brand-live">LIVE</span>
            </div>
            <button
              onPointerDown={() => setCloudOpen(true)}
              title="Sauvegarder / Charger"
              style={{
                background:'rgba(255,215,0,0.10)', border:'1px solid rgba(255,215,0,0.25)',
                borderRadius:6, padding:'3px 8px', color:'#FFD700', fontSize:12,
                cursor:'pointer', fontWeight:700, lineHeight:1,
              }}
            >☁️</button>
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
            onUpdatePlayer={handleUpdatePlayer}
            selectedActionId={selectedActionId}
            onSelectRally={handleSelectRally}
            onSelectAction={setSelectedActionId}
            displayedRallyId={displayedRallyId}
            onUndo={handleUndo}
            onDeleteLastPoint={undoLastPoint}
          />
        </div>

      </div>
    </div>

      {/* Panneau cloud */}
      {cloudOpen && <CloudSync onClose={() => setCloudOpen(false)} />}
    </>
  );
}
