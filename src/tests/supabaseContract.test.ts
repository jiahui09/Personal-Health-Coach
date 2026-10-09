/**
 * Supabase 云端路径契约测试（用假 fetch，不连真库）
 *
 * 锁定四件事：
 *   1. 行到域模型的映射：形状转换正确、缺字段保持 undefined、Postgres 的 numeric 字符串与
 *      time 'HH:MM:SS' 都能吃下；
 *   2. **跨路径一致性**：同一批原始记录，本地（直接给域模型）与云端（域模型→行→域模型）
 *      经 assembleToday 得到的 TodayData 必须逐字节相同 —— 这是「两条数据路径不会漂移」的证明；
 *   3. 身份与传输层：手记名 → 归属标记（确定性、可复算、不联网；账号只作标记,不设防）；
 *      无标记时一个网络请求都不发、错误码映射（401→auth / 409→conflict / 旧外键·缺列→schema / 网络异常→network）；
 *   4. 仓库层：无标记一律抛 auth（绝不静默返回空数据）、同日体重走 PATCH 而非新增、
 *      档案走 upsert、云端「复其初」显式拒绝（绝不清真实数据）。
 */

import { assembleToday, type RawSnapshot } from '../services/todayAssembly';
import {
  SupabaseError,
  SupabaseRest,
  type StorageLike,
} from '../services/supabaseRest';
import { markerUserId } from '../services/accountMarker';
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
} from '../services/supabaseMappers';
import { SupabaseHealthRepository } from '../services/supabaseHealthRepository';
import { createSeedData } from '../data/mockData';
import { RepositoryError } from '../services/healthRepository';
import type { UserProfile } from '../types/health';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let checks = 0;
const ok = (message: string): void => {
  checks += 1;
  console.log(`   ✓ ${message}`);
};

const NOW = new Date(2026, 8, 25, 21, 30);
const UID = 'user-1';

// ---------------- 假 fetch ----------------

interface Route {
  method: string;
  match: (url: string) => boolean;
  status?: number;
  body?: unknown;
}

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function makeFetch(routes: Route[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, headers, body });
    const route = routes.find((r) => r.method === method && r.match(url));
    const status = route?.status ?? 200;
    const payload = route?.body === undefined ? null : JSON.stringify(route.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => payload ?? '',
      json: async () => (payload ? JSON.parse(payload) : null),
    } as unknown as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function memoryStorage(): StorageLike & { dump(): Record<string, string> } {
  const map: Record<string, string> = {};
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => {
      map[k] = v;
    },
    removeItem: (k) => {
      delete map[k];
    },
    dump: () => ({ ...map }),
  };
}

/** 带归属标记的存储（数据方法都要先「打开手记」）。 */
function accountStorage(name = '手记甲'): StorageLike {
  const storage = memoryStorage();
  storage.setItem('phc_account_v1', JSON.stringify({ userId: UID, name }));
  return storage;
}

// ---------------- 1. 映射：形状与容错 ----------------

const seeded: UserProfile = {
  name: '档主',
  sex: 'male',
  birthYear: 1998,
  heightCm: 175,
  activityLevel: 'light',
  waistCm: 84,
  goal: 'fat loss',
  goalSource: 'user',
};

const profileRoundTrip = profileFromRow({ user_id: UID, ...profileToRow(UID, seeded) });
assert(JSON.stringify(profileRoundTrip) === JSON.stringify(seeded), '档案 round-trip 完全一致');
assert(Object.keys(profileFromRow({ user_id: UID })).length === 0, '空行 → 空档案（不注入默认人体数据）');
ok('档案映射：往返一致，缺字段不填默认值');

const weightRow = { id: 'w-1', ...weightToRow(UID, { id: 'w-1', date: '2026-09-25', weight: 68.4, source: 'manual', time: '07:10' }) };
const weight = weightFromRow(weightRow);
assert(weight?.weight === 68.4 && weight.time === '07:10' && weight.source === 'manual', '体重映射保留数值/时刻/来源');
assert(weightFromRow({ id: 'w-2', measured_on: '2026-09-24', weight_kg: '68.40', measured_at: '07:10:00' })?.weight === 68.4, 'numeric 字符串与 HH:MM:SS 都能吃下');
assert(weightFromRow({ id: 'w-3', weight_kg: 68 }) === null, '缺日期 → null（不猜）');
ok('体重映射：numeric 字符串、time 秒位、缺字段');

const intervalState = { date: '2026-09-25', sleep: { kind: 'interval' as const, sleepStart: '00:55', wakeTime: '08:15' }, energy: 4, soreness: 2, notes: '晨起神清' };
const intervalRow = { ...stateToRow(UID, intervalState), on_date: '2026-09-25' };
const intervalBack = stateFromRow(intervalRow);
assert(intervalBack?.sleep?.kind === 'interval', '睡眠区间分支往返保持');
const durationState = { date: '2026-09-24', sleep: { kind: 'duration' as const, minutes: 438 } };
const durationBack = stateFromRow({ ...stateToRow(UID, durationState), on_date: '2026-09-24' });
assert(durationBack?.sleep?.kind === 'duration' && durationBack.sleep.minutes === 438, '手录眠时分支往返保持');
assert(stateFromRow({ user_id: UID, on_date: '2026-09-23' })?.sleep === undefined, '无眠时数据 → sleep 缺席（不编造）');
assert(stateFromRow({ user_id: UID, on_date: '2026-09-25', sleep_start: '23:30:00', sleep_wake: '07:00:00' })?.sleep?.kind === 'interval', '库里带秒位的时间也能成区间');
ok('每日体征映射：睡眠两分支互斥且往返一致');

const meal = { id: 'm-1', date: '2026-09-25', time: '12:30', category: 'lunch' as const, name: '鸡腿饭', foods: ['鸡腿', '糙米'], estimatedCalories: 590, estimatedProtein: 42, source: 'manual' as const, confirmed: true };
const mealBack = mealFromRow({ id: 'm-1', ...mealToRow(UID, meal) });
assert(JSON.stringify(mealBack) === JSON.stringify(meal), '膳食映射往返一致');
assert(mealBack?.confirmed === true, '入库膳食视为已确认');
assert(mealFromRow({ ...mealToRow(UID, meal) }) === null, '缺 id（未真正入库的行）→ null');
ok('膳食映射：往返一致');
const mealWithItems = { ...meal, estimatedFatG: 22.5, items: [{ name: '鸡胸肉', grams: 150, kcal: 248, proteinG: 46.4, fatG: 5.4, foodId: 'f-chicken-breast' }] };
assert(JSON.stringify(mealFromRow({ id: meal.id, ...mealToRow(UID, mealWithItems) })) === JSON.stringify(mealWithItems), '库选明细与脂肪列往返一致');
const legacyBack = mealFromRow({ id: meal.id, ...mealToRow(UID, meal) });
assert(legacyBack?.estimatedFatG === undefined && legacyBack?.items === undefined, '旧记录无 items/脂肪 → 如实缺席（不填 0）');
ok('膳食库选增量：往返一致且旧记录缺席');
const budgetProfile = { ...seeded, trainingMinutesBudget: 45 };
assert(profileFromRow({ ...profileToRow(UID, budgetProfile) }).trainingMinutesBudget === 45, '训练时间预算列往返一致');
assert(profileFromRow(profileToRow(UID, seeded)).trainingMinutesBudget === undefined, '未设预算 → 字段缺席（不填 30 冒充已设）');
ok('档案训练时间预算：往返一致且未设缺席');

const workout = { id: 'wo-1', date: '2026-09-23', time: '18:15', title: '徒手循环', durationMinutes: 20, durationSource: 'estimated' as const, exercises: [{ name: '深蹲', sets: 3, repsOrDuration: '12 次' }], perceivedDifficulty: 'moderate' as const, completed: true, category: 'resistance' as const };
assert(JSON.stringify(workoutFromRow({ id: 'wo-1', ...workoutToRow(UID, workout) })) === JSON.stringify(workout), '训练映射往返一致');
const todo = { id: 't-1', title: '读文献', date: '2026-09-25', estimatedMinutes: 30, priority: 'medium' as const, status: 'todo' as const, category: 'reading' as const };
assert(JSON.stringify(todoFromRow({ id: 't-1', ...todoToRow(UID, todo) })) === JSON.stringify(todo), '待办映射往返一致');
ok('训练与待办映射：往返一致（含 exercises jsonb）');

// ---------------- 2. 跨路径一致性（本地 vs 云端） ----------------

function cloudShapedSnapshot(now: Date): RawSnapshot {
  const seed = createSeedData(now);
  return {
    profile: profileFromRow({ ...profileToRow(UID, seeded) }),
    // 用原始 id：云端返回的行本就带库里的 id,这里模拟「同一条记录」而不是新造记录
    weights: seed.weightHistory.map((w) => weightFromRow({ ...weightToRow(UID, w), id: w.id })!),
    dailyStates: seed.dailyStates.map((s) => stateFromRow({ ...stateToRow(UID, s), on_date: s.date })!),
    meals: seed.meals.map((m) => mealFromRow({ ...mealToRow(UID, m), id: m.id })!),
    workouts: seed.workouts.map((w) => workoutFromRow({ ...workoutToRow(UID, w), id: w.id })!),
    todos: seed.todos.map((t) => todoFromRow({ ...todoToRow(UID, t), id: t.id })!),
  };
}

const localSnapshot: RawSnapshot = (() => {
  const seed = createSeedData(NOW);
  return { profile: seeded, ...{ weights: seed.weightHistory, dailyStates: seed.dailyStates, meals: seed.meals, workouts: seed.workouts, todos: seed.todos } };
})();

const localToday = assembleToday(localSnapshot, NOW);
const cloudToday = assembleToday(cloudShapedSnapshot(NOW), NOW);
assert(
  JSON.stringify(localToday) === JSON.stringify(cloudToday),
  '本地与云端两条路径的 TodayData 必须逐字节相同（含 BMI/目标/趋势/推荐）'
);
assert(cloudToday.body.bmi !== null && cloudToday.targets !== null, '云端路径同样算出体征与目标');
ok('跨路径一致性：同一批记录 → 同一份 TodayData');

// ---------------- 3. 传输层 ----------------

const cfg = { url: 'https://demo.supabase.co', anonKey: 'anon-key' };

// 手记名 → 归属标记（确定性、可复算、不联网；没有 GoTrue/密码/邮件）
{
  const storage = memoryStorage();
  const rest = new SupabaseRest(cfg, { fetchImpl: makeFetch([]).fetchImpl, storage });
  assert(rest.hasAccount() === false, '从未打开 → hasAccount=false（先到账号门）');

  const seen: (string | null)[] = [];
  rest.onAccountChange((acct) => seen.push(acct?.userId ?? null));
  const account = rest.enterByName('  My手记 ');
  assert(account.name === 'My手记', '显示名只压空白、保留大小写');
  assert(account.userId === markerUserId('my手记'), '归一后同名派生同一标记');
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(account.userId),
    '标记呈 UUID 形（落 uuid 列）'
  );
  assert(storage.dump()['phc_account_v1'] !== undefined, '标记落盘本机');
  assert(seen.length === 1 && seen[0] === account.userId, '订阅者收到「打开手记」事件');

  // 换设备（新实例、同一份本机存储）→ 同一个标记：同名即同库
  const again = new SupabaseRest(cfg, { fetchImpl: makeFetch([]).fetchImpl, storage });
  assert(again.getAccount()?.userId === account.userId, '重启读到同一标记（跨设备同名同库）');

  rest.signOut();
  assert(rest.hasAccount() === false, '退出后 hasAccount=false');
  assert(storage.dump()['phc_account_v1'] === undefined, '退出只清本机标记（云端数据不动）');
  assert(seen.at(-1) === null && seen.length === seen.filter((v) => v !== null).length + 1, '退出也通知订阅者');
  ok('手记名：确定性标记、落盘、退出只清本机');
}

// 无标记：数据请求一个都不发,直接 auth（绝不静默返回空数据）；请求头恒为公开 anon key
{
  const { fetchImpl, calls } = makeFetch([{ method: 'GET', match: () => true, body: [] }]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage: memoryStorage() });
  try {
    await rest.select('meals', 'select=*');
    assert(false, '无标记时读应当抛出');
  } catch (err) {
    assert(err instanceof SupabaseError && err.kind === 'auth', '无标记 → auth');
  }
  assert(calls.length === 0, '无标记时不发任何网络请求');

  rest.enterByName('甲');
  await rest.select('meals', 'select=*');
  assert(calls[0].headers.apikey === 'anon-key', '请求带 apikey');
  assert(calls[0].headers.Authorization === 'Bearer anon-key', '请求带 Bearer（公开 anon key,无会话令牌）');
  ok('数据请求：无标记先到账号门；请求头恒为公开 anon key');
}

// 错误码映射
{
  const cases: [number, string][] = [
    [401, 'auth'],
    [403, 'auth'],
    [404, 'not_found'],
    [409, 'conflict'],
    [500, 'unknown'],
  ];
  for (const [status, kind] of cases) {
    const { fetchImpl } = makeFetch([{ method: 'GET', match: () => true, status, body: { message: 'x' } }]);
    const rest = new SupabaseRest(cfg, { fetchImpl, storage: accountStorage() });
    try {
      await rest.select('weight_records', 'select=*');
      assert(false, `HTTP ${status} 应当抛出`);
    } catch (err) {
      assert(err instanceof SupabaseError && err.kind === kind, `HTTP ${status} → ${kind}`);
    }
  }
  // 云库结构落后于代码：旧外键（409）与缺列（400）对症归 schema,不与「记录已存在」混淆
  const schemaCases: [number, unknown, string][] = [
    [409, { code: '23503', message: 'insert or update on table "profiles" violates foreign key constraint "profiles_user_id_fkey"' }, '409+旧外键 → schema'],
    [400, { code: 'PGRST204', message: 'Could not find the column in the schema cache' }, '400+缺列 → schema'],
  ];
  for (const [status, body, label] of schemaCases) {
    const { fetchImpl } = makeFetch([{ method: 'GET', match: () => true, status, body }]);
    const rest = new SupabaseRest(cfg, { fetchImpl, storage: accountStorage() });
    try {
      await rest.select('profiles', 'select=*');
      assert(false, `${label} 应当抛出`);
    } catch (err) {
      assert(err instanceof SupabaseError && err.kind === 'schema', label);
    }
  }
  // 立档等写动作同样归 schema → 页面据此出对症 toast（「全文重跑 schema.sql」）
  {
    const { fetchImpl } = makeFetch([
      { method: 'GET', match: (u) => u.includes('/profiles'), status: 200, body: [] },
      {
        method: 'POST',
        match: (u) => u.includes('/profiles'),
        status: 409,
        body: { code: '23503', message: 'violates foreign key constraint "profiles_user_id_fkey"' },
      },
    ]);
    const repo = new SupabaseHealthRepository(cfg, { fetchImpl, storage: accountStorage() });
    try {
      await repo.updateProfile({ heightCm: 175 });
      assert(false, '立档写入遇旧外键应当抛出');
    } catch (err) {
      assert(err instanceof RepositoryError && err.code === 'schema', '立档遇旧外键 → RepositoryError(schema) → 对症 toast');
    }
  }
  const throwing = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  const rest = new SupabaseRest(cfg, { fetchImpl: throwing, storage: accountStorage() });
  try {
    await rest.select('meals', 'select=*');
    assert(false, '网络异常应当抛出');
  } catch (err) {
    assert(err instanceof SupabaseError && err.kind === 'network', '网络异常 → network');
  }

  ok('错误映射：401/403→auth、404→not_found、409→conflict、旧外键/缺列→schema、5xx→unknown、断网→network');
}

// hasAccount：账号只是标记,可区分「没打开过手记」与「已打开」
{
  const fresh = new SupabaseRest(cfg, { fetchImpl: makeFetch([]).fetchImpl, storage: memoryStorage() });
  assert(fresh.hasAccount() === false, '无标记 → hasAccount=false（先到账号门）');

  const stored = new SupabaseRest(cfg, { fetchImpl: makeFetch([]).fetchImpl, storage: accountStorage() });
  assert(stored.hasAccount() === true, '本机存有标记 → hasAccount=true（直接进手记）');

  const repo = new SupabaseHealthRepository(cfg, { fetchImpl: makeFetch([]).fetchImpl, storage: memoryStorage() });
  assert(repo.hasAccount() === false, '仓库透传 hasAccount');
  ok('身份状态：有无归属标记可区分（账号门 vs 直接进手记）');
}

// 查询串构造
{
  const storage = accountStorage();
  const { fetchImpl, calls } = makeFetch([{ method: 'GET', match: () => true, body: [] }]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage });
  await rest.select('weight_records', `select=*&user_id=eq.${UID}&measured_on=gte.2026-08-27&order=measured_on.asc`);
  assert(calls[0].url.includes('user_id=eq.user-1'), '查询带 user_id 过滤（RLS 之外再加一道）');
  assert(calls[0].headers.Authorization === 'Bearer anon-key', '查询带 Bearer（公开 anon key）');
  ok('数据请求：URL 过滤与鉴权头正确');
}

// ---------------- 4. 仓库层 ----------------

// 无标记（未打开手记）：必须抛 auth，绝不静默返回空数据
{
  const { fetchImpl } = makeFetch([]);
  const repo = new SupabaseHealthRepository(cfg, { fetchImpl, storage: memoryStorage(), clock: () => NOW });
  for (const call of [
    () => repo.getToday(),
    () => repo.getMeals(),
    () => repo.addMeal({ category: 'lunch', name: 'x', estimatedCalories: 1, estimatedProtein: 1 }),
    () => repo.updateProfile({ heightCm: 175 }),
  ]) {
    try {
      await call();
      assert(false, '无标记时数据方法必须抛错');
    } catch (err) {
      assert(err instanceof RepositoryError && err.code === 'auth', '无标记 → RepositoryError(auth)');
    }
  }
  assert((await repo.getCurrentUser()) === null, '无标记时 getCurrentUser 返回 null');
  ok('无标记：一切数据方法抛 auth（页面据此显示账号门）');
}

// 已打开手记：取回 TodayData 且与本地算出的派生值一致
{
  const storage = accountStorage('手记甲');
  const seed = createSeedData(NOW);
  const routes: Route[] = [
    { method: 'GET', match: (u) => u.includes('/profiles'), body: [{ user_id: UID, ...profileToRow(UID, seeded) }] },
    { method: 'GET', match: (u) => u.includes('/weight_records'), body: seed.weightHistory.map((w, i) => ({ id: `w-${i}`, ...weightToRow(UID, w) })) },
    { method: 'GET', match: (u) => u.includes('/daily_states'), body: seed.dailyStates.map((s) => ({ ...stateToRow(UID, s), on_date: s.date })) },
    { method: 'GET', match: (u) => u.includes('/meals'), body: seed.meals.map((m, i) => ({ id: `m-${i}`, ...mealToRow(UID, m) })) },
    { method: 'GET', match: (u) => u.includes('/workout_sessions'), body: seed.workouts.map((w, i) => ({ id: `wo-${i}`, ...workoutToRow(UID, w) })) },
    { method: 'GET', match: (u) => u.includes('/todos'), body: seed.todos.map((t, i) => ({ id: `t-${i}`, ...todoToRow(UID, t) })) },
  ];
  const { fetchImpl } = makeFetch(routes);
  const repo = new SupabaseHealthRepository(cfg, {
    fetchImpl,
    storage,
    clock: () => NOW,
  });
  const today = await repo.getToday();
  assert(today.profileStatus === 'complete', '云端档案齐备 → complete');
  assert(today.date === '2026-09-25', '日期来自注入时钟');
  assert(today.nutrition.calories.consumed === 1020, '今日摄入由云端记录算出（1020 千卡）');
  assert(today.nutrition.calories.target === localToday.nutrition.calories.target, '目标与本地路径一致');
  assert(today.body.bmi === localToday.body.bmi, 'BMI 与本地路径一致');
  assert(today.training.decision.mode === localToday.training.decision.mode, '训练决策与本地路径一致');
  assert((await repo.getCurrentUser())?.name === '手记甲', '已打开手记 → 返回归属身份');
  ok('已打开手记：云端记录 → 与本地完全一致的 TodayData');
}

// 同日体重：走 PATCH 而非新增；档案走 upsert；云端拒绝「复其初」
{
  const storage = accountStorage();
  const routes: Route[] = [
    { method: 'GET', match: (u) => u.includes('/profiles'), body: [{ user_id: UID, ...profileToRow(UID, seeded) }] },
    { method: 'GET', match: (u) => u.includes('/weight_records'), body: [{ id: 'w-existing' }] },
    { method: 'PATCH', match: (u) => u.includes('/weight_records'), body: [{ id: 'w-existing', measured_on: '2026-09-25', weight_kg: 57, source: 'manual' }] },
    { method: 'PATCH', match: (u) => u.includes('/todos'), body: [{ id: 't-1', ...todoToRow(UID, { date: '2026-09-25', title: '甲', estimatedMinutes: 30, status: 'todo' }) }] },
    { method: 'POST', match: (u) => u.includes('/profiles'), body: [{ user_id: UID, ...profileToRow(UID, seeded) }] },
    { method: 'DELETE', match: (u) => u.includes('/meals'), body: null },
  ];
  const { fetchImpl, calls } = makeFetch(routes);
  const repo = new SupabaseHealthRepository(cfg, {
    fetchImpl,
    storage,
    clock: () => NOW,
  });

  const updated = await repo.addWeight(57);
  assert(updated.weight === 57, '同日再录返回更新后的记录');
  assert(calls.some((c) => c.method === 'PATCH' && c.url.includes('/weight_records')), '同日体重走 PATCH');
  assert(!calls.some((c) => c.method === 'POST' && c.url.includes('/weight_records')), '同日体重不新增第二条事实');

  await repo.updateProfile({ waistCm: 86 });
  const upsert = calls.find((c) => c.method === 'POST' && c.url.includes('on_conflict=user_id'));
  assert(upsert !== undefined, '档案走 upsert（on_conflict=user_id）');
  assert(upsert!.headers.Prefer.includes('merge-duplicates'), '档案 upsert 带 merge-duplicates');

  // 改拟时长：按 id 的 PATCH、限本人、载荷即列名（null = 清空,不写 0）
  const todoSetResult = await repo.updateTodo('t-1', { estimatedMinutes: 30 });
  assert(todoSetResult.estimatedMinutes === 30, 'PATCH 回映射带出新时长');
  const todoSet = calls.find((c) => c.method === 'PATCH' && c.url.includes('/todos'));
  assert(todoSet !== undefined && todoSet.url.includes('id=eq.t-1') && todoSet.url.includes('user_id=eq.'), '改拟时长走按 id 的 PATCH 且限本人');
  assert((todoSet!.body as { estimated_minutes?: number | null }).estimated_minutes === 30, '载荷写 estimated_minutes');

  await repo.updateTodo('t-1', { estimatedMinutes: null });
  const todoClear = calls.filter((c) => c.method === 'PATCH' && c.url.includes('/todos'))[1];
  assert((todoClear.body as { estimated_minutes?: number | null }).estimated_minutes === null, '取消时长 → estimated_minutes 置 null（列可空,不写 0）');

  await repo.deleteMeal('m-1');
  const del = calls.find((c) => c.method === 'DELETE');
  assert(del!.url.includes('id=eq.m-1') && del!.url.includes('user_id=eq.user-1'), '删除同时限定 id 与 user_id');

  try {
    await repo.resetToDefault();
    assert(false, '云端不得支持复其初');
  } catch (err) {
    assert(err instanceof RepositoryError && err.code === 'not_implemented', '云端「复其初」显式拒绝');
  }
  ok('写入语义：同日 PATCH、档案 upsert、删除限本人、拒绝清库');
}

// ---------------- 5. 批量写入的传输层 ----------------

// 批量插入：数组体 + return=representation（合并走它,一次一张表）
{
  const { fetchImpl, calls } = makeFetch([
    { method: 'POST', match: (u) => u.includes('/rest/v1/meals'), body: [] },
  ]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage: accountStorage() });
  const rows = [
    { user_id: UID, eaten_on: '2026-09-25', name: '鸡腿饭' },
    { user_id: UID, eaten_on: '2026-09-26', name: '燕麦粥' },
  ];
  await rest.insertMany('meals', rows);
  const call = calls[0];
  assert(Array.isArray(call.body), '批量写入发数组体（PostgREST 批量插入）');
  assert((call.body as unknown[]).length === 2, '数组体逐行带过去');
  assert(call.headers.Prefer === 'return=representation', '要回执行,便于核对写入结果');
  await rest.insertMany('meals', []);
  assert(calls.length === 1, '空数组不发请求（没有可并的行就别打网络）');
  ok('insertMany：数组体 + 回执头 + 空数组短路');
}

console.log(`ALL SUPABASE CONTRACT TESTS PASSED. (${checks} checks)`);
