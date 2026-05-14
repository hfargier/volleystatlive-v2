// src/components/court/PlayerBadge.tsx
// Badge joueur affiché dans une zone du terrain.
// Affiche le numéro de maillot avec un code couleur selon l'équipe.

import React from 'react';
import type { TeamSide } from '../../types';

interface PlayerBadgeProps {
  number: number;
  name?: string;
  team: TeamSide;
  size?: 'sm' | 'md';
}

const TEAM_COLOR: Record<TeamSide, { bg: string; text: string }> = {
  home: { bg: '#FFD700', text: '#111111' },
  away: { bg: '#ff8a65', text: '#111111' },
};

export function PlayerBadge({ number, name, team, size = 'sm' }: PlayerBadgeProps) {
  const colors = TEAM_COLOR[team];
  const isMd = size === 'md';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isMd ? 4 : 2,
        background: colors.bg,
        color: colors.text,
        borderRadius: isMd ? 10 : 8,
        padding: isMd ? '3px 8px' : '1px 5px',
        fontWeight: 800,
        fontSize: isMd ? 11 : 8,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <span>#{number}</span>
      {name && isMd && (
        <span style={{ fontWeight: 600, opacity: 0.8 }}>{name}</span>
      )}
    </div>
  );
}
