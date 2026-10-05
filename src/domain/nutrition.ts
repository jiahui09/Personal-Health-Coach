/**
 * 营养（Derived + Decision）
 *
 * 计划膳（MealRecommendation）永不进入这里；只有已确认入账的 MealRecord 才被累加。
 * 蛋白质/热量/比例/余量/超额全部来自同一组输入，杜绝「页面数字 A、进度条 B、百分比 C」。
 */

import type { FoodItem, MealItem, MealRecord } from '../types/health';
import { NUTRITION_POLICY, type NutritionPolicy } from './policy';
import type { DataQuality, NutritionProgress, NutritionSummary } from './types';

/** 单笔账：比例、余量、超额同源。 */
export function calculateNutritionProgress(consumed: number, target: number): NutritionProgress {
  const safeConsumed = Number.isFinite(consumed) ? consumed : 0;
  const safeTarget = Number.isFinite(target) ? target : 0;
  // 未立目标（建档前 target 为 0）：不判达标/超额——否则「已录即已超」的假红字
  if (!(safeTarget > 0)) {
    return { consumed: safeConsumed, target: safeTarget, ratio: 0, remaining: 0, over: 0, status: 'no_target' };
  }
  const ratio = safeConsumed / safeTarget;
  const remaining = Math.max(safeTarget - safeConsumed, 0);
  const over = Math.max(safeConsumed - safeTarget, 0);
  const status: NutritionProgress['status'] =
    over > 0 ? 'over' : remaining > 0 ? 'under' : 'met';
  return { consumed: safeConsumed, target: safeTarget, ratio, remaining, over, status };
}

/**
 * 食物库一行的营养换算：一切以每 100g 为基准线性折算（每克 = per100/100）。
 * 千卡取整、克数留一位小数——录入界面只显示这一份结果，页面不再自算。
 */
export function foodItemNutrition(food: FoodItem, grams: number): MealItem {
  const g = Number.isFinite(grams) && grams > 0 ? grams : 0;
  const round1 = (n: number): number => Math.round(n * 10) / 10;
  return {
    foodId: food.id,
    name: food.name,
    grams: round1(g),
    kcal: Math.round((food.per100.kcal * g) / 100),
    proteinG: round1((food.per100.proteinG * g) / 100),
    fatG: round1((food.per100.fatG * g) / 100),
  };
}

/** 一行合计（求和时先各自取整再加，与逐行显示的数字一致）。 */
export function sumMealItems(items: MealItem[]): { kcal: number; proteinG: number; fatG: number } {
  return items.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (it.kcal || 0),
      proteinG: acc.proteinG + (it.proteinG || 0),
      fatG: acc.fatG + (it.fatG || 0),
    }),
    { kcal: 0, proteinG: 0, fatG: 0 }
  );
}

/** 一笔账的脂肪：库选记录先看明细求和，再看已存总额；旧记录两者皆无则如实为 0。 */
function mealFatOf(meal: MealRecord): number {
  if (typeof meal.estimatedFatG === 'number') return meal.estimatedFatG;
  if (meal.items && meal.items.length > 0) return sumMealItems(meal.items).fatG;
  return 0;
}

/** 今日已入账膳食的合计（原始记录 → 合计，不存第二份）。 */
export function sumMealLogs(meals: MealRecord[]): {
  calories: number;
  protein: number;
  fat: number;
  count: number;
} {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (meal.estimatedCalories || 0),
      protein: acc.protein + (meal.estimatedProtein || 0),
      fat: acc.fat + mealFatOf(meal),
      count: acc.count + 1,
    }),
    { calories: 0, protein: 0, fat: 0, count: 0 }
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
    // 偏低与越上限是两回事,共用一码会让朱批说出「已及目标之X%」的反话
    reasons.push('nutrition_too_low');
    detail.consumedKcal = calories.consumed;
    detail.minPlausibleKcal = policy.minPlausibleKcal;
  }

  return { flag: reasons.length > 0 ? 'needs_review' : 'normal', reasons, detail };
}

export function buildNutritionSummary(
  meals: MealRecord[],
  targetCalories: number,
  targetProtein: number,
  macros?: { fatG: number; carbG: number },
  policy: NutritionPolicy = NUTRITION_POLICY
): NutritionSummary {
  const totals = sumMealLogs(meals);
  const calories = calculateNutritionProgress(totals.calories, targetCalories);
  const protein = calculateNutritionProgress(totals.protein, targetProtein);
  const fat = calculateNutritionProgress(totals.fat, macros?.fatG ?? 0);
  // 隐含碳水：千卡 − 蛋白×4 − 脂×4 反推（口径见类型注释），未建档时目标为 0 → no_target
  const carbConsumed = Math.max(
    0,
    Math.round((totals.calories - totals.protein * 4 - totals.fat * 4) / 4)
  );
  const carbs = calculateNutritionProgress(carbConsumed, macros?.carbG ?? 0);
  return {
    calories,
    protein,
    fat,
    carbs,
    mealCount: totals.count,
    quality: assessNutritionQuality(calories, totals.count, policy),
  };
}
