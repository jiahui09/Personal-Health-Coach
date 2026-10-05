/**
 * 今日任务（Derived）
 *
 * Task = 「今天准备做什么」。完成与否只看 status，绝不由「有时长」反推；
 * estimatedMinutes 永远是计划值，不当时长记录使用。
 */

import type { TodoItem } from '../types/health';
import type { TaskProgress } from './types';

export const isActiveTask = (todo: TodoItem): boolean => todo.status !== 'skipped';

/** 当日的任务（按日期过滤；跨日任务不得混入今日）。 */
export function tasksForDay(todos: TodoItem[], dayKey: string): TodoItem[] {
  return todos.filter((todo) => todo.date === dayKey);
}

/** 全站唯一的任务完成率计算。 */
export function calculateTaskProgress(todos: TodoItem[]): TaskProgress {
  const active = todos.filter(isActiveTask);
  const completed = active.filter((todo) => todo.status === 'done').length;
  return {
    total: active.length,
    completed,
    skipped: todos.length - active.length,
    ratio: active.length > 0 ? completed / active.length : 0,
  };
}

/** 拟时长的取值域：1 分钟至 12 小时（一天的待办不至离谱）。 */
const ESTIMATE_MIN_MINUTES = 1;
const ESTIMATE_MAX_MINUTES = 720;

/**
 * 拟时长规范化（录入与改录共用）：字符串或数字 → 整数分钟。
 * 空、非法、越界之外的取值夹回 [1, 720]；空或非法返回 null（即「无时长」）。
 */
export function normalizeEstimateMinutes(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === '') return null;
  const parsed = typeof trimmed === 'string' ? Number(trimmed) : trimmed;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < ESTIMATE_MIN_MINUTES) return null;
  return Math.min(rounded, ESTIMATE_MAX_MINUTES);
}
