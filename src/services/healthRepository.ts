/**
 * HealthRepository Interface Definition (V3 Living Journal)
 * Single source of truth for health and living journal data access.
 * Decouples UI from the Mock (localStorage) and the backend (Supabase) implementations.
 *
 * Target deployment: Cloudflare Pages (static host) + Supabase Free (Postgres + Auth).
 * There is no server tier in the request path — the UI talks to Supabase REST
 * directly and the deterministic decision engine always runs in the client.
 * That is why the interface below carries identity (for row level security) and
 * explicit error codes instead of raw `throw new Error(...)`.
 */

import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateTodoInput,
  CreateWorkoutInput,
  DailyState,
  MealRecord,
  TodayData,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';

/** 手记身份：账号只是归属标记（手记名 → user_id）,不设密码与邮件。 */
export interface Account {
  /** 落到各行 user_id 列的归属标记。 */
  id: string;
  /** 手记名（显示用;同名即同库）。 */
  name: string;
  /** True for the local, storage-only user served by MockHealthRepository. */
  isDemo: boolean;
}

export type RepositoryErrorCode =
  | 'network' // transport failure: offline, DNS, CORS, 5xx
  | 'auth' // 尚未打开手记（无归属标记）,或请求被 RLS/键策略拒绝
  | 'rate_limited' // provider throttling (HTTP 429)
  | 'conflict' // concurrent write, unique constraint violated
  | 'not_found' // row missing or owned by someone else
  | 'not_implemented' // backend stub not wired yet
  | 'schema' // 云库结构落后于代码（旧外键/缺列）:全文重跑 supabase/schema.sql
  | 'unknown';

/** Single error vocabulary so the UI can map a failure to a message and a retry. */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

/** Normalises anything thrown by an implementation into a RepositoryError. */
export function toRepositoryError(err: unknown): RepositoryError {
  if (err instanceof RepositoryError) return err;
  if (err instanceof Error) return new RepositoryError('unknown', err.message, { cause: err });
  return new RepositoryError('unknown', String(err));
}

export interface HealthRepository {
  // ---- Identity (scopes every row by the account marker) ----
  getCurrentUser(): Promise<Account | null>;
  /**
   * 打开手记：手记名即账号——无密码、无邮件、无验证。
   * 同一个名字在任何设备派生同一个 user_id,因此「同名即同库」。
   */
  enterByName(name: string): Promise<Account>;
  signOut(): Promise<void>;
  /** Returns an unsubscribe function. */
  onAccountChange(listener: (account: Account | null) => void): () => void;

  // ---- Profile ----
  getProfile(): Promise<UserProfile>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;

  /**
   * 本机是否已选好归属标记。
   * 真 → 直接读写该名下的数据；假 → 先到账号门写下手记名。
   */
  hasAccount(): boolean;

  // ---- Aggregated view ----
  getToday(): Promise<TodayData>;

  // ---- Meals ----
  getMeals(since?: string): Promise<MealRecord[]>;
  addMeal(input: CreateMealInput): Promise<MealRecord>;
  deleteMeal(id: string): Promise<void>;

  // ---- Workouts ----
  getWorkouts(since?: string): Promise<WorkoutRecord[]>;
  addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord>;
  completeTodayWorkout(): Promise<void>;

  // ---- Daily State & Body (each day is its own record; there is no single "today" row) ----
  getDailyState(date?: string): Promise<DailyState | null>;
  getDailyStates(since?: string): Promise<DailyState[]>;
  saveDailyState(input: CreateDailyStateInput): Promise<DailyState>;

  // ---- Weights ----
  getWeightHistory(since?: string): Promise<WeightRecord[]>;
  addWeight(
    weight: number,
    date?: string,
    options?: { time?: string; source?: WeightRecord['source'] }
  ): Promise<WeightRecord>;

  // ---- Todos (TODAY domain) ----
  getTodos(since?: string): Promise<TodoItem[]>;
  addTodo(input: CreateTodoInput): Promise<TodoItem>;
  toggleTodo(id: string): Promise<TodoItem>;
  /** 改预计时长：数字即改，null 即「取消时长」（页面回显「—」）。 */
  updateTodo(id: string, patch: { estimatedMinutes?: number | null }): Promise<TodoItem>;
  deleteTodo(id: string): Promise<void>;

  // ---- Demo data ----
  /**
   * DEMO ONLY: re-seeds the local/演示 dataset (relative to the injected clock). On a backend implementation this
   * must NEVER delete user rows — it should either throw `not_implemented` or be
   * restricted to an explicitly flagged demo account.
   */
  resetToDefault(): Promise<void>;
}
