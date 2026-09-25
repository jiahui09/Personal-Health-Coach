/**
 * SupabaseHealthRepository (Future Architectural Stub)
 *
 * Implements the HealthRepository interface for the Supabase Free backend
 * (Postgres + Auth, called directly from the browser — see README "部署方案").
 * Every method fails fast with a typed `not_implemented` error so the UI can
 * report the actual reason instead of an opaque crash.
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
import { AuthUser, HealthRepository, RepositoryError } from './healthRepository';

export class SupabaseHealthRepository implements HealthRepository {
  private fail(method: string): never {
    throw new RepositoryError(
      'not_implemented',
      `SupabaseHealthRepository.${method}() is not wired yet. Set VITE_SUPABASE_URL / ` +
        `VITE_SUPABASE_ANON_KEY and implement this method, or run without them to use the local mock.`
    );
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    this.fail('getCurrentUser');
  }

  async signIn(_email: string, _password: string): Promise<AuthUser> {
    this.fail('signIn');
  }

  async signUp(_email: string, _password: string): Promise<AuthUser> {
    this.fail('signUp');
  }

  async signOut(): Promise<void> {
    this.fail('signOut');
  }

  onAuthChange(_listener: (user: AuthUser | null) => void): () => void {
    this.fail('onAuthChange');
  }

  async getProfile(): Promise<UserProfile> {
    this.fail('getProfile');
  }

  async updateProfile(_patch: Partial<UserProfile>): Promise<UserProfile> {
    this.fail('updateProfile');
  }

  async getToday(): Promise<TodayData> {
    this.fail('getToday');
  }

  async getMeals(_since?: string): Promise<MealRecord[]> {
    this.fail('getMeals');
  }

  async addMeal(_input: CreateMealInput): Promise<MealRecord> {
    this.fail('addMeal');
  }

  async deleteMeal(_id: string): Promise<void> {
    this.fail('deleteMeal');
  }

  async getWorkouts(_since?: string): Promise<WorkoutRecord[]> {
    this.fail('getWorkouts');
  }

  async addWorkout(_input: CreateWorkoutInput): Promise<WorkoutRecord> {
    this.fail('addWorkout');
  }

  async completeTodayWorkout(): Promise<void> {
    this.fail('completeTodayWorkout');
  }

  async getDailyState(_date?: string): Promise<DailyState | null> {
    this.fail('getDailyState');
  }

  async getDailyStates(_since?: string): Promise<DailyState[]> {
    this.fail('getDailyStates');
  }

  async saveDailyState(_input: CreateDailyStateInput): Promise<DailyState> {
    this.fail('saveDailyState');
  }

  async getWeightHistory(_since?: string): Promise<WeightRecord[]> {
    this.fail('getWeightHistory');
  }

  async addWeight(
    _weight: number,
    _date?: string,
    _options?: { time?: string; source?: WeightRecord['source'] }
  ): Promise<WeightRecord> {
    this.fail('addWeight');
  }

  async getTodos(_since?: string): Promise<TodoItem[]> {
    this.fail('getTodos');
  }

  async addTodo(_input: CreateTodoInput): Promise<TodoItem> {
    this.fail('addTodo');
  }

  async toggleTodo(_id: string): Promise<TodoItem> {
    this.fail('toggleTodo');
  }

  async deleteTodo(_id: string): Promise<void> {
    this.fail('deleteTodo');
  }

  async getLifeLogs(_since?: string): Promise<LifeLog[]> {
    this.fail('getLifeLogs');
  }

  async addLifeLog(_input: CreateLifeLogInput): Promise<LifeLog> {
    this.fail('addLifeLog');
  }

  async getNotes(_since?: string): Promise<DailyNote[]> {
    this.fail('getNotes');
  }

  async addNote(_input: CreateNoteInput): Promise<DailyNote> {
    this.fail('addNote');
  }

  async resetToDefault(): Promise<void> {
    // Deliberately not implemented: on a backend this would delete real rows.
    this.fail('resetToDefault');
  }
}
