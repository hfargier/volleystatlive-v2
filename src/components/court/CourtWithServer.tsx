// src/components/court/CourtWithServer.tsx
import React, { useCallback, useRef } from 'react';
import type { TeamSide, Position, AnyQuality, PlayerRole } from '../../types';
import { useMatchStore } from '../../store/matchStore';
import styles from './CourtWithServer.module.css';

interface Dot {
  id: string;
  x: number; y: number;
  team: TeamSide;
  kind: string;
  quality: AnyQuality | null;
}

export interface SideOutDot {
  playerId: string;
  number: number;
  x: number;
  y: number;
  roles: PlayerRole[];  // all roles, first used for colour
}

export interface EditDot {
  playerId: string;
  number: number;
  x: number;
  y: number;
  roles: PlayerRole[];
}

export interface AttackZoneBound {
  role: PlayerRole | null;
  x0: number; x1: number;
  y0: number; y1: number;
}

// ── Attack zone bounds (half-court coords, no flip) ──────────────────────────
// HOME: y=0 near net, y=1 back baseline
// AWAY: y=0 back baseline, y=1 near net
// Les zones utilisent attacker_4/3/2/pipe/1 — INDÉPENDANTS des rôles de position
export const ATTACK_ZONE_BOUNDS: Record<TeamSide, AttackZoneBound[]> = {
  home: [
    { role: 'attacker_4',    x0: 0,   x1: 1/3, y0: 0,   y1: 1/3 }, // zone 4
    { role: 'attacker_3',    x0: 1/3, x1: 2/3, y0: 0,   y1: 1/3 }, // zone 3
    { role: 'attacker_2',    x0: 2/3, x1: 1,   y0: 0,   y1: 1/3 }, // zone 2
    { role: null,            x0: 0,   x1: 1/3, y0: 1/3, y1: 2/3 },
    { role: 'attacker_pipe', x0: 1/3, x1: 2/3, y0: 1/3, y1: 2/3 }, // pipe
    { role: 'attacker_1',    x0: 2/3, x1: 1,   y0: 1/3, y1: 2/3 }, // zone 1
    { role: null,            x0: 0,   x1: 1/3, y0: 2/3, y1: 1   },
    { role: null,            x0: 1/3, x1: 2/3, y0: 2/3, y1: 1   },
    { role: null,            x0: 2/3, x1: 1,   y0: 2/3, y1: 1   },
  ],
  away: [
    { role: null,            x0: 0,   x1: 1/3, y0: 0,   y1: 1/3 },
    { role: null,            x0: 1/3, x1: 2/3, y0: 0,   y1: 1/3 },
    { role: null,            x0: 2/3, x1: 1,   y0: 0,   y1: 1/3 },
    { role: 'attacker_1',    x0: 0,   x1: 1/3, y0: 1/3, y1: 2/3 }, // zone 1
    { role: 'attacker_pipe', x0: 1/3, x1: 2/3, y0: 1/3, y1: 2/3 }, // pipe
    { role: null,            x0: 2/3, x1: 1,   y0: 1/3, y1: 2/3 },
    { role: 'attacker_2',    x0: 0,   x1: 1/3, y0: 2/3, y1: 1   }, // zone 2
    { role: 'attacker_3',    x0: 1/3, x1: 2/3, y0: 2/3, y1: 1   }, // zone 3
    { role: 'attacker_4',    x0: 2/3, x1: 1,   y0: 2/3, y1: 1   }, // zone 4
  ],
};

interface Props {
  servingTeam: TeamSide;
  onCourtClick: (x: number, y: number, team: TeamSide) => void;
  onServiceFault: () => void;

  dots: Dot[];
  highlightTeam: TeamSide | null;
  instruction: string;
  selectedActionId: string | null;
  onDotTap: (actionId: string) => void;
  sideOutDots?: { home: SideOutDot[]; away: SideOutDot[] };

  // Edit mode
  editDots?: { home: EditDot[]; away: EditDot[] };
  editSelectedId?: string | null;
  onEditDotDrag?: (playerId: string, team: TeamSide, x: number, y: number) => void;
  onEditDotTap?:  (playerId: string, team: TeamSide) => void;

  // Attack zone grid (edit mode, sideOut config)
  showAttackZones?: boolean;
  onZoneLink?: (playerId: string, team: TeamSide, role: PlayerRole) => void;

  // Out-zone click (ball landed beyond boundary)
  onOutZoneClick?: (x: number, y: number) => void;

  // Net click (block attempt)
  onNetClick?: (x: number) => void;
  netHighlight?: boolean;
}

const KIND_LETTER: Record<string, string> = {
  service:'S', service_fault:'!',
  reception:'R', set:'P', attack:'A',
  defense:'D', block:'C', support:'S',
};

const KIND_COLOR: Record<string, string> = {
  service:'#FFD700', service_fault:'#f44336',
  reception:'#81c784', set:'#ce93d8', attack:'#ff8a65',
  defense:'#4fc3f7', block:'#ff5252', support:'#a5d6a7',
};

const ROLE_COLOR: Record<string, string> = {
  // Positions (couleur principale du dot)
  setter:        '#ce93d8', // violet
  receiver:      '#81c784', // vert
  central:       '#ffb74d', // orange
  pointu:        '#ff7043', // rouge-orangé
  libero:        '#4fc3f7', // bleu clair
  // Zones d'attaque (couleur des flèches et cellules de grille)
  attacker_4:    '#ff8a65',
  attacker_3:    '#ffb74d',
  attacker_2:    '#ff7043',
  attacker_pipe: '#ffa726',
  attacker_1:    '#ef5350',
  // Bloc/Déf
  blocker:       '#4fc3f7',
  defender:      '#a5d6a7',
};

// Labels des cellules de la grille d'attaque (numéros de zone)
const ZONE_LABELS: Partial<Record<PlayerRole, string>> = {
  attacker_4:    '4',
  attacker_3:    '3',
  attacker_2:    '2',
  attacker_pipe: 'P',
  attacker_1:    '1',
};

// Lettre affichée SUR le dot — uniquement depuis les rôles de position
// Les rôles attacker_* (zones) sont ignorés ici
function volleyLabel(roles: PlayerRole[]): { letter: string | null; isSetter: boolean } {
  for (const r of roles) {
    if (r === 'setter')   return { letter: null, isSetter: true };
    if (r === 'receiver') return { letter: 'R',  isSetter: false };
    if (r === 'central')  return { letter: 'C',  isSetter: false };
    if (r === 'pointu')   return { letter: 'P',  isSetter: false };
    if (r === 'libero')   return { letter: 'L',  isSetter: false };
  }
  return { letter: null, isSetter: false };
}

function qualityBg(q: AnyQuality | null): string {
  if (!q) return 'rgba(0,0,0,0.45)';
  if (q.endsWith('++')) return 'rgba(255,215,0,0.22)';
  if (q.endsWith('+'))  return 'rgba(76,175,80,0.22)';
  if (q.endsWith('='))  return 'rgba(255,152,0,0.22)';
  if (q.endsWith('-'))  return 'rgba(244,67,54,0.22)';
  return 'rgba(0,0,0,0.45)';
}

const HOME_LAYOUT: Partial<Record<Position,[number,number]>> = {
  2:[83,25], 3:[50,25], 4:[17,25],
  5:[17,75], 6:[50,75],
};
const AWAY_LAYOUT: Partial<Record<Position,[number,number]>> = {
  2:[17,75], 3:[50,75], 4:[83,75],
  5:[83,25], 6:[50,25],
};

const HALF = 0.495;
function toGlobal(dot: Dot) {
  return dot.team === 'away'
    ? { gx: dot.x, gy: dot.y * HALF }
    : { gx: dot.x, gy: 0.505 + dot.y * HALF };
}

function FullCourtTrajectory({ dots, selectedActionId, onDotTap }: {
  dots: Dot[];
  selectedActionId: string | null;
  onDotTap: (id: string) => void;
}) {
  if (dots.length < 1) return null;
  const global = dots.map(toGlobal);
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < global.length - 1; i++) {
    const a = global[i];
    const b = global[i + 1];
    const color = KIND_COLOR[dots[i + 1].kind] ?? '#aaa';
    const crossesNet =
      (dots[i].team === 'home' && dots[i+1].team === 'away') ||
      (dots[i].team === 'away' && dots[i+1].team === 'home');
    const mx = (a.gx + b.gx) / 2;
    const my = (a.gy + b.gy) / 2 + (crossesNet ? -0.09 : -0.03);
    lines.push(
      <path key={'l'+i}
        d={`M ${a.gx*100} ${a.gy*100} Q ${mx*100} ${my*100} ${b.gx*100} ${b.gy*100}`}
        stroke={color}
        strokeWidth={crossesNet ? '1.1' : '0.9'}
        strokeDasharray={crossesNet ? '4 2.5' : '3 2'}
        fill="none" strokeOpacity={0.65} strokeLinecap="round"
      />
    );
  }

  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.trajectorySvg} style={{ overflow: 'visible' }}>
        {lines}
      </svg>

      {dots.map((dot, i) => {
        const g          = global[i];
        const color      = KIND_COLOR[dot.kind] ?? '#aaa';
        const letter     = KIND_LETTER[dot.kind] ?? '?';
        const isSelected = dot.id === selectedActionId;

        return (
          <div
            key={'lbl'+i}
            onPointerDown={(e) => { e.stopPropagation(); onDotTap(dot.id); }}
            className={styles.dotHitArea}
            style={{
              left: `calc(${g.gx * 100}% - 11px)`,
              top:  `calc(${g.gy * 100}% - 11px)`,
            }}
          >
            <div
              className={styles.dotCircle}
              style={{
                background: isSelected ? color + '35' : qualityBg(dot.quality),
                border: '1px solid ' + (isSelected ? color : color + '70'),
                boxShadow: isSelected ? '0 0 5px ' + color + '50' : 'none',
              }}
            >
              <span className={styles.dotLetter} style={{ color: isSelected ? color : color + 'bb' }}>
                {letter}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function SideOutGhosts({ dots }: { dots: SideOutDot[] }) {
  if (dots.length === 0) return null;
  return (
    <>
      {dots.map(d => {
        const { letter, isSetter } = volleyLabel(d.roles);
        // Passeur → toujours violet + triangle, quelle que soit la config tactique (blocDef, blocDefS…)
        const mainRole = isSetter ? 'setter' : (d.roles[0] ?? null);
        const color    = mainRole ? (ROLE_COLOR[mainRole] ?? '#a0998e') : '#a0998e';

        if (isSetter) {
          // Forme triangulaire (passeur △)
          return (
            <div key={d.playerId} style={{
              position: 'absolute',
              left: `${d.x * 100}%`,
              top:  `${d.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 30, height: 28,
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              background: color + 'cc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              paddingTop: '10px',
              pointerEvents: 'none',
              zIndex: 2,
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#111' }}>{d.number}</span>
            </div>
          );
        }

        return (
          <div key={d.playerId} style={{
            position: 'absolute',
            left: `${d.x * 100}%`,
            top:  `${d.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 28, height: 28,
            borderRadius: '50%',
            border: `2px solid ${color}cc`,
            background: color + '28',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 2,
          }}>
            <span style={{ fontSize: 8, fontWeight: 900, color, lineHeight: 1 }}>
              {d.number}{letter}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ── Attack zone grid overlay ─────────────────────────────────────────────────
function AttackZoneGrid({ team, dots, selectedId, onZoneTap }: {
  team: TeamSide;
  dots: EditDot[];
  selectedId: string | null;
  onZoneTap: (role: PlayerRole) => void;
}) {
  const zones = ATTACK_ZONE_BOUNDS[team];

  return (
    <>
      {zones.map((zone, i) => {
        if (!zone.role) {
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${zone.x0 * 100}%`, width: `${(zone.x1 - zone.x0) * 100}%`,
              top:  `${zone.y0 * 100}%`, height: `${(zone.y1 - zone.y0) * 100}%`,
              border: '1px solid rgba(255,255,255,0.05)',
              pointerEvents: 'none',
              zIndex: 3,
            }} />
          );
        }
        const linked = dots.find(d => d.roles.includes(zone.role!));
        const c = ROLE_COLOR[zone.role] ?? '#fff';
        return (
          <div key={i}
            style={{
              position: 'absolute',
              left: `${zone.x0 * 100}%`, width: `${(zone.x1 - zone.x0) * 100}%`,
              top:  `${zone.y0 * 100}%`, height: `${(zone.y1 - zone.y0) * 100}%`,
              border: `1px solid ${linked ? c + '70' : c + '28'}`,
              background: linked ? c + '15' : (selectedId ? c + '08' : 'transparent'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: selectedId ? 'pointer' : 'default',
              pointerEvents: selectedId ? 'auto' : 'none',
              transition: 'background 0.12s',
              zIndex: 3,
            }}
            onPointerDown={e => {
              e.stopPropagation();
              onZoneTap(zone.role!);
            }}
          >
            <span style={{
              fontSize: 13, fontWeight: 900,
              color: linked ? c : c + '50',
              pointerEvents: 'none',
            }}>
              {ZONE_LABELS[zone.role]}
            </span>
          </div>
        );
      })}

      {/* SVG arrows from player dots to their linked zones */}
      <svg
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible', zIndex: 4,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker id="arrow-zone" markerWidth="5" markerHeight="5"
            refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="currentColor" opacity="0.75" />
          </marker>
        </defs>
        {dots.flatMap(dot =>
          dot.roles
            .filter(r => r.startsWith('attacker_'))
            .flatMap(role => {
              const zone = zones.find(z => z.role === role);
              if (!zone) return [];
              const zx = (zone.x0 + zone.x1) / 2 * 100;
              // Pointe vers le filet : haut de la zone pour HOME (y0), bas pour AWAY (y1)
              const zy = team === 'home' ? zone.y0 * 100 : zone.y1 * 100;
              const c = ROLE_COLOR[role as PlayerRole] ?? '#fff';
              return [(
                <line key={`${dot.playerId}-${role}`}
                  x1={dot.x * 100} y1={dot.y * 100}
                  x2={zx} y2={zy}
                  stroke={c} strokeWidth={1.5} strokeOpacity={0.75}
                  strokeDasharray="3 2"
                  markerEnd="url(#arrow-zone)"
                  style={{ color: c } as React.CSSProperties}
                />
              )];
            })
        )}
      </svg>
    </>
  );
}

// ── Editable dots (drag only — no tap-to-place) ──────────────────────────────
const DRAG_THRESHOLD = 6; // px

function EditableDots({ dots, team, halfRef, selectedId, onTap, onDrag }: {
  dots: EditDot[];
  team: TeamSide;
  halfRef: React.RefObject<HTMLDivElement>;
  selectedId: string | null;
  onTap:  (playerId: string, team: TeamSide) => void;
  onDrag: (playerId: string, team: TeamSide, x: number, y: number) => void;
}) {
  const dragState = useRef<{
    playerId: string;
    startX: number; startY: number;
    dragging: boolean;
  } | null>(null);

  return (
    <>
      {dots.map(dot => {
        const isSelected = dot.playerId === selectedId;
        const mainRole   = dot.roles[0] as PlayerRole | undefined;
        const color      = mainRole ? (ROLE_COLOR[mainRole] ?? '#a0998e') : '#a0998e';

        const { letter, isSetter } = volleyLabel(dot.roles);
        const pointerHandlers = {
          onPointerDown: (e: React.PointerEvent) => {
            e.stopPropagation();
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragState.current = { playerId: dot.playerId, startX: e.clientX, startY: e.clientY, dragging: false };
          },
          onPointerMove: (e: React.PointerEvent) => {
            const ds = dragState.current;
            if (!ds || ds.playerId !== dot.playerId || !halfRef.current) return;
            if (!ds.dragging) {
              if (Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY) < DRAG_THRESHOLD) return;
              ds.dragging = true;
            }
            const r = halfRef.current.getBoundingClientRect();
            onDrag(dot.playerId, team,
              Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width)),
              Math.max(0.06, Math.min(0.97, (e.clientY - r.top)  / r.height)),
            );
          },
          onPointerUp: (e: React.PointerEvent) => {
            const ds = dragState.current;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            if (ds && ds.playerId === dot.playerId && !ds.dragging) onTap(dot.playerId, team);
            dragState.current = null;
          },
          onPointerCancel: () => { dragState.current = null; },
        };

        if (isSetter) {
          return (
            <div key={dot.playerId}
              style={{
                position: 'absolute',
                left: `${dot.x * 100}%`, top: `${dot.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 34, height: 32,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                background: isSelected ? color + '90' : color + 'cc',
                boxShadow: isSelected ? `0 0 12px ${color}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                paddingTop: '10px',
                cursor: 'grab', touchAction: 'none', zIndex: 15, userSelect: 'none',
              }}
              {...pointerHandlers}
            >
              <span style={{ fontSize: 10, fontWeight: 900, color: '#111', pointerEvents: 'none' }}>
                {dot.number}
              </span>
            </div>
          );
        }

        return (
          <div key={dot.playerId}
            style={{
              position: 'absolute',
              left: `${dot.x * 100}%`, top: `${dot.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 32, height: 32,
              borderRadius: '50%',
              background: isSelected ? color + '50' : color + '22',
              border: `2px solid ${isSelected ? color : color + '90'}`,
              boxShadow: isSelected ? `0 0 9px ${color}90` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'grab', touchAction: 'none', zIndex: 15, userSelect: 'none',
            }}
            {...pointerHandlers}
          >
            <span style={{ fontSize: 9, fontWeight: 900, color, pointerEvents: 'none', lineHeight: 1 }}>
              {dot.number}{letter}
            </span>
          </div>
        );
      })}
    </>
  );
}

function PlayerCircle({ number, team }: { number: number; team: TeamSide }) {
  const c = team === 'home' ? '#FFD700' : '#ff8a65';
  return (
    <div
      className={styles.playerCircle}
      style={{ background: c + '18', border: '1.5px solid ' + c, color: c }}
    >
      {number}
    </div>
  );
}

function ServerBadge({ number, team, onFault }: {
  number: number; team: TeamSide; onFault: () => void;
}) {
  const c = team === 'home' ? '#FFD700' : '#ff8a65';
  return (
    <div className={styles.serverBadge}>
      <div className={styles.serverBadgeMain}>
        {team === 'away' && <div className={styles.serverArrow} style={{ color: c }}>▼</div>}
        <div className={styles.serverCircle} style={{ background: c }}>{number}</div>
        {team === 'home' && <div className={styles.serverArrow} style={{ color: c }}>▲</div>}
      </div>
      <button onClick={onFault} className={styles.faultButton}>Serv. faute</button>
    </div>
  );
}

export function CourtWithServer({
  servingTeam, onCourtClick, onServiceFault,
  dots, highlightTeam, instruction, selectedActionId, onDotTap,
  sideOutDots,
  editDots, editSelectedId, onEditDotDrag, onEditDotTap,
  showAttackZones, onZoneLink,
  onOutZoneClick,
  onNetClick, netHighlight,
}: Props) {
  const rotationHome = useMatchStore((s) => s.rotationHome);
  const rotationAway = useMatchStore((s) => s.rotationAway);

  const homeHalfRef = useRef<HTMLDivElement>(null);
  const awayHalfRef = useRef<HTMLDivElement>(null);

  const isEditMode = !!editDots;

  // Stats mode click (disabled in edit mode)
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>, team: TeamSide) => {
    if (isEditMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    onCourtClick((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, team);
  }, [onCourtClick, isEditMode]);

  const handleZoneTap = useCallback((role: PlayerRole, team: TeamSide) => {
    if (!editSelectedId || !onZoneLink) return;
    onZoneLink(editSelectedId, team, role);
  }, [editSelectedId, onZoneLink]);

  const renderPlayers = (team: TeamSide) => {
    if (isEditMode) return null;
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const layout = team === 'home' ? HOME_LAYOUT : AWAY_LAYOUT;
    if (!rot) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, opacity: 0.13, pointerEvents: 'none' }}>
        {(Object.entries(layout) as [string,[number,number]][]).map(([ps,[px,py]]) => {
          const n = parseInt(ps, 10);
          if (n < 1 || n > 6) return null;
          const player = rot[n as Position];
          if (!player) return null;
          return (
            <div key={n} style={{ position:'absolute', left:px+'%', top:py+'%' }}>
              <PlayerCircle number={player.number} team={team}/>
            </div>
          );
        })}
      </div>
    );
  };

  const halfDynamicStyle = (team: TeamSide): React.CSSProperties => {
    if (isEditMode) return { background: '#1c3a2a' };
    return {
      background: highlightTeam === team
        ? (team === 'home' ? 'rgba(255,215,0,0.07)' : 'rgba(255,138,101,0.07)')
        : '#1c3a2a',
      outline: highlightTeam === team
        ? '1px solid ' + (team === 'home' ? 'rgba(255,215,0,0.3)' : 'rgba(255,138,101,0.3)')
        : 'none',
    };
  };

  const srvHome = rotationHome?.[1]?.number ?? 0;
  const srvAway = rotationAway?.[1]?.number ?? 0;

  return (
    <div className={styles.courtWrapper}>

      <div className={styles.courtArea}>
        <div className={styles.courtRow}>
          <div className={styles.courtColumn}>
            <div className={styles.serverSlot}>
              {!isEditMode && servingTeam === 'away' && (
                <div className={styles.serverBadgeTop}>
                  <ServerBadge number={srvAway} team="away" onFault={onServiceFault}/>
                </div>
              )}
            </div>

            <div className={styles.courtBox}>
              {!isEditMode && (
                <FullCourtTrajectory dots={dots} selectedActionId={selectedActionId} onDotTap={onDotTap}/>
              )}

              {/* Out zone — au-dessus (balle longue au fond adverse) */}
              {!isEditMode && onOutZoneClick && (
                <div
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    onOutZoneClick((e.clientX - r.left) / r.width, -0.15);
                  }}
                  style={{
                    position: 'absolute', top: -20, left: 0, right: 0, height: 20,
                    cursor: 'crosshair', zIndex: 15,
                    background: 'rgba(255,100,80,0.05)',
                    borderBottom: '1px dashed rgba(255,100,80,0.40)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 7, color: 'rgba(255,100,80,0.50)', fontWeight: 700, pointerEvents: 'none', letterSpacing: 3 }}>
                    OUT
                  </span>
                </div>
              )}

              {/* Out zone — gauche (inclut les coins haut-gauche et bas-gauche) */}
              {!isEditMode && onOutZoneClick && (
                <div
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    onOutZoneClick(-0.15, (e.clientY - r.top) / r.height);
                  }}
                  style={{
                    position: 'absolute', left: -18, top: -20, bottom: -20, width: 18,
                    cursor: 'crosshair', zIndex: 14,
                    background: 'rgba(255,100,80,0.05)',
                    borderRight: '1px dashed rgba(255,100,80,0.40)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 7, color: 'rgba(255,100,80,0.50)', fontWeight: 700, writingMode: 'vertical-rl', pointerEvents: 'none' }}>
                    OUT
                  </span>
                </div>
              )}

              {/* Out zone — droite (inclut les coins haut-droite et bas-droite) */}
              {!isEditMode && onOutZoneClick && (
                <div
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    onOutZoneClick(1.15, (e.clientY - r.top) / r.height);
                  }}
                  style={{
                    position: 'absolute', right: -18, top: -20, bottom: -20, width: 18,
                    cursor: 'crosshair', zIndex: 14,
                    background: 'rgba(255,100,80,0.05)',
                    borderLeft: '1px dashed rgba(255,100,80,0.40)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 7, color: 'rgba(255,100,80,0.50)', fontWeight: 700, writingMode: 'vertical-rl', pointerEvents: 'none' }}>
                    OUT
                  </span>
                </div>
              )}

              <div className={styles.half} style={halfDynamicStyle('away')}
                ref={awayHalfRef}
                onClick={(e) => handleClick(e,'away')}>
                <div className={styles.attackLine} style={{ bottom:'33%' }}/>
                {renderPlayers('away')}
                {!isEditMode && sideOutDots && <SideOutGhosts dots={sideOutDots.away} />}
                {isEditMode && editDots && onEditDotTap && onEditDotDrag && (
                  <>
                    {showAttackZones && (
                      <AttackZoneGrid
                        team="away"
                        dots={editDots.away}
                        selectedId={editSelectedId ?? null}
                        onZoneTap={role => handleZoneTap(role, 'away')}
                      />
                    )}
                    <EditableDots dots={editDots.away} team="away"
                      halfRef={awayHalfRef}
                      selectedId={editSelectedId ?? null}
                      onTap={onEditDotTap} onDrag={onEditDotDrag} />
                  </>
                )}
              </div>

              {/* Zone cliquable élargie du filet (contre) */}
              {!isEditMode && onNetClick && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    onNetClick((e.clientX - r.left) / r.width);
                  }}
                  style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    top: 'calc(50% - 22px)',
                    height: 44,
                    cursor: netHighlight ? 'crosshair' : 'default',
                    zIndex: 20,
                    // Pointer events seulement quand le filet est actif (après une attaque)
                    pointerEvents: netHighlight ? 'auto' : 'none',
                    background: netHighlight
                      ? 'rgba(255,215,0,0.10)'
                      : 'rgba(0,0,0,0)',
                    borderTop:    netHighlight ? '1px dashed rgba(255,215,0,0.45)' : 'none',
                    borderBottom: netHighlight ? '1px dashed rgba(255,215,0,0.45)' : 'none',
                    transition: 'background 0.15s',
                  }}
                />
              )}

              <div className={styles.net}>
                <div className={styles.netPoleLeft} />
                <span className={styles.netLabel}>FILET</span>
                <div className={styles.netPoleRight} />
              </div>

              <div className={styles.half} style={halfDynamicStyle('home')}
                ref={homeHalfRef}
                onClick={(e) => handleClick(e,'home')}>
                <div className={styles.attackLine} style={{ top:'33%' }}/>
                {renderPlayers('home')}
                {!isEditMode && sideOutDots && <SideOutGhosts dots={sideOutDots.home} />}
                {isEditMode && editDots && onEditDotTap && onEditDotDrag && (
                  <>
                    {showAttackZones && (
                      <AttackZoneGrid
                        team="home"
                        dots={editDots.home}
                        selectedId={editSelectedId ?? null}
                        onZoneTap={role => handleZoneTap(role, 'home')}
                      />
                    )}
                    <EditableDots dots={editDots.home} team="home"
                      halfRef={homeHalfRef}
                      selectedId={editSelectedId ?? null}
                      onTap={onEditDotTap} onDrag={onEditDotDrag} />
                  </>
                )}
              </div>
              {/* Out zone — en-dessous (balle longue au fond home) */}
              {!isEditMode && onOutZoneClick && (
                <div
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    onOutZoneClick((e.clientX - r.left) / r.width, 1.15);
                  }}
                  style={{
                    position: 'absolute', bottom: -20, left: 0, right: 0, height: 20,
                    cursor: 'crosshair', zIndex: 15,
                    background: 'rgba(255,100,80,0.05)',
                    borderTop: '1px dashed rgba(255,100,80,0.40)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 7, color: 'rgba(255,100,80,0.50)', fontWeight: 700, pointerEvents: 'none', letterSpacing: 3 }}>
                    OUT
                  </span>
                </div>
              )}
            </div>

            <div className={styles.serverSlot}>
              {!isEditMode && servingTeam === 'home' && (
                <div className={styles.serverBadgeBottom}>
                  <ServerBadge number={srvHome} team="home" onFault={onServiceFault}/>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
