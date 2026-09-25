/**
 * Personal Health Coach · Living Journal — seed dataset.
 *
 * 全部日期由传入的时钟推导（不再是模块加载时冻结），因此：
 *   1. 演示数据永远落在正确的今日/本周窗口内；
 *   2. 测试可注入固定 clock，得到完全确定的窗口与统计。
 *
 * seed 只提供「原始记录」；任何统计都不在这里，一律由 domain/ 派生。
 */

import {
  DailyNote,
  DailyState,
  LifeLog,
  MealRecord,
  TodoItem,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar date n days before `from` (0 = that day), as YYYY-MM-DD. */
export function daysAgo(from: Date, n: number): string {
  const date = new Date(from);
  date.setDate(date.getDate() - n);
  return toDateString(date);
}

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

/** 30 readings, oldest → today: a slow, realistic downward drift with daily noise. */
const SEED_WEIGHTS = [
  69.3, 69.2, 69.4, 69.1, 69.0, 69.2, 69.2, 69.0, 68.9, 69.1,
  68.8, 68.7, 68.9, 68.8, 68.6, 68.7, 68.5, 68.6, 68.5, 68.4,
  68.3, 68.5, 68.3, 68.6, 68.4, 68.3, 68.5, 68.4, 68.5, 68.4,
];

export interface SeedData {
  profile: UserProfile;
  weightHistory: WeightRecord[];
  dailyStates: DailyState[];
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  todos: TodoItem[];
  lifeLogs: LifeLog[];
  notes: DailyNote[];
}

export function createSeedData(now: Date): SeedData {
  const today = toDateString(now);
  const day = (n: number): string => daysAgo(now, n);

  const weightHistory: WeightRecord[] = SEED_WEIGHTS.map((weight, index) => ({
    id: `w-${String(index + 1).padStart(2, '0')}`,
    date: day(SEED_WEIGHTS.length - 1 - index),
    weight,
    source: 'manual' as const,
  }));

  // 睡眠只记今日一夜（如实：更早的夜没有记录，故近七日均只能按 1/7 夜报告）。
  const dailyStates: DailyState[] = [
    {
      date: today,
      sleep: { kind: 'interval', sleepStart: '00:55', wakeTime: '08:15' },
      energy: 4,
      soreness: 2,
      notes: '晨起神清，昨夜入睡安顺。',
    },
  ];

  const meals: MealRecord[] = [
    {
      id: 'm-1',
      date: today,
      time: '09:10',
      category: 'breakfast',
      name: '燕麦片配牛奶与香蕉',
      foods: ['燕麦 (60g)', '牛奶 (250ml)', '香蕉 (1根)'],
      estimatedCalories: 430,
      estimatedProtein: 21,
      source: 'manual',
      confirmed: true,
    },
    {
      id: 'm-2',
      date: today,
      time: '12:30',
      category: 'lunch',
      name: '去皮鸡腿肉 · 糙米饭 · 清炒时蔬',
      foods: ['鸡腿肉 (150g)', '糙米饭 (200g)', '西兰花 (150g)'],
      estimatedCalories: 590,
      estimatedProtein: 42,
      source: 'manual',
      confirmed: true,
    },
  ];

  const workouts: WorkoutRecord[] = [
    {
      id: 'wo-1',
      date: day(4),
      time: '18:15',
      title: '徒手基础循环',
      durationMinutes: 20,
      durationSource: 'estimated',
      exercises: [
        { name: '徒手深蹲', sets: 3, repsOrDuration: '12 次', movementPattern: 'lower body' },
        { name: '标准俯卧撑', sets: 3, repsOrDuration: '10 次', movementPattern: 'push' },
        { name: '双腿臀桥', sets: 2, repsOrDuration: '12 次', movementPattern: 'posterior chain' },
        { name: '平板支撑', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core' },
      ],
      perceivedDifficulty: 'moderate',
      completed: true,
      category: 'resistance',
    },
    {
      id: 'wo-2',
      date: day(2),
      time: '19:00',
      title: '下肢与核心轻负荷循环',
      durationMinutes: 16,
      durationSource: 'estimated',
      exercises: [
        { name: '徒手深蹲', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body' },
        { name: '死虫式', sets: 2, repsOrDuration: '每侧 6 次', movementPattern: 'core' },
        { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain' },
      ],
      perceivedDifficulty: 'light',
      completed: true,
      category: 'resistance',
    },
  ];

  const todos: TodoItem[] = [
    {
      id: 'todo-1',
      title: '著成产品核心架构札记',
      date: today,
      estimatedMinutes: 45,
      priority: 'high',
      status: 'todo',
      category: 'work',
    },
    {
      id: 'todo-2',
      title: '读抗阻训练文献一篇',
      date: today,
      estimatedMinutes: 30,
      priority: 'medium',
      status: 'todo',
      category: 'reading',
    },
    {
      id: 'todo-3',
      title: '徒手自重轻量练习',
      date: today,
      estimatedMinutes: 16,
      priority: 'medium',
      status: 'todo',
      category: 'workout',
    },
    {
      id: 'todo-4',
      title: '置办鲜蔬与优质蛋白食材',
      date: today,
      estimatedMinutes: 20,
      priority: 'low',
      status: 'done',
      category: 'life',
    },
  ];

  const lifeLogs: LifeLog[] = [
    {
      id: 'life-1',
      date: day(0),
      title: '促成决策引擎与手记页面之解耦',
      content: '将 evidence_derived、evidence_constrained 与 engineering_heuristic 之边界固化为类型，规则尽落于纯函数之中。',
      category: 'Coding',
      durationMinutes: 240,
      project: 'Personal Health Coach',
    },
    {
      id: 'life-2',
      date: day(1),
      title: '研读 Hall 2011 动态能量平衡模型',
      content: '记录静态 3500 kcal = 1 lb 规则之失效条件，兼记体重下降后代谢自适应如何减慢减重之势。',
      category: 'Learning',
      durationMinutes: 180,
      project: 'Metabolic Foundations',
    },
    {
      id: 'life-3',
      date: day(2),
      title: '徒手自重渐进抗阻训练',
      content: '俯卧撑与深蹲各 3 组，力竭前留 2 次（RIR 2），动作之控先于次数。',
      category: 'Exercise',
      durationMinutes: 45,
    },
    {
      id: 'life-4',
      date: day(3),
      title: '读毕 Morton 2018 与 Schoenfeld 2018',
      content: '区分群体层面蛋白质拐点之证据与单餐实用之建议，其统计性质与适用之界。',
      category: 'Reading',
      durationMinutes: 120,
    },
  ];

  const notes: DailyNote[] = [
    {
      id: 'note-1',
      date: today,
      content: '每周以模型所测与真实体重相较一次；偏差既大，先查记录有无遗漏，再议调整目标。',
      tags: ['#architecture', '#living-journal'],
      timestamp: '14:20',
    },
  ];

  return { profile: { ...INITIAL_USER_PROFILE }, weightHistory, dailyStates, meals, workouts, todos, lifeLogs, notes };
}
