/**
 * Repository factory — the one switch between the local mock and the backend.
 *
 * Deployment target: Cloudflare Pages (static) + Supabase Free.
 *   - No VITE_SUPABASE_* configured  -> MockHealthRepository (localStorage demo, default)
 *   - Both VITE_SUPABASE_* configured -> SupabaseHealthRepository (client -> Supgabase REST)
 *
 * There is deliberately no server/worker tier here: Pages only serves the bundle,
 * and the decision engine runs in the browser either way (LLM = OFF).
 */

import { HealthRepository } from './healthRepository';
import { MockHealthRepository } from './mockHealthRepository';
import { SupabaseHealthRepository } from './supabaseHealthRepository';

export type RepositoryKind = 'mock' | 'supabase';

export function resolveRepositoryKind(): RepositoryKind {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? 'supabase' : 'mock';
}

export function createHealthRepository(kind: RepositoryKind = resolveRepositoryKind()): HealthRepository {
  return kind === 'supabase' ? new SupabaseHealthRepository() : new MockHealthRepository();
}

/** Which implementation this build resolved to (surfaced in logs / footer). */
export const repositoryKind: RepositoryKind = resolveRepositoryKind();

/** The singleton the UI talks to. */
export const healthRepository: HealthRepository = createHealthRepository();
