/**
 * Repository factory — the one switch between the local mock and the backend.
 *
 * Deployment target: Cloudflare Pages (static) + Supabase Free.
 *   - No VITE_SUPABASE_* configured   -> MockHealthRepository (localStorage, default)
 *   - Both VITE_SUPABASE_* configured -> SupabaseHealthRepository (browser -> Supabase Auth + REST)
 *
 * There is deliberately no server/worker tier here: Pages only serves the bundle,
 * and every statistic is computed in the browser by the pure functions in `src/domain`.
 */

import { HealthRepository } from './healthRepository';
import { MockHealthRepository } from './mockHealthRepository';
import { SupabaseHealthRepository } from './supabaseHealthRepository';

export type RepositoryKind = 'mock' | 'supabase';

export interface SupabaseEnv {
  url?: string;
  anonKey?: string;
}

export function readSupabaseEnv(): SupabaseEnv {
  try {
    return {
      url: import.meta.env?.VITE_SUPABASE_URL,
      anonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY,
    };
  } catch {
    return {};
  }
}

export function resolveRepositoryKind(env: SupabaseEnv = readSupabaseEnv()): RepositoryKind {
  return env.url && env.anonKey ? 'supabase' : 'mock';
}

export function createHealthRepository(kind: RepositoryKind = resolveRepositoryKind()): HealthRepository {
  if (kind === 'supabase') {
    const env = readSupabaseEnv();
    return new SupabaseHealthRepository({ url: env.url!, anonKey: env.anonKey! });
  }
  return new MockHealthRepository();
}

/** Which implementation this build resolved to（页面据此决定是否显示登录页）。 */
export const repositoryKind: RepositoryKind = resolveRepositoryKind();

/** The singleton the UI talks to. */
export const healthRepository: HealthRepository = createHealthRepository();
