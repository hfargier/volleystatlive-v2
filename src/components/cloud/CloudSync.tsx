// src/components/cloud/CloudSync.tsx
// Panneau latéral : sauvegarde/chargement de matchs + modèles
import React, { useState, useEffect, useCallback } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { saveMatch, listMatches, getMatch, deleteMatch, listModels } from '../../api/volleyApi';
import type { MatchMeta, ApiModel } from '../../api/volleyApi';
import { BUILTIN_MODELS } from '../../api/modelTemplates';

type Tab = 'match' | 'models';

interface Props {
  onClose: () => void;
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
};
const PANEL: React.CSSProperties = {
  width: '100%', maxWidth: 480, maxHeight: '85vh',
  background: '#12180f', borderRadius: '14px 14px 0 0',
  border: '1px solid rgba(255,255,255,0.1)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
};

export function CloudSync({ onClose }: Props) {
  const store          = useMatchStore();
  const [tab, setTab]  = useState<Tab>('match');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<MatchMeta[]>([]);
  const [models,  setModels]  = useState<ApiModel[]>([]);
  const [loading, setLoading] = useState(false);

  // Charger la liste des matchs et modèles au montage
  useEffect(() => {
    setLoading(true);
    Promise.all([listMatches(), listModels()])
      .then(([ms, mods]) => { setMatches(ms); setModels(mods); })
      .catch(e => setStatus('⚠️ ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Sauvegarder le match courant ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true); setStatus('');
    try {
      const state = useMatchStore.getState();
      await saveMatch(state);
      setStatus('✅ Match sauvegardé');
      const ms = await listMatches();
      setMatches(ms);
    } catch (e: any) {
      setStatus('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Charger un match ──────────────────────────────────────────────────────
  const handleLoad = useCallback(async (matchId: string) => {
    if (!confirm('Remplacer le match courant par cette sauvegarde ?')) return;
    setLoading(true); setStatus('');
    try {
      const res = await getMatch(matchId);
      store.loadMatchState(res.state);
      setStatus('✅ Match chargé');
      onClose();
    } catch (e: any) {
      setStatus('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [store, onClose]);

  // ── Supprimer un match ────────────────────────────────────────────────────
  const handleDeleteMatch = useCallback(async (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer ce match ?')) return;
    try {
      await deleteMatch(matchId);
      setMatches(prev => prev.filter(m => m.match_id !== matchId));
    } catch (e: any) {
      setStatus('❌ ' + e.message);
    }
  }, []);

  // ── Appliquer un modèle ───────────────────────────────────────────────────
  const handleApplyModel = useCallback((modelData: { config: any }, team: 'home' | 'away') => {
    if (!confirm(`Appliquer ce modèle à l'équipe ${team === 'home' ? 'Domicile' : 'Adverse'} ? (écrase les configs existantes)`)) return;
    store.applyModel(team, modelData.config);
    setStatus(`✅ Modèle appliqué à ${team === 'home' ? 'Domicile' : 'Adverse'}`);
  }, [store]);

  const fmt = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

  // Fusionne modèles builtin locaux + modèles API
  const allModels = [
    ...BUILTIN_MODELS.map(m => ({ id: m.id, name: m.name, description: m.description, config: m.config, builtin: 1 })),
    ...models.filter(m => !BUILTIN_MODELS.some(b => b.name === m.name)),
  ];

  return (
    <div style={OVERLAY} onPointerDown={onClose}>
      <div style={PANEL} onPointerDown={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', padding:'12px 14px 8px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize:14, fontWeight:800, color:'#FFD700', flex:1 }}>☁️ Synchronisation</span>
          <button onPointerDown={onClose} style={{ background:'none', border:'none', color:'#5a554e', fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, padding:'8px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          {(['match','models'] as Tab[]).map(t => (
            <button key={t}
              onPointerDown={() => setTab(t)}
              style={{
                padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:4, cursor:'pointer',
                background: tab===t ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: tab===t ? '1px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: tab===t ? '#FFD700' : '#a0998e',
              }}
            >{t === 'match' ? '🏐 Matchs' : '📋 Modèles'}</button>
          ))}
        </div>

        {/* Status */}
        {status && (
          <div style={{ padding:'6px 14px', fontSize:10, color: status.startsWith('✅') ? '#81c784' : '#ff7043', background:'rgba(255,255,255,0.04)' }}>
            {status}
          </div>
        )}

        {/* Contenu scrollable */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 14px' }}>

          {/* ── Tab Matchs ── */}
          {tab === 'match' && (
            <>
              {/* Bouton sauvegarder */}
              <button
                onPointerDown={handleSave}
                disabled={saving}
                style={{
                  width:'100%', padding:'10px', fontSize:12, fontWeight:800, borderRadius:6, cursor:'pointer',
                  background: saving ? 'rgba(255,255,255,0.05)' : 'rgba(255,215,0,0.15)',
                  border:'1px solid rgba(255,215,0,0.4)', color:'#FFD700', marginBottom:14,
                  opacity: saving ? 0.6 : 1,
                }}
              >{saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder le match courant'}</button>

              {/* Matchs sauvegardés */}
              <div style={{ fontSize:9, fontWeight:700, color:'#5a554e', letterSpacing:'0.08em', marginBottom:6 }}>
                MATCHS SAUVEGARDÉS ({matches.length})
              </div>

              {loading && <div style={{ color:'#5a554e', fontSize:10, textAlign:'center', padding:16 }}>Chargement…</div>}

              {!loading && matches.length === 0 && (
                <div style={{ color:'#5a554e', fontSize:10, textAlign:'center', padding:16 }}>Aucun match sauvegardé</div>
              )}

              {matches.map(m => (
                <div
                  key={m.match_id}
                  onPointerDown={() => handleLoad(m.match_id)}
                  style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:4,
                    background:'rgba(255,255,255,0.04)', borderRadius:6, cursor:'pointer', border:'1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f0ede6', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {m.team_home_name} <span style={{ color:'#FFD700' }}>{m.score_home}–{m.score_away}</span> {m.team_away_name}
                    </div>
                    <div style={{ fontSize:9, color:'#5a554e', marginTop:2 }}>
                      Set {m.current_set} · {fmt(m.updated_at)}
                    </div>
                  </div>
                  <button
                    onPointerDown={e => handleDeleteMatch(m.match_id, e)}
                    style={{ background:'none', border:'none', color:'#5a554e', fontSize:14, cursor:'pointer', padding:'0 4px', flexShrink:0 }}
                  >🗑</button>
                </div>
              ))}
            </>
          )}

          {/* ── Tab Modèles ── */}
          {tab === 'models' && (
            <>
              <div style={{ fontSize:9, color:'#5a554e', marginBottom:10, lineHeight:1.5 }}>
                Appliquer un modèle pré-remplit les positions de réception, bloc/def et bloc/def S pour toutes les rotations.
              </div>

              {allModels.map((m, idx) => (
                <div key={idx} style={{ padding:'10px', marginBottom:8, background:'rgba(255,255,255,0.04)', borderRadius:6, border:'1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#f0ede6', flex:1 }}>{m.name}</span>
                    {m.builtin === 1 && (
                      <span style={{ fontSize:8, color:'#FFD700', background:'rgba(255,215,0,0.12)', borderRadius:3, padding:'1px 5px', fontWeight:700 }}>INTÉGRÉ</span>
                    )}
                  </div>
                  {m.description && (
                    <div style={{ fontSize:9, color:'#a0998e', marginBottom:8, lineHeight:1.4 }}>{m.description}</div>
                  )}
                  <div style={{ display:'flex', gap:6 }}>
                    <button
                      onPointerDown={() => handleApplyModel(m as any, 'home')}
                      style={{
                        flex:1, padding:'5px 0', fontSize:9, fontWeight:700, borderRadius:4, cursor:'pointer',
                        background:'rgba(129,199,132,0.12)', border:'1px solid rgba(129,199,132,0.3)', color:'#81c784',
                      }}
                    >✓ Domicile</button>
                    <button
                      onPointerDown={() => handleApplyModel(m as any, 'away')}
                      style={{
                        flex:1, padding:'5px 0', fontSize:9, fontWeight:700, borderRadius:4, cursor:'pointer',
                        background:'rgba(255,138,101,0.12)', border:'1px solid rgba(255,138,101,0.3)', color:'#ff8a65',
                      }}
                    >✓ Adverse</button>
                  </div>
                </div>
              ))}

              {allModels.length === 0 && !loading && (
                <div style={{ color:'#5a554e', fontSize:10, textAlign:'center', padding:16 }}>Aucun modèle disponible</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
