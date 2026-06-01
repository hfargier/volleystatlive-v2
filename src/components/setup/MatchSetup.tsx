// src/components/setup/MatchSetup.tsx
import React, { useState, useEffect } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { RotationSetup } from './RotationSetup';
import { ModelEditor } from './ModelEditor';
import { listModels, saveMatch } from '../../api/volleyApi';
import type { ApiModel } from '../../api/volleyApi';
import { BUILTIN_MODELS } from '../../api/modelTemplates';
import type { ModelRoles } from '../../api/modelTemplates';

interface MatchSetupProps { onComplete: () => void; }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 12px', color: '#f0ede6', fontSize: 14,
  outline: 'none', marginBottom: 4, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#a0998e', fontWeight: 700,
  letterSpacing: '0.06em', marginBottom: 6, marginTop: 14,
};
const btnStyle: React.CSSProperties = {
  width: '100%', marginTop: 20, background: '#FFD700', color: '#111',
  fontWeight: 700, padding: '12px 18px', borderRadius: 10, border: 'none',
  fontSize: 13, cursor: 'pointer', minHeight: 44,
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, marginBottom: 0, cursor: 'pointer',
};

export function MatchSetup({ onComplete }: MatchSetupProps) {
  const { initMatch, setSetupComplete, applyModel } = useMatchStore(s => ({
    initMatch: s.initMatch,
    setSetupComplete: s.setSetupComplete,
    applyModel: s.applyModel,
  }));
  const teamHomeName = useMatchStore(s => s.teamHomeName);
  const teamAwayName = useMatchStore(s => s.teamAwayName);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const [homeName,   setHomeName]   = useState(teamHomeName);
  const [awayName,   setAwayName]   = useState(teamAwayName);
  const [matchDate,  setMatchDate]  = useState(todayISO);
  const [step, setStep]             = useState<'names' | 'rotations' | 'models'>('names');
  // Défaut : 5-1 Classique (id builtin, remplacé par l'id API une fois chargé)
  const [homeModel, setHomeModel] = useState<string>('__5_1_classique__');
  const [awayModel, setAwayModel] = useState<string>('__5_1_classique__');
  const [apiModels, setApiModels] = useState<ApiModel[]>([]);

  // Charger les modèles depuis l'API (tous, config incluse)
  useEffect(() => {
    listModels()
      .then(ms => setApiModels(ms))
      .catch(() => {});
  }, []);

  // Fusionne builtin + API :
  // • Les modèles API (même nom builtin) priment sur le local — ils contiennent les perso de l'utilisateur.
  // • Les builtins locaux non encore sauvegardés en BDD servent de fallback.
  const apiByName = Object.fromEntries(apiModels.map(m => [m.name, m]));
  const allModels = [
    { id: '__none__', name: 'Aucun modèle', config: null },
    // Builtins : version API si dispo (perso), sinon local
    ...BUILTIN_MODELS.map(b => {
      const api = apiByName[b.name];
      return { id: api ? String(api.id) : b.id, name: b.name, config: api?.config ?? b.config };
    }),
    // Modèles perso (noms différents des builtins)
    ...apiModels
      .filter(m => !BUILTIN_MODELS.some(b => b.name === m.name))
      .map(m => ({ id: String(m.id), name: m.name, config: m.config ?? null })),
  ];

  // Quand l'API renvoie un id numérique pour un modèle builtin, met à jour la sélection
  // si l'utilisateur n'a pas encore changé manuellement (id builtin non trouvé dans allModels).
  useEffect(() => {
    const validIds = new Set(allModels.map(m => m.id));
    if (!validIds.has(homeModel)) {
      const m = allModels.find(x => x.name === '5-1 Classique') ?? allModels[0];
      setHomeModel(m.id);
    }
    if (!validIds.has(awayModel)) {
      const m = allModels.find(x => x.name === '5-1 Classique') ?? allModels[0];
      setAwayModel(m.id);
    }
  }, [allModels]); // eslint-disable-line react-hooks/exhaustive-deps

  const findConfig = (id: string) => allModels.find(m => m.id === id)?.config ?? null;

  const handleStart = () => {
    initMatch(homeName || 'Mon Equipe', awayName || 'Adversaire', matchDate || todayISO());
    setStep('rotations');
  };

  const handleRotationsComplete = async () => {
    // Appliquer les modèles sélectionnés
    const hConfig = findConfig(homeModel);
    const aConfig = findConfig(awayModel);
    if (hConfig) applyModel('home', hConfig as any);
    if (aConfig) applyModel('away', aConfig as any);
    setSetupComplete();
    // Sauvegarder le match en BDD (silencieux si hors-ligne)
    try { await saveMatch(useMatchStore.getState()); } catch (_) { /* silencieux */ }
    onComplete();
  };

  if (step === 'models') {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
        <ModelEditor onBack={() => setStep('names')} />
      </div>
    );
  }

  if (step === 'rotations') {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
        <RotationSetup
          onComplete={handleRotationsComplete}
          homeModelConfig={(findConfig(homeModel) ?? undefined) as ModelRoles | undefined}
          awayModelConfig={(findConfig(awayModel) ?? undefined) as ModelRoles | undefined}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
      <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Nouveau Match</h2>
      <p style={{ color: '#a0998e', fontSize: 12, marginBottom: 20 }}>Configuration initiale</p>

      {/* Date du match */}
      <label style={{ ...labelStyle, marginTop: 0 }}>Date du match</label>
      <input
        type="date"
        value={matchDate}
        onChange={e => setMatchDate(e.target.value)}
        style={{
          ...inputStyle,
          colorScheme: 'dark',
        }}
      />

      {/* Équipe domicile */}
      <label style={labelStyle}>Équipe Domicile</label>
      <input value={homeName} onChange={e => setHomeName(e.target.value)} placeholder="Mon Équipe" style={inputStyle} />

      <label style={{ ...labelStyle, marginTop: 6 }}>Modèle de jeu — Domicile</label>
      <select value={homeModel} onChange={e => setHomeModel(e.target.value)} style={selectStyle}>
        {allModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      {/* Équipe adverse */}
      <label style={labelStyle}>Équipe Adverse</label>
      <input value={awayName} onChange={e => setAwayName(e.target.value)} placeholder="Adversaire" style={inputStyle} />

      <label style={{ ...labelStyle, marginTop: 6 }}>Modèle de jeu — Adverse</label>
      <select value={awayModel} onChange={e => setAwayModel(e.target.value)} style={selectStyle}>
        {allModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,215,0,0.06)', borderRadius: 6, border: '1px solid rgba(255,215,0,0.15)' }}>
        <p style={{ fontSize: 10, color: '#a0998e', margin: 0, lineHeight: 1.5 }}>
          Le modèle pré-remplit les positions de réception (Module 1/2) et les positions de bloc/défense (Module 3) pour toutes les rotations.
          Vous pourrez les affiner en mode ✎ EDIT.
        </p>
      </div>

      <button onClick={handleStart} style={btnStyle}>
        Configurer les rotations →
      </button>

      <button
        onPointerDown={() => setStep('models')}
        style={{
          width: '100%', marginTop: 8, background: 'transparent',
          color: '#a0998e', fontWeight: 600, padding: '9px 18px',
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 12, cursor: 'pointer',
        }}
      >
        ⚙ Gérer les modèles de jeu
      </button>
    </div>
  );
}
