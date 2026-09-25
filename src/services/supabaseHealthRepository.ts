/**
 * SupabaseHealthRepository — 浏览器直连 Supabase（Auth + PostgREST），零依赖。
 *
 * 与 MockHealthRepository 的关系：
 *   - 两者都只做「取原始记录 → 交给 services/todayAssembly.assembleToday → 返回 TodayData」；
 *   - 派生逻辑（BMI/代谢/目标/趋势/决策）完全共用，因此两条路径不可能算出不同结果
 *     （由 src/tests/supabaseContract.test.ts 的跨路径一致性用例锁定）。
 *
 * 未登录时所有数据方法抛 RepositoryError('auth')，页面据此显示登录页而不是空白。
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
import { AuthUser, HealthRepository, RepositoryError } from './healthRepository';
import { assembleToday } from './todayAssembly';
import {
  clearMagicLinkHash,
  readMagicLinkHash,
  SupabaseError,
  SupabaseRest,
  type SupabaseConfig,
  type SupabaseRestOptions,
  type SupabaseSession,
} from './supabaseRest';
import {
  mealFromRow,
  mealToRow,
  profileFromRow,
  profileToRow,
  stateFromRow,
  stateToRow,
  todoFromRow,
  todoToRow,
  weightFromRow,
  weightToRow,
  workoutFromRow,
  workoutToRow,
} from './supabaseMappers';
import { makeDayContext } from '../domain';

type Row = Record<string, unknown>;

const nowClock = (): string => new Date().toTimeString().slice(0, 5);

/** 把传输层错误统一成仓库错误码（与 mock 实现同一套词汇）。 */
function toRepositoryError(err: unknown): RepositoryError {
  if (err instanceof RepositoryError) return err;
  if (err instanceof SupabaseError) {
    const code =
      err.kind === 'auth'
        ? 'auth'
        : err.kind === 'network'
        ? 'network'
        : err.kind === 'conflict'
        ? 'conflict'
        : err.kind === 'not_found'
        ? 'not_found'
        : 'unknown';
    return new RepositoryError(code, err.message, { cause: err });
  }
  return new RepositoryError('unknown', (err as Error)?.message ?? String(err), { cause: err });
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw toRepositoryError(err);
  }
}

export interface SupabaseHealthRepositoryOptions extends SupabaseRestOptions {
  /** 注入时钟（测试用）。 */
  clock?: () => Date;
}

export class SupabaseHealthRepository implements HealthRepository {
  private readonly rest: SupabaseRest;
  private readonly clock: () => Date;
  private readonly authListeners = new Set<(user: AuthUser | null) => void>();
  private cachedProfile: UserProfile | null = null;

  constructor(config: SupabaseConfig, options: SupabaseHealthRepositoryOptions = {}) {
    this.rest = new SupabaseRest(config, options);
    this.clock = options.clock ?? (() => new Date());

    // magic link 回跳：把 hash 里的令牌换成本地会话,然后清掉地址栏里的令牌
    const hash = readMagicLinkHash();
    if (hash.includes('access_token=')) {
      void this.rest
        .completeMagicLink(hash)
        .then((session) => {
          if (session) this.emitAuth(session);
          clearMagicLinkHash();
        })
        .catch(() => clearMagicLinkHash());
    }
    // 失败回跳（如链接过期）不清 hash：交给登录页读出原因后再清,否则用户只看到「又回到登录页」
  }

  private emitAuth(session: SupabaseSession | null): void {
    const user: AuthUser | null = session
      ? { id: session.userId, email: session.email, isDemo: false }
      : null;
    for (const listener of this.authListeners) listener(user);
  }

  private async requireUserId(): Promise<string> {
    const session = await this.rest.ensureSession();
    if (!session) throw new RepositoryError('auth', '尚未登录：请先用邮箱收取登录链接');
    return session.userId;
  }

  // ================= Identity =================

  async getCurrentUser(): Promise<AuthUser | null> {
    const user = await guard(() => this.rest.getUser());
    return user ? { id: user.id, email: user.email, isDemo: false } : null;
  }

  /** 发送 magic link（signIn 与 signUp 同一入口：首次点击即注册）。 */
  async signIn(email: string, _password: string): Promise<AuthUser> {
    const redirectTo = typeof window === 'undefined' ? '' : window.location.origin;
    await guard(() => this.rest.sendMagicLink(email, redirectTo));
    // 点击邮件后才真正建立会话；此处返回「待确认」身份，由 App 提示查收邮件
    return { id: 'pending', email, isDemo: false };
  }

  async signUp(email: string, password: string): Promise<AuthUser> {
    return this.signIn(email, password);
  }

  async signOut(): Promise<void> {
    await guard(() => this.rest.signOut());
    this.cachedProfile = null;
    this.emitAuth(null);
  }

  onAuthChange(listener: (user: AuthUser | null) => void): () => void {
    this.authListeners.add(listener);
    return () => this.authListeners.delete(listener);
  }

  // ================= Profile =================

  async getProfile(): Promise<UserProfile> {
    if (this.cachedProfile) return this.cachedProfile;
    const userId = await this.requireUserId();
    const rows = await guard(() =>
      this.rest.select<Row>('profiles', `select=*&user_id=eq.${userId}&limit=1`)
    );
    const profile = rows.length > 0 ? profileFromRow(rows[0]) : {};
    this.cachedProfile = profile;
    return profile;
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
    const userId = await this.requireUserId();
    const current = await this.getProfile();
    const next: UserProfile = { ...current, ...patch };
    const rows = await guard(() =>
      this.rest.upsert<Row>('profiles', profileToRow(userId, next), 'user_id')
    );
    this.cachedProfile = rows.length > 0 ? profileFromRow(rows[0]) : next;
    return this.cachedProfile;
  }

  // ================= Aggregated view =================

  async getToday(): Promise<TodayData> {
    const userId = await this.requireUserId();
    const now = this.clock();
    const ctx = makeDayContext(now);
    const monthStart = ctx.last30Keys[0];

    const [profileRows, weightRows, stateRows, mealRows, workoutRows, todoRows] = await guard(() =>
      Promise.all([
        this.rest.select<Row>('profiles', `select=*&user_id=eq.${userId}&limit=1`),
        this.rest.select<Row>(
          'weight_records',
          `select=*&user_id=eq.${userId}&measured_on=gte.${monthStart}&order=measured_on.asc`
        ),
        this.rest.select<Row>(
          'daily_states',
          `select=*&user_id=eq.${userId}&on_date=gte.${monthStart}&order=on_date.asc`
        ),
        this.rest.select<Row>('meals', `select=*&user_id=eq.${userId}&eaten_on=eq.${ctx.todayKey}`),
        this.rest.select<Row>(
          'workout_sessions',
          `select=*&user_id=eq.${userId}&performed_on=gte.${monthStart}&order=performed_on.asc`
        ),
        this.rest.select<Row>('todos', `select=*&user_id=eq.${userId}&on_date=eq.${ctx.todayKey}`),
      ])
    );

    const profile = profileRows.length > 0 ? profileFromRow(profileRows[0]) : {};
    this.cachedProfile = profile;

    return assembleToday(
      {
        profile,
        weights: weightRows.map(weightFromRow).filter((w): w is WeightRecord => w !== null),
        dailyStates: stateRows.map(stateFromRow).filter((s): s is DailyState => s !== null),
        meals: mealRows.map(mealFromRow).filter((m): m is MealRecord => m !== null),
        workouts: workoutRows.map(workoutFromRow).filter((w): w is WorkoutRecord => w !== null),
        todos: todoRows.map(todoFromRow).filter((t): t is TodoItem => t !== null),
      },
      now
    );
  }

  // ================= Meals =================

  async getMeals(since?: string): Promise<MealRecord[]> {
    const userId = await this.requireUserId();
    const filter = since ? `&eaten_on=gte.${since}` : '';
    const rows = await guard(() =>
      this.rest.select<Row>('meals', `select=*&user_id=eq.${userId}${filter}&order=eaten_on.desc`)
    );
    return rows.map(mealFromRow).filter((m): m is MealRecord => m !== null);
  }

  async addMeal(input: CreateMealInput): Promise<MealRecord> {
    const userId = await this.requireUserId();
    const date = input.date ?? makeDayContext(this.clock()).todayKey;
    const row = mealToRow(userId, {
      date,
      time: input.time ?? nowClock(),
      category: input.category,
      name: input.name,
      foods: input.foods && input.foods.length > 0 ? input.foods : [input.name],
      estimatedCalories: input.estimatedCalories,
      estimatedProtein: input.estimatedProtein,
      source: input.source ?? 'manual',
      confirmed: true,
    });
    const rows = await guard(() => this.rest.insert<Row>('meals', row));
    const meal = mealFromRow(rows[0]);
    if (!meal) throw new RepositoryError('unknown', '写入膳食后未取回记录');
    return meal;
  }

  async deleteMeal(id: string): Promise<void> {
    const userId = await this.requireUserId();
    await guard(() => this.rest.remove('meals', `id=eq.${id}&user_id=eq.${userId}`));
  }

  // ================= Workouts =================

  async getWorkouts(since?: string): Promise<WorkoutRecord[]> {
    const userId = await this.requireUserId();
    const filter = since ? `&performed_on=gte.${since}` : '';
    const rows = await guard(() =>
      this.rest.select<Row>(
        'workout_sessions',
        `select=*&user_id=eq.${userId}${filter}&order=performed_on.desc`
      )
    );
    return rows.map(workoutFromRow).filter((w): w is WorkoutRecord => w !== null);
  }

  async addWorkout(input: CreateWorkoutInput): Promise<WorkoutRecord> {
    const userId = await this.requireUserId();
    const date = input.date ?? makeDayContext(this.clock()).todayKey;
    const row = workoutToRow(userId, {
      date,
      time: input.time ?? nowClock(),
      title: input.title,
      durationMinutes: input.durationMinutes,
      durationSource: input.durationSource ?? 'estimated',
      exercises: input.exercises,
      perceivedDifficulty: input.perceivedDifficulty ?? 'moderate',
      completed: input.completed ?? true,
      feeling: input.feeling,
      category: input.category ?? 'resistance',
    });
    const rows = await guard(() => this.rest.insert<Row>('workout_sessions', row));
    const workout = workoutFromRow(rows[0]);
    if (!workout) throw new RepositoryError('unknown', '写入训练后未取回记录');
    return workout;
  }

  async completeTodayWorkout(): Promise<void> {
    const userId = await this.requireUserId();
    const today = makeDayContext(this.clock()).todayKey;
    const existing = await guard(() =>
      this.rest.select<Row>(
        'workout_sessions',
        `select=id&user_id=eq.${userId}&performed_on=eq.${today}&completed=is.true&limit=1`
      )
    );
    if (existing.length > 0) return;

    const row = workoutToRow(userId, {
      date: today,
      time: nowClock(),
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
    });
    await guard(() => this.rest.insert<Row>('workout_sessions', row));
  }

  // ================= Daily State =================

  async getDailyState(date?: string): Promise<DailyState | null> {
    const userId = await this.requireUserId();
    const target = date ?? makeDayContext(this.clock()).todayKey;
    const rows = await guard(() =>
      this.rest.select<Row>(
        'daily_states',
        `select=*&user_id=eq.${userId}&on_date=eq.${target}&limit=1`
      )
    );
    return rows.length > 0 ? stateFromRow(rows[0]) : null;
  }

  async getDailyStates(since?: string): Promise<DailyState[]> {
    const userId = await this.requireUserId();
    const filter = since ? `&on_date=gte.${since}` : '';
    const rows = await guard(() =>
      this.rest.select<Row>('daily_states', `select=*&user_id=eq.${userId}${filter}&order=on_date.asc`)
    );
    return rows.map(stateFromRow).filter((s): s is DailyState => s !== null);
  }

  async saveDailyState(input: CreateDailyStateInput): Promise<DailyState> {
    const userId = await this.requireUserId();
    const now = this.clock();
    const date = input.date ?? makeDayContext(now).todayKey;
    const current = await this.getDailyState(date);

    const next: DailyState = {
      date,
      sleep: input.sleep ?? current?.sleep,
      energy: input.energy ?? current?.energy,
      soreness: input.soreness ?? current?.soreness,
      notes: input.notes !== undefined ? input.notes : current?.notes,
    };

    const rows = await guard(() =>
      this.rest.upsert<Row>('daily_states', stateToRow(userId, next), 'user_id,on_date')
    );

    if (input.weight !== undefined && input.weight > 0) {
      await this.addWeight(input.weight, date, { time: input.weightTime ?? nowClock() });
    }

    return rows.length > 0 ? stateFromRow(rows[0]) ?? next : next;
  }

  // ================= Weights =================

  async getWeightHistory(since?: string): Promise<WeightRecord[]> {
    const userId = await this.requireUserId();
    const filter = since ? `&measured_on=gte.${since}` : '';
    const rows = await guard(() =>
      this.rest.select<Row>(
        'weight_records',
        `select=*&user_id=eq.${userId}${filter}&order=measured_on.asc`
      )
    );
    return rows.map(weightFromRow).filter((w): w is WeightRecord => w !== null);
  }

  /** 同日再录 = 更正当日之数（不新增第二条事实），与本地实现一致。 */
  async addWeight(
    weight: number,
    date?: string,
    options: { time?: string; source?: WeightRecord['source'] } = {}
  ): Promise<WeightRecord> {
    const userId = await this.requireUserId();
    const target = date ?? makeDayContext(this.clock()).todayKey;
    const existing = await guard(() =>
      this.rest.select<Row>(
        'weight_records',
        `select=id&user_id=eq.${userId}&measured_on=eq.${target}&limit=1`
      )
    );

    if (existing.length > 0) {
      const rows = await guard(() =>
        this.rest.update<Row>('weight_records', `id=eq.${String(existing[0].id)}&user_id=eq.${userId}`, {
          weight_kg: weight,
          measured_at: options.time ?? nowClock(),
        })
      );
      const updated = weightFromRow(rows[0]);
      if (updated) return updated;
    }

    const rows = await guard(() =>
      this.rest.insert<Row>(
        'weight_records',
        weightToRow(userId, {
          id: 'pending',
          date: target,
          weight,
          source: options.source ?? 'manual',
          time: options.time ?? nowClock(),
        })
      )
    );
    const created = weightFromRow(rows[0]);
    if (!created) throw new RepositoryError('unknown', '写入体重后未取回记录');
    return created;
  }

  // ================= Todos =================

  async getTodos(since?: string): Promise<TodoItem[]> {
    const userId = await this.requireUserId();
    const filter = since ? `&on_date=gte.${since}` : '';
    const rows = await guard(() =>
      this.rest.select<Row>('todos', `select=*&user_id=eq.${userId}${filter}&order=on_date.desc`)
    );
    return rows.map(todoFromRow).filter((t): t is TodoItem => t !== null);
  }

  async addTodo(input: CreateTodoInput): Promise<TodoItem> {
    const userId = await this.requireUserId();
    const row = todoToRow(userId, {
      title: input.title,
      date: makeDayContext(this.clock()).todayKey,
      estimatedMinutes: input.estimatedMinutes,
      priority: input.priority ?? 'medium',
      status: 'todo',
      category: input.category ?? 'work',
    });
    const rows = await guard(() => this.rest.insert<Row>('todos', row));
    const todo = todoFromRow(rows[0]);
    if (!todo) throw new RepositoryError('unknown', '写入待办后未取回记录');
    return todo;
  }

  async toggleTodo(id: string): Promise<TodoItem> {
    const userId = await this.requireUserId();
    const rows = await guard(() =>
      this.rest.select<Row>('todos', `select=*&user_id=eq.${userId}&id=eq.${id}&limit=1`)
    );
    if (rows.length === 0) throw new RepositoryError('not_found', `Todo not found: ${id}`);
    const current = todoFromRow(rows[0]);
    if (!current) throw new RepositoryError('not_found', `Todo not found: ${id}`);
    const updated = await guard(() =>
      this.rest.update<Row>('todos', `id=eq.${id}&user_id=eq.${userId}`, {
        status: current.status === 'done' ? 'todo' : 'done',
      })
    );
    const todo = todoFromRow(updated[0]);
    if (!todo) throw new RepositoryError('unknown', '切换待办后未取回记录');
    return todo;
  }

  async deleteTodo(id: string): Promise<void> {
    const userId = await this.requireUserId();
    await guard(() => this.rest.remove('todos', `id=eq.${id}&user_id=eq.${userId}`));
  }

  // ================= Demo data =================

  /** 云端实现**绝不允许**清空真实数据：这里显式拒绝。 */
  async resetToDefault(): Promise<void> {
    throw new RepositoryError(
      'not_implemented',
      '云端账号不支持「复其初」：它只用于本地演示数据，绝不会删你的真实记录'
    );
  }
}
