/**
 * 时间层 · 唯一的「今天 / 本周 / 近七日 / 近三十日」
 *
 * 全站所有窗口判定都从这里取键（本地日键 YYYY-MM-DD，字典序即时间序）：
 * 组件不得自行调用 new Date()，也不得自行加减天数。
 *
 * - Today      : [今天 00:00, 明天 00:00)
 * - ThisWeek   : 周一 00:00 → 周日 23:59:59.999（ISO 周）
 * - Last7Days  : 滚动七日（今天 + 前六日）
 * - Last30Days : 滚动三十日（今天 + 前廿九日）
 */

export interface DayContext {
  /** 注入的时刻，全站唯一时间来源。 */
  now: Date;
  /** 本地日键 YYYY-MM-DD。 */
  todayKey: string;
  /** 本地小时 0–23，供餐位与时问候使用。 */
  hour: number;
  /** 本周（周一）首日与末日。 */
  weekStartKey: string;
  weekEndKey: string;
  /** 含今天的滚动窗口，升序。 */
  last7Keys: string[];
  last30Keys: string[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 本地日键（不涉 UTC 换算，避免时区漂移）。 */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 日键 + n 天（以本地正午为锚，规避夏令时偏移）。 */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return toDayKey(date);
}

/** 「YYYY-MM-DD」→ 本地正午时刻，仅供展示层做礼拜/干支换算。 */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** 本周首日：以周一为一周之始。 */
export function weekStartKeyOf(key: string): string {
  const dow = (fromDayKey(key).getDay() + 6) % 7; // 0 = 周一
  return addDays(key, -dow);
}

export function makeDayContext(now: Date): DayContext {
  const todayKey = toDayKey(now);
  const weekStartKey = weekStartKeyOf(todayKey);
  return {
    now,
    todayKey,
    hour: now.getHours(),
    weekStartKey,
    weekEndKey: addDays(weekStartKey, 6),
    last7Keys: Array.from({ length: 7 }, (_, i) => addDays(todayKey, i - 6)),
    last30Keys: Array.from({ length: 30 }, (_, i) => addDays(todayKey, i - 29)),
  };
}

/** 日键是否落在 [startKey, endKey] 闭区间内。 */
export function withinWindow(key: string, startKey: string, endKey: string): boolean {
  return key >= startKey && key <= endKey;
}

export const isInWeek = (ctx: DayContext, key: string): boolean =>
  withinWindow(key, ctx.weekStartKey, ctx.weekEndKey);
export const isInLast7 = (ctx: DayContext, key: string): boolean => ctx.last7Keys.includes(key);
export const isInLast30 = (ctx: DayContext, key: string): boolean => ctx.last30Keys.includes(key);

/** 窗口的中文标签，供页面文案直接引用（防止「本周」与「近七日」互相冒充）。 */
export const WINDOW_CN = {
  today: '今日',
  thisWeek: '本周（周一起）',
  last7: '近七日',
  last30: '近三十日',
} as const;
