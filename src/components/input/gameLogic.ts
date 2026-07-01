// src/components/input/gameLogic.ts
import type { ActionKind, AnyQuality, RallyAction, TeamSide } from '../../types';

export const DEFAULT_QUALITY: Partial<Record<ActionKind, AnyQuality>> = {
  service:   'S=',
  reception: 'R+',
  set:       'P+',
  attack:    'A+',
  defense:   'D+',
  block:     'B++',
  support:   'D+',
};

export function nextExpectedAction(
  actions: RallyAction[],
  servingTeam: TeamSide
): { kind: ActionKind; team: TeamSide; subPhase: number; phase: 'P1'|'P2'|'P3' } | null {
  if (actions.length === 0) return null;
  const last = actions[actions.length - 1];
  if (last.phase === 'P1' && last.kind === 'service')
    return { kind:'reception', team:servingTeam==='home'?'away':'home', subPhase:1, phase:'P2' };
  if (last.phase === 'P2' && last.kind === 'reception')
    return { kind:'set', team:last.team, subPhase:1, phase:'P2' };
  if (last.phase === 'P2' && last.kind === 'set')
    return { kind:'attack', team:last.team, subPhase:1, phase:'P2' };
  if (last.kind === 'attack') {
    const defTeam: TeamSide = last.team === 'home' ? 'away' : 'home';
    const sub = last.phase === 'P3' ? last.subPhase + 1 : 1;
    return { kind:'defense', team:defTeam, subPhase:sub, phase:'P3' };
  }
  if (last.phase === 'P3' && last.kind === 'defense')
    return { kind:'set', team:last.team, subPhase:last.subPhase, phase:'P3' };
  if (last.phase === 'P3' && last.kind === 'set')
    return { kind:'attack', team:last.team, subPhase:last.subPhase, phase:'P3' };
  if (last.phase === 'P3' && last.kind === 'block') {
    if (!last.quality || last.quality === 'B++' || last.quality === 'B-') return null;
    if (last.quality === 'B=') {
      const attackerTeam: TeamSide = last.team === 'home' ? 'away' : 'home';
      return { kind:'support', team: attackerTeam, subPhase: last.subPhase + 1, phase:'P3' };
    }
    if (last.quality === 'B+') {
      return { kind:'defense', team: last.team, subPhase: last.subPhase, phase:'P3' };
    }
    return null;
  }
  if (last.phase === 'P3' && last.kind === 'support')
    return { kind:'set', team:last.team, subPhase:last.subPhase, phase:'P3' };
  return null;
}

// ── Effets d'une sélection de qualité ────────────────────────────────────────

export type RetroUpdate =
  | { type: 'quality'; actionId: string; quality: AnyQuality }
  | { type: 'clearPlayer'; actionId: string };

export type QualityEffect = {
  retro: RetroUpdate[];    // mises à jour sur d'autres actions du même rally
  winner: TeamSide | null; // équipe qui gagne le point (null = jeu continue)
};

function findLastBefore(actions: RallyAction[], beforeIdx: number, kind: ActionKind): RallyAction | undefined {
  for (let i = beforeIdx - 1; i >= 0; i--) {
    if (actions[i].kind === kind) return actions[i];
  }
  return undefined;
}

// Zone 1-9 d'un demi-terrain, numérotées depuis le bas-gauche (opposé filet) :
// 1 2 3 (fond), 4 5 6 (milieu), 7 8 9 (avant, près filet).
// Left/right depuis la perspective du joueur (away est miroir en x).
export function getSetZone(x: number, y: number, team: TeamSide): number {
  const localY = team === 'home' ? 2 * (y - 0.5) : 1 - 2 * y; // 0=filet, 1=fond
  const localX = team === 'home' ? x : 1 - x;                  // 0=gauche joueur, 1=droite
  const row = localY >= 2 / 3 ? 1 : localY >= 1 / 3 ? 2 : 3;  // 1=fond, 3=avant
  const col = localX < 1 / 3 ? 1 : localX < 2 / 3 ? 2 : 3;
  return (row - 1) * 3 + col;
}

export function receptionQualityFromSetZone(zone: number): 'R+' | 'R=' | 'R-' {
  if (zone === 8 || zone === 9) return 'R+';
  if (zone === 5) return 'R=';
  return 'R-';
}

// Chaque règle de jeu est ici. Ajouter une règle = ajouter un cas dans ce switch.
export function computeQualityEffect(
  action: RallyAction,
  quality: AnyQuality,
  allActions: RallyAction[],
): QualityEffect {
  const idx   = allActions.findIndex(a => a.id === action.id);
  const retro: RetroUpdate[] = [];
  const none: QualityEffect  = { retro, winner: null };

  switch (action.kind) {

    case 'service':
      if (quality === 'S-')  return { retro, winner: action.team === 'home' ? 'away' : 'home' };
      if (quality === 'S++') {
        // Ace : efface le joueur sur la réception (personne n'a touché)
        const recAct = allActions.find(a => a.kind === 'reception');
        if (recAct?.playerId) retro.push({ type: 'clearPlayer', actionId: recAct.id });
        return { retro, winner: action.team };
      }
      return none;

    case 'reception':
      if (quality === 'Zip') {
        // Ace reçu : le service précédent devient S++
        const svcAct = allActions.find(a => a.kind === 'service');
        if (svcAct && svcAct.quality !== 'S++')
          retro.push({ type: 'quality', actionId: svcAct.id, quality: 'S++' });
        return { retro, winner: action.team === 'home' ? 'away' : 'home' };
      }
      return none;

    case 'attack':
      if (quality === 'A++') return { retro, winner: action.team };
      if (quality === 'A-')  return { retro, winner: action.team === 'home' ? 'away' : 'home' };
      return none;

    case 'block':
      // La résolution du bloc est gérée par les clics terrain — pas d'effet ici
      return none;

    case 'support': {
      const blockAct = findLastBefore(allActions, idx, 'block');
      if (!blockAct) return none;
      const blockIdx  = allActions.findIndex(a => a.id === blockAct.id);
      const attackAct = findLastBefore(allActions, blockIdx, 'attack');
      if (quality === 'D+' || quality === 'D=') {
        // Soutiens réussi : attaque → A+, bloc → B=, jeu continue
        if (attackAct) retro.push({ type: 'quality', actionId: attackAct.id, quality: 'A+' });
        retro.push({ type: 'quality', actionId: blockAct.id, quality: 'B=' });
        return { retro, winner: null };
      }
      if (quality === 'D-') {
        // Soutiens raté : attaque → A=, bloc reste B++, bloqueur marque
        if (attackAct) retro.push({ type: 'quality', actionId: attackAct.id, quality: 'A=' });
        return { retro, winner: blockAct.team };
      }
      return none;
    }

    case 'defense': {
      const blockAct = findLastBefore(allActions, idx, 'block');
      if (quality === 'D-') {
        if (blockAct) {
          // Défense ratée après bloc : attaque → A++, bloc reste B+
          const blockIdx  = allActions.findIndex(a => a.id === blockAct.id);
          const attackAct = findLastBefore(allActions, blockIdx, 'attack');
          if (attackAct) retro.push({ type: 'quality', actionId: attackAct.id, quality: 'A++' });
        }
        return { retro, winner: action.team === 'home' ? 'away' : 'home' };
      }
      if (blockAct) {
        // Défense réussie après bloc : attaque → A+, bloc reste B+, jeu continue
        const blockIdx  = allActions.findIndex(a => a.id === blockAct.id);
        const attackAct = findLastBefore(allActions, blockIdx, 'attack');
        if (attackAct) retro.push({ type: 'quality', actionId: attackAct.id, quality: 'A+' });
      }
      return none;
    }

    default:
      return none;
  }
}
