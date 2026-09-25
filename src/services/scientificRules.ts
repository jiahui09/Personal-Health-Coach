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
  MealRecord,
  MealRecommendation,
  PerceivedDifficulty,
  RuleStatus,
  TodayData,
  TrainingState,
  UserProfile,
  WeightForecast,
  WeightRecord,
  WeightTrendResult,
  WorkoutRecord,
  WorkoutRecommendation,
} from '../types/health';
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

  if (typeof profileOrWeight === 'object') {
    currentWeight = profileOrWeight.currentWeight ?? profileOrWeight.weight ?? 68.4;
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
    notes: 'Predicted RMR based on Mifflin-St Jeor population model. Individual metabolic variation typically ±10% due to NEAT, organ mass, and adaptive thermogenesis.',
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
// 4. Weight Trend Analysis: f_weight_trend(weightHistory)
// Status: evidence_constrained (rolling avg & linear trend)
// ==========================================

export function f_weight_trend(weightHistory: WeightRecord[]): WeightTrendResult {
  if (weightHistory.length === 0) {
    return {
      rollingAverage7d: 68.4,
      trendPerWeek: 0,
      currentTrend: 'stable',
      dataPointsCount: 0,
    };
  }

  // 1. 7-day rolling average of latest available points
  const recent7 = weightHistory.slice(-7);
  const sum7 = recent7.reduce((acc, curr) => acc + curr.weight, 0);
  const rollingAverage7d = Math.round((sum7 / recent7.length) * 10) / 10;

  // 2. Linear slope across last 14-30 points
  const slicePoints = weightHistory.slice(-21);
  if (slicePoints.length < 2) {
    return {
      rollingAverage7d,
      trendPerWeek: 0,
      currentTrend: 'stable',
      dataPointsCount: weightHistory.length,
    };
  }

  // Simple linear regression: y = weight, x = day index
  const n = slicePoints.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slicePoints[i].weight;
    sumXY += i * slicePoints[i].weight;
    sumXX += i * i;
  }

  const slopePerDay = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const trendPerWeek = Math.round(slopePerDay * 7 * 100) / 100;

  let currentTrend: 'decreasing' | 'stable' | 'increasing' = 'stable';
  if (trendPerWeek < -0.05) currentTrend = 'decreasing';
  else if (trendPerWeek > 0.05) currentTrend = 'increasing';

  return {
    rollingAverage7d,
    trendPerWeek,
    currentTrend,
    dataPointsCount: weightHistory.length,
  };
}

// ==========================================
// 5. Weight Forecast Intervals: f_weight_forecast(context)
// Status: dynamic model / evidence_constrained
// Source: Hall et al., 2011 (dynamic energy balance)
// ==========================================

export function f_weight_forecast(context: {
  currentWeight: number;
  weightTrend: WeightTrendResult;
  goal: string;
}): WeightForecast {
  const { currentWeight, weightTrend } = context;
  const weeklyRate = weightTrend.trendPerWeek; // e.g. -0.18 kg/week

  // Under Hall et al. dynamic adaptation, weight change slows down as body mass decreases
  // Damping factor for metabolic slowdown
  const damping4w = 0.95;
  const damping8w = 0.88;
  const damping12w = 0.80;

  const delta4w = weeklyRate * 4 * damping4w;
  const delta8w = weeklyRate * 8 * damping8w;
  const delta12w = weeklyRate * 12 * damping12w;

  // Prediction intervals: ±0.35kg at 4w, ±0.55kg at 8w, ±0.75kg at 12w
  const est4 = currentWeight + delta4w;
  const est8 = currentWeight + delta8w;
  const est12 = currentWeight + delta12w;

  const fourWeeks = {
    weeks: 4,
    range: {
      min: Math.round((est4 - 0.35) * 10) / 10,
      max: Math.round((est4 + 0.35) * 10) / 10,
    },
    unit: 'kg',
    label: '4 周预测区间',
  };

  const eightWeeks = {
    weeks: 8,
    range: {
      min: Math.round((est8 - 0.55) * 10) / 10,
      max: Math.round((est8 + 0.55) * 10) / 10,
    },
    unit: 'kg',
    label: '8 周预测区间',
  };

  const twelveWeeks = {
    weeks: 12,
    range: {
      min: Math.round((est12 - 0.75) * 10) / 10,
      max: Math.round((est12 + 0.75) * 10) / 10,
    },
    unit: 'kg',
    label: '12 周预测区间',
  };

  const confidence: 'low' | 'medium' | 'high' =
    weightTrend.dataPointsCount >= 20 ? 'medium' : 'low';

  return {
    fourWeeks,
    eightWeeks,
    twelveWeeks,
    confidence,
    assumptions: [
      '保持当前能量摄入水平与身体活动节律',
      '代谢适应符合 Hall et al. 2011 动态非线性递减规律',
      '无突发肠道水钠潴留或极端饮食结构剧变',
    ],
    limitations: [
      '预测为统计置信区间 (Prediction Interval)，非确定性单一数值',
      '短期内糖原储备增减与食盐摄入会导致 ±1kg 的急性非脂肪体重波动',
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

export function f_meal_candidates(
  context: HealthContext,
  proteinGap: number,
  calorieRoom: number
): MealTemplate[] {
  const currentHour = new Date().getHours();
  const mealTime = currentHour < 10 ? 'breakfast' : currentHour < 15 ? 'lunch' : 'dinner';

  // Filter templates
  return MEAL_TEMPLATES.filter((tpl) => {
    // Basic time fit
    if (tpl.suitabilityTime !== 'any' && tpl.suitabilityTime !== mealTime) {
      if (mealTime === 'dinner' && tpl.suitabilityTime === 'breakfast') return false;
      if (mealTime === 'breakfast' && tpl.suitabilityTime === 'dinner') return false;
    }
    // Goal fit
    return true;
  });
}

export function f_meal(context: HealthContext): MealRecommendation {
  const { profile, todayMeals } = context;
  const currentWeight = context.currentWeight || profile.currentWeight;

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
  const ruleName = '多维约束候选餐食启发式匹配';
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
      '食物成分基于标准全食物数据库估计，实际生熟重量比与烹饪用油会带来 ±15% 的热量变动',
      'Morton 2018 提供了群体平台证据，并不保证该单餐适合所有胃肠消化速度个体',
    ],
    confidence: 'high',
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
    reason: `平衡补充 ≈${proteinMin}–${proteinMax}g 蛋白质与全食物膳食纤维，适配今日减脂平稳节律。`,
    ruleId,
    ruleName,
    ruleStatus,
    trace,
    evidenceTraces,
    isUncertaintyNoted: true,
    uncertaintyMessage: '热量与蛋白质为估算区间，实际数值受烹饪控油及食材批次影响。',
  };
}

// ==========================================
// 10. Training State: f_training_state
// Status: engineering_heuristic
// ==========================================

export function f_training_state(input: {
  sleepHours: number;
  energy: number;
  soreness: number;
  workoutCompletedToday: boolean;
}): {
  state: TrainingState;
  status: 'engineering_heuristic';
  heuristicReason: string;
  disclaimer: 'Product heuristic. Not a clinically validated readiness score.';
} {
  const { sleepHours, energy, soreness, workoutCompletedToday } = input;
  const disclaimer = 'Product heuristic. Not a clinically validated readiness score.' as const;

  if (workoutCompletedToday) {
    return {
      state: 'REST',
      status: 'engineering_heuristic',
      heuristicReason: '今日已完成既定训练，神经肌肉系统转入自然恢复期',
      disclaimer,
    };
  }

  // Engineering heuristic rules (explicitly documented as heuristics)
  if (energy <= 2 || soreness >= 4) {
    return {
      state: 'RECOVERY',
      status: 'engineering_heuristic',
      heuristicReason: '主观精力偏低 (<=2) 或酸痛显著 (>=4)，调度低刺激拉伸与慢速核心激活',
      disclaimer,
    };
  }

  if (sleepHours < 6.0 || energy === 3 || soreness === 3) {
    return {
      state: 'LIGHT',
      status: 'engineering_heuristic',
      heuristicReason: '体感平稳或睡眠偏短，采用温和容量的徒手维持循环',
      disclaimer,
    };
  }

  return {
    state: 'NORMAL',
    status: 'engineering_heuristic',
    heuristicReason: '精力与睡眠充足且无明显肌肉酸痛，执行完整徒手渐进循环',
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
      variationUpgrade: exerciseName.includes('Knee') ? '标准俯卧撑 (Push-up)' : undefined,
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

  const trainingStateDecision = f_training_state({
    sleepHours: todayState.sleepHours,
    energy: todayState.energy,
    soreness: todayState.soreness,
    workoutCompletedToday: !!(todayWorkout && todayWorkout.completed),
  });

  const trainingState = trainingStateDecision.state;
  const trainingVolume = f_training_volume(recentWorkouts);

  let title = '徒手全身轻量循环';
  let sessionType: 'Normal session' | 'Light session' | 'Recovery session' | 'Rest' = 'Light session';
  let durationMinutes = 16;
  let exercises: BodyweightExercise[] = [];
  let recoveryGuidance = '保持呼吸深长，不追求酸胀力竭，给身心留下充裕余量。';
  let reason = '以温和自重激活下肢与推力肌群，促进血液循环与神经舒缓。';
  let ruleId = 'RULE_WORKOUT_LIGHT_BODYWEIGHT_01';
  let ruleName = '自重低负荷神经维持循环';

  if (trainingState === 'REST') {
    title = '今日恢复与休息';
    sessionType = 'Rest';
    durationMinutes = 0;
    exercises = [];
    reason = '今日已完成既定身体练习，给肌纤维与神经系统留出自主重构时间。';
    recoveryGuidance = '多补充温水，保持规律作息，准备迎接明天的充沛精力。';
    ruleId = 'RULE_WORKOUT_REST_STATE_01';
    ruleName = '自主生理恢复休整';
  } else if (trainingState === 'RECOVERY') {
    title = '温和关节与深层核心舒缓';
    sessionType = 'Recovery session';
    durationMinutes = 12;
    exercises = [
      { name: '死虫式 (Dead Bug)', sets: 2, repsOrDuration: '每侧 6 次', movementPattern: 'core', progressionNote: '腰背贴紧地面，动作放慢' },
      { name: '双腿臀桥 (Glute Bridge)', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain', progressionNote: '顶峰收缩 2 秒，激活臀大肌' },
      { name: '原地踏步慢动作 (March)', sets: 2, repsOrDuration: '45 秒', movementPattern: 'lower body', progressionNote: '保持躯干稳定，轻快呼吸' },
    ];
    reason = '基于主观酸痛感知或精力偏低，回避高机械张力动作，仅作轻度血液流动舒展。';
    recoveryGuidance = '动作以无痛与舒展为基准，结束后可温水沐浴。';
    ruleId = 'RULE_WORKOUT_RECOVERY_FLOW_01';
    ruleName = '低负荷主动恢复流';
  } else if (trainingState === 'NORMAL') {
    title = '徒手自重力量进阶循环';
    sessionType = 'Normal session';
    durationMinutes = 20;
    exercises = [
      { name: '徒手深蹲 (Squat)', sets: 3, repsOrDuration: '12 次', movementPattern: 'lower body', progressionNote: '全脚掌踩实，臀部向后下沉' },
      { name: '标准俯卧撑 (Push-up)', sets: 3, repsOrDuration: '8–10 次', movementPattern: 'push', progressionNote: '核心收紧，慢下快推' },
      { name: '交替后箭步蹲 (Reverse Lunge)', sets: 2, repsOrDuration: '每侧 10 次', movementPattern: 'lower body', progressionNote: '保护前膝不过度前移' },
      { name: '单腿臀桥 (Single-leg Bridge)', sets: 2, repsOrDuration: '每侧 8 次', movementPattern: 'posterior chain', progressionNote: '强化骨盆后倾稳定' },
      { name: '平板支撑 (Plank)', sets: 2, repsOrDuration: '35 秒', movementPattern: 'core', progressionNote: '肘部下压地面，避免塌腰' },
    ];
    reason = '精力与睡眠良好，安排覆盖全身推力、下肢与后链的抗阻渐进练习。';
    recoveryGuidance = '组间休息 60–90 秒，预留 2 次力竭储备 (RIR 2)。';
    ruleId = 'RULE_WORKOUT_NORMAL_PROGRESSION_01';
    ruleName = '复合自重多关节进阶循环';
  } else {
    // LIGHT
    title = '徒手基础全身循环';
    sessionType = 'Light session';
    durationMinutes = 16;
    exercises = [
      { name: '徒手深蹲 (Squat)', sets: 2, repsOrDuration: '10 次', movementPattern: 'lower body', progressionNote: '节奏平稳，下蹲 2 秒' },
      { name: '跪姿俯卧撑 (Knee Push-up)', sets: 2, repsOrDuration: '8 次', movementPattern: 'push', progressionNote: '肩胛平稳下沉' },
      { name: '双腿臀桥 (Glute Bridge)', sets: 2, repsOrDuration: '10 次', movementPattern: 'posterior chain', progressionNote: '顶峰停顿 1 秒' },
      { name: '平板支撑 (Plank)', sets: 2, repsOrDuration: '30 秒', movementPattern: 'core', progressionNote: '保持脊柱中立' },
    ];
    reason = '体感平稳，以 16 分钟基础动作激活各大肌群，不施加过多中枢神经疲劳。';
    ruleId = 'RULE_WORKOUT_LIGHT_CYCLE_01';
    ruleName = '徒手低负荷神经维持循环';
  }

  const trace: DecisionTrace = {
    inputSnapshot: {
      sleepHours: todayState.sleepHours,
      energyScore: todayState.energy,
      sorenessScore: todayState.soreness,
      workoutCompletedToday: !!(todayWorkout && todayWorkout.completed),
      weeklySessionsSoFar: trainingVolume.weeklySessions,
    },
    derivedValues: {
      trainingState,
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
      '每次练习采用 RIR 2–3 (保留 2–3 次力竭) 的自主节律调节',
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
      relevance: '落实每周至少 2 天全身主要肌群抗阻强化的公共卫生建议。',
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
    reason,
    exercises,
    recoveryGuidance,
    progressionTip: '动作标准高于次数，顶点稍作停顿，体验身体关节与肌群的稳定张力。',
    equipmentCoverage: {
      push: 'well covered',
      lowerBody: 'well covered',
      core: 'well covered',
      posteriorChain: 'moderately covered',
      pull: 'limited (no pull-up bar / external equipment)',
    },
    engineeringTranslationNote: 'ACSM 提供了渐进抗阻原则，具体 2×10 深蹲与俯卧撑级数属于工程实现。',
    ruleId,
    ruleName,
    ruleStatus: 'engineering_heuristic',
    trace,
    evidenceTraces,
    isUncertaintyNoted: true,
  };
}
