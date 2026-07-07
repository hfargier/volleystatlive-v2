// src/api/modelTemplates.ts
// Modèles de jeu intégrés + utilitaire d'application à une équipe.
import type { Position, Player, PlayerRole, SideOutPlayer } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModelRoles {
  /** Rôles par position (1-6) pour chaque rotation (index 0-5) */
  sideOutRoles: Record<number, Record<number, PlayerRole[]>>;
  /**
   * Coordonnées XY — perspective HOME (y=0=filet, y=1=fond).
   * Pour AWAY : transform automatique (1-x, 1-y).
   * rotation (0-5) → position (1-6) → { x, y }
   */
  sideOutPositions?:  Record<number, Record<number, { x: number; y: number }>>;
  blocDefPositions?:  Record<number, Record<number, { x: number; y: number }>>;
  blocDefSPositions?: Record<number, Record<number, { x: number; y: number }>>;
}

// ── Defaults de coordonnées (fallback si le modèle n'en a pas) ────────────────
const HOME_DEF_SIDEOUT: Record<Position, [number, number]> = {
  1: [0.83, 0.75], 2: [0.83, 0.25], 3: [0.50, 0.25],
  4: [0.17, 0.25], 5: [0.17, 0.75], 6: [0.50, 0.75],
};
const HOME_DEF_BLOCDEF: Record<Position, [number, number]> = {
  1: [0.83, 0.72], 2: [0.83, 0.20], 3: [0.50, 0.20],
  4: [0.17, 0.20], 5: [0.17, 0.70], 6: [0.50, 0.82],
};
const AWAY_DEF_SIDEOUT: Record<Position, [number, number]> = {
  1: [0.17, 0.25], 2: [0.17, 0.75], 3: [0.50, 0.75],
  4: [0.83, 0.75], 5: [0.83, 0.25], 6: [0.50, 0.25],
};
const AWAY_DEF_BLOCDEF: Record<Position, [number, number]> = {
  1: [0.17, 0.28], 2: [0.17, 0.80], 3: [0.50, 0.80],
  4: [0.83, 0.80], 5: [0.83, 0.30], 6: [0.50, 0.18],
};

// ── Dérivation BlocDefS depuis SideOut ────────────────────────────────────────
export function deriveBlocDefS(
  rot: Record<Position, Player>,
  soConfig: SideOutPlayer[],
  isHome: boolean,
): SideOutPlayer[] {
  const defs = isHome ? HOME_DEF_BLOCDEF : AWAY_DEF_BLOCDEF;
  const hasZ2 = soConfig.some(sp => sp.roles.includes('attacker_2'));

  return ([1, 2, 3, 4, 5, 6] as Position[]).flatMap(p => {
    const player = rot[p];
    if (!player) return [];
    const sp    = soConfig.find(s => s.playerId === player.id);
    const roles = sp?.roles ?? [];
    const front = ([2, 3, 4] as Position[]).includes(p);

    let coords: [number, number];
    let outRole: PlayerRole[];

    if (front) {
      outRole = ['blocker'];
      if      (roles.includes('attacker_4'))                              coords = defs[4];
      else if (roles.includes('attacker_3') || roles.includes('central')) coords = defs[3];
      else if (roles.includes('attacker_2'))                              coords = defs[2];
      else if (roles.includes('setter') && !hasZ2)                       coords = defs[2];
      else if (roles.includes('setter'))                                  coords = defs[2];
      else                                                                 coords = defs[p];
    } else {
      outRole = ['defender'];
      if      (roles.includes('libero'))                                  coords = defs[5];
      else if (roles.includes('central'))                                 coords = defs[5];
      else if (roles.includes('receiver'))                                coords = defs[6];
      else if (roles.includes('setter') || roles.includes('pointu'))     coords = defs[1];
      else                                                                 coords = defs[p];
    }
    return [{ playerId: player.id, x: coords[0], y: coords[1], roles: outRole }];
  });
}

// ── Application d'un modèle à une équipe ─────────────────────────────────────

export interface AppliedConfigs {
  sideOut:  Record<string, SideOutPlayer[]>;
  blocDef:  Record<string, SideOutPlayer[]>;
  blocDefS: Record<string, SideOutPlayer[]>;
}

/**
 * Applique un modèle à toutes les rotations d'une équipe.
 *
 * Si le modèle contient `sideOutPositions`, les coordonnées XY du modèle sont
 * utilisées (avec transformation miroir pour AWAY). Sinon, les positions par
 * défaut sont utilisées.
 *
 * @param rotations  Array des 6 rotations (index 0 = état courant)
 * @param model      ModelRoles récupéré depuis l'API ou BUILTIN_MODELS
 * @param isHome     true si équipe domicile
 */
/** Normalise les clés d'un objet indexé par rotation/position (supporte string ET number après JSON round-trip). */
function normKey<T>(obj: Record<any, T> | undefined, key: number): T | undefined {
  if (!obj) return undefined;
  return (obj[key] ?? obj[String(key)]) as T | undefined;
}

/**
 * Retourne l'offset entre la rotation courante du jeu et la rotation 0 du modèle.
 * Le modèle est défini avec le passeur en P1 au tour 0, P6 au tour 1, etc.
 * Si le passeur est actuellement à P3 (modèle rotation 4), offset = 4.
 *
 * Mapping passeur → rotation modèle : P1→0, P6→1, P5→2, P4→3, P3→4, P2→5
 */
function modelRotationOffset(baseRot: Record<Position, Player>): number {
  const setterPosToModelRot: Record<number, number> = { 1:0, 6:1, 5:2, 4:3, 3:4, 2:5 };
  for (let p = 1; p <= 6; p++) {
    if ((baseRot as any)[p]?.isSetter) return setterPosToModelRot[p] ?? 0;
  }
  return 0; // pas de passeur identifié → rotation 0 par défaut
}

export function applyModel(
  rotations: Record<Position, Player>[],
  model: ModelRoles,
  isHome: boolean,
): AppliedConfigs {
  const defSO = isHome ? HOME_DEF_SIDEOUT : AWAY_DEF_SIDEOUT;
  const defBD = isHome ? HOME_DEF_BLOCDEF : AWAY_DEF_BLOCDEF;

  const sideOut:  Record<string, SideOutPlayer[]> = {};
  const blocDef:  Record<string, SideOutPlayer[]> = {};
  const blocDefS: Record<string, SideOutPlayer[]> = {};

  // Décalage entre la rotation courante et la rotation 0 du modèle (passeur en P1).
  // Permet d'appliquer le bon schéma même si le passeur n'est pas à P1 au départ.
  const offset = modelRotationOffset(rotations[0]);

  for (let i = 0; i < 6; i++) {
    const rot       = rotations[i];
    const serverId  = rot[1].id;
    // Index dans le modèle pour ce tour de jeu
    const mi        = (offset + i) % 6;
    type XY = { x: number; y: number };
    const modelRot    = normKey(model.sideOutRoles, mi) ?? ({} as Record<number, PlayerRole[]>);
    const modelPos    = model.sideOutPositions  ? normKey(model.sideOutPositions, mi)  : undefined;
    const modelBDPos  = model.blocDefPositions  ? normKey(model.blocDefPositions, mi)  : undefined;
    const modelBDSPos = model.blocDefSPositions ? normKey(model.blocDefSPositions, mi) : undefined;

    const soPlayers: SideOutPlayer[] = [];
    const bdPlayers: SideOutPlayer[] = [];

    ([1, 2, 3, 4, 5, 6] as Position[]).forEach(p => {
      const player = rot[p];
      if (!player) return;

      const soRoles: PlayerRole[] = normKey(modelRot, p) ?? [];
      const bdRoles: PlayerRole[] = ([2, 3, 4] as Position[]).includes(p) ? ['blocker'] : ['defender'];

      // ── Coordonnées SideOut ─────────────────────────────────────────────
      let soX: number, soY: number;
      const soPos: XY | undefined = modelPos ? normKey(modelPos, p) : undefined;
      if (soPos) {
        soX = isHome ? soPos.x : 1 - soPos.x;
        soY = isHome ? soPos.y : 1 - soPos.y;
      } else {
        soX = defSO[p][0]; soY = defSO[p][1];
      }

      // ── Coordonnées Bloc/Def ────────────────────────────────────────────
      let bdX: number, bdY: number;
      const bdPos: XY | undefined = modelBDPos ? normKey(modelBDPos, p) : undefined;
      if (bdPos) {
        bdX = isHome ? bdPos.x : 1 - bdPos.x;
        bdY = isHome ? bdPos.y : 1 - bdPos.y;
      } else {
        bdX = defBD[p][0]; bdY = defBD[p][1];
      }

      soPlayers.push({ playerId: player.id, x: soX, y: soY, roles: soRoles });
      bdPlayers.push({ playerId: player.id, x: bdX, y: bdY, roles: bdRoles });
    });

    // ── Bloc/Def S ──────────────────────────────────────────────────────
    let bdsPlayers: SideOutPlayer[];
    if (modelBDSPos) {
      bdsPlayers = ([1, 2, 3, 4, 5, 6] as Position[]).flatMap(p => {
        const player = rot[p];
        if (!player) return [];
        const pt: XY | undefined = normKey(modelBDSPos, p);
        if (!pt) return [];
        const x = isHome ? pt.x : 1 - pt.x;
        const y = isHome ? pt.y : 1 - pt.y;
        const roles: PlayerRole[] = ([2, 3, 4] as Position[]).includes(p) ? ['blocker'] : ['defender'];
        return [{ playerId: player.id, x, y, roles }];
      });
    } else {
      bdsPlayers = deriveBlocDefS(rot, soPlayers, isHome);
    }

    sideOut[serverId]  = soPlayers;
    blocDef[serverId]  = bdPlayers;
    blocDefS[serverId] = bdsPlayers;
  }

  return { sideOut, blocDef, blocDefS };
}

// ── Modèle intégré 5-1 Classique ─────────────────────────────────────────────
//
// Rotations (setter cycle : P1→P6→P5→P4→P3→P2) :
//   Rot 0 : S=P1(B)  C=P2(F)  R=P3(F)  P=P4(F)  R=P5(B)  C=P6(B)
//   Rot 1 : C=P1(B)  R=P2(F)  P=P3(F)  R=P4(F)  C=P5(B)  S=P6(B)
//   Rot 2 : R=P1(B)  P=P2(F)  R=P3(F)  C=P4(F)  S=P5(B)  C=P6(B)
//   Rot 3 : P=P1(B)  R=P2(F)  C=P3(F)  S=P4(F)  C=P5(B)  R=P6(B)
//   Rot 4 : R=P1(B)  C=P2(F)  S=P3(F)  C=P4(F)  R=P5(B)  P=P6(B)
//   Rot 5 : C=P1(B)  S=P2(F)  C=P3(F)  R=P4(F)  P=P5(B)  R=P6(B)
//
// Coordonnées SideOut (perspective HOME, y=0=filet) :
//   F = front row (au filet ou se décale pour réception)
//   B = back row (reste au fond ou court vers le filet pour setter)

// ── Pattern de rotation 5-1 ───────────────────────────────────────────────────
//
// En lisant dans le sens horaire depuis le passeur, le pattern est :
//   S → R → C → O → R → C   (setter, récepteur, central, pointu, récepteur, central)
//
// Les paires sont toujours diagonalement opposées (3 positions d'écart) :
//   Passeur  ↔ Pointu   (P1↔P4, P6↔P3, P5↔P2 selon la rotation)
//   Central  ↔ Central  (P3↔P6, P2↔P5, P1↔P4 selon la rotation)
//   Récept.  ↔ Récept.  (P2↔P5, P1↔P4, P3↔P6 selon la rotation)
//
// Rotations (setter cycle : P1→P6→P5→P4→P3→P2) :
//   Rot 0 : S=P1  R=P2(F)  C=P3(F)  O=P4(F)  R=P5(B)  C=P6(B)
//   Rot 1 : C=P1(B)  R=P2(F)  O=P3(F)  R=P4(F)  C=P5(B)  S=P6(B)
//   Rot 2 : C=P1(B)  O=P2(F)  R=P3(F)  C=P4(F)  S=P5(B)  R=P6(B)
//   Rot 3 : O=P1(B)  R=P2(F)  C=P3(F)  S=P4(F)  C=P5(B)  R=P6(B) ← wait, recheck
//   Rot 4 : R=P1(B)  C=P2(F)  S=P3(F)  R=P4(F)  C=P5(B)  O=P6(B)  ← wait
//   Rot 5 : C=P1(B)  S=P2(F)  R=P3(F)  C=P4(F)  O=P5(B)  R=P6(B)

export const MODEL_5_1_CLASSIQUE: ModelRoles = {

  sideOutRoles: {
    // Rot 0 — Setter@P1 : P1=S P2=R P3=C P4=O P5=R P6=C
    0: { 1:['setter'], 2:['receiver','attacker_4'], 3:['central','attacker_3'], 4:['pointu','attacker_2'], 5:['receiver','attacker_4'], 6:['central','attacker_3'] },
    // Rot 1 — Setter@P6 : P1=R P2=C P3=O P4=R P5=C P6=S
    1: { 1:['receiver','attacker_4'], 2:['central','attacker_3'], 3:['pointu','attacker_2'], 4:['receiver','attacker_4'], 5:['central','attacker_3'], 6:['setter'] },
    // Rot 2 — Setter@P5 : P1=C P2=O P3=R P4=C P5=S P6=R
    2: { 1:['central','attacker_3'], 2:['pointu','attacker_2'], 3:['receiver','attacker_4'], 4:['central','attacker_3'], 5:['setter'], 6:['receiver','attacker_4'] },
    // Rot 3 — Setter@P4 : P1=O P2=R P3=C P4=S P5=R P6=C
    3: { 1:['pointu','attacker_2'], 2:['receiver','attacker_4'], 3:['central','attacker_3'], 4:['setter'], 5:['receiver','attacker_4'], 6:['central','attacker_3'] },
    // Rot 4 — Setter@P3 : P1=R P2=C P3=S P4=R P5=C P6=O
    4: { 1:['receiver','attacker_4'], 2:['central','attacker_3'], 3:['setter'], 4:['receiver','attacker_4'], 5:['central','attacker_3'], 6:['pointu','attacker_2'] },
    // Rot 5 — Setter@P2 : P1=C P2=S P3=R P4=C P5=O P6=R
    5: { 1:['central','attacker_3'], 2:['setter'], 3:['receiver','attacker_4'], 4:['central','attacker_3'], 5:['pointu','attacker_2'], 6:['receiver','attacker_4'] },
  },

  // ── Positions SideOut précises pour chaque rotation ─────────────────────────
  // Principes :
  //   • Réceptionneurs back row  : zone réception, fond de court (y ≈ 0.62-0.70)
  //   • Réceptionneurs front row : reculent derrière la ligne des 3m pour recevoir
  //   • Passeur back row  : attend en fond, court vers filet après réception
  //   • Passeur front row : déjà au filet côté droit (y ≈ 0.12-0.16)
  //   • Centraux front    : au filet (y ≈ 0.14-0.18)
  //   • Centraux back     : couverture fond (y ≈ 0.78-0.82)
  //   • Pointu front/back : filet ou couverture selon position
  sideOutPositions: {
    // ── Rotation 0 : Setter back-right (P1) ────────────────────────────────
    //    O(F)──C(F)──R(F)   [net]
    //    R(B)──C(B)──S(B)
    0: {
      1: { x: 0.83, y: 0.73 }, // Setter back-right → court vers filet
      2: { x: 0.83, y: 0.40 }, // Receiver front-right, recule pour réception
      3: { x: 0.50, y: 0.16 }, // Central front-center, au filet
      4: { x: 0.17, y: 0.16 }, // Pointu front-left, au filet
      5: { x: 0.22, y: 0.65 }, // Receiver back-left, réception primaire
      6: { x: 0.50, y: 0.82 }, // Central back-center, couverture
    },
    // ── Rotation 1 : Setter back-center (P6) ───────────────────────────────
    //    R(F)──O(F)──C(F)   [net]   (P4=R, P3=O, P2=C)
    //    C(B)──S(B)──R(B)           (P5=C, P6=S, P1=R)
    1: {
      1: { x: 0.83, y: 0.68 }, // Receiver back-right, réception primaire
      2: { x: 0.83, y: 0.16 }, // Central front-right, au filet
      3: { x: 0.50, y: 0.14 }, // Pointu front-center, au filet
      4: { x: 0.25, y: 0.42 }, // Receiver front-left, recule pour réception
      5: { x: 0.17, y: 0.82 }, // Central back-left, couverture
      6: { x: 0.50, y: 0.78 }, // Setter back-center → court vers filet
    },
    // ── Rotation 2 : Setter back-left (P5) ─────────────────────────────────
    //    C(F)──R(F)──O(F)   [net]   (P4=C, P3=R, P2=O)
    //    S(B)──R(B)──C(B)           (P5=S, P6=R, P1=C)
    2: {
      1: { x: 0.83, y: 0.82 }, // Central back-right, couverture
      2: { x: 0.83, y: 0.16 }, // Pointu front-right, au filet
      3: { x: 0.55, y: 0.42 }, // Receiver front-center, recule pour réception
      4: { x: 0.17, y: 0.16 }, // Central front-left, au filet
      5: { x: 0.17, y: 0.72 }, // Setter back-left → court vers filet
      6: { x: 0.55, y: 0.65 }, // Receiver back-center, réception primaire
    },
    // ── Rotation 3 : Setter front-left (P4) ────────────────────────────────
    //    S(F)──C(F)──R(F)   [net]   (P4=S, P3=C, P2=R)
    //    R(B)──C(B)──O(B)           (P5=R, P6=C, P1=O)
    3: {
      1: { x: 0.83, y: 0.78 }, // Pointu back-right, couverture
      2: { x: 0.78, y: 0.42 }, // Receiver front-right, recule pour réception
      3: { x: 0.50, y: 0.16 }, // Central front-center, au filet
      4: { x: 0.20, y: 0.12 }, // Setter front-left, au filet prêt à passer
      5: { x: 0.22, y: 0.65 }, // Receiver back-left, réception primaire
      6: { x: 0.50, y: 0.82 }, // Central back-center, couverture
    },
    // ── Rotation 4 : Setter front-center (P3) ──────────────────────────────
    //    R(F)──S(F)──C(F)   [net]   (P4=R, P3=S, P2=C)
    //    C(B)──O(B)──R(B)           (P5=C, P6=O, P1=R)
    4: {
      1: { x: 0.83, y: 0.65 }, // Receiver back-right, réception primaire
      2: { x: 0.83, y: 0.16 }, // Central front-right, au filet
      3: { x: 0.55, y: 0.12 }, // Setter front-center, au filet prêt à passer
      4: { x: 0.22, y: 0.42 }, // Receiver front-left, recule pour réception
      5: { x: 0.17, y: 0.82 }, // Central back-left, couverture
      6: { x: 0.50, y: 0.82 }, // Pointu back-center, couverture
    },
    // ── Rotation 5 : Setter front-right (P2) ───────────────────────────────
    //    C(F)──R(F)──S(F)   [net]   (P4=C, P3=R, P2=S)
    //    R(B)──O(B)──C(B)           (P6=R, P5=O, P1=C)
    5: {
      1: { x: 0.83, y: 0.82 }, // Central back-right, couverture
      2: { x: 0.83, y: 0.12 }, // Setter front-right, au filet prêt à passer
      3: { x: 0.52, y: 0.42 }, // Receiver front-center, recule pour réception
      4: { x: 0.17, y: 0.16 }, // Central front-left, au filet
      5: { x: 0.17, y: 0.82 }, // Pointu back-left, couverture
      6: { x: 0.55, y: 0.68 }, // Receiver back-center, réception primaire
    },
  },
};

/** Liste des modèles intégrés (disponibles sans connexion API). */
export const BUILTIN_MODELS: Array<{
  id: string; name: string; description: string; config: ModelRoles;
}> = [
  {
    id: '__5_1_classique__',
    name: '5-1 Classique',
    description: '1 passeur, 1 pointu, 2 centraux, 2 réceptionneurs. '
      + 'Positions SideOut pré-calculées pour les 6 rotations.',
    config: MODEL_5_1_CLASSIQUE,
  },
];
