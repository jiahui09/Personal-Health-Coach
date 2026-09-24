/**
 * MockHealthRepository Implementation
 * Uses browser localStorage for transparent persistence.
 * Synchronizes with recommendationEngine for rule-based next action computation.
 */

import {
  INITIAL_DAILY_STATE,
  INITIAL_MEALS,
  INITIAL_RECENT_WORKOUTS,
  INITIAL_USER_PROFILE,
  INITIAL_WEIGHT_HISTORY,
  TODAY_STR,
} from '../data/mockData';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  DailyState,
  HealthContext,
  MealRecord,
  TodayData,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import { HealthRepository } from './healthRepository';
import { scientificDecisionEngine } from './scientificDecisionEngine';

const STORAGE_KEYS = {
  PROFILE: 'phc_profile_lean',
  WEIGHTS: 'phc_weights_lean',
  DAILY_STATE: 'phc_state_lean',
  MEALS: 'phc_meals_lean',
  WORKOUTS: 'phc_workouts_lean',
};

function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn(`[MockHealthRepository] Failed reading key ${key}:`, err);
  }
  return fallback;
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[MockHealthRepository] Failed writing key ${key}:`, err);
  }
}

export class MockHealthRepository implements HealthRepository {
  private profile: UserProfile;
  private weightHistory: WeightRecord[];
  private dailyState: DailyState;
  private meals: MealRecord[];
  private workouts: WorkoutRecord[];

  constructor() {
    this.profile = getStorage(STORAGE_KEYS.PROFILE, INITIAL_USER_PROFILE);
    this.weightHistory = getStorage(STORAGE_KEYS.WEIGHTS, INITIAL_WEIGHT_HISTORY);
    this.dailyState = getStorage(STORAGE_KEYS.DAILY_STATE, INITIAL_DAILY_STATE);
    this.meals = getStorage(STORAGE_KEYS.MEALS, INITIAL_MEALS);
    this.workouts = getStorage(STORAGE_KEYS.WORKOUTS, INITIAL_RECENT_WORKOUTS);
  }

  private async sleep(ms: number = 20): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async getProfile(): Promise<UserProfile> {
    await this.sleep(10);
    return this.profile;
  }

  async getToday(): Promise<TodayData> {
    await this.sleep(15);
    const today = TODAY_STR;

    // Weight calculation
    const sortedWeights = [...this.weightHistory].sort((a, b) => a.date.localeCompare(b.date));
    const latestWeightRecord = sortedWeights.find((w) => w.date === today) || sortedWeights[sortedWeights.length - 1];
    const currentWeight = latestWeightRecord ? latestWeightRecord.weight : 68.4;
    const monthStartRecord = sortedWeights.find((w) => w.date === '2026-09-01') || sortedWeights[0];
    const monthDelta = Number((currentWeight - (monthStartRecord?.weight || 69.2)).toFixed(1));

    // Time-aware greeting
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning.';
    if (hour >= 12 && hour < 18) {
      timeGreeting = 'Good afternoon.';
    } else if (hour >= 18 || hour < 5) {
      timeGreeting = 'Good evening.';
    }

    // Nutrition summary
    const todayMeals = this.meals.filter((m) => m.date === today);
    const consumedCalories = todayMeals.reduce((acc, m) => acc + m.estimatedCalories, 0);
    const consumedProtein = todayMeals.reduce((acc, m) => acc + m.estimatedProtein, 0);

    // Workout today
    const todayWorkout = this.workouts.find((w) => w.date === today);

    // Build structured context for recommendation engine
    const context: HealthContext = {
      profile: this.profile,
      currentWeight,
      todayState: this.dailyState,
      todayMeals,
      recentMeals: this.meals,
      recentWorkouts: this.workouts,
      todayWorkout,
      hasIncompleteData: false,
    };

    const nextMeal = scientificDecisionEngine.recommendNextMeal(context);
    const nextWorkout = scientificDecisionEngine.recommendNextWorkout(context);

    // Recent stats
    const workoutsThisWeek = this.workouts.filter((w) => w.completed && w.date >= '2026-09-18').length;
    const weight30dDiff = sortedWeights.length >= 2
      ? Number((sortedWeights[sortedWeights.length - 1].weight - sortedWeights[0].weight).toFixed(1))
      : -0.8;

    return {
      date: today,
      displayDate: 'Thursday, September 24',
      timeGreeting,
      profile: this.profile,
      weight: {
        current: currentWeight,
        monthDelta,
      },
      state: this.dailyState,
      nutritionSummary: {
        consumedCalories,
        targetCalories: this.profile.dailyCalorieTarget,
        consumedProtein,
        targetProtein: this.profile.dailyProteinTarget,
        meals: todayMeals,
      },
      nextMeal,
      nextWorkout,
      recentStats: {
        weightChange30d: weight30dDiff,
        workoutsThisWeek: Math.max(2, workoutsThisWeek),
        avgDailyProtein: 112,
        avgSleepHours: 7.3,
      },
      personalNote: "You've been sleeping a little longer this week. Your training has stayed consistent.",
    };
  }

  async getMeals(): Promise<MealRecord[]> {
    await this.sleep(10);
    return this.meals;
  }

  async addMeal(input: CreateMealInput): Promise<MealRecord> {
    await this.sleep(30);
    const now = new Date();
    const timeStr = input.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newMeal: MealRecord = {
      id: `m-${Date.now()}`,
      date: input.date || TODAY_STR,
      time: timeStr,
      category: input.category,
      name: input.name,
      foods: input.foods || [input.name],
      estimatedCalories: Number(input.estimatedCalories) || 400,
      estimatedProtein: Number(input.estimatedProtein) || 25,
    };

    this.meals.push(newMeal);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    return newMeal;
  }

  async deleteMeal(id: string): Promise<void> {
    await this.sleep(20);
    this.meals = this.meals.filter((m) => m.id !== id);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
  }

  async getWorkouts(): Promise<WorkoutRecord[]> {
    await this.sleep(10);
    return this.workouts;
  }

  async addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord> {
    await this.sleep(30);
    const now = new Date();
    const timeStr = input.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newWorkout: WorkoutRecord = {
      id: `wo-${Date.now()}`,
      date: input.date || TODAY_STR,
      time: timeStr,
      title: input.title,
      durationMinutes: Number(input.durationMinutes) || 20,
      exercises: input.exercises,
      perceivedDifficulty: input.perceivedDifficulty || 'moderate',
      completed: input.completed ?? true,
      feeling: input.feeling,
    };

    const existingIdx = this.workouts.findIndex((w) => w.date === newWorkout.date);
    if (existingIdx >= 0) {
      this.workouts[existingIdx] = newWorkout;
    } else {
      this.workouts.push(newWorkout);
    }

    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    return newWorkout;
  }

  async completeTodayWorkout(): Promise<void> {
    await this.sleep(20);
    const today = TODAY_STR;
    const existing = this.workouts.find((w) => w.date === today);
    if (existing) {
      existing.completed = true;
    } else {
      this.workouts.push({
        id: `wo-${Date.now()}`,
        date: today,
        time: '18:00',
        title: '20 min · 徒手全身标准练习',
        durationMinutes: 20,
        perceivedDifficulty: 'moderate',
        completed: true,
        exercises: [
          { name: '徒手深蹲 (Squat)', sets: 3, repsOrDuration: '12 次' },
          { name: '标准俯卧撑 (Push-up)', sets: 3, repsOrDuration: '10 次' },
          { name: '后退箭步蹲 (Reverse Lunge)', sets: 3, repsOrDuration: '8 次 / 侧' },
          { name: '平板支撑 (Plank)', sets: 3, repsOrDuration: '30 秒' },
        ],
        feeling: '动作顺畅，下肢与胸背微酸通透。',
      });
    }
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
  }

  async getDailyState(): Promise<DailyState> {
    await this.sleep(10);
    return this.dailyState;
  }

  async saveDailyState(input: CreateDailyStateInput): Promise<DailyState> {
    await this.sleep(25);
    const updated: DailyState = {
      date: input.date || TODAY_STR,
      sleepHours: input.sleepHours,
      energy: input.energy,
      soreness: input.soreness,
      notes: input.notes ?? this.dailyState.notes,
      sleepBedtime: this.dailyState.sleepBedtime,
      sleepWakeup: this.dailyState.sleepWakeup,
    };
    this.dailyState = updated;
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyState);

    if (input.weight) {
      await this.addWeight(input.weight, input.date);
    }
    return this.dailyState;
  }

  async getWeightHistory(): Promise<WeightRecord[]> {
    await this.sleep(10);
    return this.weightHistory;
  }

  async addWeight(weight: number, date: string = TODAY_STR): Promise<WeightRecord> {
    await this.sleep(25);
    const newRecord: WeightRecord = {
      id: `w-${Date.now()}`,
      date,
      weight: Number(weight),
    };

    const existingIdx = this.weightHistory.findIndex((w) => w.date === date);
    if (existingIdx >= 0) {
      this.weightHistory[existingIdx] = newRecord;
    } else {
      this.weightHistory.push(newRecord);
    }
    this.weightHistory.sort((a, b) => a.date.localeCompare(b.date));
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    return newRecord;
  }

  async resetToDefault(): Promise<void> {
    this.profile = { ...INITIAL_USER_PROFILE };
    this.weightHistory = [...INITIAL_WEIGHT_HISTORY];
    this.dailyState = { ...INITIAL_DAILY_STATE };
    this.meals = [...INITIAL_MEALS];
    this.workouts = [...INITIAL_RECENT_WORKOUTS];

    setStorage(STORAGE_KEYS.PROFILE, this.profile);
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyState);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
  }
}

export const healthRepository: HealthRepository = new MockHealthRepository();
