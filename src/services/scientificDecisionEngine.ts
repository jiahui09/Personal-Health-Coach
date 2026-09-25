/**
 * Scientific Decision Engine (V3 Living Journal Audited)
 *
 * Deterministic, Auditable, Evidence-Grounded Decision Engine for Personal Health Coach.
 *
 * Mathematical / Pure Function Paradigm:
 *   Personal Data x -> Scientific Rules -> Deterministic Functions -> Next Action y
 *
 * LLM STATUS: OFF (No generative hallucinations, zero external AI API calls for health advice).
 * Contract: Given identical context x and rule version, output y is bit-identical and fully traceable.
 */

import {
  DietQualityAssessment,
  EnergyCalibration,
  HealthContext,
  MealRecommendation,
  WeightForecast,
  WorkoutRecommendation,
} from '../types/health';
import type { DataQuality } from '../domain/types';
import { resolveSleepMinutes } from '../domain/sleep';
import {
  ENGINE_VERSION,
  f_diet_quality,
  f_energy_calibration,
  f_energy_prior,
  f_meal,
  f_meal_candidates,
  f_progression,
  f_protein,
  f_RMR,
  f_TDEE,
  f_training_state,
  f_training_volume,
  f_weight_forecast,
  f_workout,
} from './scientificRules';

export interface DecisionEvaluationResult {
  version: string;
  evaluatedAt: string;
  isDeterministic: true;
  llmStatus: 'OFF';
  contextSummary: {
    currentWeight: number;
    dailyCalorieTarget: number;
    dailyProteinTarget: number;
    consumedCalories: number;
    consumedProtein: number;
    energy: number | null;
    soreness: number | null;
    /** 由就寝/起身时刻推得的小时数；今日未录为 null。 */
    sleepHours: number | null;
  };
  mealRecommendation: MealRecommendation;
  workoutRecommendation: WorkoutRecommendation;
}

export class ScientificDecisionEngine {
  readonly version = ENGINE_VERSION;
  readonly llmStatus = 'OFF' as const;

  /**
   * Deterministically compute Next Meal recommendation: y_meal = f_meal(x)
   */
  recommendNextMeal(context: HealthContext): MealRecommendation {
    return f_meal(context);
  }

  /**
   * Deterministically compute Next Workout recommendation: y_workout = f_workout(x)
   */
  recommendNextWorkout(context: HealthContext): WorkoutRecommendation {
    return f_workout(context);
  }

  /**
   * 4w / 8w / 12w 情景区间（据 domain 派生的趋势；数据存疑或不足时不出数）。
   */
  computeWeightForecast(input: {
    latestWeight: number | null;
    trendKgPerWeek: number | null;
    basedOnDays: number;
    inputWindowDays: number;
    quality: DataQuality;
  }): WeightForecast {
    return f_weight_forecast({ ...input, modelVersion: this.version });
  }

  /**
   * Assess daily diet quality against WHO and Dietary Guidelines criteria
   */
  assessDietQuality(context: HealthContext): DietQualityAssessment {
    return f_diet_quality(context.todayMeals, context.recentMeals);
  }

  /**
   * Empirical long-term energy calibration
   */
  calibrateEnergy(history: {
    recordedEnergyIntake: number[];
    weightTrendKg: number;
    timePeriodDays: number;
  }): EnergyCalibration {
    return f_energy_calibration(history);
  }

  /**
   * Perform a unified, auditable evaluation pass for both core decisions.
   */
  evaluateFullDecision(context: HealthContext): DecisionEvaluationResult {
    const meal = this.recommendNextMeal(context);
    const workout = this.recommendNextWorkout(context);

    const consumedCalories = context.todayMeals.reduce((acc, m) => acc + m.estimatedCalories, 0);
    const consumedProtein = context.todayMeals.reduce((acc, m) => acc + m.estimatedProtein, 0);

    return {
      version: this.version,
      evaluatedAt: context.now.toISOString(),
      isDeterministic: true,
      llmStatus: 'OFF',
      contextSummary: {
        currentWeight: context.currentWeight,
        dailyCalorieTarget: context.profile.dailyCalorieTarget,
        dailyProteinTarget: context.profile.dailyProteinTarget,
        consumedCalories,
        consumedProtein,
        energy: context.todayState.energy ?? null,
        soreness: context.todayState.soreness ?? null,
        sleepHours:
          context.todayState.sleep === undefined
            ? null
            : Math.round(
                ((resolveSleepMinutes(context.todayState.sleep)?.minutes ?? 0) / 60) * 100
              ) / 100,
      },
      mealRecommendation: meal,
      workoutRecommendation: workout,
    };
  }

  /**
   * Verifies the deterministic idempotency contract: f(x) === f(x)
   */
  verifyDeterminism(context: HealthContext): boolean {
    const runA = JSON.stringify(this.evaluateFullDecision(context));
    const runB = JSON.stringify(this.evaluateFullDecision(context));
    return runA === runB;
  }
}

// Singleton export
export const scientificDecisionEngine = new ScientificDecisionEngine();

// Backward compatibility alias
export const recommendationEngine = scientificDecisionEngine;

// Export underlying functions for testing and verification
export {
  f_diet_quality,
  f_energy_calibration,
  f_energy_prior,
  f_meal,
  f_meal_candidates,
  f_progression,
  f_protein,
  f_RMR,
  f_TDEE,
  f_training_state,
  f_training_volume,
  f_weight_forecast,
  f_workout,
};
