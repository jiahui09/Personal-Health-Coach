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
  /** 每日训练规划器（离线排课）——全部条目为 engineering_heuristic。 */
  planner: TrainingPlannerPolicy;
}

export interface TrainingPlannerPolicy {
  /** 每日时间预算：默认 / 下限 / 上限（分钟），档内可改。 */
  budgetDefaultMinutes: number;
  budgetMinMinutes: number;
  budgetMaxMinutes: number;
  /** 热身预留（分钟）：动作估时之和不得吃满预算。 */
  warmupReserveMinutes: number;
  /** 恢复门（天）：同模式（部位）不足此间隔不重复排同族动作（工程近似 ≥48h 同肌群恢复）。 */
  recoveryGapDays: number;
  /** 摄入就绪门：今日热量或蛋白达成低于此比例 → 常规降轻量（短眠维度已由上游状态门处理）。 */
  intakeReadyRatio: number;
  /** 周目标组数（trailing 7 天口径）：缺口 × 恢复门 × 目标权重 = 排课优先级。 */
  weeklyPatternSets: Record<string, number>;
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

/**
 * 目标与处方政策：热量比例、安全下限、目标速率、蛋白区间、抗阻日数。
 * 数值本身是工程启发式（除蛋白区间引 Morton 2018、抗阻基线引 WHO 2020）。
 */
export const TARGET_POLICY = {
  loseRatio: 0.8, // 减脂：TDEE −20%
  maintainRatio: 1.0,
  gainRatio: 1.1, // 增重：TDEE +10%
  /** 长期低于此值需专业指导（安全下限，非处方）。 */
  calorieFloor: { male: 1500, female: 1200 },
  /** 目标速率（%体重/周）。 */
  loseRatePctPerWeek: { min: 0.5, max: 1.0 },
  gainRatePctPerWeek: { min: 0.25, max: 0.5 },
  /** 蛋白目标区间（Morton 2018，g/kg/日）。 */
  proteinGPerKg: { min: 1.4, max: 2.0 },
  /** 脂肪目标区间（g/kg/日）：下限保激素与脂溶维生素所需，上限防脂肪过剩——工程启发式。 */
  fatGPerKg: { min: 0.6, max: 1.0 },
  /** 训练日热量上调：比例与封顶（kcal）取小者；依据为训练日能量可用性调节（工程启发式）。 */
  trainingDayKcalPct: 1.1,
  trainingDayKcalCap: 400,
  /** 抗阻：人群基线（WHO 2020）与按目标/活动水平的上调。 */
  resistanceDaysBaseline: 2,
  resistanceDaysForMuscleGain: 3,
  resistanceDaysActive: 4,
} as const;

export const TRAINING_POLICY: TrainingDecisionPolicy = {
  lowEnergyMax: 2,
  highSorenessMin: 4,
  shortSleepHours: 6,
  moderateEnergy: 3,
  moderateSoreness: 3,
  weeklyResistanceTarget: 2,
  evidenceStatus: 'engineering_heuristic',
  planner: {
    budgetDefaultMinutes: 30,
    budgetMinMinutes: 10,
    budgetMaxMinutes: 180,
    warmupReserveMinutes: 2,
    recoveryGapDays: 2,
    intakeReadyRatio: 0.5,
    weeklyPatternSets: {
      push: 9,
      'lower body': 9,
      'posterior chain': 6,
      core: 6,
      'pull (limited)': 4,
      cardio: 3,
    },
    evidenceStatus: 'engineering_heuristic',
  },
};

export const SLEEP_POLICY: SleepPolicy = {
  targetMinutes: 7 * 60,
};

/** 参考目标的「时」表述（供页面直接引用，组件不再自算分钟→时）。 */
export const SLEEP_REFERENCE_HOURS = SLEEP_POLICY.targetMinutes / 60;

export const WEIGHT_POLICY: WeightPolicy = {
  rollingAvgDays: 7,
  trendWindowDays: 30,
  // 周变不足 0.2 kg 落在量测噪声与水钠波动之内,读作持平;
  // 旧值 0.05 会把日常噪声读成「在涨/在跌」（2026 审查裁决）。
  directionThresholdKgPerWeek: 0.2,
  minDaysForTrend: 3,
  anomalyAbsKg: 1.5,
  anomalyRatio: 0.02,
};

export const NUTRITION_POLICY: NutritionPolicy = {
  overRatioReview: 2,
  minPlausibleKcal: 200,
};

