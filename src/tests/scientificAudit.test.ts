/**
 * Deterministic Test Suite for the Scientific Decision Engine (V3)
 *
 * Verifies:
 * 1. Idempotency & Determinism: same input + same rule version = same output
 * 2. f_RMR (Mifflin-St Jeor 1990) calculation
 * 3. f_protein (Morton 2018 range) calculation
 * 4. f_training_state (Engineering heuristic) assignment
 * 5. f_progression (ACSM 2026 progressive overload translation)
 * 6. f_meal edge cases: sparse data, high protein gap, tight budget
 * 7. f_workout edge cases: completed today, high soreness, low energy + missing sleep
 * 8. f_energy_calibration: empirical maintenance estimation
 * 9. Clock injection: the engine reads time only from `context.now`
 */

import { totalDailyEnergy } from '../domain/body';
import { scientificDecisionEngine } from '../services/scientificDecisionEngine';

import {
  f_energy_calibration,
  f_meal,
  f_progression,
  f_protein,
  f_RMR,
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
  console.log('Starting V3 Scientific Audit Verification Tests...\n');

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
  // Test 2: 总消耗 = RMR × PAL（domain/body：真实活动系数,不再是写死的久坐区间）
  console.log('2. Testing totalDailyEnergy (RMR × PAL by activity level)...');
  const tdeeSedentary = totalDailyEnergy(1649, 'sedentary');
  const tdeeLight = totalDailyEnergy(1649, 'light');
  assert(tdeeSedentary !== null && tdeeSedentary.kcal === Math.round(1649 * 1.2), 'sedentary PAL 1.2');
  assert(tdeeLight !== null && tdeeLight.kcal === Math.round(1649 * 1.375), 'light PAL 1.375');
  console.log('   ✓ totalDailyEnergy passed.');

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
    sex: 'male',
    birthYear: 1998,
    heightCm: 175,
    activityLevel: 'light',
    waistCm: 84,
    goal: 'fat loss',
    goalSource: 'user',
  };
  const testTargets = { caloriesKcal: 1820, proteinG: 123, proteinRange: { min: 96, max: 137 }, kcalFromTdee: 2275, ratio: 0.8, floored: false, targetRateKgPerWeek: { min: 0.34, max: 0.68 }, direction: 'lose' as const };

  // Edge case A: missing meal data (0 meals logged today)
  const contextSparse: HealthContext = {
    now: new Date('2026-09-24T13:00:00'),
    profile: baseProfile,
    currentWeight: 68.4,
    targets: testTargets,
    todayState: { date: '2026-09-24', sleep: { kind: 'duration', minutes: 450 }, energy: 4, soreness: 2 },
    todayMeals: [],
    recentMeals: [],
    recentWorkouts: [],
    hasIncompleteData: true,
  };
  const mealSparse = f_meal(contextSparse);
  assert(mealSparse.isUncertaintyNoted === true, 'Sparse data must note uncertainty');
  assert(mealSparse.trace.confidence === 'low', 'Sparse data must have low confidence');
  assert(
    mealSparse.ruleId === 'RULE_MEAL_CANDIDATE_OPTIMIZATION_03',
    'V3 ranks meal candidates under the documented optimization rule'
  );
  assert(
    mealSparse.energyRange !== undefined && mealSparse.energyRange.min < mealSparse.energyRange.max,
    'Meal advice must expose an energy range, never a single integer'
  );

  // Edge case B: high protein deficit
  const contextHighDeficit: HealthContext = {
    now: new Date('2026-09-24T13:00:00'),
    profile: baseProfile,
    currentWeight: 68.4,
    targets: testTargets,
    todayState: { date: '2026-09-24', sleep: { kind: 'duration', minutes: 432 }, energy: 4, soreness: 2 },
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
        source: 'manual',
        confirmed: true,
      },
    ],
    recentMeals: [],
    recentWorkouts: [],
  };
  const mealHighDeficit = f_meal(contextHighDeficit);
  assert(
    mealHighDeficit.ruleId === 'RULE_MEAL_CANDIDATE_OPTIMIZATION_03',
    'Logged intake must route through the candidate ranking rule'
  );
  assert(mealHighDeficit.trace.confidence === 'high', 'Logged intake yields high confidence');
  assert(
    mealHighDeficit.trace.inputSnapshot.consumedProtein === 16,
    'Trace must snapshot the protein already consumed'
  );

  // Edge case C: workout with high soreness
  const contextHighSoreness: HealthContext = {
    now: new Date('2026-09-24T13:00:00'),
    profile: baseProfile,
    currentWeight: 68.4,
    targets: testTargets,
    todayState: { date: '2026-09-24', sleep: { kind: 'duration', minutes: 420 }, energy: 4, soreness: 5 },
    todayMeals: [],
    recentMeals: [],
    recentWorkouts: [],
  };
  const workoutRecovery = f_workout(contextHighSoreness);
  assert(workoutRecovery.trainingState === 'RECOVERY', 'High soreness must prescribe RECOVERY');
  assert(workoutRecovery.equipmentCoverage.pull === 'limited (no pull-up bar / external equipment)', 'Must disclose equipment limits');

  // Edge case D: workout with 0 training history
  const contextNoHistory: HealthContext = {
    now: new Date('2026-09-24T13:00:00'),
    profile: baseProfile,
    currentWeight: 68.4,
    targets: testTargets,
    todayState: { date: '2026-09-24', sleep: { kind: 'duration', minutes: 480 }, energy: 4, soreness: 1 },
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

  // ==========================================
  // Test 9: Clock injection (y is a pure function of x, wall clock excluded)
  // ==========================================
  console.log('9. Testing clock injection (context.now is the only clock)...');
  const clockCtx: HealthContext = { ...contextHighDeficit, now: new Date('2026-09-24T13:00:00') };
  const evalA = scientificDecisionEngine.evaluateFullDecision(clockCtx);
  const evalB = scientificDecisionEngine.evaluateFullDecision(clockCtx);

  assert(
    evalA.evaluatedAt === clockCtx.now.toISOString(),
    'evaluatedAt must come from context.now, not the wall clock'
  );
  assert(JSON.stringify(evalA) === JSON.stringify(evalB), 'Same x must yield bit-identical y');
  assert(
    scientificDecisionEngine.verifyDeterminism(clockCtx) === true,
    'verifyDeterminism must hold without wall-clock drift'
  );
  console.log('   ✓ Clock injection passed.');

  console.log('\nALL V3 SCIENTIFIC AUDIT TESTS PASSED.\n');
  return true;
}

// Execute if run directly via tsx
runScientificAuditTests();
