// src/utils/exportPDF.ts
// Adapté au nouveau store : scoreHome/scoreAway, rotationHome/rotationAway.

import type { MatchState } from '../types';
import { calcAttackEfficiency, calcReceptionStats, calcSetterDistribution } from './statsCalc';

export async function exportToPDF(state: MatchState): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 14;

  const title = (text: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 215, 0);
    doc.text(text, 12, y);
    y += 8;
  };

  const bodyLine = (text: string) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(text, 16, y);
    y += 5;
    if (y > 270) { doc.addPage(); y = 14; }
  };

  const sep = () => {
    doc.setDrawColor(60, 60, 60);
    doc.line(12, y, W - 12, y);
    y += 5;
  };

  // En-tête
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 215, 0);
  doc.text('VolleyStat Live', W / 2, 10, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(
    state.teamHomeName + ' vs ' + state.teamAwayName +
    '  |  ' + state.scoreHome + ' - ' + state.scoreAway,
    W / 2, 18, { align: 'center' }
  );
  doc.text('Généré le ' + new Date().toLocaleString('fr-FR'), W / 2, 24, { align: 'center' });
  y = 36;

  title('Distribution Passeur — Phase 2');
  const dp2 = calcSetterDistribution(state.rallies, 'P2', 'home');
  dp2.length === 0
    ? bodyLine('Aucune donnée')
    : dp2.forEach((d) => bodyLine('Zone ' + d.zone + ' : ' + d.count + ' passes (' + d.percentage + '%)'));
  sep();

  title('Distribution Passeur — Phase 3');
  const dp3 = calcSetterDistribution(state.rallies, 'P3', 'home');
  dp3.length === 0
    ? bodyLine('Aucune donnée')
    : dp3.forEach((d) => bodyLine('Zone ' + d.zone + ' : ' + d.count + ' passes (' + d.percentage + '%)'));
  sep();

  title('Efficacité Attaquants');
  const eff = calcAttackEfficiency(state.rallies, undefined, 'home');
  eff.length === 0
    ? bodyLine('Aucune donnée')
    : eff.forEach((item) =>
        bodyLine(
          'Joueur ' + item.playerId.substring(0, 8) +
          '  |  Total: ' + item.total +
          '  |  Pts: ' + item.points +
          '  |  Eff: ' + item.efficiency + '%'
        )
      );
  sep();

  title('Stats Réception');
  const rec = calcReceptionStats(state.rallies, 'home');
  rec.length === 0
    ? bodyLine('Aucune donnée')
    : rec.forEach((item) =>
        bodyLine(
          'Joueur ' + item.playerId.substring(0, 8) +
          '  |  Total: ' + item.total +
          '  |  R+: ' + item.rPlus +
          '  |  Taux: ' + item.positiveRate + '%'
        )
      );

  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('VolleyStat Live — rapport auto-généré', W / 2, 288, { align: 'center' });
  doc.save('rapport_match_' + Date.now() + '.pdf');
}
