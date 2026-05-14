// src/hooks/useRotation.ts
// Hook utilitaire pour interroger et manipuler les rotations.
// Expose les helpers pour trouver quel joueur est à quelle position,
// et pour identifier l'opposition passeur courante (P1..P6 vs P1..P6).

import { useMatchStore } from '../store/matchStore';
import type { TeamSide, Position, Player } from '../types';

export interface OppositionLabel {
  homeSetterPos: Position;   // ex: P1 = passeur home en zone 1
  awaySetterPos: Position;
  label: string;             // ex: "P1 (home) vs P3 (away)"
}

export function useRotation() {
  const rotation = useMatchStore((s) => s.rotation);
  const rotate = useMatchStore((s) => s.rotate);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);

  // Retourne le joueur occupant une position donnée
  const getPlayer = (team: TeamSide, pos: Position): Player => {
    return rotation[team][pos];
  };

  // Retourne le passeur actuel de l'équipe
  const getSetter = (team: TeamSide): Player | undefined => {
    return Object.values(rotation[team]).find((p) => p.isSetter);
  };

  // Position courante du passeur (1..6)
  const getSetterPosition = (team: TeamSide): Position => {
    const setter = getSetter(team);
    return setter ? setter.position : 1;
  };

  // Retourne tous les joueurs d'une équipe triés par position
  const getTeamPlayers = (team: TeamSide): Player[] => {
    const positions: Position[] = [1, 2, 3, 4, 5, 6];
    return positions.map((pos) => rotation[team][pos]);
  };

  // Label de l'opposition courante (pour les stats par opposition)
  const getCurrentOpposition = (): OppositionLabel => {
    const homePos = getSetterPosition('home');
    const awayPos = getSetterPosition('away');
    return {
      homeSetterPos: homePos,
      awaySetterPos: awayPos,
      label: 'P' + homePos + ' (' + teamHomeName + ') vs P' + awayPos + ' (' + teamAwayName + ')',
    };
  };

  // Vérifie si un joueur est en zone avant (positions 2, 3, 4)
  const isInFrontRow = (pos: Position): boolean => {
    return pos === 2 || pos === 3 || pos === 4;
  };

  // Nombre de rotations avant que le passeur revienne en P1
  const rotationsUntilServe = (team: TeamSide): number => {
    const setterPos = getSetterPosition(team);
    if (setterPos === 1) return 0;
    return 7 - setterPos; // ex: pos 3 → 4 rotations
  };

  return {
    rotation,
    rotate,
    getPlayer,
    getSetter,
    getSetterPosition,
    getTeamPlayers,
    getCurrentOpposition,
    isInFrontRow,
    rotationsUntilServe,
  };
}
