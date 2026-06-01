// src/api/volleyApi.ts
// Client pour l'API VolleyStat Live
import type { MatchState } from '../types';

const BASE = 'https://seme-et-tisse.fr/API/VolleyStatLive/api_volleystatlive.php';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiModel {
  id: number;
  name: string;
  description: string;
  builtin: number; // 1 = non supprimable
  config?: ModelConfig;
  created_at?: string;
}

/** Configuration complète d'un modèle de jeu */
export interface ModelConfig {
  /** Rôles par position (1-6) pour chaque rotation (index 0-5) */
  sideOutRoles: Record<number, Record<number, string[]>>;
  /**
   * Coordonnées XY — perspective HOME (y=0=filet, y=1=fond).
   * Pour AWAY : miroir automatique (1-x, 1-y).
   * Format : rotation (0-5) → position (1-6) → { x, y }
   */
  sideOutPositions?:  Record<number, Record<number, { x: number; y: number }>>;
  blocDefPositions?:  Record<number, Record<number, { x: number; y: number }>>;
  blocDefSPositions?: Record<number, Record<number, { x: number; y: number }>>;
}

export interface MatchMeta {
  match_id:       string;
  team_home_name: string;
  team_away_name: string;
  score_home:     number;
  score_away:     number;
  current_set:    number;
  created_at:     string;
  updated_at:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function call<T>(
  action: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  extra?: Record<string, string>,
): Promise<T> {
  const params = new URLSearchParams({ action, ...extra });
  const res = await fetch(`${BASE}?${params}`, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Erreur API');
  return json.data as T;
}

// ── Init ──────────────────────────────────────────────────────────────────────

/** Initialise les tables BDD (à appeler une fois au démarrage). */
export function initDb(): Promise<{ tables_created: boolean }> {
  return call('init');
}

// ── Modèles ───────────────────────────────────────────────────────────────────

export function listModels(): Promise<ApiModel[]> {
  return call('list_models');
}

export function getModel(id: number): Promise<ApiModel> {
  return call('get_model', 'GET', undefined, { id: String(id) });
}

export function saveModel(model: Omit<ApiModel, 'id' | 'builtin' | 'created_at'> & { id?: number }): Promise<{ id: number; updated?: boolean; created?: boolean }> {
  return call('save_model', 'POST', model);
}

export function deleteModel(id: number): Promise<{ deleted: boolean }> {
  return call('delete_model', 'GET', undefined, { id: String(id) });
}

// ── Matchs ────────────────────────────────────────────────────────────────────

export function listMatches(): Promise<MatchMeta[]> {
  return call('list_matches');
}

export function getMatch(matchId: string): Promise<{ state: MatchState } & MatchMeta> {
  return call('get_match', 'GET', undefined, { match_id: matchId });
}

/** Sauvegarde (upsert) le MatchState complet. */
export function saveMatch(state: MatchState): Promise<{ saved: boolean; matchId: string }> {
  return call('save_match', 'POST', state);
}

export function deleteMatch(matchId: string): Promise<{ deleted: boolean }> {
  return call('delete_match', 'GET', undefined, { match_id: matchId });
}
