/**
 * Scientific Rules & Mathematical Functions (V2.1 Audited)
 *
 * Strict separation of:
 * - Evidence-derived model: Directly derived from published equations/data (e.g. Mifflin-St Jeor 1990).
 * - Evidence-constrained model: Constrained by meta-analyses/guidelines, translated by program (e.g. Morton 2018 protein ranges).
 * - Engineering heuristic: Practical product logic to bridge gaps (e.g. energy score threshold, rep progression, training state assignment).
 *
 * All functions are pure, deterministic, and idempotent: y = f(x).
 * LLM = OFF. No probabilistic randomness.
 */

import {
  BodyweightExercise,
  DecisionTrace,
  EnergyCalibration,
  HealthContext,
  MealRecommendation,
  PerceivedDifficulty,
  RuleStatus,
  TrainingState,
  UserProfile,
  WorkoutRecommendation,
} from '../types/health';
import { getEvidenceById } from './scientificEvidence';

export const ENGINE_VERSION = '2.1.0-audited';

// ==========================================
// 1. Basal / Resting Metabolic Rate: f_RMR(x)
// Status: evidence_derived
// Source: Mifflin et al., 1990 (AJCN)
// ==========================================

export interface RmrPrediction {
  predictedRMR: number; // kcal / day
  status: 'evidence_derived';
  source: 'Mifflin et al., 1990';
  formula: string;
  notes: string;
}

/**
 * Predicts Resting Metabolic Rate (RMR) via Mifflin-St Jeor equation.
 * Male: 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 * Other: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 78
 *
 * IMPORTANT SCIENTIFIC DISCLAIMER:
 * This output is a "predicted RMR", NOT actual measured metabolic rate.
 * Prediction error exists at the individual level (typical ±10% standard error).
 */
export function f_RMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: 'female' | 'male' | 'other'
): RmrPrediction {
  const genderOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const rawRmr = 10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset;
  const predictedRMR = Math.round(rawRmr);

  return {
    predictedRMR,
    status: 'evidence_derived',
    source: 'Mifflin et al., 1990',
    formula: `10 * ${weightKg} + 6.25 * ${heightCm} - 5 * ${age} + (${genderOffset})`,
    notes: 'Predicted RMR based on Mifflin-St Jeor population model. Individual variation typically spans ±10% (standard error of estimate). Does not measure thyroid, NEAT, or adaptive thermogenesis.',
  };
}

// ==========================================
// 2. Daily Energy Estimation: f_TDEE(rmr, activity)
// Status: engineering_heuristic
// ==========================================

export interface TdeeEstimation {
  estimatedEnergyRange: { min: number; max: number }; // kcal / day
  midpoint: number;
  status: 'engineering_heuristic';
  activityAssumption: string;
  notes: string;
}

/**
 * Estimates Total Daily Energy Expenditure (TDEE).
 * RMR is a predictive equation; Activity Factor (1.15–1.25 for sedentary base) is an engineering assumption.
 * Output is an ESTIMATED ENERGY RANGE, never a pseudo-exact single requirement.
 */
export function f_TDEE(
  predictedRmr: number,
  activeExerciseToday: boolean = false
): TdeeEstimation {
  // Sedentary baseline factor range: 1.15 to 1.25
  const baseMinFactor = 1.15;
  const baseMaxFactor = 1.25;
  const exerciseAddon = activeExerciseToday ? 150 : 0;

  const min = Math.round(predictedRmr * baseMinFactor + (exerciseAddon > 0 ? 100 : 0));
  const max = Math.round(predictedRmr * baseMaxFactor + (exerciseAddon > 0 ? 200 : 0));
  const midpoint = Math.round((min + max) / 2);

  return {
    estimatedEnergyRange: { min, max },
    midpoint,
    status: 'engineering_heuristic',
    activityAssumption: activeExerciseToday
      ? 'Sedentary baseline (PAL 1.15–1.25) + moderate bodyweight session (~100–200 kcal)'
      : 'Sedentary baseline multiplier range (PAL 1.15–1.25)',
    notes: 'Energy requirement is an estimated range, not an exact single number. Activity factor is an engineering assumption model.',
  };
}

// ==========================================
// 3. Long-Term Energy Calibration: f_energy_calibration
// Status: engineering_heuristic
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
      notes: 'Requires at least 14 days of consistent intake logging and body weight tracking for personalized empirical calibration.',
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
    notes: 'Personal calibration accounts for individual metabolic adaptation and NEAT changes over time.',
  };
}

// ==========================================
// 4. Daily Protein Target Range: f_protein(x)
// Status: evidence_constrained
// Source: Morton et al., 2018 (BJSM)
// ==========================================

export interface ProteinTargetRange {
  proteinRange: { min: number; max: number }; // grams / day
  ratioPerKgRange: { min: number; max: number }; // g / kg / day
  status: 'evidence_constrained';
  source: 'Morton et al., 2018 (systematic review, meta-analysis & meta-regression)';
  notes: string;
}

/**
 * Computes recommended daily protein reference range.
 * Grounded in Morton et al. 2018 meta-regression finding inflection point at ~1.62 g/kg/day (95% CI: 1.03–2.20).
 * Reference range: 1.4–2.0 g/kg/day.
 * Status: evidence_constrained (not a direct evidence-derived individual target).
 */
export function f_protein(
  bodyWeightKg: number,
  goal: 'fat loss' | 'maintain' | 'muscle gain' | 'general fitness' = 'fat loss'
): ProteinTargetRange {
  const minRatio = 1.4;
  const maxRatio = 2.0;

  const minGrams = Math.round(bodyWeightKg * minRatio);
  const maxGrams = Math.round(bodyWeightKg * maxRatio);

  return {
    proteinRange: { min: minGrams, max: maxGrams },
    ratioPerKgRange: { min: minRatio, max: maxRatio },
    status: 'evidence_constrained',
    source: 'Morton et al., 2018 (systematic review, meta-analysis & meta-regression)',
    notes: 'Evidence-constrained reference range (1.4–2.0 g/kg/day). For 68.4kg: 96–137 g/day. The product engineering target of ~110 g/day is an engineering choice, not a single exact biological optimum.',
  };
}

// ==========================================
// 5. Per-Meal Protein Target: f_per_meal_protein
// Status: evidence_constrained
// Source: Schoenfeld & Aragon, 2018 (JISSN)
// ==========================================

export interface PerMealProteinTarget {
  perMealRange: { min: number; max: number }; // grams
  status: 'evidence_constrained';
  source: 'Schoenfeld & Aragon, 2018 (review / theoretical practical recommendation)';
  notes: string;
}

/**
 * Computes per-meal protein target range (~0.40–0.55 g/kg/meal).
 * Grounded in Schoenfeld & Aragon 2018 practical recommendation.
 * Marked as review/practical recommendation, NOT meta-analysis.
 */
export function f_per_meal_protein(bodyWeightKg: number): PerMealProteinTarget {
  const minGrams = Math.max(20, Math.round(bodyWeightKg * 0.40));
  const maxGrams = Math.min(45, Math.round(bodyWeightKg * 0.55));

  return {
    perMealRange: { min: minGrams, max: maxGrams },
    status: 'evidence_constrained',
    source: 'Schoenfeld & Aragon, 2018 (review / theoretical practical recommendation)',
    notes: 'Theoretical practical recommendation derived from acute MPS kinetics. Higher single-meal intake is not wasted and supports whole-body protein turnover.',
  };
}

// ==========================================
// 6. Training State Decision: f_training_state(x)
// Status: engineering_heuristic
// ==========================================

export interface TrainingStateDecision {
  state: TrainingState;
  status: 'engineering_heuristic';
  heuristicReason: string;
  disclaimer: 'Product heuristic. Not a clinically validated readiness score.';
  triggerFactors: {
    sleepDuration: number;
    energy: number;
    soreness: number;
    workoutCompletedToday: boolean;
  };
}

/**
 * Assigns TrainingState based on user's subjective state and today's workout log.
 *
 * CRITICAL AUDIT RULE:
 * This is an ENGINEERING HEURISTIC. It is NOT a clinically validated physiological readiness score.
 */
export function f_training_state(input: {
  sleepHours: number;
  energy: number; // 1-5
  soreness: number; // 1-5
  workoutCompletedToday: boolean;
  recentDifficulty?: PerceivedDifficulty;
}): TrainingStateDecision {
  const { sleepHours, energy, soreness, workoutCompletedToday } = input;
  const disclaimer = 'Product heuristic. Not a clinically validated readiness score.' as const;

  // Branch 1: Completed workout today -> REST
  if (workoutCompletedToday) {
    return {
      state: 'REST',
      status: 'engineering_heuristic',
      heuristicReason: 'Today training session already completed. Priority is tissue repair and neurological rest.',
      disclaimer,
      triggerFactors: { sleepDuration: sleepHours, energy, soreness, workoutCompletedToday },
    };
  }

  // Branch 2: High soreness (>= 4) or severe fatigue (energy <= 2 & sleep < 6h) -> RECOVERY
  if (soreness >= 4 || (energy <= 2 && sleepHours < 6.0)) {
    return {
      state: 'RECOVERY',
      status: 'engineering_heuristic',
      heuristicReason: `High muscular soreness (${soreness}/5) or acute fatigue (energy ${energy}/5, sleep ${sleepHours}h). Conservative protection heuristic favors joint mobility over strength overload.`,
      disclaimer,
      triggerFactors: { sleepDuration: sleepHours, energy, soreness, workoutCompletedToday },
    };
  }

  // Branch 3: Moderate soreness (3) or moderate energy (3) or recent challenging session -> LIGHT
  if (soreness === 3 || energy === 3 || input.recentDifficulty === 'challenging') {
    return {
      state: 'LIGHT',
      status: 'engineering_heuristic',
      heuristicReason: 'Intermediate recovery balance. Autoregulation heuristic clamps volume to 2 sets with 2–3 repetitions in reserve (RIR 2–3).',
      disclaimer,
      triggerFactors: { sleepDuration: sleepHours, energy, soreness, workoutCompletedToday },
    };
  }

  // Branch 4: High energy (>= 4), low soreness (<= 2), adequate sleep -> NORMAL
  return {
    state: 'NORMAL',
    status: 'engineering_heuristic',
    heuristicReason: `Favorable recovery markers (energy ${energy}/5, soreness ${soreness}/5, sleep ${sleepHours}h). Heuristic prescribes standard 3-set progressive bodyweight circuit.`,
    disclaimer,
    triggerFactors: { sleepDuration: sleepHours, energy, soreness, workoutCompletedToday },
  };
}

// ==========================================
// 7. Bodyweight Exercise Progression: f_progression
// Status: engineering_heuristic (translating ACSM 2026 principle)
// ==========================================

export interface ProgressionGuidance {
  movementName: string;
  currentSets: number;
  currentReps: string;
  progressionNote: string;
  status: 'engineering_heuristic';
  translationNote: string;
}

/**
 * Translates ACSM 2026 progressive overload principle into bodyweight repetitions and leverage variations.
 *
 * EXPLICIT AUDIT DECLARATION:
 * ACSM supports progressive resistance training. This application translates that principle
 * to bodyweight exercise using rep and variation progression.
 */
export function f_progression(
  movement: 'push-up' | 'squat' | 'plank' | 'lunge',
  difficultyHistory: PerceivedDifficulty = 'moderate'
): ProgressionGuidance {
  const translationNote = 'ACSM 2026 supports progressive resistance training. This application translates that principle to bodyweight exercise using rep and variation progression.';

  switch (movement) {
    case 'push-up':
      if (difficultyHistory === 'light') {
        return {
          movementName: '标准俯卧撑 (Standard Push-ups)',
          currentSets: 3,
          currentReps: '12–15 次',
          progressionNote: '进阶提示：动作底部静止停顿 1 秒增加反向机械张力，或抬高脚部增加杠杆负重。',
          status: 'engineering_heuristic',
          translationNote,
        };
      }
      return {
        movementName: '俯卧撑 (Push-ups / Incline variant)',
        currentSets: 3,
        currentReps: '8–12 次',
        progressionNote: '进阶梯度：跪姿/上斜推墙 (8-10次) → 标准俯卧撑 (8-12次) → 底部停顿俯卧撑。',
        status: 'engineering_heuristic',
        translationNote,
      };

    case 'squat':
      return {
        movementName: '标准自重深蹲 (Bodyweight Air Squats)',
        currentSets: 3,
        currentReps: '12–15 次',
        progressionNote: '进阶梯度：自重深蹲 (12-15次) → 节奏深蹲 (下蹲3秒) → 分腿蹲/保加利亚分腿蹲。',
        status: 'engineering_heuristic',
        translationNote,
      };

    case 'plank':
      return {
        movementName: '前臂平板支撑 (Forearm Plank)',
        currentSets: 3,
        currentReps: '30–40 秒',
        progressionNote: '进阶梯度：前臂支撑 (30-45秒) → 单臂/单腿离地动态平衡板。',
        status: 'engineering_heuristic',
        translationNote,
      };

    case 'lunge':
    default:
      return {
        movementName: '交替反向箭步蹲 (Alternating Reverse Lunges)',
        currentSets: 3,
        currentReps: '10 次 / 侧',
        progressionNote: '进阶梯度：反向箭步蹲 (10次/侧) → 行走箭步蹲 → 垫高前脚跟深蹲。',
        status: 'engineering_heuristic',
        translationNote,
      };
  }
}

// ==========================================
// 8. Next Meal Recommendation Function: f_meal(x)
// ==========================================

export function f_meal(context: HealthContext): MealRecommendation {
  const { profile, todayMeals, todayState, hasIncompleteData, currentWeight } = context;

  const rmr = f_RMR(currentWeight, profile.height, profile.age, profile.sex);
  const tdee = f_TDEE(rmr.predictedRMR, false);
  const proteinTarget = f_protein(currentWeight, profile.goal);
  const perMealProtein = f_per_meal_protein(currentWeight);

  const consumedCalories = todayMeals.reduce((acc, m) => acc + m.estimatedCalories, 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + m.estimatedProtein, 0);

  const mealCount = todayMeals.length;
  const isDataSparse = mealCount === 0 || hasIncompleteData;

  const remainingProteinMin = Math.max(0, proteinTarget.proteinRange.min - consumedProtein);
  const remainingProteinMax = Math.max(0, proteinTarget.proteinRange.max - consumedProtein);
  const remainingCalorieMin = Math.max(0, tdee.estimatedEnergyRange.min - consumedCalories);
  const remainingCalorieMax = Math.max(0, tdee.estimatedEnergyRange.max - consumedCalories);

  // Evidence references
  const mortonRef = getEvidenceById('morton-2018')!;
  const schoenfeldRef = getEvidenceById('schoenfeld-2018')!;
  const mifflinRef = getEvidenceById('mifflin-1990')!;

  // Branch 1: Zero meal logs or incomplete data -> Baseline Plate with explicit uncertainty
  if (isDataSparse) {
    const mealEnergyMin = Math.round(tdee.estimatedEnergyRange.min * 0.28);
    const mealEnergyMax = Math.round(tdee.estimatedEnergyRange.max * 0.35);
    const mealProteinMin = perMealProtein.perMealRange.min;
    const mealProteinMax = perMealProtein.perMealRange.max;

    const trace: DecisionTrace = {
      inputSnapshot: {
        weightKg: currentWeight,
        heightCm: profile.height,
        age: profile.age,
        sex: profile.sex,
        goal: profile.goal,
        recordedMealsCount: mealCount,
        hasIncompleteData: !!hasIncompleteData,
      },
      derivedValues: {
        predictedRMR: rmr.predictedRMR,
        tdeeRange: tdee.estimatedEnergyRange,
        dailyProteinRange: proteinTarget.proteinRange,
        perMealProteinTarget: perMealProtein.perMealRange,
      },
      ruleIds: ['RULE_MEAL_BASELINE_PLATE_01'],
      ruleStatuses: ['evidence_derived', 'evidence_constrained', 'engineering_heuristic'],
      evidenceIds: ['mifflin-1990', 'morton-2018', 'schoenfeld-2018'],
      assumptions: [
        'Mifflin-St Jeor equation predicts resting metabolic rate; individual variance is typically ±10%',
        'Activity factor (1.15–1.25) is an engineering estimation assumption providing an energy range',
        'In the absence of daytime meal logs, program recommends a baseline balanced plate (28–35% daily energy)',
      ],
      limitations: [
        'Cannot determine exact remaining nutrient deficits without real logged intake data',
        'Meal template uses representative food nutrition values, not laboratory chemical assay',
      ],
      confidence: 'low',
    };

    return {
      mealName: '清蒸鱼柳或嫩豆腐 · 杂粮米饭 · 鲜蔬盘',
      suggestedItems: ['清蒸鱼柳或卤豆腐 (150g)', '五谷杂粮饭 (1碗 / 150g)', '深绿西兰花与菠菜 (150g)', '橄榄油少许 (5ml)'],
      estimatedCalories: Math.round((mealEnergyMin + mealEnergyMax) / 2),
      estimatedProtein: Math.round((mealProteinMin + mealProteinMax) / 2),
      energyRange: { min: mealEnergyMin, max: mealEnergyMax },
      proteinRange: { min: mealProteinMin, max: mealProteinMax },
      ruleId: 'RULE_MEAL_BASELINE_PLATE_01',
      ruleName: '初次基准全营养餐盘规则',
      ruleStatus: 'engineering_heuristic',
      reason: `今日暂无饮食日志。依据 Mifflin-St Jeor 预测之 RMR (${rmr.predictedRMR} kcal) 与全谷物精益蛋白餐盘模型，提供标准全营养启动餐盘。`,
      isUncertaintyNoted: true,
      uncertaintyMessage: '今日饮食记录尚不完整，此建议为基于个人基础代谢与体重的估算餐盘（置信度：Low）。',
      trace,
      evidenceTraces: [
        {
          evidenceId: 'mifflin-1990',
          relevance: '采用 Mifflin-St Jeor (1990) 预测方程提供基准能量消耗参考（个体误差通常为 ±10%）。',
          evidenceStrength: 'High',
          reference: mifflinRef,
        },
        {
          evidenceId: 'schoenfeld-2018',
          relevance: '根据 Schoenfeld & Aragon (2018) 单餐实用建议，推荐每餐摄入约 0.40–0.55 g/kg 优质蛋白质。',
          evidenceStrength: 'Moderate',
          reference: schoenfeldRef,
        },
      ],
    };
  }

  // Branch 2: High protein gap remaining (>= 35g)
  if (remainingProteinMin >= 35) {
    const mealProteinMin = Math.min(35, remainingProteinMin);
    const mealProteinMax = Math.min(45, remainingProteinMax);
    const mealEnergyMin = Math.min(480, Math.max(380, remainingCalorieMin - 150));
    const mealEnergyMax = Math.min(580, Math.max(450, remainingCalorieMax));

    const trace: DecisionTrace = {
      inputSnapshot: {
        weightKg: currentWeight,
        consumedProtein,
        consumedCalories,
        targetProteinMin: proteinTarget.proteinRange.min,
        remainingProteinMin,
        remainingProteinMax,
      },
      derivedValues: {
        remainingProteinGap: `${remainingProteinMin}–${remainingProteinMax} g`,
        recommendedBolus: `${mealProteinMin}–${mealProteinMax} g`,
      },
      ruleIds: ['RULE_MEAL_PROTEIN_DEFICIT_PRIORITY'],
      ruleStatuses: ['evidence_constrained', 'engineering_heuristic'],
      evidenceIds: ['morton-2018', 'schoenfeld-2018'],
      assumptions: [
        'Morton 2018 meta-regression demonstrates group benefit plateau ~1.62 g/kg/day during resistance training',
        'Schoenfeld 2018 suggests capping single-meal target around ~0.40–0.55 g/kg to avoid excessive single bolus',
      ],
      limitations: [
        'Individual amino acid oxidation rate varies with gut transit time and training status',
      ],
      confidence: 'high',
    };

    return {
      mealName: '香煎鸡胸肉 · 糙米饭 · 清炒时蔬盘',
      suggestedItems: ['去皮鸡胸肉或巴沙鱼 (160g)', '熟糙米饭 (160g)', '西兰花与胡萝卜 (160g)', '少许清油调味'],
      estimatedCalories: Math.round((mealEnergyMin + mealEnergyMax) / 2),
      estimatedProtein: Math.round((mealProteinMin + mealProteinMax) / 2),
      energyRange: { min: mealEnergyMin, max: mealEnergyMax },
      proteinRange: { min: mealProteinMin, max: mealProteinMax },
      ruleId: 'RULE_MEAL_PROTEIN_DEFICIT_PRIORITY',
      ruleName: '高蛋白缺口修补规则',
      ruleStatus: 'evidence_constrained',
      reason: `今日已记录摄入蛋白质 ${consumedProtein}g。建议选择适度高蛋白餐盘（≈35–45g 蛋白质），以稳步贴近日常参考范围。`,
      isUncertaintyNoted: false,
      trace,
      evidenceTraces: [
        {
          evidenceId: 'morton-2018',
          relevance: '系统综述与荟萃分析指出群体的边际增益拐点在 ~1.62 g/kg/day，全天亏缺需要适时弥补。',
          evidenceStrength: 'High',
          reference: mortonRef,
        },
        {
          evidenceId: 'schoenfeld-2018',
          relevance: '单餐蛋白质分配建议将单次剂量控制在约 0.40–0.55 g/kg (约 28–42g)。',
          evidenceStrength: 'Moderate',
          reference: schoenfeldRef,
        },
      ],
    };
  }

  // Branch 3: Calorie space tight (< 420 kcal) but protein still needed
  if (remainingCalorieMax <= 450 && remainingProteinMin >= 15) {
    const mealEnergyMin = Math.max(260, remainingCalorieMin);
    const mealEnergyMax = Math.min(360, remainingCalorieMax);
    const mealProteinMin = 22;
    const mealProteinMax = Math.min(32, remainingProteinMax);

    const trace: DecisionTrace = {
      inputSnapshot: {
        remainingCalorieRange: `${remainingCalorieMin}–${remainingCalorieMax} kcal`,
        remainingProteinRange: `${remainingProteinMin}–${remainingProteinMax} g`,
      },
      derivedValues: {
        mealEnergyRange: `${mealEnergyMin}–${mealEnergyMax} kcal`,
        mealProteinRange: `${mealProteinMin}–${mealProteinMax} g`,
      },
      ruleIds: ['RULE_MEAL_LEAN_DENSITY_CONSTRAINT'],
      ruleStatuses: ['engineering_heuristic'],
      evidenceIds: ['morton-2018'],
      assumptions: [
        'Prioritizes high protein-to-energy ratio foods (seafood, egg whites, low-fat soy)',
        'Minimizes dietary fats in this specific meal to prevent exceeding remaining daily energy allowance',
      ],
      limitations: [
        'Ultra-lean protein may reduce palatability; ensure adequate vegetable fiber for satiety',
      ],
      confidence: 'medium',
    };

    return {
      mealName: '白灼鲜虾与蛋白 · 爽口凉拌黄瓜紫菜汤',
      suggestedItems: ['白灼鲜虾 (120g) 或 鸡蛋白 (3个)', '凉拌黄瓜与生菜 (180g)', '清淡紫菜虾皮汤 (1碗)'],
      estimatedCalories: Math.round((mealEnergyMin + mealEnergyMax) / 2),
      estimatedProtein: Math.round((mealProteinMin + mealProteinMax) / 2),
      energyRange: { min: mealEnergyMin, max: mealEnergyMax },
      proteinRange: { min: mealProteinMin, max: mealProteinMax },
      ruleId: 'RULE_MEAL_LEAN_DENSITY_CONSTRAINT',
      ruleName: '低热量高蛋白密度分支',
      ruleStatus: 'engineering_heuristic',
      reason: `今日剩余热量空间收紧 (≈${mealEnergyMin}–${mealEnergyMax} kcal)，但仍有蛋白质需求。采用高蛋白质/能量比食材，确保在热量不超支前提下守住蛋白质底线。`,
      isUncertaintyNoted: false,
      trace,
      evidenceTraces: [
        {
          evidenceId: 'morton-2018',
          relevance: '热量亏缺状态下优先保留蛋白质配额，对冲去脂体重分解风险。',
          evidenceStrength: 'High',
          reference: mortonRef,
        },
      ],
    };
  }

  // Branch 4: Protein target largely reached
  const mealEnergyMin = Math.max(260, Math.min(360, remainingCalorieMin));
  const mealEnergyMax = Math.max(340, Math.min(420, remainingCalorieMax));
  const mealProteinMin = 14;
  const mealProteinMax = 22;

  const trace: DecisionTrace = {
    inputSnapshot: {
      consumedProtein,
      targetProteinMin: proteinTarget.proteinRange.min,
      remainingProteinMin,
    },
    derivedValues: {
      completionRate: `${Math.round((consumedProtein / proteinTarget.proteinRange.min) * 100)}%`,
    },
    ruleIds: ['RULE_MEAL_MAINTENANCE_LIGHT_01'],
    ruleStatuses: ['engineering_heuristic'],
    evidenceIds: ['schoenfeld-2018'],
    assumptions: [
      'Gastrointestinal rest is favored before evening bedtime when daily macro requirements are met',
    ],
    limitations: [
      'Personal meal timing preferences (e.g. intermittent fasting) may shift calorie distribution',
    ],
    confidence: 'high',
  };

  return {
    mealName: '轻食全麦三明治或温拌时蔬豆腐',
    suggestedItems: ['全麦面包或蒸南瓜 (120g)', '水煮蛋 (1个)', '嫩豆腐或白肉片 (60g)', '生菜番茄片'],
    estimatedCalories: Math.round((mealEnergyMin + mealEnergyMax) / 2),
    estimatedProtein: Math.round((mealProteinMin + mealProteinMax) / 2),
    energyRange: { min: mealEnergyMin, max: mealEnergyMax },
    proteinRange: { min: mealProteinMin, max: mealProteinMax },
    ruleId: 'RULE_MEAL_MAINTENANCE_LIGHT_01',
    ruleName: '营养近达维持与纤维修整规则',
    ruleStatus: 'engineering_heuristic',
    reason: `今日蛋白质已基本达标 (${consumedProtein}g)。建议以温和易消化的复合全谷物与深色蔬菜为主，平稳夜间血糖与肠胃负荷。`,
    isUncertaintyNoted: false,
    trace,
    evidenceTraces: [
      {
        evidenceId: 'schoenfeld-2018',
        relevance: '全天蛋白质总量满足后，单餐无需追求大剂量，维持均衡适度即可。',
        evidenceStrength: 'Moderate',
        reference: schoenfeldRef,
      },
    ],
  };
}

// ==========================================
// 9. Next Workout Recommendation Function: f_workout(x)
// ==========================================

export function f_workout(context: HealthContext): WorkoutRecommendation {
  const { todayState, todayWorkout, recentWorkouts } = context;

  const trainingDecision = f_training_state({
    sleepHours: todayState.sleepHours,
    energy: todayState.energy,
    soreness: todayState.soreness,
    workoutCompletedToday: todayWorkout?.completed === true,
    recentDifficulty: recentWorkouts[0]?.perceivedDifficulty,
  });

  const whoRef = getEvidenceById('who-2020')!;
  const acsmRef = getEvidenceById('acsm-2026')!;
  const helmsRef = getEvidenceById('helms-2016')!;

  const equipmentCoverage: WorkoutRecommendation['equipmentCoverage'] = {
    push: 'well covered',
    lowerBody: 'well covered',
    core: 'well covered',
    posteriorChain: 'moderately covered',
    pull: 'limited (no pull-up bar / external equipment)',
  };

  const engineeringTranslationNote =
    'ACSM 2026 supports progressive resistance training. This application translates that principle to bodyweight exercise using rep and variation progression.';

  // Branch A: Workout already completed today -> REST
  if (trainingDecision.state === 'REST') {
    const exercises: BodyweightExercise[] = [
      { name: '死虫子核心抗伸展 (Dead Bug)', sets: 2, repsOrDuration: '8 次 / 侧', progressionNote: '轻缓呼气，专注于腹横肌等长维持', movementPattern: 'core' },
      { name: '靠墙静蹲支撑 (Wall Sit)', sets: 2, repsOrDuration: '25 秒', progressionNote: '保持股四头肌静态张力，不施加下背负荷', movementPattern: 'lower body' },
      { name: '仰卧胸椎温和拉伸与深呼吸', sets: 1, repsOrDuration: '3 分钟', progressionNote: '膈肌自然膨胀，放松交感神经系统', movementPattern: 'posterior chain' },
    ];

    const trace: DecisionTrace = {
      inputSnapshot: {
        workoutCompletedToday: true,
        durationMinutes: todayWorkout?.durationMinutes || 0,
      },
      derivedValues: {
        trainingState: 'REST',
      },
      ruleIds: ['RULE_WORKOUT_SUPERCOMPENSATION_REST'],
      ruleStatuses: ['engineering_heuristic'],
      evidenceIds: ['who-2020'],
      assumptions: [
        'Supercompensation model: muscle fiber remodeling and central fatigue recovery require inter-session rest',
      ],
      limitations: [
        'Does not track non-exercise daily physical labor or steps outside recorded workouts',
      ],
      confidence: 'high',
    };

    return {
      title: '今日运动已达成 · 神经与肌纤维温和休整',
      sessionType: 'Rest',
      trainingState: 'REST',
      trainingStateHeuristicNote: trainingDecision.disclaimer,
      durationMinutes: 10,
      reason: '今日已完成了一次抗阻训练。超量恢复 (Supercompensation) 原理表明结缔组织修复发生在间歇期，今日无需追加力量训练。',
      exercises,
      recoveryGuidance: '补充 300–500ml 温水，维持正常作息与蛋白质供应。',
      equipmentCoverage,
      engineeringTranslationNote,
      ruleId: 'RULE_WORKOUT_SUPERCOMPENSATION_REST',
      ruleName: '超量恢复与休息工程规则',
      ruleStatus: 'engineering_heuristic',
      trace,
      evidenceTraces: [
        {
          evidenceId: 'who-2020',
          relevance: 'WHO 建议每周力量活动应留出适当恢复窗口，避免连续同肌群劳损。',
          evidenceStrength: 'High',
          reference: whoRef,
        },
      ],
    };
  }

  // Branch B: Severe soreness or acute fatigue -> RECOVERY
  if (trainingDecision.state === 'RECOVERY') {
    const exercises: BodyweightExercise[] = [
      { name: '猫牛式脊柱流转 (Cat-Cow)', sets: 2, repsOrDuration: '10 次流动', progressionNote: '轻柔活动胸椎与骨盆，配合呼吸节律', movementPattern: 'core' },
      { name: '仰卧双腿臀桥静态激活 (Glute Bridge)', sets: 2, repsOrDuration: '20 秒静态保持', progressionNote: '强化臀大肌神经反射，减轻腰背代偿', movementPattern: 'posterior chain' },
      { name: '四足鸟狗式核心平衡 (Bird Dog)', sets: 2, repsOrDuration: '6 次 / 侧', progressionNote: '对侧手脚伸展，不反弓腰部', movementPattern: 'core' },
      { name: '仰卧抱膝与下背放松 (Knee-to-Chest)', sets: 2, repsOrDuration: '30 秒', progressionNote: '促进盆底与腰背筋膜张力缓解', movementPattern: 'posterior chain' },
    ];

    const trace: DecisionTrace = {
      inputSnapshot: {
        sleepHours: todayState.sleepHours,
        energy: todayState.energy,
        soreness: todayState.soreness,
      },
      derivedValues: {
        trainingState: 'RECOVERY',
      },
      ruleIds: ['RULE_WORKOUT_ACTIVE_RECOVERY_PROTECTION'],
      ruleStatuses: ['engineering_heuristic'],
      evidenceIds: ['helms-2016'],
      assumptions: [
        'High soreness (>=4) or energy deprivation indicates impaired neuromuscular recruitment and elevated strain risk',
      ],
      limitations: [
        'Subjective soreness score (1-5) is a self-reported heuristic, not a biological creatine kinase marker',
      ],
      confidence: 'medium',
    };

    return {
      title: '高疲劳与肌肉酸痛 · 主动恢复与关节灵活性',
      sessionType: 'Recovery session',
      trainingState: 'RECOVERY',
      trainingStateHeuristicNote: trainingDecision.disclaimer,
      durationMinutes: 14,
      reason: `肌肉酸痛评分偏高 (${todayState.soreness}/5) 或精力受限 (${todayState.energy}/5)。工程保护启发式下调负荷为灵活性流转，避免动作代偿与韧带过载。`,
      exercises,
      recoveryGuidance: '避免冲击性跳跃或力竭动作，重点在于促进血液循环与缓解肌肉张力。',
      progressionTip: '今晚争取提早 30 分钟入睡，让机体深度睡眠参与组织修复。',
      equipmentCoverage,
      engineeringTranslationNote,
      ruleId: 'RULE_WORKOUT_ACTIVE_RECOVERY_PROTECTION',
      ruleName: '高疲劳保护与主动恢复规则',
      ruleStatus: 'engineering_heuristic',
      trace,
      evidenceTraces: [
        {
          evidenceId: 'helms-2016',
          relevance: '自律调节框架提倡在疲劳或组织酸痛状态下适度下调负荷，防止中枢神经劳损。',
          evidenceStrength: 'High',
          reference: helmsRef,
        },
      ],
    };
  }

  // Branch C: Moderate recovery balance -> LIGHT
  if (trainingDecision.state === 'LIGHT') {
    const exercises: BodyweightExercise[] = [
      { name: '自重深蹲 (Air Squat)', sets: 2, repsOrDuration: '10–12 次', progressionNote: '下蹲 2 秒，站起平稳，保持呼吸畅通', movementPattern: 'lower body' },
      { name: '上斜/跪姿俯卧撑 (Incline / Knee Push-ups)', sets: 2, repsOrDuration: '8–10 次', progressionNote: '掌根发力推起，保持核心微紧', movementPattern: 'push' },
      { name: '前臂平板支撑 (Forearm Plank)', sets: 2, repsOrDuration: '25 秒', progressionNote: '肘关节垂直于肩下，骨盆维持中立位', movementPattern: 'core' },
      { name: '仰卧交替屈髋死虫子 (Dead Bug)', sets: 2, repsOrDuration: '8 次 / 侧', progressionNote: '控制速度，不要借用腰部代偿', movementPattern: 'core' },
    ];

    const trace: DecisionTrace = {
      inputSnapshot: {
        energy: todayState.energy,
        soreness: todayState.soreness,
        sleepHours: todayState.sleepHours,
      },
      derivedValues: {
        trainingState: 'LIGHT',
        clampedSets: 2,
        targetRIR: '2–3 reps in reserve',
      },
      ruleIds: ['RULE_WORKOUT_AUTOREGULATED_MODERATE'],
      ruleStatuses: ['engineering_heuristic'],
      evidenceIds: ['helms-2016', 'acsm-2026'],
      assumptions: [
        'Volume reduction to 2 sets preserves physical activity stimulus without accumulating excessive systemic fatigue',
      ],
      limitations: [
        'Home bodyweight calisthenics has limited horizontal and vertical pulling movements without equipment',
      ],
      confidence: 'medium',
    };

    return {
      title: '自律调节适度容量锻炼 (Autoregulated Light Session)',
      sessionType: 'Light session',
      trainingState: 'LIGHT',
      trainingStateHeuristicNote: trainingDecision.disclaimer,
      durationMinutes: 16,
      reason: `今日状态处于中等平衡区间 (精力 ${todayState.energy}/5, 酸痛 ${todayState.soreness}/5)。应用启发式规则将动作总组数收紧至 2 组，保留 2–3 次力竭余量 (RIR 2-3)。`,
      exercises,
      recoveryGuidance: '组间休整 60–75 秒，动作质量优于速度。',
      equipmentCoverage,
      engineeringTranslationNote,
      ruleId: 'RULE_WORKOUT_AUTOREGULATED_MODERATE',
      ruleName: '自律调节适度容量规则',
      ruleStatus: 'engineering_heuristic',
      trace,
      evidenceTraces: [
        {
          evidenceId: 'helms-2016',
          relevance: '自律调节模型建议在适度机能状态下维持 RPE 6–7 (RIR 2–3)，平衡训练刺激与恢复。',
          evidenceStrength: 'High',
          reference: helmsRef,
        },
        {
          evidenceId: 'acsm-2026',
          relevance: 'ACSM 2026 阻抗综述确认即使在中等容量下，接近力竭的多关节动作依然能诱发有效的肌肉功能保持。',
          evidenceStrength: 'High',
          reference: acsmRef,
        },
      ],
    };
  }

  // Branch D: High readiness -> NORMAL
  const exercises: BodyweightExercise[] = [
    { name: '标准自重深蹲 (Bodyweight Air Squats)', sets: 3, repsOrDuration: '12–15 次', progressionNote: '下蹲节奏 2-0-2，双膝朝向第二脚趾', movementPattern: 'lower body' },
    { name: '标准俯卧撑 (Standard Push-ups)', sets: 3, repsOrDuration: '10–12 次', progressionNote: '前锯肌与胸大肌主动发力，身体呈稳定平面', movementPattern: 'push' },
    { name: '交替反向箭步蹲 (Alternating Reverse Lunges)', sets: 3, repsOrDuration: '10 次 / 侧', progressionNote: '重心平稳垂直下降，前脚掌全脚踩实', movementPattern: 'lower body' },
    { name: '前臂平板支撑 (Forearm Plank Hold)', sets: 3, repsOrDuration: '30–40 秒', progressionNote: '收紧臀大肌与腹横肌，自然均匀呼吸', movementPattern: 'core' },
  ];

  const trace: DecisionTrace = {
    inputSnapshot: {
      energy: todayState.energy,
      soreness: todayState.soreness,
      sleepHours: todayState.sleepHours,
    },
    derivedValues: {
      trainingState: 'NORMAL',
      standardSets: 3,
      targetRPE: '7–8',
    },
    ruleIds: ['RULE_WORKOUT_PROGRESSIVE_CALISTHENICS'],
    ruleStatuses: ['engineering_heuristic'],
    evidenceIds: ['acsm-2026', 'who-2020'],
    assumptions: [
      'ACSM 2026 confirms progressive overload is effective via multi-joint movement patterns',
      'Application translates progressive overload to bodyweight reps and pause tempo variations',
    ],
    limitations: [
      'Pull movement coverage is limited without pull-up bars or suspension rings; push/lower/core are fully covered',
    ],
    confidence: 'high',
  };

  return {
    title: '徒手力量与核心标准推进 (Progressive Calisthenics Circuit)',
    sessionType: 'Normal session',
    trainingState: 'NORMAL',
    trainingStateHeuristicNote: trainingDecision.disclaimer,
    durationMinutes: 22,
    reason: `精力状态良好 (${todayState.energy}/5)，酸痛较低 (${todayState.soreness}/5)。执行标准 3 组闭链徒手力量循环，给予机体清晰的渐进超负荷刺激。`,
    exercises,
    recoveryGuidance: '组间休息 45–60 秒，训练后 30 分钟内适量饮水与摄入蛋白质。',
    progressionTip: '若俯卧撑能轻松完成 15 次，下一阶段可在动作底部静止停留 1 秒增加机械张力。',
    equipmentCoverage,
    engineeringTranslationNote,
    ruleId: 'RULE_WORKOUT_PROGRESSIVE_CALISTHENICS',
    ruleName: '渐进超负荷徒手力量规则',
    ruleStatus: 'engineering_heuristic',
    trace,
    evidenceTraces: [
      {
        evidenceId: 'acsm-2026',
        relevance: 'ACSM 2026 阻抗训练立场陈述证实渐进式阻抗刺激对于健康成年人肌力与肌肉肥大的有效性。',
        evidenceStrength: 'High',
        reference: acsmRef,
      },
      {
        evidenceId: 'who-2020',
        relevance: '符合 WHO 建议的每周至少 2 天全身主要肌群中等以上强度力量锻炼指南。',
        evidenceStrength: 'High',
        reference: whoRef,
      },
    ],
  };
}
