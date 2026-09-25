/**
 * 存储形态迁移（Raw 的类型升级，绝不改数值）
 *
 * 旧形态 → 新形态：
 *   DailyState  单对象 → 数组；sleepHours/sleepBedtime/sleepWakeup → sleep 判别联合
 *   TodoItem    completed:boolean → status:'todo'|'done'|'skipped'
 *   WorkoutRecord          → + category / durationSource
 *   MealRecord             → + source
 *   LifeLog     content 必填 → 可选
 *   WeightRecord           → + source（date 为唯一窗口字段）
 *
 * 迁移是窄范围、有注释、双向测试的兼容兜底：只补字段与形态，不改任何一个数值。
 */

import type {
  DailyNote,
  DailyState,
  LifeLog,
  MealRecord,
  SleepEntry,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutCategory,
  WorkoutRecord,
} from '../types/health';

export const STORAGE_KEYS = {
  PROFILE: 'phc_profile_v3',
  WEIGHTS: 'phc_weights_v3',
  DAILY_STATE: 'phc_state_v3',
  MEALS: 'phc_meals_v3',
  WORKOUTS: 'phc_workouts_v3',
  TODOS: 'phc_todos_v3',
  LIFE_LOGS: 'phc_lifelogs_v3',
  NOTES: 'phc_notes_v3',
  AUTH: 'phc_auth_v3',
} as const;

type AnyRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AnyRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** 旧睡眠三字段 → 单一来源。有就寝与起身时刻则用区间，否则用手录眠时。 */
export function migrateSleep(raw: AnyRecord): SleepEntry | undefined {
  if (isRecord(raw.sleep)) {
    const existing = raw.sleep as AnyRecord;
    if (existing.kind === 'interval') {
      return {
        kind: 'interval',
        sleepStart: str(existing.sleepStart, '00:00'),
        wakeTime: str(existing.wakeTime, '00:00'),
      };
    }
    if (existing.kind === 'duration') {
      return { kind: 'duration', minutes: num(existing.minutes, 0) };
    }
  }
  const bedtime = typeof raw.sleepBedtime === 'string' ? raw.sleepBedtime : null;
  const wakeup = typeof raw.sleepWakeup === 'string' ? raw.sleepWakeup : null;
  if (bedtime && wakeup) {
    return { kind: 'interval', sleepStart: bedtime, wakeTime: wakeup };
  }
  if (typeof raw.sleepHours === 'number' && raw.sleepHours > 0) {
    return { kind: 'duration', minutes: Math.round(raw.sleepHours * 60) };
  }
  return undefined;
}

export function migrateState(raw: unknown): DailyState[] {
  return asArray(raw).map((item) => ({
    date: str(item.date, ''),
    sleep: migrateSleep(item),
    energy: typeof item.energy === 'number' ? item.energy : undefined,
    soreness: typeof item.soreness === 'number' ? item.soreness : undefined,
    notes: typeof item.notes === 'string' ? item.notes : undefined,
  }));
}

export function migrateWeights(raw: unknown): WeightRecord[] {
  return asArray(raw).map((item) => ({
    id: str(item.id, `w-${str(item.date, 'x')}`),
    date: str(item.date, ''),
    weight: num(item.weight, 0),
    note: typeof item.note === 'string' ? item.note : undefined,
    source: item.source === 'scale' ? 'scale' : 'manual',
    time: typeof item.time === 'string' ? item.time : undefined,
  }));
}

export function migrateTodos(raw: unknown): TodoItem[] {
  return asArray(raw).map((item) => ({
    id: str(item.id, `todo-${str(item.title, 'x')}`),
    title: str(item.title, ''),
    date: str(item.date, ''),
    estimatedMinutes:
      typeof item.estimatedMinutes === 'number' ? item.estimatedMinutes : undefined,
    priority:
      item.priority === 'low' || item.priority === 'medium' || item.priority === 'high'
        ? item.priority
        : undefined,
    status:
      item.status === 'done' || item.status === 'todo' || item.status === 'skipped'
        ? item.status
        : item.completed === true
        ? 'done'
        : 'todo',
    category:
      item.category === 'workout' ||
      item.category === 'reading' ||
      item.category === 'work' ||
      item.category === 'life'
        ? item.category
        : undefined,
  }));
}

const WORKOUT_CATEGORIES: WorkoutCategory[] = [
  'resistance',
  'recovery',
  'cardio',
  'mobility',
  'other',
];

export function migrateWorkouts(raw: unknown): WorkoutRecord[] {
  return asArray(raw).map((item) => {
    const category = WORKOUT_CATEGORIES.includes(item.category as WorkoutCategory)
      ? (item.category as WorkoutCategory)
      : // 存量数据只有徒手自重循环（seed 与「一键完成」皆然），按抗阻归类
        'resistance';
    return {
      id: str(item.id, 'wo-x'),
      date: str(item.date, ''),
      time: str(item.time, '00:00'),
      title: str(item.title, ''),
      durationMinutes: num(item.durationMinutes, 0),
      durationSource: item.durationSource === 'actual' ? 'actual' : 'estimated',
      exercises: Array.isArray(item.exercises) ? (item.exercises as WorkoutRecord['exercises']) : [],
      perceivedDifficulty:
        item.perceivedDifficulty === 'light' ||
        item.perceivedDifficulty === 'moderate' ||
        item.perceivedDifficulty === 'challenging'
          ? item.perceivedDifficulty
          : 'moderate',
      completed: item.completed === true,
      feeling: typeof item.feeling === 'string' ? item.feeling : undefined,
      category,
    };
  });
}

export function migrateMeals(raw: unknown): MealRecord[] {
  return asArray(raw).map((item) => ({
    id: str(item.id, 'meal-x'),
    date: str(item.date, ''),
    time: str(item.time, '00:00'),
    category:
      item.category === 'breakfast' ||
      item.category === 'lunch' ||
      item.category === 'dinner' ||
      item.category === 'snack'
        ? item.category
        : 'snack',
    name: str(item.name, ''),
    foods: Array.isArray(item.foods) ? (item.foods as string[]) : [],
    estimatedCalories: num(item.estimatedCalories, 0),
    estimatedProtein: num(item.estimatedProtein, 0),
    source:
      item.source === 'suggested' || item.source === 'database'
        ? item.source
        : 'manual',
    confirmed: item.confirmed !== false,
  }));
}

export function migrateLifeLogs(raw: unknown): LifeLog[] {
  return asArray(raw).map((item) => ({
    id: str(item.id, 'life-x'),
    date: str(item.date, ''),
    title: str(item.title, ''),
    content: typeof item.content === 'string' ? item.content : '',
    category:
      item.category === 'Coding' ||
      item.category === 'Learning' ||
      item.category === 'Exercise' ||
      item.category === 'Reading' ||
      item.category === 'Life'
        ? item.category
        : 'Life',
    durationMinutes: num(item.durationMinutes, 0),
    project: typeof item.project === 'string' ? item.project : undefined,
  }));
}

export function migrateNotes(raw: unknown): DailyNote[] {
  return asArray(raw).map((item) => ({
    id: str(item.id, 'note-x'),
    date: str(item.date, ''),
    content: str(item.content, ''),
    tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
    timestamp: str(item.timestamp, '00:00'),
  }));
}

export function migrateProfile(raw: unknown, fallback: UserProfile): UserProfile {
  if (!isRecord(raw)) return fallback;
  return { ...fallback, ...(raw as Partial<UserProfile>) };
}
