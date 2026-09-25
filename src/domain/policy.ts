/**
 * 政策层 · 全部阈值与目标的唯一出处
 *
 * 规则：页面组件不得出现业务阈值字面量（2 / 4 / 6 / 7 / 1.5 / 0.05 …）；
 * 需要时从这里读。数值本身不改动既有行为，只把散落的常量收拢。
 */

export type EvidenceStatus = 'evidence_derived' | 'evidence_constrained' | 'engineering_heuristic';

export interface TrainingDecisionPolicy {
  /** 精力 ≤ 此值 → 恢复。 */
  lowEnergyMax: number;
  /** 酸痛 ≥ 此值 → 恢复。 */
  highSorenessMin: number;
  /** 眠时 < 此值（小时）→ 轻量。 */
  shortSleepHours: number;
  /** 精力恰为此值 → 轻量。 */
  moderateEnergy: number;
  /** 酸痛恰为此值 → 轻量。 */
  moderateSoreness: number;
  /** 每周抗阻目标（次），WHO 2020 建议每周两日。 */
  weeklyResistanceTarget: number;
  evidenceStatus: EvidenceStatus;
}

export interface SleepPolicy {
  /** 参考目标（分钟）：AASM 2015 每晚七时之基。 */
  targetMinutes: number;
}

export interface WeightPolicy {
  rollingAvgDays: number;
  trendWindowDays: number;
  /** 趋势方向阈值（kg/周），小于此幅度视为持平。 */
  directionThresholdKgPerWeek: number;
  /** 出趋势所需的最少有效日数。 */
  minDaysForTrend: number;
  /** 异常判定：|今录 − 近七日均| 超过 max(绝对阈值, 均值×比例) 即需核对。 */
  anomalyAbsKg: number;
  anomalyRatio: number;
}

export interface NutritionPolicy {
  /** 超过目标此倍数即视为所录越常度，需核对。 */
  overRatioReview: number;
  /** 有记录却低于此热量，同样提示核对。 */
  minPlausibleKcal: number;
}

export interface ActivityPolicy {
  /** 一周之始：周一起。 */
  weekStartsOn: 'monday';
  /** 近来手记的回看窗口（日）。 */
  journalWindowDays: number;
}

export const TRAINING_POLICY: TrainingDecisionPolicy = {
  lowEnergyMax: 2,
  highSorenessMin: 4,
  shortSleepHours: 6,
  moderateEnergy: 3,
  moderateSoreness: 3,
  weeklyResistanceTarget: 2,
  evidenceStatus: 'engineering_heuristic',
};

export const SLEEP_POLICY: SleepPolicy = {
  targetMinutes: 7 * 60,
};

/** 参考目标的「时」表述（供页面直接引用，组件不再自算分钟→时）。 */
export const SLEEP_REFERENCE_HOURS = SLEEP_POLICY.targetMinutes / 60;

export const WEIGHT_POLICY: WeightPolicy = {
  rollingAvgDays: 7,
  trendWindowDays: 30,
  directionThresholdKgPerWeek: 0.05,
  minDaysForTrend: 3,
  anomalyAbsKg: 1.5,
  anomalyRatio: 0.02,
};

export const NUTRITION_POLICY: NutritionPolicy = {
  overRatioReview: 2,
  minPlausibleKcal: 200,
};

export const ACTIVITY_POLICY: ActivityPolicy = {
  weekStartsOn: 'monday',
  journalWindowDays: 7,
};

/** 生活纪事分类的稳定次序（展示与聚合共用，避免各处各写一份）。 */
export const LIFE_CATEGORY_ORDER = ['Coding', 'Learning', 'Exercise', 'Reading', 'Life'] as const;
