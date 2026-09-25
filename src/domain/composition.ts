/**
 * 目标与处方（Decision）
 *
 * 应用先给建议（据 BMI 与腰围），用户确认后才成为目标；两者相悖时如实标出。
 * 每日目标热量/蛋白由 TDEE 与目标方向算出——页面不再手写 1950 / 110 这类数字。
 */

import type { FitnessGoal, UserProfile } from '../types/health';
import { TARGET_POLICY } from './policy';
import type { BmiCategory } from './body';
import type { NutritionTargets, TrainingTarget, WeightGoalAdvice } from './types';

export type WeightDirection = 'lose' | 'maintain' | 'gain';

export type GoalReason =
  | 'bmi_overweight'
  | 'bmi_obese'
  | 'waist_elevated'
  | 'bmi_underweight'
  | 'bmi_normal'
  | 'goal_conflicts_with_advice';

const directionOfGoal = (goal: FitnessGoal | undefined): WeightDirection => {
  if (goal === 'fat loss') return 'lose';
  if (goal === 'muscle gain') return 'gain';
  return 'maintain';
};

/**
 * 「该减、该守、还是该增」——建议只由 BMI 分类与腰围给出；
 * 与用户自选目标冲突时标 conflicting，由用户决定（不替他改目标）。
 */
export function adviseWeightGoal(input: {
  bmiCategory: BmiCategory | null;
  waistElevated: boolean | null;
  goal: FitnessGoal | undefined;
}): WeightGoalAdvice {
  const { bmiCategory, waistElevated, goal } = input;
  const reasons: GoalReason[] = [];

  let direction: WeightDirection = 'maintain';
  if (bmiCategory === 'obese_1' || bmiCategory === 'obese_2') {
    direction = 'lose';
    reasons.push('bmi_obese');
  } else if (bmiCategory === 'overweight') {
    direction = 'lose';
    reasons.push('bmi_overweight');
  } else if (bmiCategory === 'underweight') {
    direction = 'gain';
    reasons.push('bmi_underweight');
  } else if (bmiCategory === 'normal') {
    reasons.push('bmi_normal');
  }

  if (waistElevated === true) {
    reasons.push('waist_elevated');
    if (direction === 'maintain') direction = 'lose';
  }

  // 只有方向「相反」才算相悖：建议维持与任何目标都可兼容（正常区间可增肌可减脂）
  const goalDirection = directionOfGoal(goal);
  const conflicting =
    goal !== undefined &&
    ((direction === 'lose' && goalDirection === 'gain') ||
      (direction === 'gain' && goalDirection === 'lose'));
  if (conflicting) reasons.push('goal_conflicts_with_advice');

  return { direction, reasons, conflicting, goalDirection };
}

/** 每日目标热量与蛋白：由 TDEE、目标方向与体重算出。 */
export function deriveNutritionTargets(input: {
  tdeeKcal: number | null;
  weightKg: number | null;
  direction: WeightDirection;
  sex: UserProfile['sex'];
}): NutritionTargets | null {
  const { tdeeKcal, weightKg, direction, sex } = input;
  if (tdeeKcal === null || tdeeKcal <= 0 || weightKg === null || weightKg <= 0) return null;

  const ratio =
    direction === 'lose'
      ? TARGET_POLICY.loseRatio
      : direction === 'gain'
      ? TARGET_POLICY.gainRatio
      : TARGET_POLICY.maintainRatio;
  const floor = sex === 'female' ? TARGET_POLICY.calorieFloor.female : TARGET_POLICY.calorieFloor.male;
  const raw = Math.round(tdeeKcal * ratio);
  const caloriesKcal = Math.max(raw, floor);

  const proteinMin = Math.round(weightKg * TARGET_POLICY.proteinGPerKg.min);
  const proteinMax = Math.round(weightKg * TARGET_POLICY.proteinGPerKg.max);
  const proteinG = Math.round((proteinMin + proteinMax) / 2);

  const rate =
    direction === 'lose'
      ? TARGET_POLICY.loseRatePctPerWeek
      : direction === 'gain'
      ? TARGET_POLICY.gainRatePctPerWeek
      : null;

  return {
    caloriesKcal,
    proteinG,
    proteinRange: { min: proteinMin, max: proteinMax },
    kcalFromTdee: tdeeKcal,
    ratio,
    floored: raw < floor,
    targetRateKgPerWeek: rate
      ? {
          min: Math.round(((weightKg * rate.min) / 100) * 100) / 100,
          max: Math.round(((weightKg * rate.max) / 100) * 100) / 100,
        }
      : null,
    direction,
  };
}

/** 每周抗阻日数与单次时长：人群基线之上按目标与活动水平调整。 */
export function decideTrainingTarget(input: {
  direction: WeightDirection;
  goal: FitnessGoal | undefined;
  activityLevel: UserProfile['activityLevel'];
}): TrainingTarget {
  const { direction, goal, activityLevel } = input;
  let resistanceDaysPerWeek: number = TARGET_POLICY.resistanceDaysBaseline;
  if (goal === 'muscle gain' || (direction === 'lose' && activityLevel === 'moderate')) {
    resistanceDaysPerWeek = TARGET_POLICY.resistanceDaysForMuscleGain;
  }
  if (activityLevel === 'active' || activityLevel === 'very_active') {
    resistanceDaysPerWeek = TARGET_POLICY.resistanceDaysActive;
  }
  return {
    resistanceDaysPerWeek,
    sessionMinutes: goal === 'muscle gain' ? { min: 40, max: 60 } : { min: 25, max: 45 },
    baseline: TARGET_POLICY.resistanceDaysBaseline,
  };
}
