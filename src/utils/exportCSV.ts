// src/utils/exportCSV.ts
// Adapté au nouveau modèle : actions atomiques (RallyAction).

import type { Rally } from '../types';

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(esc).join(',');
}

export function exportToCSV(rallies: Rally[], matchName: string): void {
  const headers = [
    'PointNum', 'Set', 'ScoreHome', 'ScoreAway', 'ServingTeam',
    'Winner', 'ActionId', 'Phase', 'SubPhase', 'Kind', 'Team',
    'Zone', 'PlayerId', 'Quality', 'Timestamp',
  ];

  const lines: string[] = [row(headers)];

  rallies.forEach((rally) => {
    rally.actions.forEach((a) => {
      lines.push(row([
        rally.pointNumber,
        rally.setNumber,
        rally.scoreHome,
        rally.scoreAway,
        rally.servingTeam,
        rally.winner ?? '',
        a.id,
        a.phase,
        a.subPhase,
        a.kind,
        a.team,
        a.zone ?? '',
        a.playerId ?? '',
        a.quality ?? '',
        a.timestamp,
      ]));
    });
  });

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = matchName.replace(/\s+/g, '_') + '_' + Date.now() + '.csv';
  link.click();
  URL.revokeObjectURL(url);
}
