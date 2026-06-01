// src/components/input/SideOutEditor.tsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { TeamSide, Position, PlayerRole, SideOutPlayer } from '../../types';
import { useMatchStore, doRotate } from '../../store/matchStore';
import styles from './SideOutEditor.module.css';

type ConfigType = 'sideOut' | 'blocDef';

interface Props {
  onClose: () => void;
}

// ── Rôles disponibles par mode ───────────────────────────────────────────────

const SIDEOUT_ROLES: PlayerRole[] = [
  'setter', 'receiver', 'central', 'pointu', 'libero', 'attacker_pipe', 'attacker_1',
];
const BLOCDEF_ROLES: PlayerRole[] = ['blocker', 'defender'];

const ROLE_LABELS: Record<PlayerRole, string> = {
  setter:        'Passeur △',
  receiver:      'Réceptionneur',
  central:       'Central',
  pointu:        'Pointu',
  libero:        'Libero',
  attacker_4:    'Zone 4',
  attacker_3:    'Zone 3',
  attacker_2:    'Zone 2',
  attacker_pipe: 'Pipe',
  attacker_1:    'Zone 1',
  blocker:       'Bloqueur',
  defender:      'Défenseur',
};

const ROLE_COLORS: Record<PlayerRole, string> = {
  setter:        '#ce93d8',
  receiver:      '#81c784',
  central:       '#ffb74d',
  pointu:        '#ff7043',
  libero:        '#4fc3f7',
  attacker_4:    '#ff8a65',
  attacker_3:    '#ffb74d',
  attacker_2:    '#ff7043',
  attacker_pipe: '#ffa726',
  attacker_1:    '#ef5350',
  blocker:       '#4fc3f7',
  defender:      '#a5d6a7',
};

// ── Positions par défaut (display: net en haut, y=0) ───────────────────────
// Inclut la position 1 (serveur revenu sur le terrain en blocDef)
const DEFAULT_SIDEOUT: Record<Position, [number, number]> = {
  1: [0.83, 0.75], // arrière droit (recevoir)
  2: [0.83, 0.22],
  3: [0.50, 0.22],
  4: [0.17, 0.22],
  5: [0.17, 0.75],
  6: [0.50, 0.75],
};

const DEFAULT_BLOCDEF: Record<Position, [number, number]> = {
  1: [0.83, 0.72], // serveur revenu (défenseur)
  2: [0.83, 0.20], // bloqueur droit
  3: [0.50, 0.20], // bloqueur centre
  4: [0.17, 0.20], // bloqueur gauche
  5: [0.17, 0.70], // défenseur gauche
  6: [0.50, 0.82], // libéro centre
};

// ── Default roles ────────────────────────────────────────────────────────────

function defaultRole(pos: Position, isSetter: boolean, type: ConfigType): PlayerRole[] {
  if (type === 'blocDef') {
    return ([2, 3, 4] as Position[]).includes(pos) ? ['blocker'] : ['defender'];
  }
  // sideOut
  if (isSetter) return ['setter'];
  return ([2, 3, 4] as Position[]).includes(pos) ? ['receiver'] : [];
}

// ── Flip coords pour équipe away ─────────────────────────────────────────────
const flip = (x: number, y: number) => ({ x: 1 - x, y: 1 - y });

// ── Composant ────────────────────────────────────────────────────────────────

export function SideOutEditor({ onClose }: Props) {
  const {
    rotationHome, rotationAway,
    sideOutHome, sideOutAway,
    blocDefHome, blocDefAway,
    teamHomeName, teamAwayName,
    saveSideOut, saveBlocDef,
  } = useMatchStore();

  const [team, setTeam]         = useState<TeamSide>('home');
  const [configType, setConfig] = useState<ConfigType>('sideOut');
  const [rotIdx, setRotIdx]     = useState(0);
  // positions en coords display (net en haut pour les 2 équipes)
  const [localPos,   setLocalPos]   = useState<Record<string, { x: number; y: number }>>({});
  const [localRoles, setLocalRoles] = useState<Record<string, PlayerRole[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const courtRef   = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);

  const isAway = team === 'away';

  const rotations = useMemo(() => {
    const base = isAway ? rotationAway : rotationHome;
    const result = [base];
    for (let i = 1; i < 6; i++) result.push(doRotate(result[i - 1]));
    return result;
  }, [team, rotationHome, rotationAway]);

  const currentRot = rotations[rotIdx];
  const serverId   = currentRot[1].id;

  const savedConfig = (() => {
    if (configType === 'sideOut') return (isAway ? sideOutAway : sideOutHome)[serverId];
    return (isAway ? blocDefAway : blocDefHome)[serverId];
  })();

  // Positions à afficher : pos 1 uniquement en blocDef, toutes les 6 en sideOut
  const visiblePositions: Position[] = configType === 'blocDef'
    ? [1, 2, 3, 4, 5, 6]
    : [1, 2, 3, 4, 5, 6]; // les 6 aussi en sideOut (tous sont sur le terrain en réception)

  const defaults = configType === 'blocDef' ? DEFAULT_BLOCDEF : DEFAULT_SIDEOUT;

  // Charger config sauvegardée ou valeurs par défaut
  useEffect(() => {
    const newPos:   Record<string, { x: number; y: number }> = {};
    const newRoles: Record<string, PlayerRole[]>              = {};

    if (savedConfig && savedConfig.length > 0) {
      savedConfig.forEach(sp => {
        const d = isAway ? flip(sp.x, sp.y) : { x: sp.x, y: sp.y };
        newPos[sp.playerId]   = d;
        newRoles[sp.playerId] = sp.roles;
      });
    } else {
      visiblePositions.forEach(p => {
        const player = currentRot[p];
        if (!player) return;
        newPos[player.id]   = { x: defaults[p][0], y: defaults[p][1] };
        newRoles[player.id] = defaultRole(p, player.isSetter, configType);
      });
    }

    setLocalPos(newPos);
    setLocalRoles(newRoles);
    setSelectedId(null);
  }, [team, rotIdx, configType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag
  const handlePointerDown = useCallback((e: React.PointerEvent, playerId: string) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingId.current = playerId;
    setSelectedId(playerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId.current || !courtRef.current) return;
    const r = courtRef.current.getBoundingClientRect();
    const x = Math.max(0.03, Math.min(0.97, (e.clientX - r.left)  / r.width));
    const y = Math.max(0.06, Math.min(0.97, (e.clientY - r.top)   / r.height));
    setLocalPos(prev => ({ ...prev, [draggingId.current!]: { x, y } }));
  }, []);

  const handlePointerUp = useCallback(() => { draggingId.current = null; }, []);

  const toggleRole = useCallback((role: PlayerRole) => {
    setSelectedId(id => {
      if (!id) return id;
      setLocalRoles(prev => {
        const cur = prev[id] ?? [];
        // En blocDef : rôle unique (blocker XOR defender)
        if (configType === 'blocDef') {
          return { ...prev, [id]: cur.includes(role) ? [] : [role] };
        }
        // En sideOut : multi-rôle possible sauf setter (exclusif)
        if (role === 'setter') {
          return { ...prev, [id]: cur.includes('setter') ? [] : ['setter'] };
        }
        return { ...prev, [id]: cur.includes(role) ? cur.filter(r => r !== role) : [...cur.filter(r => r !== 'setter'), role] };
      });
      return id;
    });
  }, [configType]);

  const handleSave = useCallback(() => {
    const players: SideOutPlayer[] = visiblePositions.flatMap(p => {
      const player = currentRot[p];
      if (!player) return [];
      const disp   = localPos[player.id] ?? { x: defaults[p][0], y: defaults[p][1] };
      const stored = isAway ? flip(disp.x, disp.y) : { x: disp.x, y: disp.y };
      return [{ playerId: player.id, x: stored.x, y: stored.y, roles: localRoles[player.id] ?? [] }];
    });

    if (configType === 'sideOut') saveSideOut(team, serverId, players);
    else                          saveBlocDef(team, serverId, players);
    onClose();
  }, [team, serverId, configType, currentRot, localPos, localRoles, isAway, defaults,
      visiblePositions, saveSideOut, saveBlocDef, onClose]);

  const selectedPlayer = selectedId
    ? Object.values(currentRot).find(p => p.id === selectedId) ?? null
    : null;

  const availableRoles = configType === 'blocDef' ? BLOCDEF_ROLES : SIDEOUT_ROLES;

  return (
    <div className={styles.overlay}>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.closeBtn} onPointerDown={onClose}>×</button>
        <span className={styles.title}>Positions</span>
        <div className={styles.teamToggle}>
          <button
            className={`${styles.teamBtn} ${team === 'home' ? styles.teamBtnActive : ''}`}
            onPointerDown={() => { setTeam('home'); setRotIdx(0); }}
          >
            {teamHomeName.substring(0, 8)}
          </button>
          <button
            className={`${styles.teamBtn} ${team === 'away' ? styles.teamBtnActive : ''}`}
            onPointerDown={() => { setTeam('away'); setRotIdx(0); }}
          >
            {teamAwayName.substring(0, 8)}
          </button>
        </div>
      </div>

      {/* Config type toggle */}
      <div className={styles.configToggle}>
        <button
          className={`${styles.configBtn} ${configType === 'sideOut' ? styles.configBtnActive : ''}`}
          onPointerDown={() => setConfig('sideOut')}
        >
          ↩ Side Out
        </button>
        <button
          className={`${styles.configBtn} ${configType === 'blocDef' ? styles.configBtnActiveBloc : ''}`}
          onPointerDown={() => setConfig('blocDef')}
        >
          ✋ Bloc / Déf
        </button>
      </div>

      {/* Rotation tabs */}
      <div className={styles.rotTabs}>
        {rotations.map((rot, i) => (
          <button
            key={i}
            className={`${styles.rotTab} ${rotIdx === i ? styles.rotTabActive : ''}`}
            onPointerDown={() => setRotIdx(i)}
          >
            R{i + 1}<br />
            <span className={styles.rotTabSub}>#{rot[1].number}</span>
          </button>
        ))}
      </div>

      {/* Half-court */}
      <div className={styles.courtContainer}>
        <div
          ref={courtRef}
          className={styles.halfCourt}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className={styles.netLabel}>FILET</div>
          <div className={styles.attackLine} />

          {visiblePositions.map(p => {
            const player = currentRot[p];
            if (!player) return null;
            const pos = localPos[player.id];
            if (!pos) return null;
            const isSelected = player.id === selectedId;
            const roles      = localRoles[player.id] ?? [];
            const mainRole   = roles[0] as PlayerRole | undefined;
            const color      = mainRole ? ROLE_COLORS[mainRole] : '#a0998e';

            return (
              <div
                key={p}
                className={styles.playerDot}
                style={{
                  left:       `${pos.x * 100}%`,
                  top:        `${pos.y * 100}%`,
                  background: isSelected ? color + '40' : color + '18',
                  border:     `2px solid ${isSelected ? color : color + '70'}`,
                  boxShadow:  isSelected ? `0 0 8px ${color}60` : 'none',
                  color,
                }}
                onPointerDown={e => handlePointerDown(e, player.id)}
              >
                <span className={styles.playerNum}>{player.number}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role picker */}
      {selectedPlayer ? (
        <div className={styles.rolePicker}>
          <span className={styles.rolePickerTitle}>
            #{selectedPlayer.number} — {selectedPlayer.name}
          </span>
          <div className={styles.roleChips}>
            {availableRoles.map(role => {
              const isActive = (localRoles[selectedPlayer.id] ?? []).includes(role);
              const color    = ROLE_COLORS[role];
              return (
                <button
                  key={role}
                  className={`${styles.roleChip} ${isActive ? styles.roleChipActive : ''}`}
                  style={isActive ? { background: color + '25', borderColor: color, color } : {}}
                  onPointerDown={() => toggleRole(role)}
                >
                  {ROLE_LABELS[role]}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.rolePicker}>
          <span className={styles.rolePickerTitle} style={{ color: '#5a554e', fontStyle: 'italic' }}>
            {configType === 'sideOut'
              ? 'Placement en réception — sélectionnez un joueur'
              : 'Placement en bloc/déf — sélectionnez un joueur'}
          </span>
        </div>
      )}

      <button className={styles.saveBtn} onPointerDown={handleSave}>
        Enregistrer
      </button>
    </div>
  );
}
