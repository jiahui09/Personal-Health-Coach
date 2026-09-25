/**
 * Supabase 云端路径契约测试（用假 fetch，不连真库）
 *
 * 锁定四件事：
 *   1. 行到域模型的映射：形状转换正确、缺字段保持 undefined、Postgres 的 numeric 字符串与
 *      time 'HH:MM:SS' 都能吃下；
 *   2. **跨路径一致性**：同一批原始记录，本地（直接给域模型）与云端（域模型→行→域模型）
 *      经 assembleToday 得到的 TodayData 必须逐字节相同 —— 这是「两条数据路径不会漂移」的证明；
 *   3. 传输层：magic link 发送、hash 换会话、过期刷新、错误码映射（401→auth / 409→conflict /
 *      网络异常→network）；
 *   4. 仓库层：未登录一律抛 auth（绝不静默返回空数据）、同日体重走 PATCH 而非新增、
 *      档案走 upsert、云端「复其初」显式拒绝（绝不清真实数据）。
 */

import { assembleToday, type RawSnapshot } from '../services/todayAssembly';
import {
  SupabaseError,
  SupabaseRest,
  type StorageLike,
  type SupabaseSession,
} from '../services/supabaseRest';
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

/** 带有效会话的存储（多数数据请求需要先登录）。 */
function authedStorage(expiresAt = Date.now() + 3_600_000): StorageLike {
  const storage = memoryStorage();
  storage.setItem(
    'phc_supabase_session_v1',
    JSON.stringify({ accessToken: 'at', refreshToken: 'rt', expiresAt, userId: UID, email: null })
  );
  return storage;
}

const sessionBody = {
  access_token: 'at-1',
  refresh_token: 'rt-1',
  expires_in: 3600,
  user: { id: UID, email: 'me@example.com' },
};

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

// magic link 发送
{
  const { fetchImpl, calls } = makeFetch([{ method: 'POST', match: (u) => u.includes('/auth/v1/otp'), body: {} }]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage: memoryStorage() });
  await rest.sendMagicLink('me@example.com', 'https://app.example.com');
  const call = calls[0];
  assert(call.headers.apikey === 'anon-key', '发送登录邮件带 apikey');
  assert(call.url === 'https://demo.supabase.co/auth/v1/otp', 'OTP 端点正确');
  assert(JSON.stringify(call.body).includes('me@example.com'), '载荷包含邮箱');
  assert(JSON.stringify(call.body).includes('https://app.example.com'), '载荷包含回跳地址');
  ok('magic link：发送端点、apikey、回跳地址正确');
}

// hash 换会话 + 会话持久化
{
  const storage = memoryStorage();
  const { fetchImpl } = makeFetch([
    { method: 'GET', match: (u) => u.includes('/auth/v1/user'), body: { id: UID, email: 'me@example.com' } },
  ]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage });
  const session = await rest.completeMagicLink('#access_token=at-9&refresh_token=rt-9&expires_in=3600&token_type=bearer');
  assert(session?.userId === UID && session.email === 'me@example.com', 'hash → 会话（含用户身份）');
  assert(storage.dump()['phc_supabase_session_v1'] !== undefined, '会话写入本地存储（刷新后仍登录）');
  assert(rest.getSession()?.accessToken === 'at-9', '内存会话可读');
  ok('magic link 回跳：hash 换会话并持久化');
}

// 过期刷新 + 未登录
{
  const storage = memoryStorage();
  let now = 1_000_000;
  const { fetchImpl, calls } = makeFetch([
    { method: 'GET', match: (u) => u.includes('/auth/v1/user'), body: { id: UID, email: 'me@example.com' } },
    { method: 'POST', match: (u) => u.includes('grant_type=refresh_token'), body: { ...sessionBody, access_token: 'at-2' } },
  ]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage, now: () => now });
  await rest.completeMagicLink('#access_token=at-1&refresh_token=rt-1&expires_in=60');
  now += 30_000; // 距过期 30 秒 → 落在刷新余量内
  const refreshed = await rest.ensureSession();
  assert(refreshed?.accessToken === 'at-2', '临近过期自动刷新令牌');
  assert(calls.some((c) => c.url.includes('grant_type=refresh_token')), '确实调用了刷新端点');

  const bare = new SupabaseRest(cfg, { fetchImpl, storage: memoryStorage() });
  assert(bare.getSession() === null && (await bare.ensureSession()) === null, '无会话时 ensureSession 返回 null');
  ok('会话：临近过期刷新；未登录返回 null');
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
    const rest = new SupabaseRest(cfg, { fetchImpl, storage: authedStorage() });
    try {
      await rest.select('weight_records', 'select=*');
      assert(false, `HTTP ${status} 应当抛出`);
    } catch (err) {
      assert(err instanceof SupabaseError && err.kind === kind, `HTTP ${status} → ${kind}`);
    }
  }
  const throwing = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  const rest = new SupabaseRest(cfg, { fetchImpl: throwing, storage: authedStorage() });
  try {
    await rest.select('meals', 'select=*');
    assert(false, '网络异常应当抛出');
  } catch (err) {
    assert(err instanceof SupabaseError && err.kind === 'network', '网络异常 → network');
  }
  ok('错误映射：401/403→auth、404→not_found、409→conflict、5xx→unknown、断网→network');
}

// 查询串构造
{
  const session: SupabaseSession = { accessToken: 'at', refreshToken: 'rt', expiresAt: Date.now() + 3_600_000, userId: UID, email: null };
  const storage = memoryStorage();
  storage.setItem('phc_supabase_session_v1', JSON.stringify(session));
  const { fetchImpl, calls } = makeFetch([{ method: 'GET', match: () => true, body: [] }]);
  const rest = new SupabaseRest(cfg, { fetchImpl, storage });
  await rest.select('weight_records', `select=*&user_id=eq.${UID}&measured_on=gte.2026-08-27&order=measured_on.asc`);
  assert(calls[0].url.includes('user_id=eq.user-1'), '查询带 user_id 过滤（RLS 之外再加一道）');
  assert(calls[0].headers.Authorization === 'Bearer at', '查询带 Bearer 令牌');
  ok('数据请求：URL 过滤与鉴权头正确');
}

// ---------------- 4. 仓库层 ----------------

// 未登录：必须抛 auth，绝不静默返回空数据
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
      assert(false, '未登录时数据方法必须抛错');
    } catch (err) {
      assert(err instanceof RepositoryError && err.code === 'auth', '未登录 → RepositoryError(auth)');
    }
  }
  assert((await repo.getCurrentUser()) === null, '未登录时 getCurrentUser 返回 null');
  ok('未登录：一切数据方法抛 auth（页面据此显示登录页）');
}

// 已登录：取回 TodayData 且与本地算出的派生值一致
{
  const storage = memoryStorage();
  storage.setItem(
    'phc_supabase_session_v1',
    JSON.stringify({ accessToken: 'at', refreshToken: 'rt', expiresAt: NOW.getTime() + 3_600_000, userId: UID, email: 'me@example.com' })
  );
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
  const repo = new SupabaseHealthRepository(cfg, { fetchImpl, storage, clock: () => NOW });
  const today = await repo.getToday();
  assert(today.profileStatus === 'complete', '云端档案齐备 → complete');
  assert(today.date === '2026-09-25', '日期来自注入时钟');
  assert(today.nutrition.calories.consumed === 1020, '今日摄入由云端记录算出（1020 千卡）');
  assert(today.nutrition.calories.target === localToday.nutrition.calories.target, '目标与本地路径一致');
  assert(today.body.bmi === localToday.body.bmi, 'BMI 与本地路径一致');
  assert(today.training.decision.mode === localToday.training.decision.mode, '训练决策与本地路径一致');
  assert((await repo.getCurrentUser())?.email === 'me@example.com', '已登录返回身份');
  ok('已登录：云端记录 → 与本地完全一致的 TodayData');
}

// 同日体重：走 PATCH 而非新增；档案走 upsert；云端拒绝「复其初」
{
  const storage = memoryStorage();
  storage.setItem(
    'phc_supabase_session_v1',
    JSON.stringify({ accessToken: 'at', refreshToken: 'rt', expiresAt: NOW.getTime() + 3_600_000, userId: UID, email: null })
  );
  const routes: Route[] = [
    { method: 'GET', match: (u) => u.includes('/profiles'), body: [{ user_id: UID, ...profileToRow(UID, seeded) }] },
    { method: 'GET', match: (u) => u.includes('/weight_records'), body: [{ id: 'w-existing' }] },
    { method: 'PATCH', match: (u) => u.includes('/weight_records'), body: [{ id: 'w-existing', measured_on: '2026-09-25', weight_kg: 57, source: 'manual' }] },
    { method: 'POST', match: (u) => u.includes('/profiles'), body: [{ user_id: UID, ...profileToRow(UID, seeded) }] },
    { method: 'DELETE', match: (u) => u.includes('/meals'), body: null },
  ];
  const { fetchImpl, calls } = makeFetch(routes);
  const repo = new SupabaseHealthRepository(cfg, { fetchImpl, storage, clock: () => NOW });

  const updated = await repo.addWeight(57);
  assert(updated.weight === 57, '同日再录返回更新后的记录');
  assert(calls.some((c) => c.method === 'PATCH' && c.url.includes('/weight_records')), '同日体重走 PATCH');
  assert(!calls.some((c) => c.method === 'POST' && c.url.includes('/weight_records')), '同日体重不新增第二条事实');

  await repo.updateProfile({ waistCm: 86 });
  const upsert = calls.find((c) => c.method === 'POST' && c.url.includes('on_conflict=user_id'));
  assert(upsert !== undefined, '档案走 upsert（on_conflict=user_id）');
  assert(upsert!.headers.Prefer.includes('merge-duplicates'), '档案 upsert 带 merge-duplicates');

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

console.log(`ALL SUPABASE CONTRACT TESTS PASSED. (${checks} checks)`);
