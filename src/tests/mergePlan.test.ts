/**
 * 本机 → 账号 合并计划（纯函数）与待合并快照的持久化契约
 *
 * 锁定四件事：
 *   1. 自然键：每张表用哪几列识别「同一条事实」；
 *   2. planMerge：账号为准（已有即跳过）、写入行去 id 换 user_id、快照内重复只留首条；
 *   3. 计数与拼接：snapshotCounts 是纯读，combineSnapshots 把上次未竟与本次新抓并作一份；
 *   4. 待合并快照：登录成功即持久化、成功后清除、存储不可用时退化为内存。
 */

import {
  MERGE_TABLES,
  captureLocalSnapshot,
  clearPending,
  combineSnapshots,
  hasPending,
  loadPending,
  naturalKey,
  planMerge,
  planInsertCount,
  setMergeStorage,
  snapshotCounts,
  stashPending,
  summaryInserted,
  type LocalSnapshot,
  type MergeTable,
  type Row,
} from '../services/accountMerge';
import { SupabaseRest, type StorageLike } from '../services/supabaseRest';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let checks = 0;
const ok = (message: string): void => {
  checks += 1;
  console.log(`   ✓ ${message}`);
};

const ANON = 'anon-uid';
const ACCOUNT = 'account-uid';

function emptyRows(): Record<MergeTable, Row[]> {
  const rows = {} as Record<MergeTable, Row[]>;
  for (const table of MERGE_TABLES) rows[table] = [];
  return rows;
}

function snapshot(partial: Partial<Record<MergeTable, Row[]>>): LocalSnapshot {
  return { anonUserId: ANON, rows: { ...emptyRows(), ...partial } };
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

// ---------------- 1. 自然键 ----------------

assert(naturalKey('weight_records', { measured_on: '2026-09-25' }) === '2026-09-25', '体重以测量日为键');
assert(naturalKey('daily_states', { on_date: '2026-09-25' }) === '2026-09-25', '体征以日期为键');
assert(naturalKey('todos', { on_date: '2026-09-25', title: '读文献' }) === '2026-09-25|读文献', '待办以日期+题为键');
const mealA = naturalKey('meals', {
  eaten_on: '2026-09-25',
  eaten_at: '12:30',
  category: 'lunch',
  name: '鸡腿饭',
  calories_kcal: '590.0',
});
const mealB = naturalKey('meals', {
  eaten_on: '2026-09-25',
  eaten_at: '12:30',
  category: 'lunch',
  name: '鸡腿饭',
  calories_kcal: '591.0',
});
assert(mealA !== mealB, '同日同名但热量不同 → 两条事实（不误并）');
const mealC = naturalKey('meals', {
  eaten_on: '2026-09-25',
  eaten_at: '19:30',
  category: 'dinner',
  name: '鸡腿饭',
  calories_kcal: '590.0',
});
assert(mealA !== mealC, '同名不同时刻 → 两条事实');
assert(naturalKey('profiles', { user_id: ANON }) === 'profile', '档案只有一行,键恒定');
assert(naturalKey('weight_records', {}) === '', '缺自然键 → 空串（坏行不并入）');
ok('自然键：每表识别列正确,缺列不误并');

// ---------------- 2. planMerge ----------------

const localWeight: Row = { id: 'w-local', user_id: ANON, measured_on: '2026-09-24', weight_kg: '68.40' };
const sharedWeight: Row = { id: 'w-acct', user_id: ANON, measured_on: '2026-09-25', weight_kg: '67.90' };
const dupWeight: Row = { id: 'w-local-2', user_id: ANON, measured_on: '2026-09-24', weight_kg: '68.40' };
const badWeight: Row = { id: 'w-bad', user_id: ANON, weight_kg: '70.00' };

const accountWeight: Row = { id: 'w-acct', user_id: ACCOUNT, measured_on: '2026-09-25', weight_kg: '67.90' };

const plan = planMerge(
  snapshot({
    weight_records: [localWeight, sharedWeight, dupWeight, badWeight],
    profiles: [{ user_id: ANON, height_cm: '175.0' }],
  }),
  { weight_records: [accountWeight] },
  ACCOUNT
);

assert(plan.toInsert.weight_records.length === 1, '账号已有的日期不重复写入');
const insertedWeight = plan.toInsert.weight_records[0];
assert(insertedWeight.user_id === ACCOUNT, '写入行 user_id 换成账号 uid');
assert(!('id' in insertedWeight), '写入行去掉库里的 id（交给 gen_random_uuid）');
assert(insertedWeight.weight_kg === '68.40', '数值原样保留,不做换算');
assert(plan.skipped.weight_records === 3, '跳过 = 账号已有 + 快照内重复 + 缺自然键');
assert(plan.toInsert.profiles.length === 1, '账号无档案 → 本机档案可并入');
assert(plan.toInsert.profiles[0].user_id === ACCOUNT, '档案同样换身份');
ok('planMerge：账号为准、去 id 换 uid、坏行与重复不写');

// 账号已有档案 → 跳过
const planWithProfile = planMerge(snapshot({ profiles: [{ user_id: ANON, height_cm: '175.0' }] }), {
  profiles: [{ user_id: ACCOUNT, height_cm: '172.0' }],
}, ACCOUNT);
assert(planWithProfile.toInsert.profiles.length === 0, '账号已有档案 → 不覆盖（账号为准）');
assert(planWithProfile.skipped.profiles === 1, '被跳过的档案计入 skipped');
ok('档案：账号已有即跳过,不做值级冲突合并');

// 六张表都能各就各位
const allLocal = snapshot({
  daily_states: [{ user_id: ANON, on_date: '2026-09-25', energy: '4' }],
  meals: [{ id: 'm1', user_id: ANON, eaten_on: '2026-09-25', eaten_at: '12:30', category: 'lunch', name: '鸡腿饭', calories_kcal: '590.0' }],
  workout_sessions: [{ id: 'wo1', user_id: ANON, performed_on: '2026-09-24', performed_at: '18:00', title: '徒手循环', duration_minutes: '20' }],
  todos: [{ id: 't1', user_id: ANON, on_date: '2026-09-25', title: '读文献' }],
});
const planAll = planMerge(allLocal, {}, ACCOUNT);
for (const table of MERGE_TABLES) {
  const rows = planAll.toInsert[table];
  assert(rows.every((row) => row.user_id === ACCOUNT), `${table} 每行都换成账号 uid`);
  assert(rows.every((row) => !('id' in row)), `${table} 每行都去掉 id`);
}
assert(planInsertCount(planAll) === 4, '待插入合计 = 各表之和（4 行）');
assert(summaryInserted({ profiles: { inserted: 2, skipped: 1 }, weight_records: { inserted: 1, skipped: 0 }, daily_states: { inserted: 0, skipped: 0 }, meals: { inserted: 0, skipped: 0 }, workout_sessions: { inserted: 0, skipped: 0 }, todos: { inserted: 0, skipped: 0 } }) === 3, '回执条数 = 各表写入之和');
ok('六表通吃：身份替换与 id 剥离逐表成立');

// ---------------- 3. 计数与拼接 ----------------

const snapA = snapshot({ weight_records: [localWeight], meals: [{ id: 'm1', user_id: ANON, eaten_on: '2026-09-25', eaten_at: '12:30', category: 'lunch', name: '鸡腿饭', calories_kcal: '590.0' }] });
const counts = snapshotCounts(snapA);
assert(counts.weight_records === 1 && counts.meals === 1 && counts.todos === 0, '计数逐表纯读');

const snapB = snapshot({ todos: [{ id: 't1', user_id: ANON, on_date: '2026-09-25', title: '读文献' }] });
const combined = combineSnapshots(snapA, snapB)!;
assert(combined.rows.weight_records.length === 1 && combined.rows.todos.length === 1, '拼接保留两份快照的行');
assert(combineSnapshots(null, snapB) === snapB && combineSnapshots(snapA, null) === snapA, '有一侧为空即原样返回');
assert(combineSnapshots(null, null) === null, '两侧皆空 → null（不需要合并）');
ok('计数与拼接：上次未竟 + 本次新抓并作一份');

// ---------------- 4. 待合并快照的持久化 ----------------

const storage = memoryStorage();
setMergeStorage(storage);
clearPending();
assert(!hasPending(), '清空后无待合并');

stashPending(snapA);
assert(hasPending(), 'stash 后立即可续');
assert(storage.dump()['phc_merge_pending_v1'] !== undefined, '快照写入存储（刷新后仍可续）');
assert(loadPending()?.anonUserId === ANON, '读回的快照完整');

clearPending();
assert(!hasPending(), '清除后 pending 消失');
assert(storage.dump()['phc_merge_pending_v1'] === undefined, '存储里的快照一并清掉');

// 存储不可用（隐私模式）→ 退化为内存,不抛
setMergeStorage(null);
stashPending(snapB);
assert(loadPending()?.rows.todos.length === 1, '无存储时退化为内存仍可续');
clearPending();
assert(!hasPending(), '内存态同样可清除');
setMergeStorage(undefined); // 复位为默认
ok('待合并快照：持久化、清除、无存储退化为内存');

// ---------------- 5. 抓快照（IO,假 fetch） ----------------

{
  const calls: string[] = [];
  const rowsByTable: Record<string, Row[]> = {
    profiles: [],
    weight_records: [{ id: 'w-1', user_id: ANON, measured_on: '2026-09-24', weight_kg: '68.40' }],
    daily_states: [],
    meals: [],
    workout_sessions: [],
    todos: [],
  };
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const table = Object.keys(rowsByTable).find((t) => url.includes(`/rest/v1/${t}`));
    const body = table ? rowsByTable[table] : [];
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
      json: async () => body,
    } as unknown as Response;
  }) as typeof fetch;

  const rest = new SupabaseRest(
    { url: 'https://demo.supabase.co', anonKey: 'anon-key' },
    { fetchImpl, storage: (() => {
      const map: Record<string, string> = {
        phc_supabase_session_v1: JSON.stringify({
          accessToken: 'at',
          refreshToken: 'rt',
          expiresAt: Date.now() + 3_600_000,
          userId: ANON,
          email: null,
        }),
      };
      return {
        getItem: (k) => (k in map ? map[k] : null),
        setItem: (k, v) => {
          map[k] = v;
        },
        removeItem: (k) => {
          delete map[k];
        },
      };
    })() }
  );

  const captured = await captureLocalSnapshot(rest);
  assert(captured !== null && captured.anonUserId === ANON, '抓到本机身份名下的快照');
  assert(captured!.rows.weight_records.length === 1, '行按表归位');
  assert(calls.length === MERGE_TABLES.length, '六张表各读一次');

  const bare = new SupabaseRest(
    { url: 'https://demo.supabase.co', anonKey: 'anon-key' },
    { fetchImpl, storage: memoryStorage() }
  );
  assert((await captureLocalSnapshot(bare)) === null, '无会话 → null（不抓不问）');
  ok('抓快照：持当前会话读满六表,无会话返回 null');
}

console.log(`ALL MERGE PLAN TESTS PASSED. (${checks} checks)`);
