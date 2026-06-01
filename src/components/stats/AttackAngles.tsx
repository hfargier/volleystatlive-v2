// src/components/stats/AttackAngles.tsx
// Trajectoires d'attaque par rotation de l'équipe sélectionnée.
// Chaque trait = ligne attack → defense (ou marqueur si A++ / A-).

import React, { useMemo, useState } from 'react';
import { useMatchStore, doRotate } from '../../store/matchStore';
import type { TeamSide, Position } from '../../types';

interface Props { team: TeamSide; }

// ── Conversion demi-terrain → coordonnées terrain complet (0-1) ──────────────
const HALF = 0.495;
function toGlobal(x: number, y: number, team: TeamSide) {
  return team === 'away'
    ? { gx: x, gy: y * HALF }
    : { gx: x, gy: 0.505 + y * HALF };
}

// ── Couleur par qualité d'attaque ────────────────────────────────────────────
const Q_COLOR: Record<string, string> = {
  'A++': '#FFD700',
  'A+' : '#4caf50',
  'A=' : '#ff9800',
  'A-' : '#f44336',
};
const Q_LABEL: Record<string, string> = {
  'A++': 'Point', 'A+': 'Défendu', 'A=': 'Bloqué', 'A-': 'Faute',
};

interface Traj {
  ax: number; ay: number;   // attack global (0-1)
  dx: number; dy: number;   // defense global (NaN si absent)
  quality: string | null;
}

// ── Calcul des trajectoires pour une rotation donnée ─────────────────────────
function computeTrajectories(
  rallies: ReturnType<typeof useMatchStore.getState>['rallies'],
  attackTeam: TeamSide,
  rotKeyId: string,
): Traj[] {
  const out: Traj[] = [];

  for (const rally of rallies) {
    const rot = attackTeam === 'away' ? rally.rotationAway : rally.rotationHome;
    if (!rot || (rot as any)[1]?.id !== rotKeyId) continue;

    for (let i = 0; i < rally.actions.length; i++) {
      const a = rally.actions[i];
      if (a.kind !== 'attack' || a.team !== attackTeam) continue;
      const ax = (a as any).x as number | undefined;
      const ay = (a as any).y as number | undefined;
      if (ax == null || ay == null) continue;

      const ag = toGlobal(ax, ay, a.team);

      // Cherche la prochaine action de défense ou bloc (de l'autre équipe)
      const next = rally.actions[i + 1];
      const hasImpact =
        next != null &&
        (next.kind === 'defense' || next.kind === 'block') &&
        (next as any).x != null;

      if (hasImpact && next) {
        const dg = toGlobal((next as any).x, (next as any).y, next.team);
        out.push({ ax: ag.gx, ay: ag.gy, dx: dg.gx, dy: dg.gy, quality: a.quality });
      } else {
        out.push({ ax: ag.gx, ay: ag.gy, dx: NaN, dy: NaN, quality: a.quality });
      }
    }
  }
  return out;
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function AttackAngles({ team }: Props) {
  const rallies       = useMatchStore(s => s.rallies);
  const rotationHome  = useMatchStore(s => s.rotationHome);
  const rotationAway  = useMatchStore(s => s.rotationAway);
  const teamHomeName  = useMatchStore(s => s.teamHomeName);
  const teamAwayName  = useMatchStore(s => s.teamAwayName);

  const [rotIdx, setRotIdx] = useState(0);

  // 6 rotations de l'équipe analysée (depuis la rotation courante)
  const rotations = useMemo(() => {
    const base = team === 'home' ? rotationHome : rotationAway;
    const r: typeof rotationHome[] = [base];
    for (let i = 1; i < 6; i++) r.push(doRotate(r[i - 1]));
    return r;
  }, [team, rotationHome, rotationAway]);

  const rotKeyId = rotations[rotIdx]?.[1 as Position]?.id ?? '';

  const trajs = useMemo(
    () => computeTrajectories(rallies, team, rotKeyId),
    [rallies, team, rotKeyId],
  );

  const teamColor = team === 'home' ? '#FFD700' : '#ff8a65';
  const teamName  = team === 'home' ? teamHomeName : teamAwayName;

  // Compte par qualité
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    trajs.forEach(t => { const q = t.quality ?? '?'; c[q] = (c[q] ?? 0) + 1; });
    return c;
  }, [trajs]);

  return (
    <div>
      {/* Titre */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:teamColor, letterSpacing:'0.05em' }}>
          Angles d'attaque — {teamName.substring(0, 14)}
        </span>
        <span style={{ fontSize:9, color:'#5a554e' }}>{trajs.length} attaque{trajs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Onglets de rotation */}
      <div style={{ display:'flex', gap:3, marginBottom:8 }}>
        {rotations.map((rot, i) => {
          const servNo = (rot as any)[1]?.number ?? '?';
          const active = rotIdx === i;
          return (
            <button key={i} onClick={() => setRotIdx(i)}
              style={{
                flex:1, padding:'3px 2px', borderRadius:5,
                fontSize:8, fontWeight:800, cursor:'pointer', border:'none',
                lineHeight:1.4, minHeight:32,
                background: active ? teamColor + '28' : 'rgba(255,255,255,0.05)',
                color:      active ? teamColor         : '#5a554e',
                boxShadow:  active ? '0 0 0 1px ' + teamColor + '60' : 'none',
              }}
            >
              R{i + 1}<br/>
              <span style={{ fontSize:8 }}>#{servNo}</span>
            </button>
          );
        })}
      </div>

      {/* Terrain + trajectoires */}
      <div style={{
        display:'flex', justifyContent:'center',
      }}>
        {/* Wrapper pour maintenir le ratio 1:2 du terrain */}
        <div style={{
          position:'relative',
          width:'52%',     // ~la moitié de la carte pour que le terrain soit lisible
          // ratio 1:2 via padding-bottom trick
          paddingBottom: 'calc(52% * 2)',
          flexShrink: 0,
        }}>
          <div style={{ position:'absolute', inset:0 }}>
            {/* Terrain */}
            <div style={{
              position:'relative', width:'100%', height:'100%',
              background:'#1c3a2a',
              border:'2px solid rgba(255,255,255,0.35)',
              boxSizing:'border-box',
            }}>
              {/* Ligne d'attaque haut */}
              <div style={{ position:'absolute', left:0, right:0, top:'33%', height:1, background:'rgba(255,255,255,0.15)' }}/>
              {/* Ligne d'attaque bas */}
              <div style={{ position:'absolute', left:0, right:0, bottom:'33%', height:1, background:'rgba(255,255,255,0.15)' }}/>
              {/* Labels équipes */}
              <div style={{ position:'absolute', top:3, left:0, right:0, textAlign:'center', fontSize:7, fontWeight:700, color:'#ff8a65', letterSpacing:'0.08em', pointerEvents:'none' }}>
                {teamAwayName.substring(0,8).toUpperCase()}
              </div>
              <div style={{ position:'absolute', bottom:3, left:0, right:0, textAlign:'center', fontSize:7, fontWeight:700, color:'#FFD700', letterSpacing:'0.08em', pointerEvents:'none' }}>
                {teamHomeName.substring(0,8).toUpperCase()}
              </div>
              {/* Filet */}
              <div style={{ position:'absolute', left:0, right:0, top:'calc(50% - 2px)', height:5, background:'#FFD700', opacity:0.7, zIndex:2 }}/>

              {/* SVG trajectoires */}
              <svg
                style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {trajs.map((t, i) => {
                  const color = Q_COLOR[t.quality ?? ''] ?? '#888';
                  const hasLine = !isNaN(t.dx) && !isNaN(t.dy);
                  return (
                    <g key={i}>
                      {/* Trait attaque → impact */}
                      {hasLine && (
                        <line
                          x1={t.ax * 100} y1={t.ay * 100}
                          x2={t.dx * 100} y2={t.dy * 100}
                          stroke={color} strokeWidth={1.3}
                          strokeOpacity={0.60} strokeLinecap="round"
                        />
                      )}
                      {/* Point d'attaque */}
                      <circle
                        cx={t.ax * 100} cy={t.ay * 100}
                        r={2.2} fill={color} opacity={0.90}
                      />
                      {/* Point d'impact défense */}
                      {hasLine && (
                        <circle
                          cx={t.dx * 100} cy={t.dy * 100}
                          r={1.8} fill="none"
                          stroke={color} strokeWidth={0.8} strokeOpacity={0.80}
                        />
                      )}
                      {/* A++ : étoile au point d'attaque */}
                      {t.quality === 'A++' && (
                        <text
                          x={t.ax * 100} y={t.ay * 100 - 2.5}
                          textAnchor="middle" fontSize="4"
                          fill="#FFD700" fontWeight="bold"
                        >★</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Légende à droite */}
        <div style={{ paddingLeft:10, display:'flex', flexDirection:'column', justifyContent:'center', gap:6 }}>
          {(['A++','A+','A=','A-'] as const).map(q => {
            const n = counts[q] ?? 0;
            const pct = trajs.length > 0 ? Math.round(n / trajs.length * 100) : 0;
            return (
              <div key={q} style={{ display:'flex', alignItems:'center', gap:5, opacity: n > 0 ? 1 : 0.35 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background: Q_COLOR[q], flexShrink:0 }}/>
                <div>
                  <span style={{ fontSize:9, fontWeight:800, color: Q_COLOR[q] }}>{q}</span>
                  <span style={{ fontSize:8, color:'#a0998e', marginLeft:3 }}>{Q_LABEL[q]}</span>
                  <br/>
                  <span style={{ fontSize:9, color:'#f0ede6', fontWeight:700 }}>{n}</span>
                  {n > 0 && <span style={{ fontSize:8, color:'#5a554e', marginLeft:3 }}>{pct}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {trajs.length === 0 && (
        <p style={{ textAlign:'center', fontSize:10, color:'#5a554e', marginTop:8 }}>
          Aucune attaque enregistrée pour cette rotation
        </p>
      )}
    </div>
  );
}
