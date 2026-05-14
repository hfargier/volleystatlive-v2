// src/components/court/CourtWithServer.tsx
import React, { useCallback } from 'react';
import type { TeamSide, Position, AnyQuality } from '../../types';
import { useMatchStore } from '../../store/matchStore';

interface Dot {
  id: string;
  x: number; y: number;
  team: TeamSide;
  kind: string;
  quality: AnyQuality | null;
}

interface Props {
  servingTeam: TeamSide;
  onCourtClick: (x: number, y: number, team: TeamSide) => void;
  onServiceFault: () => void;
  onUndo: () => void;
  dots: Dot[];
  highlightTeam: TeamSide | null;
  instruction: string;
  selectedActionId: string | null;
  onDotTap: (actionId: string) => void;
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
  5:[83,75], 6:[50,75], 4:[17,75],
  2:[83,25], 3:[50,25],
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
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position:'absolute', top:14, bottom:14, left:0, right:0,
          width:'100%', height:'calc(100% - 28px)',
          pointerEvents:'none', zIndex:7 }}>
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
            style={{
              position: 'absolute',
              left: `calc(${g.gx * 100}% - 11px)`,
              top:  `calc(14px + ${g.gy * 100} * (100% - 28px) / 100 - 11px)`,
              padding: 11,
              margin: -11,
              zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'none',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: isSelected ? color + '35' : qualityBg(dot.quality),
              border: '1px solid ' + (isSelected ? color : color + '70'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isSelected ? '0 0 5px ' + color + '50' : 'none',
              transition: 'all 0.1s',
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800,
                color: isSelected ? color : color + 'bb',
                lineHeight: 1,
              }}>
                {letter}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

function PlayerCircle({ number, team }: { number: number; team: TeamSide }) {
  const c = team === 'home' ? '#FFD700' : '#ff8a65';
  return (
    <div style={{
      width:26, height:26, borderRadius:'50%',
      background: c+'18', border:'1.5px solid '+c,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:10, fontWeight:800, color:c,
      position:'absolute', transform:'translate(-50%,-50%)',
      pointerEvents:'none', zIndex:3,
    }}>{number}</div>
  );
}

function ServerBadge({ number, team, onFault }: {
  number: number; team: TeamSide; onFault: () => void;
}) {
  const c = team === 'home' ? '#FFD700' : '#ff8a65';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      {team === 'away' && <div style={{ fontSize:12, color:c }}>▼</div>}
      <div style={{ width:30, height:30, borderRadius:'50%', background:c, color:'#111', fontSize:12, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid rgba(255,255,255,0.25)', boxShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>{number}</div>
      {team === 'home' && <div style={{ fontSize:12, color:c }}>▲</div>}
      <button onClick={onFault} style={{ background:'rgba(244,67,54,0.2)', border:'1px solid #f44336', borderRadius:4, padding:'2px 5px', fontSize:8, fontWeight:700, color:'#f44336', cursor:'pointer', minWidth:30, textAlign:'center' }}>Faute</button>
    </div>
  );
}

export function CourtWithServer({
  servingTeam, onCourtClick, onServiceFault, onUndo,
  dots, highlightTeam, instruction, selectedActionId, onDotTap,
}: Props) {
  const rotationHome = useMatchStore((s) => s.rotationHome);
  const rotationAway = useMatchStore((s) => s.rotationAway);
  const teamHomeName = useMatchStore((s) => s.teamHomeName);
  const teamAwayName = useMatchStore((s) => s.teamAwayName);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>, team: TeamSide) => {
    const r = e.currentTarget.getBoundingClientRect();
    onCourtClick((e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, team);
  }, [onCourtClick]);

  const renderPlayers = (team: TeamSide) => {
    const rot    = team === 'home' ? rotationHome : rotationAway;
    const layout = team === 'home' ? HOME_LAYOUT : AWAY_LAYOUT;
    if (!rot) return null;
    return (Object.entries(layout) as [string,[number,number]][]).map(([ps,[px,py]]) => {
      const n = parseInt(ps, 10);
      if (n < 1 || n > 6) return null;
      const player = rot[n as Position];
      if (!player) return null;
      return (
        <div key={n} style={{ position:'absolute', left:px+'%', top:py+'%' }}>
          <PlayerCircle number={player.number} team={team}/>
        </div>
      );
    });
  };

  const halfStyle = (team: TeamSide): React.CSSProperties => ({
    flex:1, position:'relative', cursor:'default', overflow:'hidden',
    background: highlightTeam===team
      ? (team==='home' ? 'rgba(255,215,0,0.07)' : 'rgba(255,138,101,0.07)')
      : '#1c3a2a',
    outline: highlightTeam===team
      ? '1px solid '+(team==='home' ? 'rgba(255,215,0,0.3)' : 'rgba(255,138,101,0.3)')
      : 'none',
    transition: 'background 0.15s',
  });

  const srvHome = rotationHome?.[1]?.number ?? 0;
  const srvAway = rotationAway?.[1]?.number ?? 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', width:'100%', overflow:'visible' }}>

      <div style={{ height:68, flexShrink:0, display:'flex', alignItems:'flex-end', justifyContent:'flex-start', paddingLeft:8, paddingBottom:4, overflow:'visible' }}>
        {servingTeam === 'away' && <ServerBadge number={srvAway} team="away" onFault={onServiceFault}/>}
      </div>

      <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', overflow:'visible' }}>
        <div style={{
          height:'100%', aspectRatio:'1/2',
          display:'flex', flexDirection:'column',
          border:'2px solid rgba(255,255,255,0.6)',
          overflow:'hidden', flexShrink:0,
          position:'relative',
        }}>
          <FullCourtTrajectory dots={dots} selectedActionId={selectedActionId} onDotTap={onDotTap}/>

          <div style={{ height:14, flexShrink:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:9 }}>
            <span style={{ fontSize:8, fontWeight:700, color:'#ff8a65', letterSpacing:'0.1em', textTransform:'uppercase' }}>{teamAwayName.substring(0,14)}</span>
          </div>

          <div style={halfStyle('away')} onClick={(e) => handleClick(e,'away')}>
            <div style={{ position:'absolute', left:0, right:0, bottom:'33%', height:1, background:'rgba(255,255,255,0.22)', pointerEvents:'none', zIndex:2 }}/>
            {renderPlayers('away')}
          </div>

          <div style={{ height:5, flexShrink:0, background:'#FFD700', boxShadow:'0 0 8px rgba(255,215,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:9 }}>
            <span style={{ fontSize:7, fontWeight:800, color:'#111', letterSpacing:'0.15em' }}>FILET</span>
          </div>

          <div style={halfStyle('home')} onClick={(e) => handleClick(e,'home')}>
            <div style={{ position:'absolute', left:0, right:0, top:'33%', height:1, background:'rgba(255,255,255,0.22)', pointerEvents:'none', zIndex:2 }}/>
            {renderPlayers('home')}
          </div>

          <div style={{ height:14, flexShrink:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', zIndex:9 }}>
            <span style={{ fontSize:8, fontWeight:700, color:'#FFD700', letterSpacing:'0.1em', textTransform:'uppercase' }}>{teamHomeName.substring(0,14)}</span>
          </div>
        </div>
      </div>

      <div style={{ height:68, flexShrink:0, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:4, gap:8, overflow:'visible' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'center', gap:4 }}>
          <span style={{ fontSize:9, color:'#a0998e', fontStyle:'italic', textAlign:'right', maxWidth:110 }}>{instruction}</span>
          <button onClick={onUndo} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, background:'#2a2a2a', border:'1px solid rgba(255,255,255,0.1)', color:'#a0998e', fontSize:10, fontWeight:700, cursor:'pointer', minHeight:28 }}>
            <span style={{ fontSize:14 }}>↩</span> Annuler
          </button>
        </div>
        {servingTeam === 'home' && <ServerBadge number={srvHome} team="home" onFault={onServiceFault}/>}
      </div>
    </div>
  );
}
