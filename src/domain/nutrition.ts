/**
 * 营养（Derived + Decision）
 *
 * 计划膳（MealRecommendation）永不进入这里；只有已确认入账的 MealRecord 才被累加。
 * 蛋白质/热量/比例/余量/超额全部来自同一组输入，杜绝「页面数字 A、进度条 B、百分比 C」。
 */

import type { MealRecord } from '../types/health';
import { NUTRITION_POLICY, type NutritionPolicy } from './policy';
import type { DataQuality, NutritionProgress, NutritionSummary } from './types';

/** 单笔账：比例、余量、超额同源。 */
export function calculateNutritionProgress(consumed: number, target: number): NutritionProgress {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = Number.isFinite(target) ? target : 0;
  const ratio = safeTarget > 0 ? safeConsumed / safeTarget : 0;
  const remaining = Math.max(safeTarget - safeConsumed, 0);
  const over = Math.max(safeConsumed - safeTarget, 0);
  const status: NutritionProgress['status'] =
    over > 0 ? 'over' : remaining > 0 ? 'under' : 'met';
  return { consumed: safeConsumed, target: safeTarget, ratio, remaining, over, status };
}

/** 今日已入账膳食的合计（原始记录 → 合计，不存第二份）。 */
export function sumMealLogs(meals: MealRecord[]): {
  calories: number;
  protein: number;
  count: number;
} {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (meal.estimatedCalories || 0),
      protein: acc.protein + (meal.estimatedProtein || 0),
      count: acc.count + 1,
    }),
    { calories: 0, protein: 0, count: 0 }
  );
}

/**
 * 记录可信度：已越常度（如一键直录被连点数次）时提示核对，而不是悄悄照算。
 * 只标记，不改数。
 */
export function assessNutritionQuality(
  calories: NutritionProgress,
  mealCount: number,
  policy: NutritionPolicy = NUTRITION_POLICY
): DataQuality {
  const reasons: DataQuality['reasons'] = [];
  const detail: DataQuality['detail'] = {};

  if (mealCount === 0) {
    return { flag: 'normal', reasons, detail };
  }

  if (calories.ratio > policy.overRatioReview) {
    reasons.push('nutrition_over_plausible_range');
    detail.ratio = calories.ratio;
    detail.consumedKcal = calories.consumed;
    detail.targetKcal = calories.target;
  } else if (calories.consumed > 0 && calories.consumed < policy.minPlausibleKcal) {
    reasons.push('nutrition_over_plausible_range');
    detail.consumedKcal = calories.consumed;
    detail.minPlausibleKcal = policy.minPlausibleKcal;
  }

  return { flag: reasons.length > 0 ? 'needs_review' : 'normal', reasons, detail };
}

export function buildNutritionSummary(
  meals: MealRecord[],
  targetCalories: number,
  targetProtein: number,
  policy: NutritionPolicy = NUTRITION_POLICY
): NutritionSummary {
  const totals = sumMealLogs(meals);
  const calories = calculateNutritionProgress(totals.calories, targetCalories);
  const protein = calculateNutritionProgress(totals.protein, targetProtein);
  return {
    calories,
    protein,
    mealCount: totals.count,
    quality: assessNutritionQuality(calories, totals.count, policy),
  };
}
