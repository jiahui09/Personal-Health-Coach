/**
 * MockHealthRepository — localStorage-backed implementation of HealthRepository.
 *
 * 职责被刻意收窄为三步：
 *   1. 读存储（旧形态经 migrate.* 升级，绝不改数值）
 *   2. 调 domain/ 的纯函数（唯一的计算处）
 *   3. 组装 TodayData（原始记录切片 + 派生指标 + 决策结果）
 *
 * 这里不做任何业务算术：窗口、平均、比例、斜率、数据质量全在 domain/。
 * 时钟由构造注入（默认 new Date()），一次 getToday() 只读一次时钟。
 */

import { createSeedData } from '../data/mockData';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateTodoInput,
  CreateWorkoutInput,
  DailyState,
  HealthContext,
  MealRecord,
  TodayData,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import {
  STORAGE_KEYS,
  buildNutritionSummary,
  buildTrainingSummary,
  calculateTaskProgress,
  dailyRepresentatives,
  decideWorkoutMode,
  adviseWeightGoal,
  bodySummary,
  decideTrainingTarget,
  deriveNutritionTargets,
  makeDayContext,
  profileCheck,
  migrateMeals,
  migrateProfile,
  migrateState,
  migrateTodos,
  migrateWeights,
  migrateWorkouts,
  sleepSummary,
  tasksForDay,
  weightSummary,
} from '../domain';
import { AuthUser, HealthRepository, RepositoryError } from './healthRepository';
import { scientificDecisionEngine } from './scientificDecisionEngine';
import { f_meal_slot } from './scientificRules';
import { clockTimeOf, formatDisplayDate, timeGreetingOf } from '../utils/calendar';

/**
 * Collision-safe id. `Date.now()` ids break as soon as two writes land in the
 * same millisecond, which is easy to do over a network backend.
 */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
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

/**
 * 读取一个集合键：存过（哪怕是空数组）就用存过的，未存过才用 seed。
 * 迁移只补字段形态，不改任何数值。
 */
function readCollection<T>(
  key: string,
  migrate: (raw: unknown) => T[],
  fallback: T[]
): T[] {
  const raw = getStorage<unknown>(key, null);
  if (raw === null) return fallback;
  try {
    return migrate(raw);
  } catch (err) {
    console.warn(`[MockHealthRepository] Failed migrating key ${key}:`, err);
    return fallback;
  }
}

export interface MockHealthRepositoryOptions {
  /** 注入时钟：测试用固定时刻，运行期默认 new Date()。 */
  clock?: () => Date;
}

export class MockHealthRepository implements HealthRepository {
  private readonly clock: () => Date;
  private profile: UserProfile;
  private weightHistory: WeightRecord[];
  private dailyStates: DailyState[];
  private meals: MealRecord[];
  private workouts: WorkoutRecord[];
  private todos: TodoItem[];

  constructor(options: MockHealthRepositoryOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    const seed = createSeedData(this.clock());

    const storedProfile = getStorage<unknown>(STORAGE_KEYS.PROFILE, null);
    this.profile = storedProfile === null ? seed.profile : migrateProfile(storedProfile);
    this.weightHistory = readCollection(STORAGE_KEYS.WEIGHTS, migrateWeights, seed.weightHistory);
    this.dailyStates = readCollection(STORAGE_KEYS.DAILY_STATE, migrateState, seed.dailyStates);
    this.meals = readCollection(STORAGE_KEYS.MEALS, migrateMeals, seed.meals);
    this.workouts = readCollection(STORAGE_KEYS.WORKOUTS, migrateWorkouts, seed.workouts);
    this.todos = readCollection(STORAGE_KEYS.TODOS, migrateTodos, seed.todos);
  }

  // ================= Identity (demo auth) =================
  private authListeners = new Set<(user: AuthUser | null) => void>();

  private ensureAuth(): AuthUser {
    const stored = getStorage<{ id: string; email: string | null } | null>(STORAGE_KEYS.AUTH, null);
    if (stored) return { ...stored, isDemo: true };
    const created = { id: `local-${newId()}`, email: null as string | null };
    setStorage(STORAGE_KEYS.AUTH, created);
    return { ...created, isDemo: true };
  }

  private emitAuth(user: AuthUser | null): void {
    for (const listener of this.authListeners) listener(user);
  }

  async getCurrentUser(): Promise<AuthUser> {
    return this.ensureAuth();
  }

  async signIn(email: string, _password: string): Promise<AuthUser> {
    const user: AuthUser = { ...this.ensureAuth(), email };
    setStorage(STORAGE_KEYS.AUTH, { id: user.id, email });
    this.emitAuth(user);
    return user;
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    return this.signIn(email, password);
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch (err) {
      console.warn('[MockHealthRepository] Failed clearing auth key:', err);
    }
    this.emitAuth(null);
  }

  onAuthChange(listener: (user: AuthUser | null) => void): () => void {
    this.authListeners.add(listener);
    return () => this.authListeners.delete(listener);
  }

  async getProfile(): Promise<UserProfile> {
    return this.profile;
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    this.profile = { ...this.profile, ...patch };
    setStorage(STORAGE_KEYS.PROFILE, this.profile);
    return this.profile;
  }

  // ================= Aggregated view =================
  async getToday(): Promise<TodayData> {
    const now = this.clock();
    const ctx = makeDayContext(now);
    const today = ctx.todayKey;

    // --- 原始记录的今日切片 ---
    const todayMeals = this.meals.filter((meal) => meal.date === today && meal.confirmed !== false);
    const todayTodos = tasksForDay(this.todos, today);
    const todayWorkout = this.workouts.find((w) => w.date === today && w.completed);
    const todayState = this.dailyStates.find((state) => state.date === today);

    // --- 派生指标（domain 纯函数，全站唯一计算处） ---
    const weight = weightSummary(this.weightHistory, ctx);
    const body = bodySummary(this.profile, weight.latest, now);
    const check = profileCheck(this.profile, now);

    // 建议（据 BMI/腰围）→ 用户确认后的目标方向 → 每日目标 → 每周抗阻处方
    const goalAdvice = adviseWeightGoal({
      bmiCategory: body.bmiCategory,
      waistElevated: body.waist ? body.waist.elevated : null,
      goal: this.profile.goal,
    });
    const direction =
      this.profile.goal === undefined
        ? goalAdvice.direction
        : this.profile.goal === 'fat loss'
        ? 'lose'
        : this.profile.goal === 'muscle gain'
        ? 'gain'
        : 'maintain';
    const targets = deriveNutritionTargets({
      tdeeKcal: body.tdeeKcal,
      weightKg: weight.latest,
      direction,
      sex: this.profile.sex,
    });
    const trainingTarget = decideTrainingTarget({
      direction,
      goal: this.profile.goal,
      activityLevel: this.profile.activityLevel,
    });

    const nutrition = buildNutritionSummary(
      todayMeals,
      targets ? targets.caloriesKcal : 0,
      targets ? targets.proteinG : 0
    );
    const sleep = sleepSummary(this.dailyStates, ctx);
    const tasks = calculateTaskProgress(todayTodos);

    // --- 决策：训练模式由纯函数判定；体重不在入参内，异常体重无法污染它 ---
    const decision = decideWorkoutMode({
      sleepMinutes: sleep.today ? sleep.today.minutes : null,
      energy: todayState?.energy ?? null,
      soreness: todayState?.soreness ?? null,
      completedToday: !!todayWorkout,
    });
    const training = buildTrainingSummary(
      this.workouts,
      ctx,
      decision,
      trainingTarget.resistanceDaysPerWeek
    );

    // --- 决策：引擎推荐（餐食/训练课表），复用同一决策结果 ---
    const context: HealthContext = {
      now,
      profile: this.profile,
      currentWeight: weight.latest ?? 0,
      todayState: todayState ?? { date: today },
      todayMeals,
      recentMeals: this.meals,
      recentWorkouts: this.workouts,
      weightHistory: this.weightHistory,
      todayWorkout,
      trainingDecision: decision,
      targets,
    };

    const nextMeal = scientificDecisionEngine.recommendNextMeal(context);
    const nextWorkout = scientificDecisionEngine.recommendNextWorkout(context);
    const dietQuality = scientificDecisionEngine.assessDietQuality(context);
    const forecast = scientificDecisionEngine.computeWeightForecast({
      latestWeight: weight.latest,
      trendKgPerWeek: weight.trendKgPerWeek,
      basedOnDays: weight.trendDays,
      inputWindowDays: weight.windowDays,
      quality: weight.quality,
    });

    const flags = [weight.quality, nutrition.quality, sleep.quality];
    const weightPoints = dailyRepresentatives(this.weightHistory)
      .slice(-ctx.last30Keys.length)
      .map((point) => ({ date: point.dayKey, weight: point.weight }));

    return {
      date: today,
      displayDate: formatDisplayDate(now),
      timeGreeting: timeGreetingOf(ctx.hour),
      profile: this.profile,
      mealSlot: f_meal_slot(ctx.hour),

      todos: todayTodos,
      todayMeals,

      tasks,
      weight,
      nutrition,
      sleep,
      state: todayState ?? { date: today },
      weightSeries: weightPoints,

      training,
      dataQuality: {
        flags,
        reviewCount: flags.filter((flag) => flag.flag === 'needs_review').length,
      },
      forecast,
      nextMeal,
      nextWorkout,
      dietQuality,

      profileStatus: check.complete ? 'complete' : 'incomplete',
      missingProfileFields: check.missing,
      body,
      targets,
      goalAdvice,
      trainingTarget,
    };
  }

  // ================= Meals =================
  async getMeals(since?: string): Promise<MealRecord[]> {
    return since ? this.meals.filter((m) => m.date >= since) : this.meals;
  }

  async addMeal(input: CreateMealInput): Promise<MealRecord> {
    const newMeal: MealRecord = {
      id: `meal-${newId()}`,
      date: input.date || makeDayContext(this.clock()).todayKey,
      time: input.time || clockTimeOf(this.clock()),
      category: input.category,
      name: input.name,
      foods: input.foods && input.foods.length > 0 ? input.foods : [input.name],
      estimatedCalories: input.estimatedCalories,
      estimatedProtein: input.estimatedProtein,
      source: input.source ?? 'manual',
      confirmed: true,
    };
    this.meals = [...this.meals, newMeal];
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    return newMeal;
  }

  async deleteMeal(id: string): Promise<void> {
    this.meals = this.meals.filter((m) => m.id !== id);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
  }

  // ================= Workouts =================
  async getWorkouts(since?: string): Promise<WorkoutRecord[]> {
    return since ? this.workouts.filter((w) => w.date >= since) : this.workouts;
  }

  async addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord> {
    const newWorkout: WorkoutRecord = {
      id: `wo-${newId()}`,
      date: input.date || makeDayContext(this.clock()).todayKey,
      time: input.time || clockTimeOf(this.clock()),
      title: input.title,
      durationMinutes: input.durationMinutes,
      durationSource: input.durationSource ?? 'estimated',
      exercises: input.exercises,
      perceivedDifficulty: input.perceivedDifficulty || 'moderate',
      completed: input.completed !== undefined ? input.completed : true,
      feeling: input.feeling,
      category: input.category ?? 'resistance',
    };
    this.workouts = [newWorkout, ...this.workouts];
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    return newWorkout;
  }

  async completeTodayWorkout(): Promise<void> {
    const today = makeDayContext(this.clock()).todayKey;
    const existing = this.workouts.find((w) => w.date === today && w.completed);
    if (existing) return;

    const completedWorkout: WorkoutRecord = {
      id: `wo-today-${newId()}`,
      date: today,
      time: clockTimeOf(this.clock()),
      title: '徒手基础全身循环',
      durationMinutes: 16,
      durationSource: 'estimated',
      exercises: [
        { name: '徒手深蹲', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body' },
        { name: '跪姿俯卧撑', sets: 2, repsOrDuration: '8 次', movementPattern: 'push' },
        { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain' },
        { name: '平板支撑', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core' },
      ],
      perceivedDifficulty: 'light',
      completed: true,
      category: 'resistance',
    };
    this.workouts = [completedWorkout, ...this.workouts];
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
  }

  // ================= Daily State =================
  async getDailyState(date?: string): Promise<DailyState | null> {
    const target = date ?? makeDayContext(this.clock()).todayKey;
    return this.dailyStates.find((state) => state.date === target) ?? null;
  }

  async getDailyStates(since?: string): Promise<DailyState[]> {
    const sorted = [...this.dailyStates].sort((a, b) => a.date.localeCompare(b.date));
    return since ? sorted.filter((state) => state.date >= since) : sorted;
  }

  async saveDailyState(input: CreateDailyStateInput): Promise<DailyState> {
    const now = this.clock();
    const date = input.date || makeDayContext(now).todayKey;
    const existing = this.dailyStates.find((state) => state.date === date);

    const next: DailyState = {
      date,
      sleep: input.sleep ?? existing?.sleep,
      energy: input.energy ?? existing?.energy,
      soreness: input.soreness ?? existing?.soreness,
      notes: input.notes !== undefined ? input.notes : existing?.notes,
    };

    this.dailyStates = existing
      ? this.dailyStates.map((state) => (state.date === date ? next : state))
      : [...this.dailyStates, next];
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyStates);

    if (input.weight !== undefined && input.weight > 0) {
      await this.addWeight(input.weight, date, { time: input.weightTime || clockTimeOf(now) });
    }

    return next;
  }

  // ================= Weights =================
  async getWeightHistory(since?: string): Promise<WeightRecord[]> {
    return since ? this.weightHistory.filter((w) => w.date >= since) : this.weightHistory;
  }

  async addWeight(
    weight: number,
    date?: string,
    options: { time?: string; source?: WeightRecord['source'] } = {}
  ): Promise<WeightRecord> {
    const target = date ?? makeDayContext(this.clock()).todayKey;
    const time = options.time ?? clockTimeOf(this.clock());
    const existingIndex = this.weightHistory.findIndex((w) => w.date === target);
    let record: WeightRecord;
    if (existingIndex >= 0) {
      // 同日再录 = 更正当日之数（不新增第二条事实）
      record = { ...this.weightHistory[existingIndex], weight, time };
      this.weightHistory[existingIndex] = record;
    } else {
      record = { id: `w-${newId()}`, date: target, weight, time, source: options.source ?? 'manual' };
      this.weightHistory = [...this.weightHistory, record];
    }
    // 体重只存在 WeightRecord 一处；档案里不再有第二份「当前体重」
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    return record;
  }

  // ================= Todos (TODAY) =================
  async getTodos(since?: string): Promise<TodoItem[]> {
    return since ? this.todos.filter((t) => t.date >= since) : this.todos;
  }

  async addTodo(input: CreateTodoInput): Promise<TodoItem> {
    const newTodo: TodoItem = {
      id: `todo-${newId()}`,
      title: input.title,
      date: makeDayContext(this.clock()).todayKey,
      estimatedMinutes: input.estimatedMinutes,
      priority: input.priority || 'medium',
      status: 'todo',
      category: input.category || 'work',
    };
    this.todos = [newTodo, ...this.todos];
    setStorage(STORAGE_KEYS.TODOS, this.todos);
    return newTodo;
  }

  async toggleTodo(id: string): Promise<TodoItem> {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) throw new RepositoryError('not_found', `Todo not found: ${id}`);
    todo.status = todo.status === 'done' ? 'todo' : 'done';
    setStorage(STORAGE_KEYS.TODOS, this.todos);
    return todo;
  }

  async deleteTodo(id: string): Promise<void> {
    this.todos = this.todos.filter((t) => t.id !== id);
    setStorage(STORAGE_KEYS.TODOS, this.todos);
  }

  // ================= Life Logs (LIFE) =================
  // ================= Daily Notes =================
  // ================= Reset =================
  async resetToDefault(): Promise<void> {
    const seed = createSeedData(this.clock());
    this.profile = seed.profile;
    this.weightHistory = seed.weightHistory;
    this.dailyStates = seed.dailyStates;
    this.meals = seed.meals;
    this.workouts = seed.workouts;
    this.todos = seed.todos;

    setStorage(STORAGE_KEYS.PROFILE, this.profile);
    setStorage(STORAGE_KEYS.WEIGHTS, this.weightHistory);
    setStorage(STORAGE_KEYS.DAILY_STATE, this.dailyStates);
    setStorage(STORAGE_KEYS.MEALS, this.meals);
    setStorage(STORAGE_KEYS.WORKOUTS, this.workouts);
    setStorage(STORAGE_KEYS.TODOS, this.todos);
  }
}

// The application singleton lives in `services/repository.ts` (factory switch).
