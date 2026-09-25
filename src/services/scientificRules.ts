/**
 * Scientific Rules & Mathematical Functions (V3 Living Journal Audited)
 *
 * Strict separation of:
 * - evidence_derived: Direct formulas & equations from literature (Mifflin-St Jeor 1990, Hall 2011).
 * - evidence_constrained: Constraints & ranges from systematic reviews/guidelines (Morton 2018, WHO diet, ACSM 2026).
 * - engineering_heuristic: Product logic bridging science to user action (energy threshold, ranking, progression).
 *
 * All functions are deterministic TypeScript pure functions: y = f(x).
 * LLM = OFF. No probabilistic randomness.
 */

import {
  BodyweightExercise,
  DecisionTrace,
  DietQualityAssessment,
  EnergyCalibration,
  HealthContext,
  ForecastPeriod,
  MealRecord,
  MealRecommendation,
  PerceivedDifficulty,
  RuleStatus,
  TodayData,
  TrainingState,
  UserProfile,
  WeightForecast,
  WeightRecord,
  WorkoutRecord,
  WorkoutRecommendation,
} from '../types/health';
import type { DataQuality, WorkoutReason } from '../domain/types';
import { decideWorkoutMode } from '../domain/training';
import { resolveSleepMinutes } from '../domain/sleep';
import { trainingStateOf, WORKOUT_REASON_CN } from './decisionCopy';
import { COMMON_FOOD_DATABASE, MEAL_TEMPLATES, MealTemplate } from '../data/foods';
import { getEvidenceById } from './scientificEvidence';

export const ENGINE_VERSION = '3.0.0-audited';

// ==========================================
// 1. Resting Metabolic Rate: f_RMR(profile)
// Status: evidence_derived
// Source: Mifflin et al., 1990 (AJCN)
// ==========================================

export interface RmrPrediction {
  value: number; // kcal / day
  predictedRMR: number; // alias for compatibility
  unit: 'kcal/day';
  method: 'Mifflin-St Jeor';
  formula: string;
  status: 'evidence_derived';
  evidenceIds: string[];
  notes: string;
}

/**
 * Predicts Resting Metabolic Rate (RMR) via Mifflin-St Jeor equation.
 * Male: 10W + 6.25H - 5A + 5
 * Female: 10W + 6.25H - 5A - 161
 * Other: 10W + 6.25H - 5A - 78
 *
 * Output is "predicted RMR", NOT measured metabolic rate.
 * Individual variation spans ±10% (standard error of estimate).
 */
export function f_RMR(
  profileOrWeight:
    | number
    | {
        currentWeight?: number;
        weight?: number;
        height: number;
        age: number;
        sex: 'male' | 'female' | 'other';
      },
  heightCm?: number,
  ageParam?: number,
  sexParam?: 'male' | 'female' | 'other'
): RmrPrediction {
  let currentWeight: number;
  let height: number;
  let age: number;
  let sex: 'male' | 'female' | 'other';
  let weightIsPlaceholder = false;

  if (typeof profileOrWeight === 'object') {
    const provided = profileOrWeight.currentWeight ?? profileOrWeight.weight;
    // 无实测体重时才退回占位值，并把这件事写进 notes/trace，绝不悄悄冒充测量
    weightIsPlaceholder = !(typeof provided === 'number' && provided > 0);
    currentWeight = weightIsPlaceholder ? 68.4 : (provided as number);
    height = profileOrWeight.height;
    age = profileOrWeight.age;
    sex = profileOrWeight.sex;
  } else {
    currentWeight = profileOrWeight;
    height = heightCm || 175;
    age = ageParam || 28;
    sex = sexParam || 'male';
  }

  const genderOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const rawRmr = 10 * currentWeight + 6.25 * height - 5 * age + genderOffset;
  const value = Math.round(rawRmr);

  return {
    value,
    predictedRMR: value,
    unit: 'kcal/day',
    method: 'Mifflin-St Jeor',
    formula: `10 * ${currentWeight} + 6.25 * ${height} - 5 * ${age} + (${genderOffset})`,
    status: 'evidence_derived',
    evidenceIds: ['mifflin-1990'],
    notes: weightIsPlaceholder
      ? 'Placeholder weight 68.4 kg used because no body-weight record was supplied: this RMR is indicative only, not a measurement. Predicted RMR based on Mifflin-St Jeor population model. Individual metabolic variation typically ±10% due to NEAT, organ mass, and adaptive thermogenesis.'
      : 'Predicted RMR based on Mifflin-St Jeor population model. Individual metabolic variation typically ±10% due to NEAT, organ mass, and adaptive thermogenesis.',
  };
}

// ==========================================
// 2. Daily Energy Prior: f_energy_prior(profile, activity)
// Status: engineering_heuristic
// ==========================================

export interface EnergyPriorEstimation {
  estimatedEnergyRange: { min: number; max: number }; // kcal / day
  midpoint: number;
  activityAssumption: string;
  status: 'engineering_heuristic';
  notes: string;
}

/**
 * Estimates daily energy requirement prior based on predicted RMR + activity factor.
 * Activity factor is an estimation parameter, not a measured physiological constant.
 */
export function f_energy_prior(
  profile: UserProfile,
  hasActiveTrainingToday: boolean = false
): EnergyPriorEstimation {
  const rmr = f_RMR(profile).value;
  // Sedentary baseline PAL 1.15 - 1.25
  const baseMin = 1.15;
  const baseMax = 1.25;
  const sessionKcal = hasActiveTrainingToday ? 150 : 0;

  const min = Math.round(rmr * baseMin + (sessionKcal > 0 ? 100 : 0));
  const max = Math.round(rmr * baseMax + (sessionKcal > 0 ? 200 : 0));
  const midpoint = Math.round((min + max) / 2);

  return {
    estimatedEnergyRange: { min, max },
    midpoint,
    activityAssumption: hasActiveTrainingToday
      ? 'Sedentary baseline (PAL 1.15–1.25) + moderate bodyweight session (~100–200 kcal)'
      : 'Sedentary baseline multiplier range (PAL 1.15–1.25)',
    status: 'engineering_heuristic',
    notes: 'Output is an estimated range, avoiding pseudo-exact single integers. Activity multiplier is an estimation model assumption.',
  };
}

// Legacy alias for compatibility
export const f_TDEE = (predictedRmr: number, activeExerciseToday: boolean = false) => {
  const baseMinFactor = 1.15;
  const baseMaxFactor = 1.25;
  const exerciseAddon = activeExerciseToday ? 150 : 0;
  const min = Math.round(predictedRmr * baseMinFactor + (exerciseAddon > 0 ? 100 : 0));
  const max = Math.round(predictedRmr * baseMaxFactor + (exerciseAddon > 0 ? 200 : 0));
  return {
    estimatedEnergyRange: { min, max },
    midpoint: Math.round((min + max) / 2),
    status: 'engineering_heuristic' as const,
    activityAssumption: activeExerciseToday ? 'Sedentary baseline + exercise' : 'Sedentary baseline',
    notes: 'Estimated energy range',
  };
};

// ==========================================
// 3. Long-Term Energy Calibration: f_energy_calibration
// Status: engineering_heuristic / dynamic model
// Source: Hall et al., 2011 (Lancet / NIH Dynamic Model principles)
// ==========================================

export function f_energy_calibration(history: {
  recordedEnergyIntake: number[];
  weightTrendKg: number;
  timePeriodDays: number;
}): EnergyCalibration {
  const { recordedEnergyIntake, weightTrendKg, timePeriodDays } = history;

  if (recordedEnergyIntake.length < 5 || timePeriodDays < 14) {
    return {
      estimatedMaintenanceRange: { min: 1900, max: 2200 },
      confidence: 'low',
      method: 'Population prior baseline (insufficient longitudinal data)',
      notes: 'Requires at least 14 days of consistent intake logs and body weight readings for personalized calibration.',
    };
  }

  const avgIntake = recordedEnergyIntake.reduce((a, b) => a + b, 0) / recordedEnergyIntake.length;
  // Dynamic weight-energy conversion heuristic: ~7,700 kcal / kg delta
  const dailyKcalDelta = (weightTrendKg * 7700) / timePeriodDays;
  const estimatedMaintenance = Math.round(avgIntake - dailyKcalDelta);

  const confidence: 'low' | 'medium' | 'high' =
    timePeriodDays >= 28 && recordedEnergyIntake.length >= 20
      ? 'high'
      : 'medium';

  return {
    estimatedMaintenanceRange: {
      min: Math.round(estimatedMaintenance - 100),
      max: Math.round(estimatedMaintenance + 100),
    },
    confidence,
    method: `Empirical energy balance: avg intake (${Math.round(avgIntake)} kcal) - trend delta (${Math.round(dailyKcalDelta)} kcal/d) over ${timePeriodDays} days`,
    notes: 'Personal calibration accounts for individual metabolic adaptation and NEAT changes over time based on Hall et al. dynamic balance concepts.',
  };
}

// ==========================================
// 5. Weight Forecast Intervals: f_weight_forecast(context)
// Status: engineering_heuristic scenario projection（情景外推，非承诺）
// Source: Hall et al., 2011 (dynamic energy balance) 之递减思想
// 注意：本函数只做「据趋势外推」，不是预测模型；数据存疑/不足时不出数。
// ==========================================

export function f_weight_forecast(context: {
  /** 最新实测体重；无则 null。 */
  latestWeight: number | null;
  /** 回归斜率（kg/周）；无则 null。 */
  trendKgPerWeek: number | null;
  /** 参与回归的有效日数。 */
  basedOnDays: number;
  inputWindowDays: number;
  /** 体重数据质量：needs_review / insufficient 时不出数。 */
  quality: DataQuality;
  modelVersion: string;
}): WeightForecast {
  const { latestWeight, trendKgPerWeek, basedOnDays, inputWindowDays, quality, modelVersion } =
    context;

  const withholdingReason: WeightForecast['withheldReason'] = quality.reasons.includes(
    'weight_deviates_from_rolling_mean'
  )
    ? 'weight_deviates_from_rolling_mean'
    : quality.flag === 'insufficient'
    ? 'insufficient_weight_days'
    : undefined;
  const withheld = withholdingReason !== undefined || latestWeight === null || trendKgPerWeek === null;

  // Under Hall et al. dynamic adaptation, weight change slows down as body mass decreases.
  const damping = { 4: 0.95, 8: 0.88, 12: 0.8 } as const;
  const spread = { 4: 0.35, 8: 0.55, 12: 0.75 } as const;

  const makePeriod = (weeks: 4 | 8 | 12, label: string): ForecastPeriod => {
    if (withheld || latestWeight === null || trendKgPerWeek === null) {
      return { weeks, unit: 'kg', label, range: { min: 0, max: 0 } };
    }
    const estimate = latestWeight + trendKgPerWeek * weeks * damping[weeks];
    const half = spread[weeks];
    return {
      weeks,
      unit: 'kg',
      label,
      range: {
        min: Math.round((estimate - half) * 10) / 10,
        max: Math.round((estimate + half) * 10) / 10,
      },
    };
  };

  const round1 = (n: number): number => Math.round(n * 10) / 10;

  return {
    fourWeeks: makePeriod(4, '4 周情景区间'),
    eightWeeks: makePeriod(8, '8 周情景区间'),
    twelveWeeks: makePeriod(12, '12 周情景区间'),
    confidence: withheld ? 'low' : basedOnDays >= 20 ? 'medium' : 'low',
    modelVersion,
    method: 'scenario_trend_projection',
    inputWindowDays,
    basedOnDays,
    withheld,
    withheldReason: withholdingReason,
    assumptions: [
      '保持当前能量摄入水平与身体活动节律',
      '代谢适应符合 Hall et al. 2011 动态非线性递减规律',
      '无突发肠道水钠潴留或极端饮食结构剧变',
    ],
    limitations: [
      `仅为情景外推（${round1(trendKgPerWeek ?? 0)} kg/周 × 周数 × 衰减），非承诺、非目标值`,
      '短期内糖原之储耗与食盐之摄入，会致 ±1kg 急性非脂肪体重之波动',
    ],
  };
}

// ==========================================
// 6. Protein Target Range: f_protein(profile)
// Status: evidence_constrained
// Source: Morton et al., 2018 (BJSM)
// ==========================================

export interface ProteinTargetRange {
  proteinRange: { min: number; max: number }; // grams / day
  ratioPerKgRange: { min: number; max: number }; // g / kg / day
  status: 'evidence_constrained';
  source: 'Morton et al., 2018';
  notes: string;
}

export function f_protein(
  bodyWeightKg: number,
  _goal: string = 'fat loss'
): ProteinTargetRange {
  const minRatio = 1.4;
  const maxRatio = 2.0;

  const minGrams = Math.round(bodyWeightKg * minRatio);
  const maxGrams = Math.round(bodyWeightKg * maxRatio);

  return {
    proteinRange: { min: minGrams, max: maxGrams },
    ratioPerKgRange: { min: minRatio, max: maxRatio },
    status: 'evidence_constrained',
    source: 'Morton et al., 2018',
    notes: 'Evidence-constrained application range (1.4–2.0 g/kg/day) based on Morton 2018 meta-regression plateau at ~1.62 g/kg/day. Not a single rigid requirement.',
  };
}

// ==========================================
// 7. Per-Meal Protein Target: f_per_meal_protein
// Status: evidence_constrained
// Source: Schoenfeld & Aragon, 2018 (JISSN)
// ==========================================

export function f_per_meal_protein(bodyWeightKg: number) {
  const minGrams = Math.max(20, Math.round(bodyWeightKg * 0.40));
  const maxGrams = Math.min(45, Math.round(bodyWeightKg * 0.55));
  return {
    perMealRange: { min: minGrams, max: maxGrams },
    status: 'evidence_constrained' as const,
    source: 'Schoenfeld & Aragon, 2018',
    notes: 'Theoretical practical recommendation derived from acute MPS kinetics. Higher intake supports whole-body turnover.',
  };
}

// ==========================================
// 8. Diet Quality Model: f_diet_quality
// Status: evidence_constrained
// Sources: WHO Healthy Diet (2020), DGA (2025–2030)
// ==========================================

export function f_diet_quality(
  todayMeals: MealRecord[],
  _recentHistory?: MealRecord[]
): DietQualityAssessment {
  let fruitAndVegCount = 0;
  let wholeGrainsCount = 0;
  let estimatedFiberGrams = 0;
  const foodGroupsSeen = new Set<string>();

  // Scan logged foods against food database
  for (const meal of todayMeals) {
    for (const foodStr of meal.foods) {
      const match = COMMON_FOOD_DATABASE.find(
        (f) => foodStr.includes(f.name) || f.name.includes(foodStr.split(' ')[0])
      );
      if (match) {
        foodGroupsSeen.add(match.foodGroup);
        estimatedFiberGrams += match.fiber;
        if (match.foodGroup === 'vegetable' || match.foodGroup === 'fruit') {
          fruitAndVegCount += 1;
        }
        if (match.foodGroup === 'grain' && (match.name.includes('糙米') || match.name.includes('燕麦') || match.name.includes('藜麦') || match.name.includes('全麦'))) {
          wholeGrainsCount += 1;
        }
      } else {
        // Fallback heuristic based on keywords
        if (foodStr.includes('西兰花') || foodStr.includes('菠菜') || foodStr.includes('时蔬') || foodStr.includes('香蕉') || foodStr.includes('蓝莓')) {
          fruitAndVegCount += 1;
          foodGroupsSeen.add('vegetable');
          estimatedFiberGrams += 3.5;
        }
        if (foodStr.includes('糙米') || foodStr.includes('燕麦') || foodStr.includes('全麦')) {
          wholeGrainsCount += 1;
          foodGroupsSeen.add('grain');
          estimatedFiberGrams += 4;
        }
      }
    }
  }

  const constraintsNotes: string[] = [];
  if (fruitAndVegCount >= 3) {
    constraintsNotes.push('蔬菜与水果摄入充裕，符合 WHO 宏观膳食多样性');
  } else {
    constraintsNotes.push('建议在下一餐或加餐中适度增加绿叶蔬菜或浆果');
  }

  if (wholeGrainsCount > 0) {
    constraintsNotes.push('全谷物慢碳水比例良好，有助于维持平稳胃排空与胰岛素敏感度');
  }

  const foodDiversityScore = foodGroupsSeen.size;
  let scoreCategory: 'optimal' | 'adequate' | 'needs_attention' = 'adequate';
  if (fruitAndVegCount >= 3 && wholeGrainsCount > 0 && foodDiversityScore >= 4) {
    scoreCategory = 'optimal';
  } else if (fruitAndVegCount < 2 && foodDiversityScore < 3) {
    scoreCategory = 'needs_attention';
  }

  return {
    scoreCategory,
    fruitAndVegetableServings: fruitAndVegCount,
    fiberGrams: Math.round(estimatedFiberGrams),
    wholeGrainsPresent: wholeGrainsCount > 0,
    excessFreeSugar: false,
    foodDiversityScore,
    ruleStatus: 'evidence_constrained',
    constraintsNotes,
    evidenceIds: ['who-diet-2020', 'dga-2025'],
  };
}

// ==========================================
// 9. Meal Candidates & Recommendation: f_meal(context)
// Status: engineering_heuristic ranking over scientific constraints
// ==========================================

/** Time-of-day slot shared by the meal rules and the UI caption. */
export function f_meal_slot(hour: number): 'breakfast' | 'lunch' | 'dinner' {
  return hour < 10 ? 'breakfast' : hour < 15 ? 'lunch' : 'dinner';
}

export function f_meal_candidates(
  context: HealthContext,
  _proteinGap: number,
  _calorieRoom: number
): MealTemplate[] {
  // Time-of-day comes from the injected clock, so the ranking is reproducible.
  const mealTime = f_meal_slot(context.now.getHours());

  // Keep templates that are plausible for this time of day; the caller ranks them.
  return MEAL_TEMPLATES.filter(
    (tpl) => tpl.suitabilityTime === 'any' || tpl.suitabilityTime === mealTime
  );
}

export function f_meal(context: HealthContext): MealRecommendation {
  const { profile, todayMeals } = context;
  const currentWeight = context.currentWeight || profile.currentWeight;

  // Data completeness decides how much the recommendation may claim.
  const hasIncompleteData = context.hasIncompleteData === true || todayMeals.length === 0;

  // 1. Inputs Snapshot
  const consumedCalories = todayMeals.reduce((sum, m) => sum + m.estimatedCalories, 0);
  const consumedProtein = todayMeals.reduce((sum, m) => sum + m.estimatedProtein, 0);

  // 2. Evidence-derived & constrained derivations
  const rmrResult = f_RMR({
    currentWeight,
    height: profile.height,
    age: profile.age,
    sex: profile.sex,
  });
  const energyPrior = f_energy_prior(profile, !!context.todayWorkout);
  const proteinTargetRange = f_protein(currentWeight, profile.goal);
  const perMealProtein = f_per_meal_protein(currentWeight);
  const dietQuality = f_diet_quality(todayMeals, context.recentMeals);

  // Engineering calculation
  const targetCalories = profile.dailyCalorieTarget || energyPrior.midpoint;
  const calorieRoom = Math.max(0, targetCalories - consumedCalories);
  const proteinGap = Math.max(0, (profile.dailyProteinTarget || 110) - consumedProtein);

  // 3. Candidate evaluation & heuristic ranking
  const candidates = f_meal_candidates(context, proteinGap, calorieRoom);

  // Scoring function (engineering_heuristic)
  let bestTemplate = candidates[0] || MEAL_TEMPLATES[0];
  let highestScore = -Infinity;

  for (const tpl of candidates) {
    // Protein fit
    const proteinDiff = Math.abs(tpl.approxProtein - Math.min(42, Math.max(28, proteinGap)));
    const proteinFit = Math.max(0, 50 - proteinDiff * 2);

    // Energy fit
    const energyDiff = Math.abs(tpl.approxCalories - Math.min(600, Math.max(450, calorieRoom)));
    const energyFit = Math.max(0, 50 - energyDiff * 0.1);

    // Repetition penalty
    const isRepeatedToday = todayMeals.some((m) =>
      m.name.includes(tpl.name.split('·')[0].trim())
    );
    const repetitionPenalty = isRepeatedToday ? 40 : 0;

    const totalScore = proteinFit + energyFit - repetitionPenalty;
    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestTemplate = tpl;
    }
  }

  // Derive honest ranges (avoid single integer illusion)
  const energyMin = Math.round((bestTemplate.approxCalories - 40) / 10) * 10;
  const energyMax = Math.round((bestTemplate.approxCalories + 40) / 10) * 10;
  const proteinMin = Math.round(bestTemplate.approxProtein - 5);
  const proteinMax = Math.round(bestTemplate.approxProtein + 5);

  const ruleId = 'RULE_MEAL_CANDIDATE_OPTIMIZATION_03';
  const ruleName = '以多维约束启选候选之膳（启发式排序）';
  const ruleStatus: RuleStatus = 'engineering_heuristic';

  const trace: DecisionTrace = {
    inputSnapshot: {
      currentWeight,
      age: profile.age,
      sex: profile.sex,
      consumedCalories,
      consumedProtein,
      calorieRoom,
      proteinGap,
    },
    derivedValues: {
      predictedRMR: rmrResult.value,
      dailyEnergyRange: `${energyPrior.estimatedEnergyRange.min}–${energyPrior.estimatedEnergyRange.max} kcal`,
      proteinReferenceRange: `${proteinTargetRange.proteinRange.min}–${proteinTargetRange.proteinRange.max} g/day`,
      perMealProteinReference: `${perMealProtein.perMealRange.min}–${perMealProtein.perMealRange.max} g`,
      dietQualityStatus: dietQuality.scoreCategory,
    },
    ruleIds: ['RULE_RMR_MIFFLIN_1990', 'RULE_PROTEIN_RANGE_MORTON_2018', ruleId],
    ruleStatuses: ['evidence_derived', 'evidence_constrained', 'engineering_heuristic'],
    evidenceIds: ['mifflin-1990', 'morton-2018', 'schoenfeld-2018', 'who-diet-2020'],
    assumptions: [
      '个体处于抗阻与减脂双重平衡期，单餐宜优先保证优质蛋白质与膳食纤维摄入',
      '采用 1.4–2.0 g/kg/day 作为群体约束区间，单餐目标 ~30–45g 蛋白质',
      '餐食评分公式 (proteinFit + energyFit - repetitionPenalty) 属于工程启发式排序',
    ],
    limitations: [
      '食物成分依标准全食物数据库估算；实际生熟之比与烹饪用油，可致 ±15% 热量之浮动',
      'Morton 2018 提供群体平台之证，并不保证此单膳合于一切胃肠消化速度之个体',
    ],
    confidence: hasIncompleteData ? 'low' : 'high',
  };

  const evidenceTraces = [
    {
      evidenceId: 'mifflin-1990',
      relevance: `静息代谢预测: ~${rmrResult.value} kcal/day，为全天能量空间提供生理基准。`,
      evidenceStrength: 'High' as const,
      reference: getEvidenceById('mifflin-1990')!,
    },
    {
      evidenceId: 'morton-2018',
      relevance: `抗阻人群全天蛋白质参考区间 ${proteinTargetRange.proteinRange.min}–${proteinTargetRange.proteinRange.max} g/day。`,
      evidenceStrength: 'High' as const,
      reference: getEvidenceById('morton-2018')!,
    },
    {
      evidenceId: 'schoenfeld-2018',
      relevance: `单餐推荐摄入约 0.40–0.55 g/kg (${perMealProtein.perMealRange.min}–${perMealProtein.perMealRange.max}g) 优质蛋白。`,
      evidenceStrength: 'Moderate' as const,
      reference: getEvidenceById('schoenfeld-2018')!,
    },
    {
      evidenceId: 'who-diet-2020',
      relevance: '融入绿叶蔬菜与全谷物，满足膳食纤维与低钠要求。',
      evidenceStrength: 'High' as const,
      reference: getEvidenceById('who-diet-2020')!,
    },
  ];

  return {
    mealName: bestTemplate.name,
    suggestedItems: bestTemplate.foodIds
      .map((id) => COMMON_FOOD_DATABASE.find((f) => f.id === id)?.name || id)
      .filter(Boolean),
    estimatedCalories: bestTemplate.approxCalories,
    estimatedProtein: bestTemplate.approxProtein,
    energyRange: { min: energyMin, max: energyMax },
    proteinRange: { min: proteinMin, max: proteinMax },
    reason: `均衡补 ≈${proteinMin}–${proteinMax}g 蛋白质与全食膳食纤维，合于今日减脂之节律。`,
    ruleId,
    ruleName,
    ruleStatus,
    trace,
    evidenceTraces,
    isUncertaintyNoted: true,
    uncertaintyMessage: '热量与蛋白质乃估算之区间，实值受控油与食材批次之影响。',
  };
}

// ==========================================
// 10. Training State: f_training_state
// Status: engineering_heuristic
// ==========================================

export function f_training_state(input: {
  sleepHours: number | null;
  energy: number | null;
  soreness: number | null;
  workoutCompletedToday: boolean;
}): {
  state: TrainingState;
  status: 'engineering_heuristic';
  heuristicReason: string;
  /** 机器可判的判定原因（页面文案据此生成，不再各写一套）。 */
  reasons: WorkoutReason[];
  disclaimer: 'Product heuristic. Not a clinically validated readiness score.';
} {
  const { sleepHours, energy, soreness, workoutCompletedToday } = input;
  const disclaimer = 'Product heuristic. Not a clinically validated readiness score.' as const;

  const decision = decideWorkoutMode({
    sleepMinutes: sleepHours === null ? null : sleepHours * 60,
    energy,
    soreness,
    completedToday: workoutCompletedToday,
  });

  const { highSorenessMin, lowEnergyMax, shortSleepHours } = decision.thresholds;
  let heuristicReason: string;
  switch (decision.mode) {
    case 'rest':
      heuristicReason = '今日既定之练已毕，神经肌肉转入自然恢复之期';
      break;
    case 'recovery':
      heuristicReason = `主观${decision.reasons
        .map((reason) => WORKOUT_REASON_CN[reason])
        .join('且')}（酸痛 ≥${highSorenessMin} 或 精力 ≤${lowEnergyMax}），故调低刺激之拉伸与缓速核心之激活`;
      break;
    case 'light':
      heuristicReason = `体感平稳或眠稍短（< ${shortSleepHours} 时），取温和容量之徒手维持循环`;
      break;
    default:
      heuristicReason =
        decision.reasons[0] === 'no_wellbeing_record'
          ? '今日尚未录体感，故按常规课表安排；录其精力与酸痛后自动改判'
          : '精力与睡眠俱足且无明显酸痛，行完整之徒手渐进循环';
  }

  return {
    state: trainingStateOf(decision.mode),
    status: 'engineering_heuristic',
    heuristicReason,
    reasons: decision.reasons,
    disclaimer,
  };
}

// ==========================================
// 11. Activity Summary: f_activity & f_training_volume
// Status: evidence_constrained
// Source: WHO 2020, ACSM 2026
// ==========================================

export function f_training_volume(recentWorkouts: WorkoutRecord[]) {
  const completedThisWeek = recentWorkouts.filter((w) => w.completed);
  let totalSets = 0;
  for (const w of completedThisWeek) {
    for (const ex of w.exercises) {
      totalSets += ex.sets || 0;
    }
  }

  return {
    weeklySessions: completedThisWeek.length,
    weeklySets: totalSets,
    status: 'evidence_constrained' as const,
    source: 'ACSM 2026 / WHO 2020',
  };
}

// ==========================================
// 12. Progression Engine: f_progression
// Status: engineering_heuristic translation of ACSM 2026
// ==========================================

export function f_progression(
  recentWorkoutsOrExercise: WorkoutRecord[] | string,
  exerciseNameOrDifficulty?: string
): {
  recommendedSets: number;
  recommendedReps: string;
  progressionNote: string;
  variationUpgrade?: string;
  status: 'engineering_heuristic';
  translationNote: string;
} {
  let exerciseName = 'push-up';
  let previousLogs: BodyweightExercise[] = [];

  if (Array.isArray(recentWorkoutsOrExercise)) {
    exerciseName = exerciseNameOrDifficulty || 'push-up';
    previousLogs = recentWorkoutsOrExercise
      .flatMap((w) => w.exercises)
      .filter((e) => e.name.toLowerCase().includes(exerciseName.toLowerCase()));
  } else {
    exerciseName = recentWorkoutsOrExercise;
  }

  const status: 'engineering_heuristic' = 'engineering_heuristic';
  const translationNote =
    'ACSM 2026 supports progressive resistance training principles; specific徒手 sets/reps progression is an engineering translation.';

  if (previousLogs.length >= 2 || exerciseName.toLowerCase().includes('push-up')) {
    return {
      recommendedSets: 3,
      recommendedReps: '10–12 次',
      progressionNote: '保持动作顶点离心停顿 1 秒，专注机械张力控制',
      variationUpgrade: exerciseName.includes('Knee') ? '标准俯卧撑' : undefined,
      status,
      translationNote,
    };
  }

  return {
    recommendedSets: 2,
    recommendedReps: '8–10 次',
    progressionNote: '规范动作轨迹与呼吸节律，预留 2–3 次力竭储备 (RIR 2–3)',
    status,
    translationNote,
  };
}

// ==========================================
// 13. Next Workout Recommendation: f_workout(context)
// Strictly Bodyweight Only (Squat, Push-up, Bridge, Plank, Lunges, etc.)
// ==========================================

export function f_workout(context: HealthContext): WorkoutRecommendation {
  const { todayState, todayWorkout, recentWorkouts } = context;

  const sleepMinutes = resolveSleepMinutes(todayState.sleep)?.minutes ?? null;
  const trainingStateDecision = f_training_state({
    sleepHours: sleepMinutes === null ? null : sleepMinutes / 60,
    energy: todayState.energy ?? null,
    soreness: todayState.soreness ?? null,
    workoutCompletedToday: !!(todayWorkout && todayWorkout.completed),
  });

  const trainingState = trainingStateDecision.state;
  const trainingVolume = f_training_volume(recentWorkouts);

  let title = '徒手全身轻量循环';
  let sessionType: 'Normal session' | 'Light session' | 'Recovery session' | 'Rest' = 'Light session';
  let durationMinutes = 16;
  let exercises: BodyweightExercise[] = [];
  let recoveryGuidance = '呼吸深长，不逐酸胀力竭，身心留有余量。';
  let reason = '以温和自重激活下肢与推力之肌群，通血脉而缓神经。';
  let ruleId = 'RULE_WORKOUT_LIGHT_BODYWEIGHT_01';
  let ruleName = '自重低负荷神经维持循环';

  if (trainingState === 'REST') {
    title = '今日恢复与休息';
    sessionType = 'Rest';
    durationMinutes = 0;
    exercises = [];
    reason = '今日既定之身练已毕，为肌纤维与神经系统留自主重构之隙。';
    recoveryGuidance = '多饮温水，作息有常，以待明日之充沛精力。';
    ruleId = 'RULE_WORKOUT_REST_STATE_01';
    ruleName = '自主生理恢复休整';
  } else if (trainingState === 'RECOVERY') {
    title = '温和关节与深层核心舒缓';
    sessionType = 'Recovery session';
    durationMinutes = 12;
    exercises = [
      { name: '死虫式', sets: 2, repsOrDuration: '每侧 6 次', movementPattern: 'core', progressionNote: '腰背贴紧地面，动作放慢' },
      { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain', progressionNote: '顶峰收缩 2 秒，激活臀大肌' },
      { name: '原地踏步慢动作', sets: 2, repsOrDuration: '45 秒', movementPattern: 'lower body', progressionNote: '保持躯干稳定，轻快呼吸' },
    ];
    reason = '依主观酸痛或精力偏低，避高机械张力之动作，仅作轻度血行舒展。';
    recoveryGuidance = '动作以无痛舒展为度，毕后可温水沐身。';
    ruleId = 'RULE_WORKOUT_RECOVERY_FLOW_01';
    ruleName = '低负荷主动恢复流';
  } else if (trainingState === 'NORMAL') {
    title = '徒手自重力量进阶循环';
    sessionType = 'Normal session';
    durationMinutes = 20;
    exercises = [
      { name: '徒手深蹲', sets: 3, repsOrDuration: '12 次', movementPattern: 'lower body', progressionNote: '全脚掌踩实，臀部向后下沉' },
      { name: '标准俯卧撑', sets: 3, repsOrDuration: '8–10 次', movementPattern: 'push', progressionNote: '核心收紧，慢下快推' },
      { name: '交替后箭步蹲', sets: 2, repsOrDuration: '每侧 10 次', movementPattern: 'lower body', progressionNote: '保护前膝不过度前移' },
      { name: '单腿臀桥', sets: 2, repsOrDuration: '每侧 8 次', movementPattern: 'posterior chain', progressionNote: '强化骨盆后倾稳定' },
      { name: '平板支撑', sets: 2, repsOrDuration: '35 秒', movementPattern: 'core', progressionNote: '肘部下压地面，避免塌腰' },
    ];
    reason = '精力与睡眠俱佳，故安排覆盖全身推力、下肢与后链之抗阻渐进练习。';
    recoveryGuidance = '组间歇 60–90 秒，预留 2 次力竭之备 (RIR 2)。';
    ruleId = 'RULE_WORKOUT_NORMAL_PROGRESSION_01';
    ruleName = '复合自重多关节进阶循环';
  } else {
    // LIGHT
    title = '徒手基础全身循环';
    sessionType = 'Light session';
    durationMinutes = 16;
    exercises = [
      { name: '徒手深蹲', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body', progressionNote: '节奏平稳，下蹲 2 秒' },
      { name: '跪姿俯卧撑', sets: 2, repsOrDuration: '8 次', movementPattern: 'push', progressionNote: '肩胛平稳下沉' },
      { name: '双腿臀桥', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain', progressionNote: '顶峰停顿 1 秒' },
      { name: '平板支撑', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core', progressionNote: '保持脊柱中立' },
    ];
    reason = '体感平稳，以十六分钟基础动作激活诸大肌群，不加中枢神经之劳。';
    ruleId = 'RULE_WORKOUT_LIGHT_CYCLE_01';
    ruleName = '徒手低负荷神经维持循环';
  }

  const trace: DecisionTrace = {
    inputSnapshot: {
      sleepHours: sleepMinutes === null ? null : Math.round((sleepMinutes / 60) * 100) / 100,
      energyScore: todayState.energy ?? null,
      sorenessScore: todayState.soreness ?? null,
      workoutCompletedToday: !!(todayWorkout && todayWorkout.completed),
      weeklySessionsSoFar: trainingVolume.weeklySessions,
    },
    derivedValues: {
      trainingState,
      decisionReasons: trainingStateDecision.reasons,
      targetDurationMinutes: durationMinutes,
      exerciseCount: exercises.length,
      heuristicDecision: trainingStateDecision.heuristicReason,
    },
    ruleIds: [ruleId, 'HEURISTIC_TRAINING_STATE_01', 'HEURISTIC_PROGRESSION_01'],
    ruleStatuses: ['engineering_heuristic', 'engineering_heuristic', 'engineering_heuristic'],
    evidenceIds: ['who-2020', 'acsm-2026', 'helms-2016'],
    assumptions: [
      '仅使用徒手自重 (bodyweight only)，推力、下肢与深层核心具备良好力学刺激，拉力动作因无单杠受限',
      '精力/酸痛阈值 (Energy <= 2, Soreness >= 4) 为产品工程启发式判定，并非临床级准备度指标',
      '每次练习采 RIR 2–3（留 2–3 次至力竭）之自主节律调节',
    ],
    limitations: [
      '居家无器械条件下垂直拉力 (Pull-up) 动作受限，未来如增设弹力带或单杠可进一步补全背部后链刺激',
      '主观精力打分受心理情绪波动影响，建议结合身体实际活动热身感受微调',
    ],
    confidence: 'high',
  };

  const evidenceTraces = [
    {
      evidenceId: 'who-2020',
      relevance: '落实每周至少两日全身主要肌群抗阻强化之公共卫生建议。',
      evidenceStrength: 'High' as const,
      reference: getEvidenceById('who-2020')!,
    },
    {
      evidenceId: 'acsm-2026',
      relevance: '应用渐进抗阻训练原则，通过多关节动作组合促进神经肌肉适应与去脂体重维持。',
      evidenceStrength: 'High' as const,
      reference: getEvidenceById('acsm-2026')!,
    },
    {
      evidenceId: 'helms-2016',
      relevance: '引入 RIR (保留次数) 自我调节概念，避免在疲劳或酸痛明显时强行力竭。',
      evidenceStrength: 'Moderate' as const,
      reference: getEvidenceById('helms-2016')!,
    },
  ];

  return {
    title,
    sessionType,
    trainingState,
    trainingStateHeuristicNote: trainingStateDecision.heuristicReason,
    durationMinutes,
    durationSource: 'estimated' as const,
    reason,
    exercises,
    recoveryGuidance,
    progressionTip: '动作之准先于次数，顶点稍停，以体关节与肌群之稳定张力。',
    equipmentCoverage: {
      push: 'well covered',
      lowerBody: 'well covered',
      core: 'well covered',
      posteriorChain: 'moderately covered',
      pull: 'limited (no pull-up bar / external equipment)',
    },
    engineeringTranslationNote: 'ACSM 提供渐进抗阻之原则，具体 2×10 深蹲与俯卧撑级数属工程实现。',
    ruleId,
    ruleName,
    ruleStatus: 'engineering_heuristic',
    trace,
    evidenceTraces,
    isUncertaintyNoted: true,
  };
}
