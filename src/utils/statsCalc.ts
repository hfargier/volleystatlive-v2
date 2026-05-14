// src/utils/statsCalc.ts
// Adapté au nouveau modèle : Rally.actions contient des RallyAction atomiques.
// Plus de Phase2Action / Phase3Action séparés.

import type { Rally, RallyAction, TeamSide, PhaseType, CourtZone } from '../types';

export function getAllActions(rallies: Rally[]): RallyAction[] {
  return rallies.flatMap((r) => r.actions);
}

// ============================================================
// Distribution du passeur (actions kind='set')
// ============================================================
export interface SetterDistributionItem {
  zone: CourtZone;
  count: number;
  percentage: number;
}

export function calcSetterDistribution(
  rallies: Rally[],
  phase: 'P2' | 'P3',
  team?: TeamSide
): SetterDistributionItem[] {
  const actions = getAllActions(rallies).filter(
    (a) => a.kind === 'set' && a.phase === phase && (!team || a.team === team) && a.zone
  );

  const counts: Record<string, number> = {};
  actions.forEach((a) => {
    const z = a.zone as string;
    counts[z] = (counts[z] ?? 0) + 1;
  });

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return Object.entries(counts)
    .map(([zone, count]) => ({
      zone: zone as CourtZone,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================
// Efficacité attaquants (actions kind='attack')
// ============================================================
export interface AttackEfficiencyItem {
  playerId: string;
  total: number;
  points: number;
  errors: number;
  blocked: number;
  defended: number;
  efficiency: number;
}

export function calcAttackEfficiency(
  rallies: Rally[],
  phase?: PhaseType,
  team?: TeamSide
): AttackEfficiencyItem[] {
  const actions = getAllActions(rallies).filter(
    (a) =>
      a.kind === 'attack' &&
      (!phase || a.phase === phase) &&
      (!team || a.team === team)
  );

  const byPlayer: Record<string, AttackEfficiencyItem> = {};

  actions.forEach((a) => {
    const pid = a.playerId ?? 'inconnu';
    if (!byPlayer[pid]) {
      byPlayer[pid] = {
        playerId: pid, total: 0,
        points: 0, errors: 0, blocked: 0, defended: 0, efficiency: 0,
      };
    }
    byPlayer[pid].total++;
    if (a.quality === 'A++')     byPlayer[pid].points++;
    else if (a.quality === 'A-') byPlayer[pid].errors++;
    else if (a.quality === 'A=') byPlayer[pid].blocked++;
    else if (a.quality === 'A+') byPlayer[pid].defended++;
  });

  return Object.values(byPlayer).map((item) => ({
    ...item,
    efficiency: item.total > 0
      ? Math.round(((item.points - item.errors) / item.total) * 100)
      : 0,
  }));
}

// ============================================================
// Stats réception (actions kind='reception')
// ============================================================
export interface ReceptionStatItem {
  playerId: string;
  total: number;
  zip: number;
  rPlus: number;
  rEqual: number;
  rMinus: number;
  positiveRate: number;
}

export function calcReceptionStats(
  rallies: Rally[],
  team?: TeamSide
): ReceptionStatItem[] {
  const actions = getAllActions(rallies).filter(
    (a) => a.kind === 'reception' && (!team || a.team === team)
  );

  const byPlayer: Record<string, ReceptionStatItem> = {};

  actions.forEach((a) => {
    const pid = a.playerId ?? 'inconnu';
    if (!byPlayer[pid]) {
      byPlayer[pid] = {
        playerId: pid, total: 0,
        zip: 0, rPlus: 0, rEqual: 0, rMinus: 0, positiveRate: 0,
      };
    }
    byPlayer[pid].total++;
    if (a.quality === 'Zip')     byPlayer[pid].zip++;
    else if (a.quality === 'R+') byPlayer[pid].rPlus++;
    else if (a.quality === 'R=') byPlayer[pid].rEqual++;
    else if (a.quality === 'R-') byPlayer[pid].rMinus++;
  });

  return Object.values(byPlayer).map((item) => ({
    ...item,
    positiveRate: item.total > 0
      ? Math.round(((item.zip + item.rPlus) / item.total) * 100)
      : 0,
  }));
}

// ============================================================
// Heatmap zones d'attaque
// ============================================================
export interface HeatmapZoneData {
  zone: CourtZone;
  count: number;
  intensity: number;
}

export function calcAttackHeatmap(
  rallies: Rally[],
  phase?: PhaseType,
  team?: TeamSide
): HeatmapZoneData[] {
  const actions = getAllActions(rallies).filter(
    (a) =>
      a.kind === 'attack' &&
      (!phase || a.phase === phase) &&
      (!team || a.team === team) &&
      a.zone
  );

  const counts: Record<string, number> = {};
  actions.forEach((a) => {
    const z = a.zone as string;
    counts[z] = (counts[z] ?? 0) + 1;
  });

  const max = Math.max(...Object.values(counts), 1);
  return Object.entries(counts).map(([zone, count]) => ({
    zone: zone as CourtZone,
    count,
    intensity: count / max,
  }));
}

// ============================================================
// Stats par opposition (12 combos rotation)
// ============================================================
export interface OppositionStat {
  label: string;
  homeSetterPos: number;
  awaySetterPos: number;
  totalRallies: number;
  homeWins: number;
  awayWins: number;
  homeWinRate: number;
}

export function calcOppositionStats(rallies: Rally[]): OppositionStat[] {
  const map: Record<string, OppositionStat> = {};

  rallies.forEach((r) => {
    const key = 'P' + r.rotationHome[1]?.position + '-P' + r.rotationAway[1]?.position;
    if (!map[key]) {
      map[key] = {
        label: key,
        homeSetterPos: r.rotationHome[1]?.position ?? 1,
        awaySetterPos: r.rotationAway[1]?.position ?? 1,
        totalRallies: 0, homeWins: 0, awayWins: 0, homeWinRate: 0,
      };
    }
    map[key].totalRallies++;
    if (r.winner === 'home') map[key].homeWins++;
    if (r.winner === 'away') map[key].awayWins++;
  });

  return Object.values(map).map((item) => ({
    ...item,
    homeWinRate: item.totalRallies > 0
      ? Math.round((item.homeWins / item.totalRallies) * 100)
      : 0,
  }));
}
