// src/components/stats/StatsTable.tsx
// Tableau comparatif mobile-friendly :
//   • Tableau principal : lignes = critères, colonnes = Home | Away (totaux)
//   • Deux tableaux dépliables en dessous : détail par joueur Home, puis Away

import React, { useMemo, useState } from 'react';
import { useMatchStore } from '../../store/matchStore';
import type { Rally, TeamSide } from '../../types';

// ── Définition des filtres ────────────────────────────────────────────────────

interface FilterDef {
  id: string;
  label: string;
  actionKinds: string[];
  cols: string[];
}

const FILTERS: FilterDef[] = [
  { id: 'service',   label: 'Service',   actionKinds: ['service','service_fault'], cols: ['S-','S=','S+','S++'] },
  { id: 'reception', label: 'Réception', actionKinds: ['reception'],               cols: ['Zip','R-','R=','R+']  },
  { id: 'set',       label: 'Passe',     actionKinds: ['set'],                     cols: ['P-','P+','P++']       },
  { id: 'attack',    label: 'Attaque',   actionKinds: ['attack'],                  cols: ['A-','A=','A+','A++']  },
  { id: 'defense',   label: 'Défense',   actionKinds: ['defense'],                 cols: ['D-','D=','D+']        },
  { id: 'block',     label: 'Bloc',      actionKinds: ['block'],                   cols: ['B-','B=','B+','B++']  },
];

// Couleur par critère qualité
const COL_COLOR: Record<string, string> = {
  'S-':'#f44336','R-':'#f44336','A-':'#f44336','Zip':'#f44336','P-':'#f44336','B-':'#f44336','D-':'#f44336',
  'S=':'#ff9800','R=':'#ff9800','A=':'#ff9800','B=':'#ff9800','D=':'#ff9800',
  'S+':'#4caf50','R+':'#4caf50','A+':'#4caf50','P+':'#4caf50','B+':'#4caf50','D+':'#4caf50',
  'S++':'#FFD700','A++':'#FFD700','P++':'#FFD700','B++':'#FFD700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type PlayerReg = Map<string, { number: number; name: string }>;

function buildPlayerReg(rallies: Rally[]): PlayerReg {
  const reg: PlayerReg = new Map();
  for (const r of rallies) {
    for (const p of [...Object.values(r.rotationHome), ...Object.values(r.rotationAway)]) {
      if (p.number > 0 && !reg.has(p.id))
        reg.set(p.id, { number: p.number, name: p.name });
    }
  }
  return reg;
}

interface StatRow {
  id: string;
  number: number;
  name: string;
  counts: Record<string, number>;
}

interface TeamStats {
  total: Record<string, number>;   // critère → count
  players: StatRow[];              // uniquement les joueurs avec playerId connu
}

function buildTeamStats(
  rallies: Rally[],
  team: TeamSide,
  actionKinds: string[],
  cols: string[],
  reg: PlayerReg,
): TeamStats {
  const actions = rallies
    .flatMap(r => r.actions)
    .filter(a => a.team === team && actionKinds.includes(a.kind));

  const total: Record<string, number> = Object.fromEntries(cols.map(c => [c, 0]));
  const byPlayer: Record<string, Record<string, number>> = {};

  for (const a of actions) {
    let q = a.quality ?? '';
    // Rétrocompatibilité : défense anciennement notée A+/A=/A- → D+/D=/D-
    if (a.kind === 'defense' && /^A[+=-]$/.test(q)) q = 'D' + q.slice(1);
    if (!cols.includes(q)) continue;
    total[q]++;                          // total : toutes actions
    if (a.playerId) {                    // détail : uniquement joueurs identifiés
      if (!byPlayer[a.playerId])
        byPlayer[a.playerId] = Object.fromEntries(cols.map(c => [c, 0]));
      byPlayer[a.playerId][q]++;
    }
  }

  const players: StatRow[] = Object.entries(byPlayer)
    .map(([id, counts]) => {
      const info = reg.get(id);
      return { id, number: info?.number ?? 0, name: info?.name ?? '', counts };
    })
    .sort((a, b) => a.number - b.number);

  return { total, players };
}

const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((s, n) => s + n, 0);

// ── Tableau détail joueurs (dépliable) ───────────────────────────────────────

function PlayerDetailTable({
  teamName, teamColor, stats, cols,
}: {
  teamName: string;
  teamColor: string;
  stats: TeamStats;
  cols: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      {/* Bouton déployer */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '7px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: open ? teamColor + '18' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? teamColor + '50' : 'rgba(255,255,255,0.10)'}`,
          borderRadius: open ? '6px 6px 0 0' : 6,
          cursor: 'pointer', outline: 'none',
        }}
      >
        <span style={{ color: open ? teamColor : '#a0998e', fontWeight: 800, fontSize: 11 }}>
          {open ? '▾' : '▸'} Détails — {teamName.substring(0, 16)}
        </span>
        <span style={{ color: '#5a554e', fontSize: 10 }}>
          {stats.players.length} joueur{stats.players.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div style={{
          border: `1px solid ${teamColor}30`,
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: teamColor + '10' }}>
                <th style={{ textAlign: 'left', padding: '5px 8px', color: '#5a554e', fontWeight: 700, fontSize: 9 }}>
                  Joueur
                </th>
                {cols.map(c => (
                  <th key={c} style={{
                    textAlign: 'center', padding: '5px 4px',
                    color: COL_COLOR[c] ?? '#a0998e', fontWeight: 800, fontSize: 9,
                  }}>{c}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '5px 4px', color: '#a0998e', fontWeight: 800, fontSize: 9 }}>
                  Tot
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Ligne TOTAL */}
              <tr style={{ borderBottom: `2px solid ${teamColor}30`, background: teamColor + '08' }}>
                <td style={{ padding: '5px 8px', color: teamColor, fontWeight: 800, fontSize: 10 }}>TOTAL</td>
                {cols.map(c => (
                  <td key={c} style={{ textAlign: 'center', padding: '5px 4px', color: stats.total[c] > 0 ? '#f0ede6' : '#2e2b27', fontWeight: 700 }}>
                    {stats.total[c] > 0 ? stats.total[c] : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '5px 4px', color: teamColor, fontWeight: 800 }}>
                  {sum(stats.total) || '—'}
                </td>
              </tr>

              {/* Lignes par joueur */}
              {stats.players.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + 2}
                    style={{ textAlign: 'center', padding: '10px', color: '#5a554e', fontSize: 10 }}>
                    Aucun joueur identifié
                  </td>
                </tr>
              ) : stats.players.map(p => {
                const pTot = sum(p.counts);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ color: teamColor, fontWeight: 800, fontSize: 10 }}>#{p.number}</span>
                      {p.name && (
                        <span style={{ color: '#5a554e', fontSize: 9, marginLeft: 4 }}>
                          {p.name.substring(0, 8)}
                        </span>
                      )}
                    </td>
                    {cols.map(c => (
                      <td key={c} style={{ textAlign: 'center', padding: '4px 4px', color: p.counts[c] > 0 ? '#f0ede6' : '#2e2b27', fontWeight: 600 }}>
                        {p.counts[c] > 0 ? p.counts[c] : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '4px 4px', color: '#a0998e', fontWeight: 700 }}>
                      {pTot > 0 ? pTot : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function StatsTable() {
  const rallies      = useMatchStore(s => s.rallies);
  const teamHomeName = useMatchStore(s => s.teamHomeName);
  const teamAwayName = useMatchStore(s => s.teamAwayName);
  const [filterId, setFilterId] = useState('service');

  const filterDef   = FILTERS.find(f => f.id === filterId) ?? FILTERS[0];
  const { cols, actionKinds } = filterDef;

  const playerReg  = useMemo(() => buildPlayerReg(rallies), [rallies]);
  const homeStats  = useMemo(
    () => buildTeamStats(rallies, 'home', actionKinds, cols, playerReg),
    [rallies, filterId, playerReg], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const awayStats  = useMemo(
    () => buildTeamStats(rallies, 'away', actionKinds, cols, playerReg),
    [rallies, filterId, playerReg], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hTot = sum(homeStats.total);
  const aTot = sum(awayStats.total);

  return (
    <div>
      {/* ── Filtres ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const active = f.id === filterId;
          return (
            <button key={f.id} onClick={() => setFilterId(f.id)}
              style={{
                padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', border: 'none', outline: 'none',
                background: active ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.06)',
                color: active ? '#FFD700' : '#a0998e',
                boxShadow: active ? '0 0 0 1px rgba(255,215,0,0.4)' : 'none',
              }}
            >{f.label}</button>
          );
        })}
      </div>

      {/* ── Tableau comparatif principal ───────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            <th style={{ textAlign: 'left', padding: '5px 6px', color: '#5a554e', fontWeight: 700, fontSize: 10, width: '40%' }}>
              Critère
            </th>
            <th style={{ textAlign: 'center', padding: '5px 6px', color: '#FFD700', fontWeight: 800, fontSize: 10, width: '30%' }}>
              {teamHomeName.substring(0, 10)}
            </th>
            <th style={{ textAlign: 'center', padding: '5px 6px', color: '#ff8a65', fontWeight: 800, fontSize: 10, width: '30%' }}>
              {teamAwayName.substring(0, 10)}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Ligne par critère qualité */}
          {cols.map(c => {
            const hVal = homeStats.total[c] ?? 0;
            const aVal = awayStats.total[c] ?? 0;
            const color = COL_COLOR[c] ?? '#a0998e';
            const hBetter = hVal > aVal;
            const aBetter = aVal > hVal;
            return (
              <tr key={c} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '6px 6px' }}>
                  <span style={{
                    color, fontWeight: 800, fontSize: 10,
                    background: color + '15', borderRadius: 4,
                    padding: '2px 6px',
                  }}>{c}</span>
                </td>
                <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                  <span style={{
                    color: hVal > 0 ? '#f0ede6' : '#2e2b27',
                    fontWeight: hBetter ? 800 : 600,
                    fontSize: hBetter ? 13 : 11,
                  }}>{hVal > 0 ? hVal : '—'}</span>
                </td>
                <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                  <span style={{
                    color: aVal > 0 ? '#f0ede6' : '#2e2b27',
                    fontWeight: aBetter ? 800 : 600,
                    fontSize: aBetter ? 13 : 11,
                  }}>{aVal > 0 ? aVal : '—'}</span>
                </td>
              </tr>
            );
          })}

          {/* Ligne TOTAL */}
          <tr style={{ borderTop: '2px solid rgba(255,255,255,0.12)' }}>
            <td style={{ padding: '6px 6px', color: '#a0998e', fontWeight: 800, fontSize: 10 }}>
              TOTAL
            </td>
            <td style={{ textAlign: 'center', padding: '6px 6px' }}>
              <span style={{ color: '#FFD700', fontWeight: 800, fontSize: 13 }}>
                {hTot > 0 ? hTot : '—'}
              </span>
            </td>
            <td style={{ textAlign: 'center', padding: '6px 6px' }}>
              <span style={{ color: '#ff8a65', fontWeight: 800, fontSize: 13 }}>
                {aTot > 0 ? aTot : '—'}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Tableaux détail par joueur (dépliables) ────────────── */}
      <PlayerDetailTable
        teamName={teamHomeName}
        teamColor="#FFD700"
        stats={homeStats}
        cols={cols}
      />
      <PlayerDetailTable
        teamName={teamAwayName}
        teamColor="#ff8a65"
        stats={awayStats}
        cols={cols}
      />
    </div>
  );
}
