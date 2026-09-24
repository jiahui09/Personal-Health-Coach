/**
 * Personal Health Coach - Clean Mock Dataset
 * Contains only the 5 core categories required to inform Next Meal & Next Workout.
 * Anchor date: 2026-09-24
 */

import {
  DailyState,
  MealRecord,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';

export const TODAY_STR = '2026-09-24';

export const INITIAL_USER_PROFILE: UserProfile = {
  name: 'Alex',
  age: 28,
  sex: 'male',
  height: 175,
  currentWeight: 68.4,
  goal: 'fat loss',
  dailyCalorieTarget: 1950,
  dailyProteinTarget: 110, // ~1.6 g/kg
};

export const INITIAL_WEIGHT_HISTORY: WeightRecord[] = [
  { id: 'w-01', date: '2026-08-26', weight: 69.3 },
  { id: 'w-02', date: '2026-08-27', weight: 69.2 },
  { id: 'w-03', date: '2026-08-28', weight: 69.4 },
  { id: 'w-04', date: '2026-08-29', weight: 69.1 },
  { id: 'w-05', date: '2026-08-30', weight: 69.0 },
  { id: 'w-06', date: '2026-08-31', weight: 69.2 },
  { id: 'w-07', date: '2026-09-01', weight: 69.2 }, // Month baseline
  { id: 'w-08', date: '2026-09-02', weight: 69.0 },
  { id: 'w-09', date: '2026-09-03', weight: 68.9 },
  { id: 'w-10', date: '2026-09-04', weight: 69.1 },
  { id: 'w-11', date: '2026-09-05', weight: 68.8 },
  { id: 'w-12', date: '2026-09-06', weight: 68.7 },
  { id: 'w-13', date: '2026-09-07', weight: 68.9 },
  { id: 'w-14', date: '2026-09-08', weight: 68.8 },
  { id: 'w-15', date: '2026-09-09', weight: 68.6 },
  { id: 'w-16', date: '2026-09-10', weight: 68.7 },
  { id: 'w-17', date: '2026-09-11', weight: 68.5 },
  { id: 'w-18', date: '2026-09-12', weight: 68.6 },
  { id: 'w-19', date: '2026-09-13', weight: 68.5 },
  { id: 'w-20', date: '2026-09-14', weight: 68.4 },
  { id: 'w-21', date: '2026-09-15', weight: 68.3 },
  { id: 'w-22', date: '2026-09-16', weight: 68.5 },
  { id: 'w-23', date: '2026-09-17', weight: 68.3 },
  { id: 'w-24', date: '2026-09-18', weight: 68.6 },
  { id: 'w-25', date: '2026-09-19', weight: 68.4 },
  { id: 'w-26', date: '2026-09-20', weight: 68.3 },
  { id: 'w-27', date: '2026-09-21', weight: 68.5 },
  { id: 'w-28', date: '2026-09-22', weight: 68.4 },
  { id: 'w-29', date: '2026-09-23', weight: 68.5 },
  { id: 'w-30', date: '2026-09-24', weight: 68.4 }, // Today: 68.4 kg (↓ 0.8 kg)
];

export const INITIAL_DAILY_STATE: DailyState = {
  date: TODAY_STR,
  sleepHours: 7.33, // 7h 20m
  sleepBedtime: '00:55',
  sleepWakeup: '08:15',
  energy: 4, // 1-5 (很好)
  soreness: 2, // 1-5 (轻微)
  notes: '晨起精神清爽，昨晚入睡顺利。',
};

export const INITIAL_MEALS: MealRecord[] = [
  {
    id: 'm-1',
    date: TODAY_STR,
    time: '09:10',
    category: 'breakfast',
    name: '燕麦片配牛奶与香蕉',
    foods: ['燕麦 (60g)', '牛奶 (250ml)', '香蕉 (1根)'],
    estimatedCalories: 430,
    estimatedProtein: 21,
  },
  {
    id: 'm-2',
    date: TODAY_STR,
    time: '12:30',
    category: 'lunch',
    name: '去皮鸡腿肉 · 糙米饭 · 清炒时蔬',
    foods: ['鸡腿肉 (150g)', '糙米饭 (200g)', '西兰花 (150g)'],
    estimatedCalories: 590,
    estimatedProtein: 42,
  },
];

export const INITIAL_RECENT_WORKOUTS: WorkoutRecord[] = [
  {
    id: 'wo-1',
    date: '2026-09-20',
    time: '18:15',
    title: '徒手基础循环',
    durationMinutes: 20,
    perceivedDifficulty: 'moderate',
    completed: true,
    exercises: [
      { name: '徒手深蹲 (Squat)', sets: 3, repsOrDuration: '12 次' },
      { name: '标准俯卧撑 (Push-up)', sets: 3, repsOrDuration: '10 次' },
      { name: '平板支撑 (Plank)', sets: 3, repsOrDuration: '30 秒' },
    ],
  },
  {
    id: 'wo-2',
    date: '2026-09-22',
    time: '17:45',
    title: '下肢与核心自重节律',
    durationMinutes: 22,
    perceivedDifficulty: 'moderate',
    completed: true,
    exercises: [
      { name: '交替后退箭步蹲 (Reverse Lunge)', sets: 3, repsOrDuration: '8 次 / 侧' },
      { name: '臀桥 (Glute Bridge)', sets: 3, repsOrDuration: '12 次' },
      { name: '死虫子 (Dead Bug)', sets: 3, repsOrDuration: '10 次 / 侧' },
    ],
  },
];
