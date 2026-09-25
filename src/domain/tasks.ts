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
