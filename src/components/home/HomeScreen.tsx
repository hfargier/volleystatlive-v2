// src/components/home/HomeScreen.tsx
// Écran d'accueil : choisir un nouveau match ou charger un match sauvegardé.
import React, { useState, useEffect, useCallback } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { listMatches, getMatch, deleteMatch } from '../../api/volleyApi';
import type { MatchMeta } from '../../api/volleyApi';

interface HomeScreenProps {
  onNewMatch:      () => void;  // démarrer la config d'un nouveau match
  onContinue:      () => void;  // reprendre le match en cours
  onLoaded:        () => void;  // match chargé depuis le cloud → aller en jeu
  onManageModels:  () => void;  // ouvrir l'éditeur de modèles
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export function HomeScreen({ onNewMatch, onContinue, onLoaded, onManageModels }: HomeScreenProps) {
  const store          = useMatchStore();
  const isInProgress   = useMatchStore(s => s.isSetupComplete);
  const teamHomeName   = useMatchStore(s => s.teamHomeName);
  const teamAwayName   = useMatchStore(s => s.teamAwayName);
  const scoreHome      = useMatchStore(s => s.scoreHome);
  const scoreAway      = useMatchStore(s => s.scoreAway);
  const currentSet     = useMatchStore(s => s.currentSet);
  const matchDate      = useMatchStore(s => s.matchDate);

  const [matches,   setMatches]   = useState<MatchMeta[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error,     setError]     = useState('');

  useEffect(() => {
    listMatches()
      .then(setMatches)
      .catch(() => setError('Impossible de charger les matchs sauvegardés.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLoad = useCallback(async (matchId: string) => {
    setLoadingId(matchId);
    setError('');
    try {
      const res = await getMatch(matchId);
      store.loadMatchState(res.state);
      onLoaded();
    } catch (e: any) {
      setError('Erreur lors du chargement : ' + e.message);
      setLoadingId(null);
    }
  }, [store, onLoaded]);

  const handleDelete = useCallback(async (matchId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer définitivement ce match ?')) return;
    try {
      await deleteMatch(matchId);
      setMatches(prev => prev.filter(m => m.match_id !== matchId));
    } catch (e: any) {
      setError('Erreur suppression : ' + e.message);
    }
  }, []);

  return (
    <div style={{
      height: '100dvh', background: '#131a13',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── En-tête app ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 18px 14px',
        background: 'linear-gradient(180deg, #0b130b 0%, #131a13 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FFD700', letterSpacing: '-0.01em' }}>
            🏐 VolleyStat Live
          </div>
          <div style={{ fontSize: 11, color: '#5a554e', marginTop: 3 }}>
            Statistiques de match en temps réel
          </div>
        </div>
        <button
          onPointerDown={onManageModels}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 10px',
            color: '#a0998e', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 13 }}>⚙</span>
          Modèles
        </button>
      </div>

      {/* ── Contenu scrollable ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>

        {/* Match en cours */}
        {isInProgress && (
          <div style={{
            background: 'rgba(255,215,0,0.07)',
            border: '1px solid rgba(255,215,0,0.28)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 18,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#FFD700', letterSpacing: '0.1em', marginBottom: 6 }}>
              MATCH EN COURS — SET {currentSet}
              {matchDate && (
                <span style={{ fontWeight: 400, color: '#a0998e', marginLeft: 8 }}>
                  {new Date(matchDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: '#f0ede6',
              marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {teamHomeName}
              <span style={{ color: '#FFD700', margin: '0 8px', fontSize: 18 }}>
                {scoreHome}–{scoreAway}
              </span>
              {teamAwayName}
            </div>
            <button
              onPointerDown={onContinue}
              style={{
                width: '100%', padding: '9px', fontSize: 12, fontWeight: 700,
                borderRadius: 7, border: '1px solid rgba(255,215,0,0.5)',
                background: 'rgba(255,215,0,0.14)', color: '#FFD700', cursor: 'pointer',
              }}
            >
              Continuer ce match →
            </button>
          </div>
        )}

        {/* ── Nouveau match ─────────────────────────────────────────────── */}
        <button
          onPointerDown={onNewMatch}
          style={{
            width: '100%', padding: '15px 18px', fontSize: 15, fontWeight: 800,
            borderRadius: 12, border: 'none', background: '#FFD700',
            color: '#111', cursor: 'pointer', marginBottom: 24, minHeight: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>➕</span>
          Nouveau Match
        </button>

        {/* ── Matchs sauvegardés ────────────────────────────────────────── */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#5a554e',
          letterSpacing: '0.1em', marginBottom: 10,
        }}>
          MATCHS SAUVEGARDÉS {!loading && `(${matches.length})`}
        </div>

        {error && (
          <div style={{
            fontSize: 10, color: '#ff7043', background: 'rgba(255,112,67,0.1)',
            border: '1px solid rgba(255,112,67,0.3)', borderRadius: 6,
            padding: '6px 10px', marginBottom: 10,
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ color: '#5a554e', fontSize: 11, textAlign: 'center', padding: '28px 0' }}>
            Chargement des matchs…
          </div>
        )}

        {!loading && matches.length === 0 && !error && (
          <div style={{
            color: '#5a554e', fontSize: 11, textAlign: 'center', padding: '28px 16px',
            border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 10,
          }}>
            Aucun match sauvegardé pour l'instant.<br />
            <span style={{ fontSize: 9 }}>Les matchs sont sauvegardés automatiquement.</span>
          </div>
        )}

        {matches.map(m => {
          const isLoading = loadingId === m.match_id;
          const dimmed    = !!loadingId && !isLoading;
          return (
            <div
              key={m.match_id}
              onPointerDown={() => !loadingId && handleLoad(m.match_id)}
              style={{
                background: isLoading
                  ? 'rgba(255,215,0,0.06)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isLoading ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10, padding: '11px 13px', marginBottom: 8,
                cursor: loadingId ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: dimmed ? 0.4 : 1,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              {/* Infos match */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Équipes + score */}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#f0ede6',
                  marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6,
                  overflow: 'hidden',
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {m.team_home_name}
                  </span>
                  <span style={{ color: '#FFD700', fontWeight: 900, flexShrink: 0 }}>
                    {m.score_home}–{m.score_away}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'right' }}>
                    {m.team_away_name}
                  </span>
                </div>
                {/* Date + set */}
                <div style={{ fontSize: 10, color: '#5a554e' }}>
                  Set {m.current_set} &nbsp;·&nbsp; {fmt(m.updated_at)}
                </div>
              </div>

              {/* Icône chargement ou poubelle */}
              {isLoading ? (
                <span style={{ fontSize: 16, color: '#FFD700', flexShrink: 0 }}>⏳</span>
              ) : (
                <button
                  onPointerDown={e => handleDelete(m.match_id, e)}
                  style={{
                    background: 'none', border: 'none', color: '#3a3530',
                    fontSize: 18, cursor: 'pointer', padding: '4px', flexShrink: 0,
                    lineHeight: 1,
                  }}
                  title="Supprimer"
                >🗑</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
