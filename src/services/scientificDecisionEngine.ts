/**
 * Scientific Decision Engine (V2.1 Audited)
 *
 * Deterministic, Auditable, Evidence-Grounded Decision Engine for Personal Health Coach.
 *
 * Mathematical / Pure Function Paradigm:
 *   Personal Data x -> Scientific Rules -> Deterministic Functions -> Next Action y
 *
 * LLM STATUS: OFF (No generative hallucinations, no external AI API calls for decisions).
 * Contract: Given identical context x and rule version, output y is bit-identical and fully traceable.
 */

import {
  EnergyCalibration,
  HealthContext,
  MealRecommendation,
  WorkoutRecommendation,
} from '../types/health';
import {
  ENGINE_VERSION,
  f_energy_calibration,
  f_meal,
  f_progression,
  f_protein,
  f_RMR,
  f_TDEE,
  f_training_state,
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
    energy: number;
    soreness: number;
    sleepHours: number;
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
      evaluatedAt: new Date().toISOString(),
      isDeterministic: true,
      llmStatus: 'OFF',
      contextSummary: {
        currentWeight: context.currentWeight,
        dailyCalorieTarget: context.profile.dailyCalorieTarget,
        dailyProteinTarget: context.profile.dailyProteinTarget,
        consumedCalories,
        consumedProtein,
        energy: context.todayState.energy,
        soreness: context.todayState.soreness,
        sleepHours: context.todayState.sleepHours,
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
  f_energy_calibration,
  f_meal,
  f_progression,
  f_protein,
  f_RMR,
  f_TDEE,
  f_training_state,
  f_workout,
};
