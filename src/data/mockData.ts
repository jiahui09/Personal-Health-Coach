/**
 * Personal Health Coach · Living Journal - Clean Mock Dataset (V3)
 * Anchor date: 2026-09-24
 */

import {
  DailyNote,
  DailyState,
  LifeLog,
  MealRecord,
  TodoItem,
  UserProfile,
  WeeklyLifeStat,
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
    exercises: [
      { name: '徒手深蹲', sets: 3, repsOrDuration: '12 次', movementPattern: 'lower body' },
      { name: '标准俯卧撑', sets: 3, repsOrDuration: '10 次', movementPattern: 'push' },
      { name: '双腿臀桥', sets: 2, repsOrDuration: '12 次', movementPattern: 'posterior chain' },
      { name: '平板支撑', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core' },
    ],
    perceivedDifficulty: 'moderate',
    completed: true,
  },
  {
    id: 'wo-2',
    date: '2026-09-22',
    time: '19:00',
    title: '下肢与核心轻负荷循环',
    durationMinutes: 16,
    exercises: [
      { name: '徒手深蹲', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body' },
      { name: '死虫式', sets: 2, repsOrDuration: '每侧 6 次', movementPattern: 'core' },
      { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain' },
    ],
    perceivedDifficulty: 'light',
    completed: true,
  },
];

// V3 TODAY: Todos
export const INITIAL_TODOS: TodoItem[] = [
  {
    id: 'todo-1',
    title: '完成产品核心架构手记',
    date: TODAY_STR,
    estimatedMinutes: 45,
    priority: 'high',
    completed: false,
    category: 'work',
  },
  {
    id: 'todo-2',
    title: '阅读 1 篇抗阻训练文献',
    date: TODAY_STR,
    estimatedMinutes: 30,
    priority: 'medium',
    completed: false,
    category: 'reading',
  },
  {
    id: 'todo-3',
    title: '徒手自重轻量练习 (16 min)',
    date: TODAY_STR,
    estimatedMinutes: 16,
    priority: 'medium',
    completed: false,
    category: 'workout',
  },
  {
    id: 'todo-4',
    title: '采购新鲜蔬菜与优质蛋白质食材',
    date: TODAY_STR,
    estimatedMinutes: 20,
    priority: 'low',
    completed: true,
    category: 'life',
  },
];

// V3 LIFE: Life logs & moments
export const INITIAL_LIFE_LOGS: LifeLog[] = [
  {
    id: 'life-1',
    date: '2026-09-24',
    title: '完成 Living Journal 核心架构解耦',
    content: '彻底厘清 evidence_derived、evidence_constrained 与 engineering_heuristic 的三层边界，不留含糊地落地为纯函数。',
    category: 'Coding',
    durationMinutes: 240,
    project: 'Personal Health Coach',
  },
  {
    id: 'life-2',
    date: '2026-09-23',
    title: '深入研读 Hall 2011 动态非线性能量模型',
    content: '摆脱静态 3500 kcal = 1 lb 的机械假设，理解机体代谢自适应与减脂减速的自然生理规律。',
    category: 'Learning',
    durationMinutes: 180,
    project: 'Metabolic Foundations',
  },
  {
    id: 'life-3',
    date: '2026-09-22',
    title: '开始纯徒手自重渐进抗阻训练',
    content: '专注于动作控制、离心张力与力竭预留 (RIR 2)，不依赖器械，身体依然有扎实的张力反馈。',
    category: 'Exercise',
    durationMinutes: 45,
  },
  {
    id: 'life-4',
    date: '2026-09-21',
    title: '研读 Morton 2018 与 Schoenfeld 2018 全文',
    content: '厘清群体平台拐点与单餐实用建议的差异，明确文献的统计性质与个体局限性。',
    category: 'Reading',
    durationMinutes: 120,
  },
];

// Factual Weekly Stats (Zero value judgments, pure facts)
export const INITIAL_WEEKLY_LIFE_STATS: WeeklyLifeStat[] = [
  { category: 'Coding', hours: 8.4 },
  { category: 'Learning', hours: 6.2 },
  { category: 'Exercise', hours: 1.5, sessions: 3 },
  { category: 'Reading', hours: 2.1 },
];

export const INITIAL_DAILY_NOTES: DailyNote[] = [
  {
    id: 'note-1',
    date: TODAY_STR,
    content: '今天终于把这个项目的核心模型想清楚了。记录事实，模型计算，给出下一步，持续观察模型预测与真实结果的差异。',
    tags: ['#architecture', '#living-journal'],
    timestamp: '14:20',
  },
];
