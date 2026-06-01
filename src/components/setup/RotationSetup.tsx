// src/components/setup/RotationSetup.tsx
import React, { useState, useMemo } from 'react';
import { useMatchStore } from '../../store/matchStore';
import { saveMatch } from '../../api/volleyApi';
import type { Position, TeamSide, Player, PlayerRole } from '../../types';
import type { ModelRoles } from '../../api/modelTemplates';
import { MODEL_5_1_CLASSIQUE } from '../../api/modelTemplates';

interface RotationSetupProps {
  onComplete: () => void;
  homeModelConfig?: ModelRoles;
  awayModelConfig?: ModelRoles;
}

// ── Constantes ────────────────────────────────────────────────────────────────
const JERSEY_NUMBERS = Array.from({ length: 99 }, (_, i) => i + 1);

const POSITION_ROLES: { role: PlayerRole; label: string; short: string; color: string }[] = [
  { role: 'setter',   label: 'Passeur',  short: '△', color: '#ce93d8' },
  { role: 'receiver', label: 'Récept.',  short: 'R', color: '#81c784' },
  { role: 'central',  label: 'Central',  short: 'C', color: '#ffb74d' },
  { role: 'pointu',   label: 'Pointu',   short: 'P', color: '#ff7043' },
];

// Passeur en position P → rotation modèle correspondante
const SETTER_POS_TO_MODEL_ROT: Record<number, number> = { 1:0, 6:1, 5:2, 4:3, 3:4, 2:5 };

// Position coords (% within each half-court div)
const HOME_POS: Record<Position, [number, number]> = {
  1: [91, 82], 2: [91, 25], 3: [58, 25], 4: [25, 25], 5: [25, 82], 6: [58, 82],
};
const AWAY_POS: Record<Position, [number, number]> = {
  1: [25, 25], 2: [25, 89], 3: [58, 89], 4: [91, 89], 5: [91, 25], 6: [58, 25],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPositionRole(player: Player): PlayerRole | null {
  return (player.defaultRoles.find(r =>
    r === 'setter' || r === 'receiver' || r === 'central' || r === 'pointu'
  ) ?? null) as PlayerRole | null;
}
function roleColor(role: PlayerRole | null, fallback: string): string {
  return POSITION_ROLES.find(r => r.role === role)?.color ?? fallback;
}
function roleShort(role: PlayerRole | null): string {
  return POSITION_ROLES.find(r => r.role === role)?.short ?? '';
}
function primaryRole(roles: PlayerRole[]): PlayerRole | null {
  for (const r of roles) {
    if (r === 'setter' || r === 'receiver' || r === 'central' || r === 'pointu') return r as PlayerRole;
  }
  return null;
}
// ── Popup flottant ─────────────────────────────────────────────────────────────
interface PopupState {
  team: TeamSide;
  pos: Position;
  anchorX: number;
  anchorY: number;
}

function FloatingEditPopup({
  player, team, pos, anchorX, anchorY, takenNumbers,
  onUpdateNum, onSetRole, onClose,
}: {
  player: Player; team: TeamSide; pos: Position;
  anchorX: number; anchorY: number;
  takenNumbers: Set<number>;
  onUpdateNum: (n: number) => void;
  onSetRole: (r: PlayerRole) => void;
  onClose: () => void;
}) {
  const c = team === 'home' ? '#FFD700' : '#ff8a65';
  const role = getPositionRole(player);

  const POPUP_W = 242;
  const MARGIN  = 8;

  const left   = Math.max(MARGIN, Math.min(anchorX - POPUP_W / 2, (window.innerWidth || 400) - POPUP_W - MARGIN));
  const screenH = window.innerHeight || 700;
  const showAbove = anchorY > screenH * 0.55;
  const posStyle: React.CSSProperties = showAbove
    ? { bottom: screenH - anchorY + 10 }
    : { top: anchorY + 10 };

  return (
    <>
      {/* Backdrop */}
      <div
        onPointerDown={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)', touchAction: 'none',
        }}
      />

      {/* Popup */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', left, ...posStyle, width: POPUP_W, zIndex: 201,
          background: '#1a1a1a',
          border: `1px solid ${c}55`,
          borderRadius: 12, padding: '10px 10px 12px',
          boxShadow: '0 10px 48px rgba(0,0,0,0.75)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: c, flex: 1, letterSpacing: '0.07em' }}>
            POSITION {pos} — {team === 'home' ? 'DOMICILE' : 'ADVERSE'}
          </span>
          <button
            onPointerDown={onClose}
            style={{ background: 'none', border: 'none', color: '#5a554e', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 0 }}
          >×</button>
        </div>

        {/* N° Maillot */}
        <div style={{ fontSize: 8, fontWeight: 700, color: '#7a726a', letterSpacing: '0.08em', marginBottom: 6 }}>
          N° MAILLOT
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3,
          maxHeight: 183,   // ~5 rows visible (shows 1-30)
          overflowY: 'auto',
          marginBottom: 11,
          paddingRight: 2,
        }}>
          {JERSEY_NUMBERS.map(n => {
            const isCurrent = player.number === n;
            const isTaken   = takenNumbers.has(n) && !isCurrent;
            return (
              <button
                key={n}
                onPointerDown={() => { if (!isTaken) onUpdateNum(n); }}
                style={{
                  aspectRatio: '1', borderRadius: '50%', minWidth: 0, padding: 0,
                  border: isCurrent
                    ? `2px solid ${c}`
                    : `1px solid rgba(255,255,255,${isTaken ? '0.03' : '0.13'})`,
                  background: isCurrent
                    ? c + '2e'
                    : isTaken ? 'transparent' : 'rgba(255,255,255,0.055)',
                  color: isCurrent ? c : isTaken ? '#2e2a26' : '#b0a89e',
                  fontSize: n >= 10 ? 9 : 11,
                  fontWeight: isCurrent ? 900 : 600,
                  cursor: isTaken ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.08s, border-color 0.08s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >{n}</button>
            );
          })}
        </div>

        {/* Poste */}
        <div style={{ fontSize: 8, fontWeight: 700, color: '#7a726a', letterSpacing: '0.08em', marginBottom: 6 }}>
          POSTE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {POSITION_ROLES.map(({ role: r, label, short, color }) => {
            const active = role === r;
            return (
              <button
                key={r}
                onPointerDown={() => onSetRole(r)}
                style={{
                  padding: '7px 6px', fontSize: 11, fontWeight: 700,
                  borderRadius: 7, cursor: 'pointer', border: 'none',
                  background: active ? color + '28' : 'rgba(255,255,255,0.06)',
                  outline: active ? `1.5px solid ${color + '80'}` : '1.5px solid transparent',
                  color: active ? color : '#7a726a',
                  display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: r === 'setter' ? 12 : 13, lineHeight: 1 }}>{short}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Dot sur le terrain ────────────────────────────────────────────────────────
function PositionDot({ pos, player, x, y, isSelected, isServer, team, onTap }: {
  pos: Position; player: Player; x: number; y: number;
  isSelected: boolean; isServer: boolean; team: TeamSide;
  onTap: (clientX: number, clientY: number) => void;
}) {
  const teamColor = team === 'home' ? '#FFD700' : '#ff8a65';
  const role      = getPositionRole(player);
  const color     = roleColor(role, teamColor);
  const short     = roleShort(role);
  const isTri     = role === 'setter';
  const S = 28;

  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onTap(e.clientX, e.clientY); }}
      style={{
        position: 'absolute', left: `${x}%`, top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10, cursor: 'pointer', touchAction: 'none',
        padding: 8, margin: -8,
      }}
    >
      {isServer && (
        <div style={{
          position: 'absolute',
          bottom: team === 'home' ? '100%' : undefined,
          top: team === 'home' ? undefined : '100%',
          left: '50%', transform: 'translateX(-50%)',
          fontSize: 14, pointerEvents: 'none', zIndex: 12, lineHeight: 1,
        }}>🏐</div>
      )}
      {isTri ? (
        <div style={{
          width: S, height: S - 2,
          clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
          background: isSelected ? color : color + 'cc',
          boxShadow: isSelected ? `0 0 8px ${color}` : 'none',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 3,
        }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: '#111', lineHeight: 1, pointerEvents: 'none' }}>
            {player.number === 0 ? '?' : player.number}
          </span>
        </div>
      ) : (
        <div style={{
          width: S, height: S, borderRadius: '50%',
          background: isSelected ? color + '50' : color + '22',
          border: `2px solid ${isSelected ? color : color + '90'}`,
          boxShadow: isSelected ? `0 0 8px ${color}80` : isServer ? `0 0 5px ${color}60` : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: role ? 8 : 10, fontWeight: 900, color, pointerEvents: 'none', lineHeight: 1 }}>
            {player.number === 0 ? '?' : `${player.number}${short}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Carte libéro (flanque le terrain) ────────────────────────────────────────
function LiberoCard({ team, number, teamName, takenNumbers, onChange }: {
  team: TeamSide; number: number; teamName: string;
  takenNumbers: Set<number>;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const teamColor = team === 'home' ? '#FFD700' : '#ff8a65';

  return (
    <div style={{
      width: 60, flexShrink: 0,
      background: 'rgba(79,195,247,0.07)',
      border: '1px solid rgba(79,195,247,0.3)',
      borderRadius: 8, padding: '8px 6px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: teamColor, letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.2 }}>
        {teamName.length > 7 ? teamName.slice(0, 7) + '…' : teamName}
      </div>

      {/* Cercle L + numéro (cliquable) */}
      <div
        onPointerDown={() => setOpen(v => !v)}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: open ? 'rgba(79,195,247,0.28)' : 'rgba(79,195,247,0.15)',
          border: `2px solid ${open ? '#4fc3f7' : 'rgba(79,195,247,0.5)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          flexShrink: 0, touchAction: 'none',
        }}
      >
        <span style={{ fontSize: number > 0 ? 12 : 13, fontWeight: 900, color: '#4fc3f7', lineHeight: 1 }}>
          {number > 0 ? number : 'L'}
        </span>
      </div>

      <div style={{ fontSize: 7, fontWeight: 700, color: '#4fc3f7', letterSpacing: '0.08em' }}>LIBERO</div>

      {/* Mini-grille dépliable */}
      {open && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2,
          maxHeight: 160, overflowY: 'auto', width: '100%',
        }}>
          {JERSEY_NUMBERS.map(n => {
            const isCurrent = number === n;
            const isTaken   = takenNumbers.has(n) && !isCurrent;
            return (
              <button
                key={n}
                onPointerDown={() => {
                  if (!isTaken) { onChange(n); setOpen(false); }
                }}
                style={{
                  aspectRatio: '1', borderRadius: '50%', minWidth: 0, padding: 0, border: 'none',
                  background: isCurrent ? 'rgba(79,195,247,0.3)' : isTaken ? 'transparent' : 'rgba(255,255,255,0.05)',
                  color: isCurrent ? '#4fc3f7' : isTaken ? '#2e2a26' : '#8a8280',
                  fontSize: n >= 10 ? 7 : 8, fontWeight: isCurrent ? 900 : 600,
                  cursor: isTaken ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >{n}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function RotationSetup({ onComplete, homeModelConfig, awayModelConfig }: RotationSetupProps) {
  const rotationHome   = useMatchStore(s => s.rotationHome);
  const rotationAway   = useMatchStore(s => s.rotationAway);
  const teamHomeName   = useMatchStore(s => s.teamHomeName);
  const teamAwayName   = useMatchStore(s => s.teamAwayName);
  const servingTeam    = useMatchStore(s => s.servingTeam);
  const liberoHome     = useMatchStore(s => s.liberoHome);
  const liberoAway     = useMatchStore(s => s.liberoAway);
  const updatePlayer   = useMatchStore(s => s.updatePlayer);
  const setServingTeam = useMatchStore(s => s.setServingTeam);
  const setLibero      = useMatchStore(s => s.setLibero);

  const [popup, setPopup] = useState<PopupState | null>(null);
  const [saving, setSaving] = useState(false);

  // Numéros déjà pris (pour griser dans le picker)
  const takenHome = useMemo(() => {
    const s = new Set<number>();
    Object.values(rotationHome).forEach(p => { if (p?.number > 0) s.add(p.number); });
    if (liberoHome?.number) s.add(liberoHome.number);
    return s;
  }, [rotationHome, liberoHome]);

  const takenAway = useMemo(() => {
    const s = new Set<number>();
    Object.values(rotationAway).forEach(p => { if (p?.number > 0) s.add(p.number); });
    if (liberoAway?.number) s.add(liberoAway.number);
    return s;
  }, [rotationAway, liberoAway]);

  const popupPlayer = popup
    ? (popup.team === 'home' ? rotationHome : rotationAway)[popup.pos]
    : null;

  const handleDotTap = (team: TeamSide, pos: Position, clientX: number, clientY: number) => {
    setPopup(prev =>
      prev?.team === team && prev?.pos === pos ? null : { team, pos, anchorX: clientX, anchorY: clientY }
    );
  };

  const handleUpdateNum = (n: number) => {
    if (!popup) return;
    updatePlayer(popup.team, popup.pos, n);
    // Ferme si le poste est déjà attribué (économise un clic)
    const hasRole = popupPlayer?.defaultRoles.some(r =>
      r === 'setter' || r === 'receiver' || r === 'central' || r === 'pointu'
    );
    if (hasRole) setPopup(null);
  };

  // Auto-assigne les postes selon le modèle quand le passeur est placé.
  // Utilise MODEL_5_1_CLASSIQUE pour les rôles (structure universelle 5-1).
  const autoAssignFromSetter = (team: TeamSide, setterPos: Position) => {
    // On lit la rotation directement depuis le snapshot réactif du composant
    const rotation = team === 'home' ? rotationHome : rotationAway;
    const modelRot = SETTER_POS_TO_MODEL_ROT[setterPos] ?? 0;
    // Accès direct au modèle builtin (clés numériques garanties en TS)
    const rolesForRot: Record<number, PlayerRole[]> = MODEL_5_1_CLASSIQUE.sideOutRoles[modelRot] ?? {};

    ([1, 2, 3, 4, 5, 6] as Position[]).forEach(p => {
      if (p === setterPos) return;
      const player = rotation[p];
      if (!player) return;
      // Ne pas écraser un poste déjà manuellement assigné
      if (player.defaultRoles.some(r =>
        r === 'setter' || r === 'receiver' || r === 'central' || r === 'pointu'
      )) return;
      // Les clés de l'objet JS sont des strings → on essaie les deux formes
      const modelRoles: PlayerRole[] = (rolesForRot[p] ?? (rolesForRot as any)[String(p)]) ?? [];
      const primary = primaryRole(modelRoles);
      if (primary) updatePlayer(team, p, player.number, player.name, [primary]);
    });
  };

  const handleSetRole = (r: PlayerRole) => {
    if (!popup || !popupPlayer) return;
    updatePlayer(popup.team, popup.pos, popupPlayer.number, popupPlayer.name, [r]);
    if (r === 'setter') autoAssignFromSetter(popup.team, popup.pos);
    // Ferme si le numéro est déjà choisi, sinon reste ouvert pour le saisir
    if (popupPlayer.number > 0) setPopup(null);
  };

  const handleComplete = async () => {
    setSaving(true);
    try { await saveMatch(useMatchStore.getState()); } catch (_) { /* hors-ligne ok */ }
    setSaving(false);
    onComplete();
  };

  const renderHalf = (team: TeamSide) => {
    const rotation  = team === 'home' ? rotationHome : rotationAway;
    const posLayout = team === 'home' ? HOME_POS : AWAY_POS;
    const teamColor = team === 'home' ? '#FFD700' : '#ff8a65';
    const name      = team === 'home' ? teamHomeName : teamAwayName;

    return (
      <>
        {/* Ligne d'attaque */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 1,
          background: 'rgba(255,255,255,0.2)', pointerEvents: 'none',
          ...(team === 'home' ? { top: '33%' } : { bottom: '33%' }),
        }} />
        {/* Nom équipe */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: 7, fontWeight: 700, color: teamColor, letterSpacing: '0.08em',
          pointerEvents: 'none', whiteSpace: 'nowrap',
          ...(team === 'home' ? { bottom: 2 } : { top: 2 }),
        }}>
          {name.toUpperCase()}
        </div>
        {/* Dots joueurs */}
        {([1, 2, 3, 4, 5, 6] as Position[]).map(pos => {
          const player = rotation[pos];
          if (!player) return null;
          const [px, py] = posLayout[pos];
          const isServingP1 = pos === 1 && servingTeam === team;
          const finalY = isServingP1 ? (team === 'home' ? 118 : -18) : py;
          return (
            <PositionDot key={pos}
              pos={pos} player={player} x={px} y={finalY}
              isSelected={popup?.team === team && popup?.pos === pos}
              isServer={isServingP1}
              team={team}
              onTap={(cx, cy) => handleDotTap(team, pos, cx, cy)}
            />
          );
        })}
      </>
    );
  };

  const takenForPopup = popup?.team === 'home' ? takenHome : takenAway;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Titre */}
      <div>
        <h2 style={{ color: '#FFD700', fontSize: 14, fontWeight: 800, margin: 0 }}>
          Rotation de départ
        </h2>
        <p style={{ color: '#a0998e', fontSize: 10, margin: '3px 0 0' }}>
          Touchez un cercle → choisissez le n° puis le poste. Placer le passeur assigne les autres postes automatiquement.
        </p>
      </div>

      {/* ── Terrain + libéros ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>

        {/* Libéro Adverse (gauche) */}
        <LiberoCard
          team="away"
          teamName={teamAwayName}
          number={liberoAway?.number ?? 0}
          takenNumbers={takenAway}
          onChange={n => setLibero('away', n)}
        />

        {/* Terrain centré */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            position: 'relative', height: 'min(42vh, 240px)', aspectRatio: '1 / 2',
            border: '2px solid rgba(255,255,255,0.55)', flexShrink: 0, overflow: 'visible',
          }}>
            {/* Demi-terrain Adverse (haut) */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '50.5%', background: '#1c3a2a', overflow: 'visible' }}>
              {renderHalf('away')}
            </div>
            {/* Filet */}
            <div style={{
              position: 'absolute', top: '49.5%', left: -3, right: -3, height: '1.3%',
              background: '#FFD700', boxShadow: '0 0 6px rgba(255,215,0,0.5)', zIndex: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 5, fontWeight: 800, color: '#111', letterSpacing: '0.1em', pointerEvents: 'none' }}>FILET</span>
            </div>
            {/* Demi-terrain Domicile (bas) */}
            <div style={{ position: 'absolute', top: '50.5%', left: 0, right: 0, bottom: 0, background: '#1c3a2a', overflow: 'visible' }}>
              {renderHalf('home')}
            </div>
          </div>
        </div>

        {/* Libéro Domicile (droite) */}
        <LiberoCard
          team="home"
          teamName={teamHomeName}
          number={liberoHome?.number ?? 0}
          takenNumbers={takenHome}
          onChange={n => setLibero('home', n)}
        />
      </div>

      {/* ── Légende ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {POSITION_ROLES.map(({ role, label, short, color }) => (
          <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 10, color, fontWeight: 800 }}>{short}</span>
            <span style={{ fontSize: 8, color: '#5a554e' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 10, color: '#4fc3f7', fontWeight: 800 }}>L</span>
          <span style={{ fontSize: 8, color: '#5a554e' }}>Libéro</span>
        </div>
      </div>

      {/* ── Qui sert en premier ? ─────────────────────────────────────────── */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#a0998e', letterSpacing: '0.06em', marginBottom: 6 }}>
          QUI SERT EN PREMIER ?
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['home', 'away'] as TeamSide[]).map(t => {
            const active = servingTeam === t;
            const c      = t === 'home' ? '#FFD700' : '#ff8a65';
            const label  = t === 'home' ? teamHomeName : teamAwayName;
            return (
              <button key={t} onPointerDown={() => setServingTeam(t)} style={{
                flex: 1, padding: '6px', fontSize: 10, fontWeight: 700,
                borderRadius: 6, cursor: 'pointer',
                background: active ? c + '22' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${active ? c + '80' : 'rgba(255,255,255,0.1)'}`,
                color: active ? c : '#a0998e',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {active ? '🏐 ' : ''}{label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 8, color: '#5a554e', marginTop: 4 }}>
          Le joueur en position 1 (🏐) servira en premier.
        </div>
      </div>

      {/* ── Confirmer ─────────────────────────────────────────────────────── */}
      <button
        onPointerDown={handleComplete}
        disabled={saving}
        style={{
          width: '100%', padding: '11px 18px', fontSize: 13, fontWeight: 800,
          borderRadius: 10, border: 'none', minHeight: 42,
          cursor: saving ? 'default' : 'pointer',
          background: saving ? 'rgba(255,255,255,0.05)' : '#FFD700',
          color: saving ? '#a0998e' : '#111',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? '⏳ Sauvegarde…' : 'Commencer le match →'}
      </button>

      {/* ── Popup flottant ─────────────────────────────────────────────────── */}
      {popup && popupPlayer && (
        <FloatingEditPopup
          player={popupPlayer}
          team={popup.team}
          pos={popup.pos}
          anchorX={popup.anchorX}
          anchorY={popup.anchorY}
          takenNumbers={takenForPopup}
          onUpdateNum={handleUpdateNum}
          onSetRole={handleSetRole}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
