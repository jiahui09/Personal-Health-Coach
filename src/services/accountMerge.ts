/**
 * accountMerge — 本机（匿名身份）记录并入账号
 *
 * 为什么需要它：云端模式首次进入时会静默建一个匿名身份，记录都挂在它的 user_id 名下。
 * 一旦登录到自己的账号，RLS 立刻只认账号身份，那些本机记录就再也读不到（等于丢了）。
 * 所以登录前先把匿名身份名下的行**快照**下来，登录后再按自然键去重写进账号。
 *
 * 合并语义（docs/data-semantics §10）：
 *   - 账号为准，本机只补缺 —— 账号里已有的自然键直接跳过，不做值级冲突合并；
 *   - 写入行去掉 id（交给 gen_random_uuid），user_id 换成账号 uid；
 *   - 逐表 Promise.allSettled：任何一张表失败 → 整次不算完成、快照留在 sessionStorage,
 *     页脚「继续上次合并」可重试；自然键去重让重试天然幂等；
 *   - 匿名身份下的原数据**不删除**——它是兜底副本，且此后再也不会被读到。
 *
 * 快照用 sessionStorage（同标签页刷新仍在、关掉即散），不污染长期存储。
 */

import { SupabaseError, SupabaseRest, type StorageLike } from './supabaseRest';

export type Row = Record<string, unknown>;

/** 六张表与 schema.sql 一一对应；顺序即展示与写入顺序。 */
export const MERGE_TABLES = [
  'profiles',
  'weight_records',
  'daily_states',
  'meals',
  'workout_sessions',
  'todos',
] as const;

export type MergeTable = (typeof MERGE_TABLES)[number];

export interface LocalSnapshot {
  /** 抓取快照时的本机（匿名）身份 uid——只作留痕，写入时一律换成账号 uid。 */
  anonUserId: string;
  /**
   * 这份快照准备并入的账号 uid（登录成功、stash 时记下）。
   * 兜底校验：待合并记录只允许写进它当初认准的那个账号,不误并到别的身份名下。
   */
  targetUserId?: string;
  rows: Record<MergeTable, Row[]>;
}

export interface MergePlan {
  /** 待写入账号的行：已去 user_id/id 之外的原样字段，自然键在账号中不存在。 */
  toInsert: Record<MergeTable, Row[]>;
  /** 每表被跳过的行数（账号已有 / 快照内重复 / 缺自然键）。 */
  skipped: Record<MergeTable, number>;
}

export type MergeSummary = Record<MergeTable, { inserted: number; skipped: number }>;

/** 页面用来列条数的计数（展示层只读，不做算术）。 */
export type MergeCounts = Record<MergeTable, number>;

// ---------------- 自然键 ----------------

const cell = (row: Row, key: string): string => String(row[key] ?? '');

/**
 * 自然键：同一条事实在两处的唯一识别。
 * 全空视为「没有键」（坏行不并入，避免互相顶掉）。
 */
export function naturalKey(table: MergeTable, row: Row): string {
  switch (table) {
    case 'profiles':
      return 'profile';
    case 'weight_records':
      return cell(row, 'measured_on');
    case 'daily_states':
      return cell(row, 'on_date');
    case 'meals':
      return ['eaten_on', 'eaten_at', 'category', 'name', 'calories_kcal']
        .map((k) => cell(row, k))
        .join('|');
    case 'workout_sessions':
      return ['performed_on', 'performed_at', 'title', 'duration_minutes']
        .map((k) => cell(row, k))
        .join('|');
    case 'todos':
      return `${cell(row, 'on_date')}|${cell(row, 'title')}`;
  }
}

/** 换身份写入：去掉库里的 id（避免与遗留行的主键相撞），user_id 换成账号 uid。 */
function reparent(row: Row, userId: string): Row {
  const { id: _id, ...rest } = row;
  return { ...rest, user_id: userId };
}

// ---------------- 纯计划（可单测，无 IO） ----------------

/**
 * 给出「本机快照 → 账号」的写入计划。
 * 账号为准：自然键已在账号中出现的行一律跳过；快照内部的重复也只留首条。
 */
export function planMerge(
  snapshot: LocalSnapshot,
  accountRows: Partial<Record<MergeTable, Row[]>>,
  accountUserId: string
): MergePlan {
  const toInsert = {} as Record<MergeTable, Row[]>;
  const skipped = {} as Record<MergeTable, number>;

  for (const table of MERGE_TABLES) {
    const account = accountRows[table] ?? [];
    const seen = new Set(account.map((row) => naturalKey(table, row)));
    const planned: Row[] = [];
    let dropped = 0;

    for (const row of snapshot.rows[table]) {
      const key = naturalKey(table, row);
      if (!key || seen.has(key)) {
        dropped += 1;
        continue;
      }
      seen.add(key); // 快照内同键只留首条
      planned.push(reparent(row, accountUserId));
    }

    toInsert[table] = planned;
    skipped[table] = dropped;
  }

  return { toInsert, skipped };
}

/** 快照各表条数（登录后「询问后合并」的清单；纯读，不做算术）。 */
export function snapshotCounts(snapshot: LocalSnapshot): MergeCounts {
  const counts = {} as MergeCounts;
  for (const table of MERGE_TABLES) counts[table] = snapshot.rows[table].length;
  return counts;
}

/**
 * 两份快照并作一份（按表拼接）。
 * 用于「上次没并完的快照」+「本次登录前新抓的本机记录」——去重交给 planMerge,
 * 因此同一条事实在两份里各出现一次也不会写重。
 */
export function combineSnapshots(
  a: LocalSnapshot | null,
  b: LocalSnapshot | null
): LocalSnapshot | null {
  if (!a) return b;
  if (!b) return a;
  const rows = {} as Record<MergeTable, Row[]>;
  for (const table of MERGE_TABLES) rows[table] = [...a.rows[table], ...b.rows[table]];
  return { anonUserId: b.anonUserId, rows };
}

/** 两份计数之和——仅用于回执文案，数字来自数据本身。 */
export function planInsertCount(plan: MergePlan): number {
  return MERGE_TABLES.reduce((total, table) => total + plan.toInsert[table].length, 0);
}

// ---------------- 待合并快照的持久化 ----------------

const PENDING_KEY = 'phc_merge_pending_v1';

let memoryPending: LocalSnapshot | null = null;
let injectedStorage: StorageLike | null | undefined;

/** 注入存储（测试用）；null = 只用内存,undefined = 复位为默认（sessionStorage）。 */
export function setMergeStorage(storage: StorageLike | null | undefined): void {
  injectedStorage = storage;
}

function sessionStore(): StorageLike | null {
  if (injectedStorage !== undefined) return injectedStorage;
  try {
    injectedStorage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    injectedStorage = null; // 隐私模式：退化为仅内存（本次会话内仍可继续合并）
  }
  return injectedStorage;
}

/** 登录成功后立即持久化快照：哪怕关掉页面，回来还能「继续上次合并」。 */
export function stashPending(snapshot: LocalSnapshot): void {
  memoryPending = snapshot;
  try {
    sessionStore()?.setItem(PENDING_KEY, JSON.stringify(snapshot));
  } catch {
    // 写不进 sessionStorage 只影响跨刷新恢复，不影响本次合并
  }
}

export function loadPending(): LocalSnapshot | null {
  if (memoryPending) return memoryPending;
  try {
    const raw = sessionStore()?.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSnapshot;
    memoryPending = parsed && parsed.anonUserId && parsed.rows ? parsed : null;
    return memoryPending;
  } catch {
    return null;
  }
}

export function hasPending(): boolean {
  return loadPending() !== null;
}

export function clearPending(): void {
  memoryPending = null;
  try {
    sessionStore()?.removeItem(PENDING_KEY);
  } catch {
    // 读不出的存储也清不出，留着不影响下次 stash 覆盖
  }
}

// ---------------- IO：抓快照 / 并入账号 ----------------

/** 持**当前**会话读满六张表；从未登录或一行都没有 → null（无需合并）。 */
export async function captureLocalSnapshot(rest: SupabaseRest): Promise<LocalSnapshot | null> {
  const session = rest.getSession();
  if (!session) return null;

  const rows = {} as Record<MergeTable, Row[]>;
  await Promise.all(
    MERGE_TABLES.map(async (table) => {
      rows[table] = await rest.select<Row>(table, `select=*&user_id=eq.${session.userId}`);
    })
  );

  const total = MERGE_TABLES.reduce((sum, table) => sum + rows[table].length, 0);
  if (total === 0) return null;
  return { anonUserId: session.userId, rows };
}

/**
 * 把快照并入当前（已登录的）账号：读账号现有行 → 去重计划 → 逐表批量插入。
 * 任何一张表失败即抛出（快照保留，可重试）；全部成功返回每表写入/跳过条数。
 */
export async function mergeSnapshotIntoAccount(
  rest: SupabaseRest,
  snapshot: LocalSnapshot
): Promise<MergeSummary> {
  const session = await rest.ensureSession();
  if (!session) throw new SupabaseError('auth', '尚未登录：合并前需先登录账号');

  const accountRows = {} as Partial<Record<MergeTable, Row[]>>;
  await Promise.all(
    MERGE_TABLES.map(async (table) => {
      accountRows[table] = await rest.select<Row>(table, `select=*&user_id=eq.${session.userId}`);
    })
  );

  const plan = planMerge(snapshot, accountRows, session.userId);

  const results = await Promise.allSettled(
    MERGE_TABLES.map((table) => rest.insertMany(table, plan.toInsert[table]))
  );
  const failure = results.find((r) => r.status === 'rejected');
  if (failure && failure.status === 'rejected') throw failure.reason;

  const summary = {} as MergeSummary;
  for (const table of MERGE_TABLES) {
    summary[table] = { inserted: plan.toInsert[table].length, skipped: plan.skipped[table] };
  }
  return summary;
}

/** 合并待办快照（没有待办返回 null）；成功后清除。 */
export async function runPendingMerge(rest: SupabaseRest): Promise<MergeSummary | null> {
  const snapshot = loadPending();
  if (!snapshot) return null;
  const session = await rest.ensureSession();
  if (!session) throw new SupabaseError('auth', '尚未登录：合并前需先登录账号');
  if (snapshot.targetUserId && snapshot.targetUserId !== session.userId) {
    throw new SupabaseError('auth', '待合并的记录属于另一个账号：请先登录那个账号');
  }
  const summary = await mergeSnapshotIntoAccount(rest, snapshot);
  clearPending();
  return summary;
}

/** 回执文案用：本次实际并入账号的条数。 */
export function summaryInserted(summary: MergeSummary): number {
  return MERGE_TABLES.reduce((total, table) => total + summary[table].inserted, 0);
}
