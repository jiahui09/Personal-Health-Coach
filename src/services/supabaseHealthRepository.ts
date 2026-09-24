/**
 * SupabaseHealthRepository (Future Architectural Stub)
 *
 * Implements the HealthRepository interface for future PostgreSQL sync.
 */

import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  DailyState,
  MealRecord,
  TodayData,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import { HealthRepository } from './healthRepository';

export class SupabaseHealthRepository implements HealthRepository {
  async getProfile(): Promise<UserProfile> {
    throw new Error('SupabaseHealthRepository not connected yet. Use MockHealthRepository.');
  }

  async getToday(): Promise<TodayData> {
    throw new Error('SupabaseHealthRepository not connected yet. Use MockHealthRepository.');
  }

  async getMeals(): Promise<MealRecord[]> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async addMeal(_input: CreateMealInput): Promise<MealRecord> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async deleteMeal(_id: string): Promise<void> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async getWorkouts(): Promise<WorkoutRecord[]> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async addWorkout(_input: CreateWorkoutInput): Promise<WorkoutRecord> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async completeTodayWorkout(): Promise<void> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async getDailyState(): Promise<DailyState> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async saveDailyState(_input: CreateDailyStateInput): Promise<DailyState> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async getWeightHistory(): Promise<WeightRecord[]> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async addWeight(_weight: number, _date?: string): Promise<WeightRecord> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }

  async resetToDefault(): Promise<void> {
    throw new Error('SupabaseHealthRepository not connected yet.');
  }
}
