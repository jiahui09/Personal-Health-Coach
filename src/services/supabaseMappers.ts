/**
 * 行 到 域模型 映射（PostgREST 表结构见 supabase/schema.sql）
 *
 * 规则：
 *   - 列名 snake_case，域模型 camelCase；只做形状转换，不做任何计算。
 *   - Postgres 的 time 返回 "HH:MM:SS"，统一裁成 "HH:MM"（域里只用到分钟粒度）。
 *   - 睡眠两分支互斥：有就寝/起身→interval；否则有手录眠时→duration；都没有→字段缺席。
 *   - 缺失字段保留 undefined，绝不填默认值（协议同 domain/migrate.ts）。
 */

import {
  DailyState,
  MealRecord,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const clock = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s.slice(0, 5) : undefined;
};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

// ---------------- profiles ----------------

export function profileFromRow(row: Row): UserProfile {
  const profile: UserProfile = {};
  const name = str(row.name);
  if (name) profile.name = name;
  if (row.sex === 'female' || row.sex === 'male' || row.sex === 'other') profile.sex = row.sex;
  const birthYear = num(row.birth_year);
  if (birthYear !== undefined) profile.birthYear = birthYear;
  const height = num(row.height_cm);
  if (height !== undefined) profile.heightCm = height;
  if (
    row.activity_level === 'sedentary' ||
    row.activity_level === 'light' ||
    row.activity_level === 'moderate' ||
    row.activity_level === 'active' ||
    row.activity_level === 'very_active'
  ) {
    profile.activityLevel = row.activity_level;
  }
  const waist = num(row.waist_cm);
  if (waist !== undefined) profile.waistCm = waist;
  if (
    row.goal === 'fat loss' ||
    row.goal === 'maintain' ||
    row.goal === 'muscle gain' ||
    row.goal === 'general fitness'
  ) {
    profile.goal = row.goal;
  }
  if (row.goal_source === 'user' || row.goal_source === 'advice') {
    profile.goalSource = row.goal_source;
  }
  return profile;
}

/** 档案只写「用户确实填过」的字段：undefined 的键不进 patch，避免把已存值抹成 null。 */
export function profileToRow(userId: string, profile: UserProfile): Row {
  const row: Row = { user_id: userId, updated_at: new Date().toISOString() };
  if (profile.name !== undefined) row.name = profile.name;
  if (profile.sex !== undefined) row.sex = profile.sex;
  if (profile.birthYear !== undefined) row.birth_year = profile.birthYear;
  if (profile.heightCm !== undefined) row.height_cm = profile.heightCm;
  if (profile.activityLevel !== undefined) row.activity_level = profile.activityLevel;
  if (profile.waistCm !== undefined) row.waist_cm = profile.waistCm;
  if (profile.goal !== undefined) row.goal = profile.goal;
  if (profile.goalSource !== undefined) row.goal_source = profile.goalSource;
  return row;
}

// ---------------- weight_records ----------------

export function weightFromRow(row: Row): WeightRecord | null {
  const date = str(row.measured_on);
  const weight = num(row.weight_kg);
  const id = str(row.id);
  if (!date || weight === undefined || !id) return null;
  return {
    id,
    date,
    weight,
    source: row.source === 'scale' ? 'scale' : 'manual',
    time: clock(row.measured_at),
    note: str(row.note),
  };
}

export function weightToRow(userId: string, record: WeightRecord): Row {
  return {
    user_id: userId,
    measured_on: record.date,
    measured_at: record.time ?? null,
    weight_kg: record.weight,
    source: record.source,
    note: record.note ?? null,
  };
}

// ---------------- daily_states ----------------

export function stateFromRow(row: Row): DailyState | null {
  const date = str(row.on_date);
  if (!date) return null;
  const state: DailyState = { date };
  const sleepStart = clock(row.sleep_start);
  const sleepWake = clock(row.sleep_wake);
  const sleepMinutes = num(row.sleep_minutes);
  if (sleepStart && sleepWake) state.sleep = { kind: 'interval', sleepStart, wakeTime: sleepWake };
  else if (sleepMinutes !== undefined && sleepMinutes > 0) {
    state.sleep = { kind: 'duration', minutes: sleepMinutes };
  }
  const energy = num(row.energy);
  if (energy !== undefined) state.energy = energy;
  const soreness = num(row.soreness);
  if (soreness !== undefined) state.soreness = soreness;
  const notes = str(row.notes);
  if (notes) state.notes = notes;
  return state;
}

export function stateToRow(userId: string, state: DailyState): Row {
  const row: Row = { user_id: userId, on_date: state.date };
  if (state.sleep?.kind === 'interval') {
    row.sleep_start = state.sleep.sleepStart;
    row.sleep_wake = state.sleep.wakeTime;
    row.sleep_minutes = null;
  } else if (state.sleep?.kind === 'duration') {
    row.sleep_start = null;
    row.sleep_wake = null;
    row.sleep_minutes = state.sleep.minutes;
  } else {
    row.sleep_start = null;
    row.sleep_wake = null;
    row.sleep_minutes = null;
  }
  row.energy = state.energy ?? null;
  row.soreness = state.soreness ?? null;
  row.notes = state.notes ?? null;
  return row;
}

// ---------------- meals ----------------

export function mealFromRow(row: Row): MealRecord | null {
  const id = str(row.id);
  const date = str(row.eaten_on);
  const name = str(row.name);
  if (!id || !date || !name) return null;
  const category = row.category;
  return {
    id,
    date,
    time: clock(row.eaten_at) ?? '00:00',
    category:
      category === 'breakfast' || category === 'lunch' || category === 'dinner' || category === 'snack'
        ? category
        : 'snack',
    name,
    foods: Array.isArray(row.foods) ? (row.foods as string[]) : [],
    estimatedCalories: num(row.calories_kcal) ?? 0,
    estimatedProtein: num(row.protein_g) ?? 0,
    source:
      row.source === 'suggested' || row.source === 'database' ? row.source : 'manual',
    confirmed: bool(row.confirmed, true),
  };
}

export function mealToRow(userId: string, meal: Omit<MealRecord, 'id'>): Row {
  return {
    user_id: userId,
    eaten_on: meal.date,
    eaten_at: meal.time,
    category: meal.category,
    name: meal.name,
    foods: meal.foods,
    calories_kcal: meal.estimatedCalories,
    protein_g: meal.estimatedProtein,
    source: meal.source,
    confirmed: meal.confirmed,
  };
}

// ---------------- workout_sessions ----------------

export function workoutFromRow(row: Row): WorkoutRecord | null {
  const id = str(row.id);
  const date = str(row.performed_on);
  const title = str(row.title);
  if (!id || !date || !title) return null;
  const category = row.category;
  return {
    id,
    date,
    time: clock(row.performed_at) ?? '00:00',
    title,
    durationMinutes: num(row.duration_minutes) ?? 0,
    durationSource: row.duration_source === 'actual' ? 'actual' : 'estimated',
    exercises: Array.isArray(row.exercises) ? (row.exercises as WorkoutRecord['exercises']) : [],
    perceivedDifficulty:
      row.perceived_difficulty === 'light' ||
      row.perceived_difficulty === 'moderate' ||
      row.perceived_difficulty === 'challenging'
        ? row.perceived_difficulty
        : 'moderate',
    completed: bool(row.completed, true),
    feeling: str(row.feeling),
    category:
      category === 'resistance' ||
      category === 'recovery' ||
      category === 'cardio' ||
      category === 'mobility' ||
      category === 'other'
        ? category
        : 'resistance',
  };
}

export function workoutToRow(userId: string, workout: Omit<WorkoutRecord, 'id'>): Row {
  return {
    user_id: userId,
    performed_on: workout.date,
    performed_at: workout.time,
    title: workout.title,
    duration_minutes: workout.durationMinutes,
    duration_source: workout.durationSource,
    category: workout.category,
    exercises: workout.exercises,
    perceived_difficulty: workout.perceivedDifficulty,
    completed: workout.completed,
    feeling: workout.feeling ?? null,
  };
}

// ---------------- todos ----------------

export function todoFromRow(row: Row): TodoItem | null {
  const id = str(row.id);
  const title = str(row.title);
  const date = str(row.on_date);
  if (!id || !title || !date) return null;
  const status = row.status;
  const priority = row.priority;
  const category = row.category;
  return {
    id,
    title,
    date,
    estimatedMinutes: num(row.estimated_minutes),
    priority:
      priority === 'low' || priority === 'medium' || priority === 'high' ? priority : undefined,
    status: status === 'done' || status === 'skipped' || status === 'todo' ? status : 'todo',
    category:
      category === 'workout' || category === 'reading' || category === 'work' || category === 'life'
        ? category
        : undefined,
  };
}

export function todoToRow(userId: string, todo: Omit<TodoItem, 'id'>): Row {
  return {
    user_id: userId,
    on_date: todo.date,
    title: todo.title,
    estimated_minutes: todo.estimatedMinutes ?? null,
    priority: todo.priority ?? null,
    status: todo.status,
    category: todo.category ?? null,
  };
}
