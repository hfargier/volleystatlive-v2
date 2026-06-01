// src/components/setup/ModelEditor.tsx
// Éditeur de modèles de jeu : 6 rotations × 3 phases, positions draggables + zones d'attaque.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listModels, getModel, saveModel, deleteModel } from '../../api/volleyApi';
import type { ApiModel } from '../../api/volleyApi';
import type { PlayerRole } from '../../types';
import { BUILTIN_MODELS } from '../../api/modelTemplates';
import { ATTACK_ZONE_BOUNDS } from '../court/CourtWithServer';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'sideOut' | 'blocDef' | 'blocDefS';

interface PosXY { x: number; y: number; }
type PhasePositions = Record<number, Record<number, PosXY>>;

interface DraftModel {
  id?: number;
  name: string;
  description: string;
  sideOutRoles:      Record<number, Record<number, string[]>>;
  sideOutPositions:  PhasePositions;
  blocDefPositions:  PhasePositions;
  blocDefSPositions: PhasePositions;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SETTER_AT: Record<number, number> = { 0:1, 1:6, 2:5, 3:4, 4:3, 5:2 };
const ROT_LABELS = [
  'Rot 1 — Pass. P1', 'Rot 2 — Pass. P6', 'Rot 3 — Pass. P5',
  'Rot 4 — Pass. P4', 'Rot 5 — Pass. P3', 'Rot 6 — Pass. P2',
];
const ROT_SHORT = ['P1','P6','P5','P4','P3','P2'];

const PHASE_INFO: { key: Phase; label: string; hint: string }[] = [
  { key: 'sideOut',  label: 'Réception',  hint: 'Positions en réception (SideOut) — adversaire au service' },
  { key: 'blocDef',  label: 'Bloc/Def',   hint: 'Positions en bloc/défense — votre équipe au service' },
  { key: 'blocDefS', label: 'Bloc/Def S', hint: 'Positions bloc/défense second rideau' },
];

const ROLE_COLORS: Record<string, string> = {
  setter: '#ce93d8', receiver: '#81c784', central: '#ffb74d', pointu: '#ff7043',
  libero: '#e0f7fa',
  attacker_4: '#ff8a65', attacker_3: '#ffb74d', attacker_2: '#ff7043',
  attacker_pipe: '#ffa726', attacker_1: '#ef5350',
};
const POS_ROLES_LIST: { role: string; label: string; color: string }[] = [
  { role: 'setter',   label: 'Passeur',       color: '#ce93d8' },
  { role: 'receiver', label: 'Réceptionneur', color: '#81c784' },
  { role: 'central',  label: 'Central',       color: '#ffb74d' },
  { role: 'pointu',   label: 'Pointu',        color: '#ff7043' },
  { role: 'libero',   label: 'Libero',        color: '#e0f7fa' },
];
const ZONE_LABELS: Partial<Record<string, string>> = {
  attacker_4: '4', attacker_3: '3', attacker_2: '2',
  attacker_pipe: 'P', attacker_1: '1',
};

const DEFAULT_POS: Record<number, PosXY> = {
  1:{x:0.83,y:0.75}, 2:{x:0.83,y:0.25}, 3:{x:0.50,y:0.25},
  4:{x:0.17,y:0.25}, 5:{x:0.17,y:0.75}, 6:{x:0.50,y:0.75},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise les rôles chargés depuis l'API.
 * Après JSON round-trip les clés sont des strings ("0","1"…).
 * On recrée explicitement un objet avec clés numériques pour 6 rotations × 6 positions.
 */
function normalizeRoles(raw: any): Record<number, Record<number, string[]>> {
  const result: Record<number, Record<number, string[]>> = {};
  for (let r = 0; r < 6; r++) {
    result[r] = {};
    for (let p = 1; p <= 6; p++) {
      result[r][p] =
        raw?.[r]?.[p]            ??
        raw?.[r]?.[String(p)]    ??
        raw?.[String(r)]?.[p]    ??
        raw?.[String(r)]?.[String(p)] ?? [];
    }
  }
  return result;
}

/**
 * Normalise les coordonnées XY chargées depuis l'API.
 * Même traitement que normalizeRoles, avec fallback sur DEFAULT_POS.
 */
function normalizePositions(raw: any): PhasePositions {
  const result: PhasePositions = {};
  for (let r = 0; r < 6; r++) {
    result[r] = {};
    for (let p = 1; p <= 6; p++) {
      const pt =
        raw?.[r]?.[p]            ??
        raw?.[r]?.[String(p)]    ??
        raw?.[String(r)]?.[p]    ??
        raw?.[String(r)]?.[String(p)];
      result[r][p] = pt ? { x: pt.x, y: pt.y } : { ...DEFAULT_POS[p] };
    }
  }
  return result;
}

function makePhasePositions(): PhasePositions {
  const out: PhasePositions = {};
  for (let r = 0; r < 6; r++) {
    out[r] = {};
    for (let p = 1; p <= 6; p++) out[r][p] = { ...DEFAULT_POS[p] };
  }
  return out;
}

function makeEmptyDraft(): DraftModel {
  const emptyRoles: Record<number, Record<number, string[]>> = {};
  for (let r = 0; r < 6; r++) { emptyRoles[r] = {}; for (let p=1;p<=6;p++) emptyRoles[r][p]=[]; }
  return {
    name: '', description: '',
    sideOutRoles:      emptyRoles,
    sideOutPositions:  makePhasePositions(),
    blocDefPositions:  makePhasePositions(),
    blocDefSPositions: makePhasePositions(),
  };
}

function dotColor(roles: string[]): string {
  for (const [r, c] of Object.entries(ROLE_COLORS)) if (roles.includes(r)) return c;
  return '#a0998e';
}

// ── Demi-terrain éditeur avec zones d'attaque ─────────────────────────────────

function CourtEditor({
  positions, roles, setterPos, phase,
  onMove, selectedPos, onSelect, onZoneTap,
}: {
  positions: Record<number, PosXY>;
  roles: Record<number, string[]>;
  setterPos: number;
  phase: Phase;
  onMove: (pos: number, x: number, y: number) => void;
  selectedPos: number | null;
  onSelect: (pos: number | null) => void;
  onZoneTap: (zoneRole: string) => void;
}) {
  const courtRef  = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  const toCoords = (e: React.PointerEvent): PosXY => {
    const r = courtRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0.04, Math.min(0.96, (e.clientX - r.left) / r.width)),
      y: Math.max(0.04, Math.min(0.96, (e.clientY - r.top)  / r.height)),
    };
  };

  const onDotDown = (e: React.PointerEvent, pos: number) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = pos;
    onSelect(pos);
  };

  const onCourtMove = (e: React.PointerEvent) => {
    if (draggingRef.current === null) return;
    const { x, y } = toCoords(e);
    onMove(draggingRef.current, x, y);
  };

  const onCourtUp = () => { draggingRef.current = null; };

  // Rôles zone du joueur sélectionné
  const selRoles  = selectedPos ? (roles[selectedPos] ?? []) : [];
  const showZones = phase === 'sideOut';
  const zones     = ATTACK_ZONE_BOUNDS['home'];
  const S = 34;

  return (
    <div
      ref={courtRef}
      onPointerMove={onCourtMove}
      onPointerUp={onCourtUp}
      onPointerLeave={onCourtUp}
      onPointerDown={() => onSelect(null)}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: '#1c3a2a', border: '2px solid rgba(255,255,255,0.4)',
        borderRadius: 4, touchAction: 'none', userSelect: 'none',
      }}
    >
      {/* Filet (haut) */}
      <div style={{
        position: 'absolute', top: -2, left: -2, right: -2, height: 4,
        background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.5)',
        borderRadius: '2px 2px 0 0', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
        fontSize: 7, color: '#FFD700', fontWeight: 700, letterSpacing: '0.1em', pointerEvents: 'none',
      }}>FILET</div>
      {/* Ligne d'attaque */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '33%', height: 1,
        background: 'rgba(255,255,255,0.2)', pointerEvents: 'none',
      }} />
      {/* Ligne de fond */}
      <div style={{
        position: 'absolute', bottom: -2, left: -2, right: -2, height: 3,
        background: 'rgba(255,255,255,0.4)', borderRadius: '0 0 2px 2px', pointerEvents: 'none',
      }} />

      {/* ── Grille zones d'attaque (sideOut uniquement) ───────────────────── */}
      {showZones && zones.map((zone, i) => {
        if (!zone.role) return (
          <div key={i} style={{
            position: 'absolute',
            left: `${zone.x0 * 100}%`, width: `${(zone.x1 - zone.x0) * 100}%`,
            top:  `${zone.y0 * 100}%`, height: `${(zone.y1 - zone.y0) * 100}%`,
            border: '1px solid rgba(255,255,255,0.05)',
            pointerEvents: 'none', zIndex: 2,
          }} />
        );
        const role   = zone.role as string;
        const linked = Object.values(roles).some(r => r.includes(role));
        const active = selRoles.includes(role);
        const c      = ROLE_COLORS[role] ?? '#fff';
        return (
          <div key={i}
            onPointerDown={e => { e.stopPropagation(); if (selectedPos !== null) onZoneTap(role); }}
            style={{
              position: 'absolute',
              left: `${zone.x0 * 100}%`, width: `${(zone.x1 - zone.x0) * 100}%`,
              top:  `${zone.y0 * 100}%`, height: `${(zone.y1 - zone.y0) * 100}%`,
              border: `1px solid ${active ? c + '90' : linked ? c + '55' : c + '28'}`,
              background: active ? c + '22' : linked ? c + '10' : (selectedPos !== null ? c + '08' : 'transparent'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: selectedPos !== null ? 'pointer' : 'default',
              pointerEvents: selectedPos !== null ? 'auto' : 'none',
              transition: 'background 0.1s',
              zIndex: 2,
            }}
          >
            <span style={{
              fontSize: 16, fontWeight: 900,
              color: active ? c : linked ? c + '99' : c + '44',
              pointerEvents: 'none',
            }}>
              {ZONE_LABELS[role]}
            </span>
          </div>
        );
      })}

      {/* ── Flèches SVG joueur → zone ─────────────────────────────────────── */}
      {showZones && (
        <svg style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible', zIndex: 3,
        }} viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="arrow-me" markerWidth="5" markerHeight="5"
              refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L0,5 L5,2.5 z" fill="currentColor" opacity="0.75" />
            </marker>
          </defs>
          {([1,2,3,4,5,6] as const).flatMap(pos => {
            const pt = positions[pos] ?? DEFAULT_POS[pos];
            return (roles[pos] ?? [])
              .filter(r => r.startsWith('attacker_'))
              .flatMap(role => {
                const zone = zones.find(z => z.role === role);
                if (!zone) return [];
                const zx = (zone.x0 + zone.x1) / 2 * 100;
                // Pointe vers le haut de la case (côté filet) et non le centre
                const zy = zone.y0 * 100;
                const c  = ROLE_COLORS[role] ?? '#fff';
                return [(
                  <line key={`${pos}-${role}`}
                    x1={pt.x * 100} y1={pt.y * 100}
                    x2={zx} y2={zy}
                    stroke={c} strokeWidth={1.8} strokeOpacity={0.8}
                    strokeDasharray="3 2"
                    markerEnd="url(#arrow-me)"
                    style={{ color: c } as React.CSSProperties}
                  />
                )];
              });
          })}
        </svg>
      )}

      {/* ── Dots joueurs ─────────────────────────────────────────────────── */}
      {([1,2,3,4,5,6] as const).map(pos => {
        const pt         = positions[pos] ?? DEFAULT_POS[pos];
        const r          = roles[pos] ?? [];
        const color      = dotColor(r);
        const isSetter   = setterPos === pos;
        const isSelected = selectedPos === pos;
        const isLibero   = r.includes('libero');

        return (
          <div key={pos}
            onPointerDown={e => onDotDown(e, pos)}
            style={{
              position: 'absolute', left: `${pt.x * 100}%`, top: `${pt.y * 100}%`,
              transform: 'translate(-50%,-50%)', zIndex: 10,
              cursor: 'grab', touchAction: 'none',
            }}
          >
            {isLibero ? (
              /* Libero : cercle blanc tirets, "L" */
              <div style={{
                width: S, height: S, borderRadius: '50%',
                background: isSelected ? 'rgba(224,247,250,0.25)' : 'rgba(224,247,250,0.08)',
                border: `2.5px dashed ${isSelected ? '#e0f7fa' : 'rgba(224,247,250,0.7)'}`,
                boxShadow: isSelected ? '0 0 12px rgba(224,247,250,0.5)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#e0f7fa', pointerEvents: 'none', lineHeight: 1 }}>
                  L
                </span>
              </div>
            ) : isSetter ? (
              <div style={{
                width: S, height: S - 4,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                background: isSelected ? color : color + 'bb',
                boxShadow: isSelected ? `0 0 12px ${color}` : 'none',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4,
              }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#111', lineHeight: 1, pointerEvents: 'none' }}>
                  P{pos}
                </span>
              </div>
            ) : (
              <div style={{
                width: S, height: S, borderRadius: '50%',
                background: isSelected ? color + '55' : color + '25',
                border: `2.5px solid ${isSelected ? color : color + '99'}`,
                boxShadow: isSelected ? `0 0 12px ${color}80` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color, pointerEvents: 'none', lineHeight: 1 }}>
                  P{pos}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

interface ModelEditorProps { onBack: () => void; }

export function ModelEditor({ onBack }: ModelEditorProps) {
  const [view,      setView]      = useState<'list' | 'edit'>('list');
  const [apiModels, setApiModels] = useState<ApiModel[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [draft,     setDraft]     = useState<DraftModel | null>(null);
  const [rotation,  setRotation]  = useState(0);
  const [phase,     setPhase]     = useState<Phase>('sideOut');
  const [selPos,    setSelPos]    = useState<number | null>(null);

  // Taille du terrain : min(largeur dispo, hauteur dispo) pour rester carré.
  // L'effet dépend de `view` : quand on passe en 'edit', le div du terrain
  // est créé dans le DOM et le ref est attaché → l'observer peut démarrer.
  const courtContainerRef = useRef<HTMLDivElement>(null);
  const [courtSize, setCourtSize] = useState(0);
  useEffect(() => {
    const el = courtContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCourtSize(Math.floor(Math.min(width, height)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [view]); // relancer quand view → 'edit' pour attraper le nouveau DOM

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      // On charge TOUS les modèles de l'API (sans filtrer les builtins)
      const ms = await listModels();
      setApiModels(ms);
    } catch { setError('Impossible de charger les modèles.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  // ── Ouvrir un modèle builtin local ────────────────────────────────────────
  const openBuiltin = (m: typeof BUILTIN_MODELS[number]) => {
    // Deep-clone via JSON pour éviter de partager les références du builtin
    const cfg = JSON.parse(JSON.stringify(m.config));
    setDraft({
      name:        m.name,
      description: m.description,
      sideOutRoles:      normalizeRoles(cfg.sideOutRoles),
      sideOutPositions:  normalizePositions(cfg.sideOutPositions),
      blocDefPositions:  normalizePositions(cfg.blocDefPositions),
      blocDefSPositions: normalizePositions(cfg.blocDefSPositions),
    });
    setRotation(0); setPhase('sideOut'); setSelPos(null); setError(''); setSuccess('');
    setView('edit');
  };

  // ── Ouvrir un modèle API ──────────────────────────────────────────────────
  const openEdit = async (model: ApiModel) => {
    setLoading(true); setError('');
    try {
      const full   = await getModel(model.id);
      const config = full.config as any;   // peut être undefined ou avoir des clés string après JSON
      setDraft({
        id:          model.id,
        name:        model.name,
        description: model.description,
        sideOutRoles:      normalizeRoles(config?.sideOutRoles),
        sideOutPositions:  normalizePositions(config?.sideOutPositions),
        blocDefPositions:  normalizePositions(config?.blocDefPositions),
        blocDefSPositions: normalizePositions(config?.blocDefSPositions),
      });
    } catch (e: any) { setError('Erreur chargement : ' + e.message); }
    finally { setLoading(false); }
    setRotation(0); setPhase('sideOut'); setSelPos(null); setSuccess('');
    setView('edit');
  };

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Nom du modèle requis.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await saveModel({
        id:          draft.id,
        name:        draft.name.trim(),
        description: draft.description,
        config: {
          sideOutRoles:      draft.sideOutRoles,
          sideOutPositions:  draft.sideOutPositions,
          blocDefPositions:  draft.blocDefPositions,
          blocDefSPositions: draft.blocDefSPositions,
        } as any,
      });
      if (!result.id) {
        setError('Sauvegarde échouée côté serveur (id=0). Vérifiez que api_volleystatlive.php est à jour sur le serveur.');
        return;
      }
      setSuccess(`✓ Modèle "${draft.name.trim()}" sauvegardé (id: ${result.id})`);
      // Met à jour l'id dans le draft si c'était un nouveau modèle ou si l'id a changé
      if (result.id && draft.id !== result.id) setDraft(d => d ? { ...d, id: result.id } : d);
      await loadModels();
    } catch (e: any) { setError('Erreur sauvegarde : ' + e.message); }
    finally { setSaving(false); }
  };

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer le modèle "${name}" ?`)) return;
    setError('');
    try {
      await deleteModel(id);
      setApiModels(prev => prev.filter(m => m.id !== id));
    } catch (e: any) { setError('Erreur suppression : ' + e.message); }
  };

  // ── Positions / rôles courants ────────────────────────────────────────────
  const getPositions = (): Record<number, PosXY> =>
    draft
      ? (phase === 'sideOut' ? draft.sideOutPositions :
         phase === 'blocDef' ? draft.blocDefPositions : draft.blocDefSPositions)[rotation] ?? {}
      : {};

  const handleMove = useCallback((pos: number, x: number, y: number) => {
    setDraft(prev => {
      if (!prev) return prev;
      const field = phase === 'sideOut' ? 'sideOutPositions' :
                    phase === 'blocDef' ? 'blocDefPositions' : 'blocDefSPositions';
      return { ...prev, [field]: { ...prev[field], [rotation]: { ...prev[field][rotation], [pos]: { x, y } } } };
    });
  }, [phase, rotation]);

  const handleSetRole = (pos: number, role: string) => {
    setDraft(prev => {
      if (!prev) return prev;
      const cur      = prev.sideOutRoles[rotation][pos] ?? [];
      const posRoles = ['setter','receiver','central','pointu','libero'];
      const kept     = cur.filter(r => !posRoles.includes(r));
      return { ...prev, sideOutRoles: { ...prev.sideOutRoles, [rotation]: { ...prev.sideOutRoles[rotation], [pos]: [role, ...kept] } } };
    });
  };

  // Zone tap : link/unlink le joueur sélectionné à une zone d'attaque
  const handleZoneTap = useCallback((zoneRole: string) => {
    if (selPos === null) return;
    setDraft(prev => {
      if (!prev) return prev;
      const cur        = prev.sideOutRoles[rotation][selPos] ?? [];
      const isZone     = (r: string) => r.startsWith('attacker_');
      const frontZones = ['attacker_4','attacker_3','attacker_2'];
      const backZones  = ['attacker_pipe','attacker_1'];
      const sameGroup  = frontZones.includes(zoneRole) ? frontZones : backZones;
      const next = cur.includes(zoneRole)
        ? cur.filter(r => r !== zoneRole)              // déjà lié → délier
        : [...cur.filter(r => !sameGroup.includes(r)), zoneRole]; // lier (1 par groupe)
      return { ...prev, sideOutRoles: { ...prev.sideOutRoles, [rotation]: { ...prev.sideOutRoles[rotation], [selPos]: next } } };
    });
  }, [selPos, rotation]);

  // ── Auto-assigner le libero ───────────────────────────────────────────────
  // Règle par défaut :
  //  • Pour chaque rotation, les centraux en zone arrière (y > 0.38) deviennent libero.
  //  • Exception : le central au poste de service (pos=1) garde son rôle "central" dans
  //    la phase BlocDef (il sert), mais est remplacé par le libero en phase SideOut.
  const autoAssignLibero = () => {
    setDraft(prev => {
      if (!prev) return prev;
      // P5 et P6 sont toujours en zone arrière sans jamais servir → libero auto.
      // P1 = poste de service : le central y sert en Bloc/Def, on ne le remplace pas.
      // (Pour la rotation où le central sert, le libero entre sur la rotation suivante
      //  en SideOut — à assigner manuellement si besoin.)
      const AUTO_LIBERO_POSITIONS = new Set([5, 6]);
      const newRoles = { ...prev.sideOutRoles };

      for (let r = 0; r < 6; r++) {
        const rotRoles = { ...newRoles[r] };
        for (let p = 1; p <= 6; p++) {
          const roles = rotRoles[p] ?? [];
          if (!roles.includes('central')) continue;
          if (!AUTO_LIBERO_POSITIONS.has(p)) continue; // P1/P2/P3/P4 → on ne touche pas
          const posRoles = ['central', 'libero'];
          const kept = roles.filter(ro => !posRoles.includes(ro));
          rotRoles[p] = ['libero', ...kept];
        }
        newRoles[r] = rotRoles;
      }
      return { ...prev, sideOutRoles: newRoles };
    });
  };

  // ── Copier vers rotation suivante ─────────────────────────────────────────
  const copyToNext = () => {
    if (rotation >= 5) return;
    setDraft(prev => {
      if (!prev) return prev;
      const field = phase === 'sideOut' ? 'sideOutPositions' :
                    phase === 'blocDef' ? 'blocDefPositions' : 'blocDefSPositions';
      return {
        ...prev,
        [field]: { ...prev[field], [rotation + 1]: { ...prev[field][rotation] } },
        ...(phase === 'sideOut' ? {
          sideOutRoles: { ...prev.sideOutRoles, [rotation + 1]: { ...prev.sideOutRoles[rotation] } },
        } : {}),
      };
    });
    setRotation(r => r + 1);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VUE LISTE
  // ─────────────────────────────────────────────────────────────────────────
  if (view === 'list') {
    // Modèles API qui portent un nom de builtin (= version personnalisée en BDD)
    const apiByName = Object.fromEntries(apiModels.map(m => [m.name, m]));
    // Builtins dont la version BDD n'existe pas encore
    const localOnlyBuiltins = BUILTIN_MODELS.filter(b => !apiByName[b.name]);
    // Modèles perso (hors builtins qui existent aussi en local)
    const customModels = apiModels.filter(
      m => !BUILTIN_MODELS.some(b => b.name === m.name) || apiByName[m.name]
    );

    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: '#131a13',
      }}>
        {/* En-tête fixe */}
        <div style={{
          padding: '12px 16px 10px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <button onPointerDown={onBack} style={{
            background: 'none', border: 'none', color: '#a0998e',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>← Retour</button>
          <h2 style={{ color: '#FFD700', fontSize: 14, fontWeight: 800, margin: 0, flex: 1 }}>
            Modèles de jeu
          </h2>
          <button onPointerDown={() => { setDraft(makeEmptyDraft()); setRotation(0); setPhase('sideOut'); setSelPos(null); setError(''); setSuccess(''); setView('edit'); }} style={{
            background: '#FFD700', color: '#111', border: 'none',
            borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
          }}>+ Nouveau</button>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {error && <div style={{ fontSize: 10, color: '#ff7043', background: 'rgba(255,112,67,0.1)', border: '1px solid rgba(255,112,67,0.3)', borderRadius: 6, padding: '6px 10px' }}>{error}</div>}

        {/* Modèles intégrés (local uniquement si pas encore en BDD) */}
        {(localOnlyBuiltins.length > 0 || apiModels.some(m => BUILTIN_MODELS.some(b => b.name === m.name))) && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#5a554e', letterSpacing: '0.1em' }}>MODÈLES INTÉGRÉS</div>
        )}
        {localOnlyBuiltins.map(m => (
          <div key={m.id} style={{
            background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0ede6' }}>{m.name}</div>
              <div style={{ fontSize: 9, color: '#5a554e', marginTop: 2 }}>{m.description}</div>
            </div>
            <button onPointerDown={() => openBuiltin(m)} style={{
              background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
              borderRadius: 5, color: '#FFD700', fontSize: 10, fontWeight: 700,
              cursor: 'pointer', padding: '4px 8px',
            }}>✎</button>
          </div>
        ))}

        {/* Tous les modèles API */}
        {apiModels.length > 0 && (
          <div style={{ fontSize: 9, fontWeight: 700, color: '#5a554e', letterSpacing: '0.1em', marginTop: 4 }}>
            MES MODÈLES {!loading && `(${apiModels.length})`}
          </div>
        )}
        {loading && <div style={{ color: '#5a554e', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>Chargement…</div>}

        {!loading && apiModels.length === 0 && localOnlyBuiltins.length > 0 && (
          <div style={{ color: '#5a554e', fontSize: 10, textAlign: 'center', padding: '12px', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 8 }}>
            Aucun modèle personnalisé. Cliquez ✎ sur un modèle intégré pour le modifier.
          </div>
        )}

        {apiModels.map(m => {
          const isBuiltinName = BUILTIN_MODELS.some(b => b.name === m.name);
          return (
            <div key={m.id} style={{
              background: isBuiltinName ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isBuiltinName ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0ede6' }}>
                  {m.name}
                  {isBuiltinName && <span style={{ fontSize: 8, color: '#FFD700', marginLeft: 6 }}>intégré</span>}
                </div>
                {m.description && <div style={{ fontSize: 9, color: '#5a554e', marginTop: 2 }}>{m.description}</div>}
              </div>
              <button onPointerDown={() => openEdit(m)} style={{
                background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: 5, color: '#FFD700', fontSize: 10, fontWeight: 700,
                cursor: 'pointer', padding: '4px 8px',
              }}>✎</button>
              {!isBuiltinName && (
                <button onPointerDown={() => handleDelete(m.id, m.name)} style={{
                  background: 'none', border: 'none', color: '#3a3530',
                  fontSize: 16, cursor: 'pointer', padding: '4px', lineHeight: 1,
                }}>🗑</button>
              )}
            </div>
          );
        })}

        </div> {/* fin contenu scrollable */}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VUE ÉDITION — layout sans scroll, terrain adaptatif
  // ─────────────────────────────────────────────────────────────────────────
  if (!draft) return null;

  const setterPos    = SETTER_AT[rotation];
  const positions    = getPositions();
  const currentRoles = draft.sideOutRoles[rotation] ?? {};
  const selRoles     = selPos ? (currentRoles[selPos] ?? []) : [];

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '8px 12px 6px',
      boxSizing: 'border-box', gap: 4, background: '#131a13',
    }}>

      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button onPointerDown={() => setView('list')} style={{
          background: 'none', border: 'none', color: '#a0998e',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap',
        }}>← Liste</button>
        <input
          value={draft.name}
          onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
          placeholder="Nom du modèle"
          style={{
            flex: 1, background: '#2a2a2a', border: '1px solid rgba(255,215,0,0.3)',
            borderRadius: 6, color: '#FFD700', fontSize: 13, fontWeight: 800,
            padding: '4px 8px', outline: 'none', minWidth: 0,
          }}
        />
        <button onPointerDown={handleSave} disabled={saving} style={{
          background: saving ? 'rgba(255,255,255,0.05)' : '#FFD700',
          color: saving ? '#a0998e' : '#111', border: 'none',
          borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 800,
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, flexShrink: 0,
        }}>{saving ? '⏳' : '💾'}</button>
      </div>

      {/* ── Description ───────────────────────────────────────────────────── */}
      <input
        value={draft.description}
        onChange={e => setDraft(d => d ? { ...d, description: e.target.value } : d)}
        placeholder="Description (optionnelle)"
        style={{
          flexShrink: 0, background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: '#a0998e', fontSize: 10, padding: '4px 8px', outline: 'none',
        }}
      />

      {/* ── Feedback (compact, disparaît quand vide) ──────────────────────── */}
      {error && (
        <div style={{
          flexShrink: 0, fontSize: 9, color: '#ff7043',
          background: 'rgba(255,112,67,0.1)', border: '1px solid rgba(255,112,67,0.3)',
          borderRadius: 5, padding: '3px 8px', fontWeight: 600,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          flexShrink: 0, fontSize: 9, color: '#81c784',
          background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
          borderRadius: 5, padding: '3px 8px', fontWeight: 600,
        }}>{success}</div>
      )}

      {/* ── Sélecteur rotation ────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0,1,2,3,4,5].map(r => (
            <button key={r} onPointerDown={() => { setRotation(r); setSelPos(null); }} style={{
              flex: 1, padding: '4px 2px', fontSize: 9, fontWeight: 700,
              borderRadius: 5, cursor: 'pointer', textAlign: 'center',
              background: rotation === r ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${rotation === r ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: rotation === r ? '#FFD700' : '#5a554e',
            }}>{ROT_SHORT[r]}</button>
          ))}
        </div>
        <div style={{ fontSize: 8, color: '#5a554e', marginTop: 2, lineHeight: 1 }}>
          {ROT_LABELS[rotation]}
        </div>
      </div>

      {/* ── Sélecteur phase ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {PHASE_INFO.map(({ key, label }) => (
          <button key={key} onPointerDown={() => { setPhase(key); setSelPos(null); }} style={{
            flex: 1, padding: '5px 2px', fontSize: 9, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
            background: phase === key ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${phase === key ? 'rgba(79,195,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: phase === key ? '#4fc3f7' : '#5a554e',
          }}>{label}</button>
        ))}
      </div>

      {/* ── Terrain ─ prend tout l'espace restant ─────────────────────────── */}
      {/* ResizeObserver calcule min(largeur, hauteur) → toujours un carré parfait */}
      <div
        ref={courtContainerRef}
        style={{
          flex: 1, minHeight: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {courtSize > 0 && (
          <div style={{ width: courtSize, height: courtSize, flexShrink: 0 }}>
            <CourtEditor
              positions={positions}
              roles={currentRoles}
              setterPos={setterPos}
              phase={phase}
              onMove={handleMove}
              selectedPos={selPos}
              onSelect={setSelPos}
              onZoneTap={handleZoneTap}
            />
          </div>
        )}
      </div>

      {/* ── Section basse (compact, hauteur fixe) ─────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Hint zones (sideOut uniquement) */}
        {phase === 'sideOut' && (
          <div style={{ fontSize: 8, color: '#5a554e', textAlign: 'center', lineHeight: 1.2 }}>
            {selPos !== null
              ? `P${selPos} sélectionné — touchez une zone pour lier/délier`
              : 'Sélectionnez un joueur pour le déplacer ou lui assigner une zone'}
          </div>
        )}

        {/* Panneau joueur sélectionné (compact) */}
        {selPos !== null && (
          <div style={{
            background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 7, padding: '5px 8px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {/* Label position + rôle spécial + zones */}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f0ede6', whiteSpace: 'nowrap' }}>
              P{selPos}
              {selRoles.includes('libero') && (
                <span style={{ fontSize: 9, color: '#e0f7fa', marginLeft: 4, fontWeight: 900 }}>
                  [L]
                </span>
              )}
              {selRoles.filter(r => r.startsWith('attacker_')).length > 0 && (
                <span style={{ fontSize: 9, color: '#4fc3f7', marginLeft: 4 }}>
                  → Z{selRoles.filter(r => r.startsWith('attacker_')).map(r => ZONE_LABELS[r]).join(',')}
                </span>
              )}
            </span>

            {/* Boutons de poste (sideOut) */}
            {phase === 'sideOut' && (
              <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                {POS_ROLES_LIST.map(({ role, label, color }) => {
                  const active = selRoles.includes(role);
                  return (
                    <button key={role} onPointerDown={() => handleSetRole(selPos, role)} style={{
                      padding: '3px 7px', fontSize: 9, fontWeight: 700,
                      borderRadius: 5, cursor: 'pointer',
                      background: active ? color + '28' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${active ? color + '90' : 'rgba(255,255,255,0.1)'}`,
                      color: active ? color : '#5a554e',
                    }}>{label}</button>
                  );
                })}
              </div>
            )}
            {phase !== 'sideOut' && (
              <span style={{ fontSize: 8, color: '#5a554e', flex: 1 }}>
                Glissez P{selPos} pour ajuster la position
              </span>
            )}

            {/* Fermer */}
            <button onPointerDown={() => setSelPos(null)} style={{
              background: 'none', border: 'none', color: '#5a554e',
              fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0, flexShrink: 0,
            }}>×</button>
          </div>
        )}

        {/* Ligne d'actions bas : Copier + Auto libero */}
        <div style={{ display: 'flex', gap: 4 }}>
          {rotation < 5 && (
            <button onPointerDown={copyToNext} style={{
              flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '5px', fontSize: 9, fontWeight: 700,
              color: '#a0998e', cursor: 'pointer',
            }}>
              Copier → {ROT_SHORT[rotation + 1]}
            </button>
          )}
          {/* Auto libero : applique la règle par défaut sur TOUTES les rotations */}
          <button
            onPointerDown={autoAssignLibero}
            title="Remplace automatiquement les centraux en zone arrière par le libero sur toutes les rotations"
            style={{
              flex: rotation < 5 ? 'none' : 1,
              background: 'rgba(224,247,250,0.08)', border: '1px solid rgba(224,247,250,0.3)',
              borderRadius: 6, padding: '5px 8px', fontSize: 9, fontWeight: 700,
              color: '#e0f7fa', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ⚡ Auto libero
          </button>
        </div>
      </div>

    </div>
  );
}
