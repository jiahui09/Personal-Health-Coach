/**
 * 生活纪事（ActivityLog → 统计）与近来手记（JournalEntry → 计数）
 *
 * 二者共用一张 LifeLog 表，但派生规则不同：
 *   - 时长统计只数 durationMinutes（先合分钟，最后一处转时）
 *   - 手记条数只数「有文字」的行
 * 因此「一段时间」与「一篇手记」不会被重复计算成两件事。
 */

import type { LifeCategory, LifeLog } from '../types/health';
import { ACTIVITY_POLICY, LIFE_CATEGORY_ORDER, type ActivityPolicy } from './policy';
import type { ActivityCategorySummary, ActivitySummary, JournalSummary } from './types';
import { WINDOW_CN, isInLast7, isInWeek, type DayContext } from './time';

export const hasJournalText = (log: LifeLog): boolean =>
  typeof log.content === 'string' && log.content.trim().length > 0;

export const hasDuration = (log: LifeLog): boolean =>
  Number.isFinite(log.durationMinutes) && log.durationMinutes > 0;

/** 本周（周一起）活动时长与分类统计。 */
export function activitySummary(
  logs: LifeLog[],
  ctx: DayContext,
  _policy: ActivityPolicy = ACTIVITY_POLICY
): ActivitySummary {
  const windowLogs = logs.filter((log) => isInWeek(ctx, log.date) && hasDuration(log));
  const totalMinutes = windowLogs.reduce((sum, log) => sum + log.durationMinutes, 0);

  const byCategory: ActivityCategorySummary[] = LIFE_CATEGORY_ORDER.map((category) => {
    const rows = windowLogs.filter((log) => log.category === category);
    const minutes = rows.reduce((sum, log) => sum + log.durationMinutes, 0);
    return {
      category: category as LifeCategory,
      minutes,
      sessions: rows.length,
      share: totalMinutes > 0 ? minutes / totalMinutes : 0,
    };
  }).filter((row) => row.minutes > 0);

  return { windowLabel: WINDOW_CN.thisWeek, totalMinutes, byCategory, logs: windowLogs };
}

/** 近七日手记条目（只认有文字的行，按日期倒序）。 */
export function journalSummary(
  logs: LifeLog[],
  ctx: DayContext,
  policy: ActivityPolicy = ACTIVITY_POLICY
): JournalSummary {
  const entries = logs
    .filter((log) => isInLast7(ctx, log.date) && hasJournalText(log))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    windowLabel: WINDOW_CN.last7,
    count: entries.length,
    entries,
  };
}

export { ACTIVITY_POLICY };
