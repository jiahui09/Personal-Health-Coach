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
  MealRecord,
  TodayData,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import {
  STORAGE_KEYS,
  makeDayContext,
  migrateMeals,
  migrateProfile,
  migrateState,
  migrateTodos,
  migrateWeights,
  migrateWorkouts,
} from '../domain';
import { Account, HealthRepository, RepositoryError } from './healthRepository';
import { assembleToday } from './todayAssembly';
import { clockTimeOf } from '../utils/calendar';

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
  // 无 DOM（契约测试环境）→ 本机无存储可写，保持内存态即可
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // 浏览器里写失败 = 数据真的没存上（配额已满/隐私设置）：
    // 如实抛给调用方让页面报「未成」——旧实现只 console.warn，
    // 用户看到的是「保存成功」，刷新后记录无声消失。
    throw new RepositoryError('unknown', `本机存储写入失败：${key}（配额已满或浏览器隐私设置）`, {
      cause: err,
    });
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

    // 跨标签页：另一标签写了存储 → 刷新内存快照。
    // 否则本页继续拿旧快照做「读-改-写」，会把别处刚存的记录无声覆盖掉。
    // storage 事件只在别的标签页触发，同页写入不会回环。
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.refreshFromStorage());
    }
  }

  /** 从存储重读全量（读失败时保底用当前内存,不退回种子数据）。 */
  private refreshFromStorage(): void {
    try {
      const storedProfile = getStorage<unknown>(STORAGE_KEYS.PROFILE, null);
      if (storedProfile !== null) this.profile = migrateProfile(storedProfile);
      this.weightHistory = readCollection(STORAGE_KEYS.WEIGHTS, migrateWeights, this.weightHistory);
      this.dailyStates = readCollection(STORAGE_KEYS.DAILY_STATE, migrateState, this.dailyStates);
      this.meals = readCollection(STORAGE_KEYS.MEALS, migrateMeals, this.meals);
      this.workouts = readCollection(STORAGE_KEYS.WORKOUTS, migrateWorkouts, this.workouts);
      this.todos = readCollection(STORAGE_KEYS.TODOS, migrateTodos, this.todos);
    } catch (err) {
      console.warn('[MockHealthRepository] Cross-tab refresh failed:', err);
    }
  }

  // ================= Identity (demo auth) =================
  private accountListeners = new Set<(account: Account | null) => void>();

  /** 本机模式的「手记名」只作显示（数据本就在本机,无须归属标记）：不设门、不校验。 */
  private ensureAccount(): Account {
    const stored = getStorage<{ id: string; name: string | null } | null>(STORAGE_KEYS.AUTH, null);
    if (stored) return { ...stored, name: stored.name ?? '本机手记', isDemo: true };
    const created = { id: `local-${newId()}`, name: '本机手记' };
    setStorage(STORAGE_KEYS.AUTH, created);
    return { ...created, isDemo: true };
  }

  private emitAccount(account: Account | null): void {
    for (const listener of this.accountListeners) listener(account);
  }

  async getCurrentUser(): Promise<Account> {
    return this.ensureAccount();
  }

  async enterByName(name: string): Promise<Account> {
    const account: Account = { ...this.ensureAccount(), name: name.trim() || '本机手记' };
    setStorage(STORAGE_KEYS.AUTH, { id: account.id, name: account.name });
    this.emitAccount(account);
    return account;
  }

  /** 本机模式不设门：数据就在本机,始终「已选好归属标记」。 */
  hasAccount(): boolean {
    return true;
  }

  async signOut(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch (err) {
      console.warn('[MockHealthRepository] Failed clearing auth key:', err);
    }
    this.emitAccount(null);
  }

  onAccountChange(listener: (account: Account | null) => void): () => void {
    this.accountListeners.add(listener);
    return () => this.accountListeners.delete(listener);
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
    // 唯一组装点在 todayAssembly（docs §10）：本地与云端走同一段代码。
    // 此前这里内联过一份复制的派生逻辑，已与真源分叉（体重序列窗口、训练周量等），
    // 现一律收回，两路径不可能再算出不同的 TodayData。
    return assembleToday(
      {
        profile: this.profile,
        weights: this.weightHistory,
        dailyStates: this.dailyStates,
        meals: this.meals,
        workouts: this.workouts,
        todos: this.todos,
      },
      this.clock()
    );
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
      ...(input.estimatedFatG !== undefined ? { estimatedFatG: input.estimatedFatG } : {}),
      ...(input.items && input.items.length > 0 ? { items: input.items } : {}),
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

  async updateTodo(id: string, patch: { estimatedMinutes?: number | null }): Promise<TodoItem> {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) throw new RepositoryError('not_found', `Todo not found: ${id}`);
    if ('estimatedMinutes' in patch) {
      todo.estimatedMinutes = patch.estimatedMinutes ?? undefined;
      if (todo.estimatedMinutes === undefined) delete todo.estimatedMinutes;
    }
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
