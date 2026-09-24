/**
 * HealthRepository Interface Definition
 * Single source of truth for health data access.
 * Completely decouples UI from Mock or Supabase data sources.
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

export interface HealthRepository {
  getProfile(): Promise<UserProfile>;
  getToday(): Promise<TodayData>;

  getMeals(): Promise<MealRecord[]>;
  addMeal(input: CreateMealInput): Promise<MealRecord>;
  deleteMeal(id: string): Promise<void>;

  getWorkouts(): Promise<WorkoutRecord[]>;
  addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord>;
  completeTodayWorkout(): Promise<void>;

  getDailyState(): Promise<DailyState>;
  saveDailyState(input: CreateDailyStateInput): Promise<DailyState>;

  getWeightHistory(): Promise<WeightRecord[]>;
  addWeight(weight: number, date?: string): Promise<WeightRecord>;

  resetToDefault(): Promise<void>;
}
