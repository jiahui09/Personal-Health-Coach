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
  CreateLifeLogInput,
  CreateMealInput,
  CreateNoteInput,
  CreateTodoInput,
  CreateWorkoutInput,
  DailyNote,
  DailyState,
  LifeLog,
  MealRecord,
  TodayData,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';

/** Authenticated principal. `id` becomes `user_id` on every row (RLS scope). */
export interface AuthUser {
  id: string;
  email: string | null;
  /** True for the local, storage-only user served by MockHealthRepository. */
  isDemo: boolean;
}

export type RepositoryErrorCode =
  | 'network' // transport failure: offline, DNS, CORS, 5xx
  | 'auth' // signed out / token expired / bad credentials
  | 'conflict' // concurrent write, unique constraint violated
  | 'not_found' // row missing or owned by someone else
  | 'not_implemented' // backend stub not wired yet
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
  // ---- Identity (scopes every row, enables RLS) ----
  getCurrentUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Returns an unsubscribe function. */
  onAuthChange(listener: (user: AuthUser | null) => void): () => void;

  // ---- Profile ----
  getProfile(): Promise<UserProfile>;
  updateProfile(patch: Partial<UserProfile>): Promise<UserProfile>;

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
  deleteTodo(id: string): Promise<void>;

  // ---- Life Logs (LIFE domain) ----
  getLifeLogs(since?: string): Promise<LifeLog[]>;
  addLifeLog(input: CreateLifeLogInput): Promise<LifeLog>;

  // ---- Daily Notes ----
  getNotes(since?: string): Promise<DailyNote[]>;
  addNote(input: CreateNoteInput): Promise<DailyNote>;

  // ---- Demo data ----
  /**
   * DEMO ONLY: re-seeds the local/演示 dataset (relative to the injected clock). On a backend implementation this
   * must NEVER delete user rows — it should either throw `not_implemented` or be
   * restricted to an explicitly flagged demo account.
   */
  resetToDefault(): Promise<void>;
}
