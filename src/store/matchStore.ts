// src/store/matchStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MatchState, Rally, RallyAction, TeamSide,
  Player, Position, AnyQuality, ActionKind, CourtZone,
  SideOutPlayer, PlayerRole, LiberoPlayer,
} from '../types';
import type { ModelRoles } from '../api/modelTemplates';
import { applyModel as applyModelUtil, deriveBlocDefS } from '../api/modelTemplates';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

const makePlayer = (pos: Position): Player =>
  ({ id: uid(), number: 0, name: '', position: pos, isSetter: false, defaultRoles: [] });

const defaultRot = (): Record<Position,Player> => ({
  1: makePlayer(1),
  2: makePlayer(2),
  3: makePlayer(3),
  4: makePlayer(4),
  5: makePlayer(5),
  6: makePlayer(6),
} as Record<Position,Player>);

const todayISO = () => new Date().toISOString().slice(0, 10);

const INIT: MatchState = {
  matchId: uid(),
  matchDate: todayISO(),
  teamHomeName: 'Mon Equipe',
  teamAwayName: 'Adversaire',
  currentSet: 1,
  scoreHome: 0,
  scoreAway: 0,
  rotationHome: defaultRot(),
  rotationAway: defaultRot(),
  servingTeam: 'home',
  rallies: [],
  activeRallyId: null,
  isSetupComplete: false,
  sideOutHome: {},
  sideOutAway: {},
  blocDefHome: {},
  blocDefAway: {},
  blocDefSHome: {},
  blocDefSAway: {},
  liberoHome: null,
  liberoAway: null,
};

// Rotation d'une équipe : chaque joueur avance d'une position (1->2->...->6->1)
export function doRotate(rot: Record<Position,Player>): Record<Position,Player> {
  const next = {} as Record<Position,Player>;
  const pos: Position[] = [1,2,3,4,5,6];
  pos.forEach(p => {
    const nextPos = (p === 1 ? 6 : p - 1) as Position;
    next[nextPos] = { ...rot[p], position: nextPos };
  });
  return next;
}

interface Store extends MatchState {
  initMatch: (home: string, away: string, date?: string) => void;
  setSetupComplete: () => void;
  setServingTeam: (team: TeamSide) => void;
  /** Met à jour le numéro, le nom et/ou les rôles d'un joueur en rotation. */
  updatePlayer: (team: TeamSide, pos: Position, num: number, name?: string, roles?: PlayerRole[]) => void;
  /** Définit le libéro d'une équipe. */
  setLibero: (team: TeamSide, num: number, name?: string) => void;
  saveSideOut:   (team: TeamSide, serverId: string, players: SideOutPlayer[]) => void;
  saveBlocDef:   (team: TeamSide, serverId: string, players: SideOutPlayer[]) => void;
  saveBlocDefS:  (team: TeamSide, serverId: string, players: SideOutPlayer[]) => void;
  /** Remplace l'état complet par un match chargé depuis l'API. */
  loadMatchState: (state: MatchState) => void;
  /** Applique un modèle de jeu aux 6 rotations d'une équipe. */
  applyModel: (team: TeamSide, model: ModelRoles) => void;

  // Rally
  startRally: () => string;
  addAction: (rallyId: string, action: Omit<RallyAction,'id'|'timestamp'>) => void;
  updateActionQuality: (rallyId: string, actionId: string, quality: AnyQuality) => void;
  updateActionPlayer:  (rallyId: string, actionId: string, playerId: string | null) => void;
  removeLastAction: (rallyId: string) => void;
  endRally: (winner: TeamSide) => void;
  undoLastPoint: () => void;
}

export const useMatchStore = create<Store>()(
  persist((set, get) => ({
    ...INIT,

    initMatch: (home, away, date) => set({ ...INIT, matchId: uid(), matchDate: date ?? todayISO(), teamHomeName: home, teamAwayName: away }),
    setSetupComplete: () => set({ isSetupComplete: true }),
    setServingTeam: (team) => set({ servingTeam: team }),

    updatePlayer: (team, pos, num, name, roles) => set(s => {
      const key = team === 'home' ? 'rotationHome' : 'rotationAway';
      const existing = s[key][pos];
      const updated: Player = {
        ...existing,
        number: num,
        // Garde le nom existant si non fourni (changement de numéro seul ne réinitialise pas le nom)
        name: name !== undefined ? name : existing.name,
        ...(roles !== undefined ? {
          isSetter: roles.includes('setter'),
          defaultRoles: roles,
        } : {}),
      };
      return { [key]: { ...s[key], [pos]: updated } };
    }),

    setLibero: (team, num, name) => set(() => {
      const libero: LiberoPlayer = { id: uid(), number: num, name: name ?? 'J' + num };
      return team === 'home' ? { liberoHome: libero } : { liberoAway: libero };
    }),

    saveSideOut: (team, serverId, players) => set(s => (
      team === 'home'
        ? { sideOutHome: { ...s.sideOutHome, [serverId]: players } }
        : { sideOutAway: { ...s.sideOutAway, [serverId]: players } }
    )),

    saveBlocDef: (team, serverId, players) => set(s => (
      team === 'home'
        ? { blocDefHome: { ...s.blocDefHome, [serverId]: players } }
        : { blocDefAway: { ...s.blocDefAway, [serverId]: players } }
    )),

    saveBlocDefS: (team, serverId, players) => set(s => (
      team === 'home'
        ? { blocDefSHome: { ...s.blocDefSHome, [serverId]: players } }
        : { blocDefSAway: { ...s.blocDefSAway, [serverId]: players } }
    )),

    loadMatchState: (state) => set({ ...state }),

    applyModel: (team, model) => {
      const s = get();
      const baseRot = team === 'home' ? s.rotationHome : s.rotationAway;
      const isHome  = team === 'home';

      // Construire les 6 rotations successives
      const rotations: Record<Position, Player>[] = [baseRot];
      for (let i = 1; i < 6; i++) rotations.push(doRotate(rotations[i - 1]));

      const { sideOut, blocDef, blocDefS } = applyModelUtil(rotations, model, isHome);

      if (isHome) {
        set({
          sideOutHome:  { ...s.sideOutHome,  ...sideOut  },
          blocDefHome:  { ...s.blocDefHome,  ...blocDef  },
          blocDefSHome: { ...s.blocDefSHome, ...blocDefS },
        });
      } else {
        set({
          sideOutAway:  { ...s.sideOutAway,  ...sideOut  },
          blocDefAway:  { ...s.blocDefAway,  ...blocDef  },
          blocDefSAway: { ...s.blocDefSAway, ...blocDefS },
        });
      }
    },

    startRally: () => {
      const s = get();
      const id = uid();
      const rally: Rally = {
        id, pointNumber: s.rallies.length + 1,
        setNumber: s.currentSet,
        scoreHome: s.scoreHome, scoreAway: s.scoreAway,
        servingTeam: s.servingTeam,
        rotationHome: { ...s.rotationHome },
        rotationAway: { ...s.rotationAway },
        actions: [], winner: null, endedAt: null,
      };
      set(s2 => ({ rallies: [...s2.rallies, rally], activeRallyId: id }));
      return id;
    },

    addAction: (rallyId, action) => set(s => ({
      rallies: s.rallies.map(r => r.id !== rallyId ? r : {
        ...r, actions: [...r.actions, { ...action, id: uid(), timestamp: Date.now() }]
      })
    })),

    updateActionQuality: (rallyId, actionId, quality) => set(s => ({
      rallies: s.rallies.map(r => r.id !== rallyId ? r : {
        ...r, actions: r.actions.map(a => a.id !== actionId ? a : { ...a, quality })
      })
    })),

    updateActionPlayer: (rallyId, actionId, playerId) => set(s => ({
      rallies: s.rallies.map(r => r.id !== rallyId ? r : {
        ...r, actions: r.actions.map(a => a.id !== actionId ? a : { ...a, playerId })
      })
    })),

    removeLastAction: (rallyId) => set(s => {
      const rally = s.rallies.find(r => r.id === rallyId);
      if (!rally) return s;
      // Si c'était la dernière action → supprime le rally entier et libère activeRallyId
      if (rally.actions.length <= 1) {
        return {
          rallies: s.rallies.filter(r => r.id !== rallyId),
          activeRallyId: s.activeRallyId === rallyId ? null : s.activeRallyId,
        };
      }
      return {
        rallies: s.rallies.map(r => r.id !== rallyId ? r : {
          ...r, actions: r.actions.slice(0, -1)
        }),
      };
    }),

    endRally: (winner) => {
      const s = get();
      const newScoreHome = winner === 'home' ? s.scoreHome + 1 : s.scoreHome;
      const newScoreAway = winner === 'away' ? s.scoreAway + 1 : s.scoreAway;
      // Si le receveur gagne => il devient serveur => rotation de l'équipe qui reçoit
      const receivingTeam: TeamSide = s.servingTeam === 'home' ? 'away' : 'home';
      const sideOut = winner === receivingTeam;
      const newServingTeam: TeamSide = winner;
      let newRotHome = { ...s.rotationHome };
      let newRotAway = { ...s.rotationAway };
      if (sideOut) {
        if (winner === 'home') newRotHome = doRotate(newRotHome);
        else newRotAway = doRotate(newRotAway);
      }
      set(s2 => ({
        rallies: s2.rallies.map(r => r.id === s.activeRallyId
          ? { ...r, winner, endedAt: Date.now() } : r),
        activeRallyId: null,
        scoreHome: newScoreHome,
        scoreAway: newScoreAway,
        servingTeam: newServingTeam,
        rotationHome: newRotHome,
        rotationAway: newRotAway,
      }));
    },

    undoLastPoint: () => set(s => {
      if (s.rallies.length === 0) return s;
      const prev = s.rallies[s.rallies.length - 1];
      return {
        rallies: s.rallies.slice(0,-1),
        activeRallyId: null,
        scoreHome: prev.scoreHome,
        scoreAway: prev.scoreAway,
        servingTeam: prev.servingTeam,
        rotationHome: prev.rotationHome,
        rotationAway: prev.rotationAway,
      };
    }),
  }), { name: 'volleystat-v2' })
);
