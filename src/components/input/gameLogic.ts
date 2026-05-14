// src/components/input/gameLogic.ts
import type { ActionKind, AnyQuality, RallyAction, TeamSide } from '../../types';

export const DEFAULT_QUALITY: Partial<Record<ActionKind, AnyQuality>> = {
  service:   'S=',
  reception: 'R+',
  set:       'P+',
  attack:    'A+',
  defense:   'A+',
  block:     'A=',
  support:   'R+',
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
  if (last.phase === 'P3' && last.kind === 'block')
    return { kind:'support', team:last.team==='home'?'away':'home', subPhase:last.subPhase+1, phase:'P3' };
  if (last.phase === 'P3' && last.kind === 'support')
    return { kind:'set', team:last.team, subPhase:last.subPhase, phase:'P3' };
  return null;
}
