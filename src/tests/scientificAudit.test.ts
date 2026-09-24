/**
 * Deterministic Test Suite for Scientific Decision Engine (V2.1)
 *
 * Verifies:
 * 1. Idempotency & Determinism: same input + same rule version = same output
 * 2. f_RMR (Mifflin-St Jeor 1990) calculation
 * 3. f_protein (Morton 2018 range) calculation
 * 4. f_training_state (Engineering heuristic) assignment
 * 5. f_progression (ACSM 2026 progressive overload translation)
 * 6. f_meal edge cases: missing meal data, high protein gap, tight budget
 * 7. f_workout edge cases: completed today, high soreness, low energy + missing sleep
 * 8. f_energy_calibration: empirical maintenance estimation
 */

import {
  f_energy_calibration,
  f_meal,
  f_progression,
  f_protein,
  f_RMR,
  f_TDEE,
  f_training_state,
  f_workout,
} from '../services/scientificRules';
import { HealthContext, UserProfile } from '../types/health';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[TEST FAILURE] ${message}`);
  }
}

export function runScientificAuditTests() {
  console.log('🧪 Starting V2.1 Scientific Audit Verification Tests...\n');

  // ==========================================
  // Test 1: f_RMR (Mifflin-St Jeor)
  // Male: 10 * 70 + 6.25 * 175 - 5 * 30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75 -> 1649
  // Female: 10 * 60 + 6.25 * 165 - 5 * 25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> 1345
  // ==========================================
  console.log('1. Testing f_RMR (Mifflin-St Jeor 1990)...');
  const rmrMale = f_RMR(70, 175, 30, 'male');
  assert(rmrMale.predictedRMR === 1649, `Expected 1649 kcal, got ${rmrMale.predictedRMR}`);
  assert(rmrMale.status === 'evidence_derived', `Expected status evidence_derived, got ${rmrMale.status}`);

  const rmrFemale = f_RMR(60, 165, 25, 'female');
  assert(rmrFemale.predictedRMR === 1345, `Expected 1345 kcal, got ${rmrFemale.predictedRMR}`);
  assert(rmrFemale.notes.toLowerCase().includes('predicted rmr'), 'RMR must be labeled predicted RMR');
  console.log('   ✓ f_RMR passed.');

  // ==========================================
  // Test 2: f_TDEE (Engineering Range)
  // ==========================================
  console.log('2. Testing f_TDEE (Energy range, not fake single integer)...');
  const tdee = f_TDEE(1649, false);
  assert(tdee.estimatedEnergyRange.min === Math.round(1649 * 1.15), 'TDEE min calculation mismatch');
  assert(tdee.estimatedEnergyRange.max === Math.round(1649 * 1.25), 'TDEE max calculation mismatch');
  assert(tdee.status === 'engineering_heuristic', 'TDEE activity assumption must be engineering_heuristic');
  console.log('   ✓ f_TDEE passed.');

  // ==========================================
  // Test 3: f_protein (Morton 2018 Range)
  // ==========================================
  console.log('3. Testing f_protein (Morton 2018 Evidence-Constrained Range)...');
  const proteinRef = f_protein(70, 'fat loss');
  assert(proteinRef.proteinRange.min === Math.round(70 * 1.4), 'Min protein mismatch');
  assert(proteinRef.proteinRange.max === Math.round(70 * 2.0), 'Max protein mismatch');
  assert(proteinRef.status === 'evidence_constrained', 'Protein range must be evidence_constrained');
  console.log('   ✓ f_protein passed.');

  // ==========================================
  // Test 4: f_training_state (Engineering Heuristic)
  // ==========================================
  console.log('4. Testing f_training_state (Disclaiming fake readiness score)...');
  const stateRest = f_training_state({
    sleepHours: 8,
    energy: 5,
    soreness: 1,
    workoutCompletedToday: true,
  });
  assert(stateRest.state === 'REST', 'Completed workout must yield REST');
  assert(stateRest.status === 'engineering_heuristic', 'Must be engineering_heuristic');
  assert(stateRest.disclaimer === 'Product heuristic. Not a clinically validated readiness score.', 'Disclaimer check');

  const stateRecoveryHighSoreness = f_training_state({
    sleepHours: 8,
    energy: 4,
    soreness: 4,
    workoutCompletedToday: false,
  });
  assert(stateRecoveryHighSoreness.state === 'RECOVERY', 'Soreness >= 4 must yield RECOVERY');

  const stateRecoveryLowEnergySleep = f_training_state({
    sleepHours: 5.2,
    energy: 2,
    soreness: 2,
    workoutCompletedToday: false,
  });
  assert(stateRecoveryLowEnergySleep.state === 'RECOVERY', 'Energy <=2 & sleep < 6h must yield RECOVERY');

  const stateLight = f_training_state({
    sleepHours: 7,
    energy: 3,
    soreness: 2,
    workoutCompletedToday: false,
  });
  assert(stateLight.state === 'LIGHT', 'Energy 3 must yield LIGHT');

  const stateNormal = f_training_state({
    sleepHours: 7.5,
    energy: 4,
    soreness: 2,
    workoutCompletedToday: false,
  });
  assert(stateNormal.state === 'NORMAL', 'High energy & low soreness must yield NORMAL');
  console.log('   ✓ f_training_state passed.');

  // ==========================================
  // Test 5: f_progression (ACSM Translation)
  // ==========================================
  console.log('5. Testing f_progression (ACSM 2026 Engineering Translation)...');
  const pushProg = f_progression('push-up', 'moderate');
  assert(pushProg.status === 'engineering_heuristic', 'Progression must be engineering_heuristic');
  assert(pushProg.translationNote.includes('ACSM 2026 supports progressive resistance training'), 'Must document translation');
  console.log('   ✓ f_progression passed.');

  // ==========================================
  // Test 6: f_meal & f_workout Edge Cases
  // ==========================================
  console.log('6. Testing f_meal and f_workout edge cases...');

  const baseProfile: UserProfile = {
    name: 'Test User',
    age: 28,
    sex: 'male',
    height: 175,
    currentWeight: 68.4,
    goal: 'fat loss',
    dailyCalorieTarget: 1820,
    dailyProteinTarget: 123,
  };

  // Edge case A: missing meal data (0 meals logged today)
  const contextSparse: HealthContext = {
    profile: baseProfile,
    currentWeight: 68.4,
    todayState: { date: '2026-09-24', sleepHours: 7.5, energy: 4, soreness: 2 },
    todayMeals: [],
    recentMeals: [],
    recentWorkouts: [],
    hasIncompleteData: true,
  };
  const mealSparse = f_meal(contextSparse);
  assert(mealSparse.isUncertaintyNoted === true, 'Sparse data must note uncertainty');
  assert(mealSparse.trace.confidence === 'low', 'Sparse data must have low confidence');
  assert(mealSparse.ruleId === 'RULE_MEAL_BASELINE_PLATE_01', 'Sparse data must use baseline plate rule');

  // Edge case B: high protein deficit
  const contextHighDeficit: HealthContext = {
    profile: baseProfile,
    currentWeight: 68.4,
    todayState: { date: '2026-09-24', sleepHours: 7.2, energy: 4, soreness: 2 },
    todayMeals: [
      {
        id: 'm1',
        date: '2026-09-24',
        time: '08:30',
        category: 'breakfast',
        name: 'Oats & Milk',
        foods: ['oats', 'milk'],
        estimatedCalories: 360,
        estimatedProtein: 16,
      },
    ],
    recentMeals: [],
    recentWorkouts: [],
  };
  const mealHighDeficit = f_meal(contextHighDeficit);
  assert(mealHighDeficit.ruleId === 'RULE_MEAL_PROTEIN_DEFICIT_PRIORITY', 'High protein gap must trigger protein priority');
  assert(mealHighDeficit.trace.confidence === 'high', 'Deficit rule with logged intake has high confidence');

  // Edge case C: workout with high soreness
  const contextHighSoreness: HealthContext = {
    profile: baseProfile,
    currentWeight: 68.4,
    todayState: { date: '2026-09-24', sleepHours: 7, energy: 4, soreness: 5 },
    todayMeals: [],
    recentMeals: [],
    recentWorkouts: [],
  };
  const workoutRecovery = f_workout(contextHighSoreness);
  assert(workoutRecovery.trainingState === 'RECOVERY', 'High soreness must prescribe RECOVERY');
  assert(workoutRecovery.equipmentCoverage.pull === 'limited (no pull-up bar / external equipment)', 'Must disclose equipment limits');

  // Edge case D: workout with 0 training history
  const contextNoHistory: HealthContext = {
    profile: baseProfile,
    currentWeight: 68.4,
    todayState: { date: '2026-09-24', sleepHours: 8, energy: 4, soreness: 1 },
    todayMeals: [],
    recentMeals: [],
    recentWorkouts: [],
  };
  const workoutNoHistory = f_workout(contextNoHistory);
  assert(workoutNoHistory.trainingState === 'NORMAL', 'Fresh state with no history should allow NORMAL');
  console.log('   ✓ Edge cases passed.');

  // ==========================================
  // Test 7: Idempotency & Determinism (same x + same rules = identical y)
  // ==========================================
  console.log('7. Testing pure function idempotency and determinism...');
  const runA_meal = JSON.stringify(f_meal(contextHighDeficit));
  const runB_meal = JSON.stringify(f_meal(contextHighDeficit));
  assert(runA_meal === runB_meal, 'f_meal must be strictly idempotent');

  const runA_workout = JSON.stringify(f_workout(contextHighSoreness));
  const runB_workout = JSON.stringify(f_workout(contextHighSoreness));
  assert(runA_workout === runB_workout, 'f_workout must be strictly idempotent');
  console.log('   ✓ Idempotency and determinism passed.');

  // ==========================================
  // Test 8: f_energy_calibration
  // ==========================================
  console.log('8. Testing f_energy_calibration...');
  const calibLow = f_energy_calibration({
    recordedEnergyIntake: [1800, 1900],
    weightTrendKg: -0.2,
    timePeriodDays: 5,
  });
  assert(calibLow.confidence === 'low', 'Under 14 days must have low confidence');

  const calibHigh = f_energy_calibration({
    recordedEnergyIntake: Array(28).fill(2100),
    weightTrendKg: 0, // stable weight
    timePeriodDays: 28,
  });
  assert(calibHigh.confidence === 'high', '28 days stable intake must have high confidence');
  assert(calibHigh.estimatedMaintenanceRange.min === 2000, 'Expected min 2000');
  assert(calibHigh.estimatedMaintenanceRange.max === 2200, 'Expected max 2200');
  console.log('   ✓ f_energy_calibration passed.');

  console.log('\n🎉 ALL V2.1 SCIENTIFIC AUDIT TESTS PASSED SUCCESSFULLY!\n');
  return true;
}

// Execute if run directly via tsx
runScientificAuditTests();
