/**
 * MockHealthRepository Implementation (V3 Living Journal)
 * Uses browser localStorage for transparent persistence.
 * Synchronizes with scientificDecisionEngine for pure deterministic next actions.
 */

import {
  INITIAL_DAILY_NOTES,
  INITIAL_DAILY_STATE,
  INITIAL_LIFE_LOGS,
  INITIAL_MEALS,
  INITIAL_RECENT_WORKOUTS,
  INITIAL_TODOS,
  INITIAL_USER_PROFILE,
  INITIAL_WEEKLY_LIFE_STATS,
  INITIAL_WEIGHT_HISTORY,
  TODAY_STR,
} from '../data/mockData';
import {
  CreateDailyStateInput,
  CreateLifeLogInput,
  CreateMealInput,
  CreateNoteInput,
  CreateTodoInput,
  CreateWorkoutInput,
  DailyNote,
  DailyState,
  HealthContext,
  LifeLog,
  MealRecord,
  TodayData,
  TodoItem,
  UserProfile,
  WeeklyLifeStat,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import { HealthRepository } from './healthRepository';
import { scientificDecisionEngine } from './scientificDecisionEngine';

const STORAGE_KEYS = {
  PROFILE: 'phc_profile_v3',
  WEIGHTS: 'phc_weights_v3',
  DAILY_STATE: 'phc_state_v3',
  MEALS: 'phc_meals_v3',
  WORKOUTS: 'phc_workouts_v3',
  TODOS: 'phc_todos_v3',
  LIFE_LOGS: 'phc_lifelogs_v3',
  NOTES: 'phc_notes_v3',
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
  private todos: TodoItem[];
  private lifeLogs: LifeLog[];
  private notes: DailyNote[];

  constructor() {
    this.profile = getStorage(STORAGE_KEYS.PROFILE, INITIAL_USER_PROFILE);
    this.weightHistory = getStorage(STORAGE_KEYS.WEIGHTS, INITIAL_WEIGHT_HISTORY);
    this.dailyState = getStorage(STORAGE_KEYS.DAILY_STATE, INITIAL_DAILY_STATE);
    this.meals = getStorage(STORAGE_KEYS.MEALS, INITIAL_MEALS);
    this.workouts = getStorage(STORAGE_KEYS.WORKOUTS, INITIAL_RECENT_WORKOUTS);
    this.todos = getStorage(STORAGE_KEYS.TODOS, INITIAL_TODOS);
    this.lifeLogs = getStorage(STORAGE_KEYS.LIFE_LOGS, INITIAL_LIFE_LOGS);
    this.notes = getStorage(STORAGE_KEYS.NOTES, INITIAL_DAILY_NOTES);
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

    // Time-aware greeting: Keep it clean ("GOOD MORNING." / "GOOD AFTERNOON." / "GOOD EVENING.")
    const hour = new Date().getHours();
    let timeGreeting = 'GOOD MORNING.';
    if (hour >= 12 && hour < 18) {
      timeGreeting = 'GOOD AFTERNOON.';
    } else if (hour >= 18 || hour < 5) {
      timeGreeting = 'GOOD EVENING.';
    }

    // Nutrition summary
    const todayMeals = this.meals.filter((m) => m.date === today);
    const consumedCalories = todayMeals.reduce((sum, m) => sum + m.estimatedCalories, 0);
    const consumedProtein = todayMeals.reduce((sum, m) => sum + m.estimatedProtein, 0);

    // Recent workouts
    const recentWorkouts = this.workouts.filter((w) => w.completed);
    const todayWorkout = this.workouts.find((w) => w.date === today && w.completed);

    // Build deterministic HealthContext
    const context: HealthContext = {
      profile: this.profile,
      currentWeight,
      todayState: this.dailyState,
      todayMeals,
      recentMeals: this.meals,
      recentWorkouts: this.workouts,
      weightHistory: this.weightHistory,
      todayWorkout,
    };

    // Evaluate deterministic scientific engine
    const nextMeal = scientificDecisionEngine.recommendNextMeal(context);
    const nextWorkout = scientificDecisionEngine.recommendNextWorkout(context);
    const weightTrend = scientificDecisionEngine.computeWeightTrend(this.weightHistory);
    const weightForecast = scientificDecisionEngine.computeWeightForecast(currentWeight, weightTrend, this.profile.goal);
    const dietQuality = scientificDecisionEngine.assessDietQuality(context);

    // Weekly stats
    const workoutsThisWeek = this.workouts.filter((w) => w.completed && w.date >= '2026-09-18').length;
    const avgDailyProtein = consumedProtein > 0 ? consumedProtein : 95;

    // Factual weekly life stats aggregation
    const weeklyLifeStats: WeeklyLifeStat[] = [...INITIAL_WEEKLY_LIFE_STATS];

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
      todos: this.todos,
      notes: this.notes,
      nutritionSummary: {
        consumedCalories,
        targetCalories: this.profile.dailyCalorieTarget,
        consumedProtein,
        targetProtein: this.profile.dailyProteinTarget,
        meals: todayMeals,
      },
      nextMeal,
      nextWorkout,
      dietQuality,
      weightTrend,
      weightForecast,
      recentLifeLogs: this.lifeLogs,
      weeklyLifeStats,
      recentStats: {
        weightChange30d: monthDelta,
        workoutsThisWeek,
        avgDailyProtein,
        avgSleepHours: this.dailyState.sleepHours,
      },
      personalNote: '让每天的进食、深蹲和安睡自然发生，身体就会长久地回馈你。',
    };
  }

  // ================= Meals =================
  async getMeals(): Promise<MealRecord[]> {
    await this.sleep(10);
    return this.meals;
  }

  async addMeal(input: CreateMealInput): Promise<MealRecord> {
    await this.sleep(15);
    const newMeal: MealRecord = {
      id: `meal-${Date.now()}`,
      date: input.date || TODAY_STR,
      time: input.time || new Date().toTimeString().slice(0, 5),
      category: input.category,
      name: input.name,
      foods: input.foods && input.foods.length > 0 ? input.foods : [input.name],
      estimatedCalories: input.estimatedCalories,
      estimatedProtein: input.estimatedProtein,
    };
    this.meals = [...this.meals, newMeal];
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    return newMeal;
  }

  async deleteMeal(id: string): Promise<void> {
    await this.sleep(10);
    this.meals = this.meals.filter((m) => m.id !== id);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
  }

  // ================= Workouts =================
  async getWorkouts(): Promise<WorkoutRecord[]> {
    await this.sleep(10);
    return this.workouts;
  }

  async addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord> {
    await this.sleep(15);
    const newWorkout: WorkoutRecord = {
      id: `wo-${Date.now()}`,
      date: input.date || TODAY_STR,
      time: input.time || new Date().toTimeString().slice(0, 5),
      title: input.title,
      durationMinutes: input.durationMinutes,
      exercises: input.exercises,
      perceivedDifficulty: input.perceivedDifficulty || 'moderate',
      completed: input.completed !== undefined ? input.completed : true,
      feeling: input.feeling,
    };
    this.workouts = [newWorkout, ...this.workouts];
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    return newWorkout;
  }

  async completeTodayWorkout(): Promise<void> {
    await this.sleep(15);
    const today = TODAY_STR;
    const existing = this.workouts.find((w) => w.date === today && w.completed);
    if (!existing) {
      const completedWorkout: WorkoutRecord = {
        id: `wo-today-${Date.now()}`,
        date: today,
        time: new Date().toTimeString().slice(0, 5),
        title: '徒手基础全身循环',
        durationMinutes: 16,
        exercises: [
          { name: '徒手深蹲', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body' },
          { name: '跪姿俯卧撑', sets: 2, repsOrDuration: '8 次', movementPattern: 'push' },
          { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain' },
          { name: '平板支撑', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core' },
        ],
        perceivedDifficulty: 'light',
        completed: true,
      };
      this.workouts = [completedWorkout, ...this.workouts];
      setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    }
  }

  // ================= Daily State =================
  async getDailyState(): Promise<DailyState> {
    await this.sleep(10);
    return this.dailyState;
  }

  async saveDailyState(input: CreateDailyStateInput): Promise<DailyState> {
    await this.sleep(15);
    this.dailyState = {
      ...this.dailyState,
      date: input.date || TODAY_STR,
      sleepHours: input.sleepHours,
      energy: input.energy,
      soreness: input.soreness,
      notes: input.notes !== undefined ? input.notes : this.dailyState.notes,
    };
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyState);

    if (input.weight !== undefined && input.weight > 0) {
      await this.addWeight(input.weight, input.date || TODAY_STR);
    }

    return this.dailyState;
  }

  // ================= Weights =================
  async getWeightHistory(): Promise<WeightRecord[]> {
    await this.sleep(10);
    return this.weightHistory;
  }

  async addWeight(weight: number, date: string = TODAY_STR): Promise<WeightRecord> {
    await this.sleep(15);
    const existingIndex = this.weightHistory.findIndex((w) => w.date === date);
    let record: WeightRecord;
    if (existingIndex >= 0) {
      record = { ...this.weightHistory[existingIndex], weight };
      this.weightHistory[existingIndex] = record;
    } else {
      record = { id: `w-${Date.now()}`, date, weight };
      this.weightHistory.push(record);
    }
    this.profile.currentWeight = weight;
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    setStorage(STORAGE_KEYS.PROFILE, this.profile);
    return record;
  }

  // ================= Todos (TODAY) =================
  async getTodos(): Promise<TodoItem[]> {
    await this.sleep(10);
    return this.todos;
  }

  async addTodo(input: CreateTodoInput): Promise<TodoItem> {
    await this.sleep(10);
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      title: input.title,
      date: TODAY_STR,
      estimatedMinutes: input.estimatedMinutes,
      priority: input.priority || 'medium',
      completed: false,
      category: input.category || 'work',
    };
    this.todos = [newTodo, ...this.todos];
    setStorage(STORAGE_KEYS.TODOS, this.todos);
    return newTodo;
  }

  async toggleTodo(id: string): Promise<TodoItem> {
    await this.sleep(10);
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) throw new Error('Todo not found');
    todo.completed = !todo.completed;
    setStorage(STORAGE_KEYS.TODOS, this.todos);
    return todo;
  }

  async deleteTodo(id: string): Promise<void> {
    await this.sleep(10);
    this.todos = this.todos.filter((t) => t.id !== id);
    setStorage(STORAGE_KEYS.TODOS, this.todos);
  }

  // ================= Life Logs (LIFE) =================
  async getLifeLogs(): Promise<LifeLog[]> {
    await this.sleep(10);
    return this.lifeLogs;
  }

  async addLifeLog(input: CreateLifeLogInput): Promise<LifeLog> {
    await this.sleep(15);
    const newLog: LifeLog = {
      id: `life-${Date.now()}`,
      date: TODAY_STR,
      title: input.title,
      content: input.content,
      category: input.category,
      durationMinutes: input.durationMinutes,
      project: input.project,
    };
    this.lifeLogs = [newLog, ...this.lifeLogs];
    setStorage(STORAGE_KEYS.LIFE_LOGS, this.lifeLogs);
    return newLog;
  }

  // ================= Daily Notes =================
  async addNote(input: CreateNoteInput): Promise<DailyNote> {
    await this.sleep(15);
    const newNote: DailyNote = {
      id: `note-${Date.now()}`,
      date: TODAY_STR,
      content: input.content,
      tags: input.tags || ['#living-journal'],
      timestamp: new Date().toTimeString().slice(0, 5),
    };
    this.notes = [newNote, ...this.notes];
    setStorage(STORAGE_KEYS.NOTES, this.notes);
    return newNote;
  }

  // ================= Reset =================
  async resetToDefault(): Promise<void> {
    await this.sleep(20);
    this.profile = INITIAL_USER_PROFILE;
    this.weightHistory = INITIAL_WEIGHT_HISTORY;
    this.dailyState = INITIAL_DAILY_STATE;
    this.meals = INITIAL_MEALS;
    this.workouts = INITIAL_RECENT_WORKOUTS;
    this.todos = INITIAL_TODOS;
    this.lifeLogs = INITIAL_LIFE_LOGS;
    this.notes = INITIAL_DAILY_NOTES;

    setStorage(STORAGE_KEYS.PROFILE, this.profile);
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyState);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    setStorage(STORAGE_KEYS.TODOS, this.todos);
    setStorage(STORAGE_KEYS.LIFE_LOGS, this.lifeLogs);
    setStorage(STORAGE_KEYS.NOTES, this.notes);
  }
}

export const healthRepository = new MockHealthRepository();
