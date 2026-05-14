import React from 'react';
import type { CourtZone } from '../../types';

const ZONE_CENTERS: Record<string, { x: number; y: number }> = {
  Z1: { x: 83, y: 83 }, Z2: { x: 50, y: 83 }, Z3: { x: 17, y: 83 },
  Z4: { x: 17, y: 33 }, Z5: { x: 50, y: 33 }, Z6: { x: 83, y: 33 },
};

interface Props { receptionZone: CourtZone | null; setZone: CourtZone | null; attackZone: CourtZone | null; }

function Dot({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} fillOpacity={0.9} />
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.2} />
    </g>
  );
}

function Arrow({ from, to, color, id }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; id: string }) {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - 12;
  const d = 'M ' + from.x + ' ' + from.y + ' Q ' + cx + ' ' + cy + ' ' + to.x + ' ' + to.y;
  return (
    <g>
      <defs>
        <marker id={'arr-' + id} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <polygon points="0 0, 6 3, 0 6" fill={color} fillOpacity={0.8} />
        </marker>
      </defs>
      <path d={d} stroke={color} strokeWidth="2" strokeOpacity={0.8} fill="none" strokeDasharray="4 2" markerEnd={'url(#arr-' + id + ')'} />
    </g>
  );
}

export function TrajectoryOverlay({ receptionZone, setZone, attackZone }: Props) {
  const rec = receptionZone ? ZONE_CENTERS[receptionZone] : null;
  const set = setZone ? ZONE_CENTERS[setZone] : null;
  const atk = attackZone ? ZONE_CENTERS[attackZone] : null;
  if (!rec && !set && !atk) return null;
  return (
    <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }} preserveAspectRatio="none">
      {rec && set && <Arrow from={rec} to={set} color="#ce93d8" id="rs" />}
      {set && atk && <Arrow from={set} to={atk} color="#ff8a65" id="sa" />}
      {rec && <Dot cx={rec.x} cy={rec.y} color="#81c784" />}
      {set && <Dot cx={set.x} cy={set.y} color="#ce93d8" />}
      {atk && <Dot cx={atk.x} cy={atk.y} color="#ff8a65" />}
    </svg>
  );
}