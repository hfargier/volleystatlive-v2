// src/types.ts
export type TeamSide = 'home' | 'away';
export type Position = 1 | 2 | 3 | 4 | 5 | 6;
export type CourtZone = 'Z1'|'Z2'|'Z3'|'Z4'|'Z5'|'Z6';

export type PlayerRole =
  | 'setter'
  | 'receiver'
  | 'attacker_4'
  | 'attacker_3'
  | 'attacker_2'
  | 'attacker_1'
  | 'attacker_pipe'
  | 'blocker'
  | 'defender';

export interface SideOutPlayer {
  playerId: string;
  x: number;   // 0-1 dans le demi-terrain (coordonnées du jeu)
  y: number;
  roles: PlayerRole[];
}

export interface Player {
  id: string;
  number: number;
  name: string;
  position: Position;
  isSetter: boolean;
  defaultRoles: PlayerRole[];
}

export type ServiceQuality  = 'S-'|'S='|'S+'|'S++';
export type ReceptionQuality= 'Zip'|'R-'|'R='|'R+';
export type SetQuality      = 'P-'|'P+'|'P++';
export type AttackQuality   = 'A-'|'A='|'A+'|'A++';
export type AnyQuality = ServiceQuality|ReceptionQuality|SetQuality|AttackQuality;

export type PhaseType = 'P1'|'P2'|'P3';

// ---- Action atomique sur le terrain ----
export type ActionKind =
  | 'service'       // P1
  | 'service_fault' // P1 faute directe
  | 'reception'     // P2
  | 'set'           // P2 / P3
  | 'attack'        // P2 / P3
  | 'defense'       // P3
  | 'block'         // P3
  | 'support';      // P3.x (soutiens après bloc)

export interface RallyAction {
  id: string;
  kind: ActionKind;
  phase: PhaseType;
  subPhase: number;       // 1 pour P2, 1..n pour P3
  team: TeamSide;
  zone: CourtZone | null; // null si hors terrain (service fault)
  playerId: string | null;
  quality: AnyQuality | null;
  timestamp: number;
}

// ---- Point (rally) ----
export interface Rally {
  id: string;
  pointNumber: number;
  setNumber: number;
  scoreHome: number;       // score AVANT ce point
  scoreAway: number;
  servingTeam: TeamSide;
  rotationHome: Record<Position, Player>;
  rotationAway: Record<Position, Player>;
  actions: RallyAction[];
  winner: TeamSide | null;
  endedAt: number | null;
}

// ---- Etat global ----
export interface MatchState {
  matchId: string;
  teamHomeName: string;
  teamAwayName: string;
  currentSet: number;
  scoreHome: number;
  scoreAway: number;
  rotationHome: Record<Position, Player>;
  rotationAway: Record<Position, Player>;
  servingTeam: TeamSide;
  rallies: Rally[];
  activeRallyId: string | null;
  isSetupComplete: boolean;
  // Side Out configs (réception) : key = playerId of player at position 1 for that rotation
  sideOutHome: Record<string, SideOutPlayer[]>;
  sideOutAway: Record<string, SideOutPlayer[]>;
  // Bloc/Def configs (équipe au service) : same key convention
  blocDefHome: Record<string, SideOutPlayer[]>;
  blocDefAway: Record<string, SideOutPlayer[]>;
}

// ---- Coordonnée pixel sur le terrain ----
export interface CourtPoint {
  x: number; // 0..1 relatif à la largeur du terrain
  y: number; // 0..1 relatif à la hauteur du demi-terrain
  team: TeamSide;
}
