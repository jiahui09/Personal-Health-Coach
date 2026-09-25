/**
 * HealthRepository Interface Definition (V3 Living Journal)
 * Single source of truth for health and living journal data access.
 * Decouples UI from Mock or future backend data sources.
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

export interface HealthRepository {
  getProfile(): Promise<UserProfile>;
  getToday(): Promise<TodayData>;

  // Meals
  getMeals(): Promise<MealRecord[]>;
  addMeal(input: CreateMealInput): Promise<MealRecord>;
  deleteMeal(id: string): Promise<void>;

  // Workouts
  getWorkouts(): Promise<WorkoutRecord[]>;
  addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord>;
  completeTodayWorkout(): Promise<void>;

  // Daily State & Body
  getDailyState(): Promise<DailyState>;
  saveDailyState(input: CreateDailyStateInput): Promise<DailyState>;

  // Weights
  getWeightHistory(): Promise<WeightRecord[]>;
  addWeight(weight: number, date?: string): Promise<WeightRecord>;

  // Todos (TODAY domain)
  getTodos(): Promise<TodoItem[]>;
  addTodo(input: CreateTodoInput): Promise<TodoItem>;
  toggleTodo(id: string): Promise<TodoItem>;
  deleteTodo(id: string): Promise<void>;

  // Life Logs (LIFE domain)
  getLifeLogs(): Promise<LifeLog[]>;
  addLifeLog(input: CreateLifeLogInput): Promise<LifeLog>;

  // Daily Notes
  addNote(input: CreateNoteInput): Promise<DailyNote>;

  // System
  resetToDefault(): Promise<void>;
}
