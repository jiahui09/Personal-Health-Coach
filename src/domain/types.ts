/**
 * 派生指标与决策结果类型（Raw → Derived → Decision）
 *
 * 这些类型只描述「算出来的东西」，不含任何 UI 文案；
 * 展示层拿到它们之后只负责措辞。
 */

import type { LifeCategory, LifeLog, WorkoutRecord } from '../types/health';
import type { EvidenceStatus } from './policy';

// ---------------- 数据质量（Decision） ----------------

export type DataQualityFlag = 'normal' | 'needs_review' | 'insufficient';

export type DataQualityReason =
  | 'weight_deviates_from_rolling_mean'
  | 'insufficient_weight_days'
  | 'nutrition_over_plausible_range'
  | 'insufficient_sleep_nights';

export interface DataQuality {
  flag: DataQualityFlag;
  reasons: DataQualityReason[];
  /** 支撑该判定的真实数值（偏离公斤数、比例、有效日数…），文案直接引用。 */
  detail: Record<string, number>;
  /** 与参照相比的方向（如体重高于/低于近七日均重），由 domain 判定。 */
  comparison?: 'above' | 'below';
}

// ---------------- 今日任务（Derived） ----------------

export interface TaskProgress {
  /** 有效任务数（不含 skipped）。 */
  total: number;
  completed: number;
  skipped: number;
  ratio: number;
}

// ---------------- 体重（Derived + Decision） ----------------

export interface DailyWeightPoint {
  dayKey: string;
  /** 当日代表值（当日最新一次有效测量）。 */
  weight: number;
  /** 当日原始测量条数。 */
  readings: number;
}

export interface WeightSummary {
  /** 今日有记录取今日，否则取窗口内最后一日；无记录为 null。 */
  latest: number | null;
  latestDayKey: string | null;
  /** 近三十日内原始条数。 */
  readingCount: number;
  /** 近三十日内有记录的日数。 */
  daysWithRecords: number;
  windowDays: number;
  firstInWindow: DailyWeightPoint | null;
  lastInWindow: DailyWeightPoint | null;
  /** 近三十日每日代表值（升序），供图表直接使用。 */
  series: DailyWeightPoint[];
  /** 端点变化 = 末值 − 首值（kg）。 */
  endpointChangeKg: number | null;
  /** 近七日有效日均重。 */
  rollingMean7d: number | null;
  rollingMean7dDays: number;
  /** 回归斜率折合每周（kg/周）。 */
  trendKgPerWeek: number | null;
  trendDays: number;
  direction: 'down' | 'up' | 'flat' | 'insufficient_data';
  quality: DataQuality;
}

// ---------------- 营养（Derived + Decision） ----------------

export interface NutritionProgress {
  consumed: number;
  target: number;
  ratio: number;
  /** 未达目标时的余量（达或超则为 0）。 */
  remaining: number;
  /** 超出目标的量（未超则为 0）。 */
  over: number;
  status: 'under' | 'met' | 'over';
}

export interface NutritionSummary {
  calories: NutritionProgress;
  protein: NutritionProgress;
  /** 今日已确认入账的膳数。 */
  mealCount: number;
  quality: DataQuality;
}

// ---------------- 睡眠（Derived） ----------------

export interface SleepNight {
  dayKey: string;
  minutes: number;
  source: 'interval' | 'duration';
  sleepStart?: string;
  wakeTime?: string;
}

export interface SleepSummary {
  /** 今日之眠（单一来源）。 */
  today: SleepNight | null;
  /** 近七日平均（仅按有记录的夜数平均）。 */
  avgMinutes: number | null;
  /** 均值的小时表述（一位小数），换算在 domain 完成。 */
  avgHours: number | null;
  nights: number;
  windowDays: number;
  /** 近七日均是否达参考目标；无记录为 null。 */
  meetsReference: boolean | null;
  /** 均值相对参考目标之比例（无记录为 null）——页面不再自除。 */
  ratioOfTarget: number | null;
  quality: DataQuality;
}

// ---------------- 训练（Decision） ----------------

export type WorkoutMode = 'rest' | 'recovery' | 'light' | 'normal';

export type WorkoutReason =
  | 'workout_completed_today'
  | 'no_wellbeing_record'
  | 'high_soreness'
  | 'low_energy'
  | 'short_sleep'
  | 'moderate_energy'
  | 'moderate_soreness'
  | 'ready';

export interface WorkoutDecision {
  mode: WorkoutMode;
  reasons: WorkoutReason[];
  /** 判定时实际使用的阈值快照，供文案与稽核直接引用。 */
  thresholds: {
    lowEnergyMax: number;
    highSorenessMin: number;
    shortSleepHours: number;
    moderateEnergy: number;
    moderateSoreness: number;
  };
  evidenceStatus: EvidenceStatus;
}

export interface ResistanceProgress {
  /** 本周（周一起）已完成的抗阻次数。 */
  completed: number;
  target: number;
  ratio: number;
  /** 距目标还差几次（已达为 0）。 */
  remaining: number;
  /** 是否已达本周目标（判定在 domain，组件不再比较）。 */
  met: boolean;
  /** 本周全部已完成训练次数（含非抗阻），用于区分「抗阻」与「所有运动」。 */
  totalWorkoutsThisWeek: number;
}

export interface TrainingSummary {
  decision: WorkoutDecision;
  /** 今日已录的实际训练（没有则为 null）。 */
  todaySession: WorkoutRecord | null;
  resistance: ResistanceProgress;
}

// ---------------- 生活纪事 / 手记（Derived） ----------------

export interface ActivityCategorySummary {
  category: LifeCategory;
  minutes: number;
  /** 该分类的记录条数（「某一行为之次数」）。 */
  sessions: number;
  /** 占本窗口总时长的比例（0–1，按分钟算）。 */
  share: number;
}

export interface ActivitySummary {
  /** 窗口说明，直接可读（如「本周（周一起）」）。 */
  windowLabel: string;
  totalMinutes: number;
  byCategory: ActivityCategorySummary[];
  /** 有实际时长的记录。 */
  logs: LifeLog[];
}

export interface JournalSummary {
  windowLabel: string;
  count: number;
  entries: LifeLog[];
}
