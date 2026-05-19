// src/store/matchStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MatchState, Rally, RallyAction, TeamSide,
  Player, Position, AnyQuality, ActionKind, CourtZone,
  SideOutPlayer,
} from '../types';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

const makePlayer = (num: number, pos: Position, isSetter=false): Player =>
  ({ id: uid(), number: num, name: 'J'+num, position: pos, isSetter, defaultRoles: isSetter ? ['setter'] : [] });

const defaultRot = (offset=0): Record<Position,Player> => ({
  1: makePlayer(1+offset,1,true),
  2: makePlayer(2+offset,2),
  3: makePlayer(3+offset,3),
  4: makePlayer(4+offset,4),
  5: makePlayer(5+offset,5),
  6: makePlayer(6+offset,6),
} as Record<Position,Player>);

const INIT: MatchState = {
  matchId: uid(),
  teamHomeName: 'Mon Equipe',
  teamAwayName: 'Adversaire',
  currentSet: 1,
  scoreHome: 0,
  scoreAway: 0,
  rotationHome: defaultRot(0),
  rotationAway: defaultRot(6),
  servingTeam: 'home',
  rallies: [],
  activeRallyId: null,
  isSetupComplete: false,
  sideOutHome: {},
  sideOutAway: {},
  blocDefHome: {},
  blocDefAway: {},
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
  initMatch: (home: string, away: string) => void;
  setSetupComplete: () => void;
  updatePlayer: (team: TeamSide, pos: Position, num: number, name?: string) => void;
  saveSideOut:  (team: TeamSide, serverId: string, players: SideOutPlayer[]) => void;
  saveBlocDef:  (team: TeamSide, serverId: string, players: SideOutPlayer[]) => void;

  // Rally
  startRally: () => string;
  addAction: (rallyId: string, action: Omit<RallyAction,'id'|'timestamp'>) => void;
  updateActionQuality: (rallyId: string, actionId: string, quality: AnyQuality) => void;
  removeLastAction: (rallyId: string) => void;
  endRally: (winner: TeamSide) => void;
  undoLastPoint: () => void;
}

export const useMatchStore = create<Store>()(
  persist((set, get) => ({
    ...INIT,

    initMatch: (home, away) => set({ ...INIT, matchId: uid(), teamHomeName: home, teamAwayName: away }),
    setSetupComplete: () => set({ isSetupComplete: true }),

    updatePlayer: (team, pos, num, name) => set(s => {
      const key = team === 'home' ? 'rotationHome' : 'rotationAway';
      return { [key]: { ...s[key], [pos]: { ...s[key][pos], number: num, name: name ?? 'J'+num } } };
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

    removeLastAction: (rallyId) => set(s => ({
      rallies: s.rallies.map(r => r.id !== rallyId ? r : {
        ...r, actions: r.actions.slice(0, -1)
      })
    })),

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
