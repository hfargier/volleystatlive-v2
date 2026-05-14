// src/components/setup/RotationSetup.tsx
// CORRECTION : le nouveau store expose rotationHome / rotationAway
// (et non plus rotation.home / rotation.away).
// updatePlayer remplace updatePlayerNumber.

import React from 'react';
import { useMatchStore } from '../../store/matchStore';
import type { Position, TeamSide } from '../../types';

interface RotationSetupProps {
  onComplete: () => void;
}

const ALL_POSITIONS: Position[] = [1, 2, 3, 4, 5, 6];

function TeamGrid({ team, name }: { team: TeamSide; name: string }) {
  // Lecture des bonnes clés du nouveau store
  const rotationHome = useMatchStore((s) => s.rotationHome);
  const rotationAway = useMatchStore((s) => s.rotationAway);
  const updatePlayer = useMatchStore((s) => s.updatePlayer);

  const rotation = team === 'home' ? rotationHome : rotationAway;
  const color    = team === 'home' ? '#FFD700' : '#ff8a65';

  // Garde : si la rotation n'est pas encore initialisée
  if (!rotation) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ color, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
        {name}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {ALL_POSITIONS.map((pos) => {
          const player = rotation[pos];
          if (!player) return null;

          return (
            <div
              key={pos}
              style={{
                background: '#2a2a2a',
                borderRadius: 10,
                padding: '8px 6px',
                border: player.isSetter
                  ? '1px solid #FFD700'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Label position */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: player.isSetter ? '#FFD700' : '#a0998e',
                  letterSpacing: '0.06em',
                  marginBottom: 4,
                }}
              >
                P{pos}{player.isSetter ? ' PASS' : ''}
              </div>

              {/* Numéro de maillot */}
              <input
                type="number"
                min={1}
                max={99}
                value={player.number}
                onChange={(e) =>
                  updatePlayer(team, pos, parseInt(e.target.value) || 0)
                }
                style={{
                  background: '#222',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  padding: '6px 4px',
                  color: '#f0ede6',
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: 'center',
                  width: '100%',
                  outline: 'none',
                }}
              />

              {/* Nom du joueur */}
              <input
                type="text"
                value={player.name}
                onChange={(e) =>
                  updatePlayer(team, pos, player.number, e.target.value)
                }
                placeholder={'J' + player.number}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a0998e',
                  fontSize: 10,
                  textAlign: 'center',
                  width: '100%',
                  outline: 'none',
                  padding: '2px 0',
                  marginTop: 2,
                }}
              />
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10, color: '#5a554e', marginTop: 6 }}>
        P1 = Passeur en position service (zone 1)
      </p>
    </div>
  );
}

export function RotationSetup({ onComplete }: RotationSetupProps) {
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);

  return (
    <div>
      <h2
        style={{
          color: '#FFD700',
          fontSize: 15,
          fontWeight: 800,
          marginBottom: 4,
        }}
      >
        Rotations de depart
      </h2>
      <p style={{ color: '#a0998e', fontSize: 11, marginBottom: 16 }}>
        P1 = Passeur en zone 1 (au service) — P2 = Passeur en zone 2...
      </p>

      <TeamGrid team="home" name={teamHomeName} />
      <TeamGrid team="away" name={teamAwayName} />

      <button
        onClick={onComplete}
        style={{
          width: '100%',
          marginTop: 8,
          background: '#FFD700',
          color: '#111',
          fontWeight: 700,
          padding: '12px 18px',
          borderRadius: 10,
          border: 'none',
          fontSize: 13,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        Commencer le match
      </button>
    </div>
  );
}
