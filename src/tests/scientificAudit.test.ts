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

import { mifflinStJeor, totalDailyEnergy } from '../domain/body';
import { muscleGroupLedger, selectSession } from '../domain/trainingPlan';
import { scientificDecisionEngine } from '../services/scientificDecisionEngine';

import {
  f_diet_quality,
  f_energy_calibration,
  f_meal,
  f_per_meal_protein,
  f_progression,
  f_protein,
  f_RMR,
  f_training_state,
  f_weight_forecast,
  f_workout,
} from '../services/scientificRules';
import { HealthContext, UserProfile, WorkoutRecord } from '../types/health';

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
  const rmrMale = f_RMR({ currentWeight: 70, height: 175, age: 30, sex: 'male' });
  assert(rmrMale.predictedRMR === 1649, `Expected 1649 kcal, got ${rmrMale.predictedRMR}`);
  assert(rmrMale.status === 'evidence_derived', `Expected status evidence_derived, got ${rmrMale.status}`);

  const rmrFemale = f_RMR({ currentWeight: 60, height: 165, age: 25, sex: 'female' });
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
  const testTargets = { caloriesKcal: 1820, proteinG: 123, proteinRange: { min: 96, max: 137 }, fatG: 55, fatRange: { min: 41, max: 68 }, carbG: 277, kcalFromTdee: 2275, ratio: 0.8, floored: false, targetRateKgPerWeek: { min: 0.34, max: 0.68 }, direction: 'lose' as const };

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

  // ==========================================
  // Test 10: f_per_meal_protein 区间恒有效（min ≤ max，且落在 20–45g 带内）
  // ==========================================
  console.log('10. Testing f_per_meal_protein invariants...');
  for (const bw of [30, 40, 60, 100, 112.5, 150, 200]) {
    const { perMealRange } = f_per_meal_protein(bw);
    assert(
      perMealRange.min <= perMealRange.max,
      `min ≤ max @ ${bw}kg (got ${perMealRange.min}–${perMealRange.max})`
    );
    assert(
      perMealRange.min >= 20 && perMealRange.max <= 45,
      `20 ≤ min ≤ max ≤ 45 @ ${bw}kg (got ${perMealRange.min}–${perMealRange.max})`
    );
  }
  const dq = f_diet_quality([]);
  assert(dq.excessFreeSugar === null, '游离糖无从判 → null（不冒充「未超标」）');
  assert(dq.ruleStatus === 'engineering_heuristic', '膳食质量是启发式，不称 evidence_constrained');
  console.log('   ✓ f_per_meal_protein invariants + diet honesty passed.');

  // ==========================================
  // Test 11: f_weight_forecast 扣发与措辞（不编 0 kg/周、不用「非承诺」行话）
  // ==========================================
  console.log('11. Testing f_weight_forecast withholding honesty...');
  const withheldForecast = f_weight_forecast({
    latestWeight: 70,
    trendKgPerWeek: null,
    basedOnDays: 0,
    inputWindowDays: 30,
    quality: { flag: 'insufficient', reasons: ['insufficient_weight_days'], detail: { days: 0 } },
    modelVersion: 'test-1',
  });
  assert(withheldForecast.withheld === true, '无趋势 → 扣发');
  assert(withheldForecast.limitations[0].includes('暂不出情景区间'), '扣发时讲清为何不出数');
  assert(!withheldForecast.limitations.join(' ').includes('0 kg/周'), '扣发句不编造 0 kg/周');
  assert(!withheldForecast.limitations.join(' ').includes('非承诺'), '不以「非承诺」行话作说明');
  assert(withheldForecast.confidence === 'low', '扣发即 low');

  const openForecast = f_weight_forecast({
    latestWeight: 70,
    trendKgPerWeek: -0.35,
    basedOnDays: 21,
    inputWindowDays: 30,
    quality: { flag: 'normal', reasons: [], detail: {} },
    modelVersion: 'test-1',
  });
  assert(openForecast.withheld === false, '常度之内 → 出数');
  assert(openForecast.limitations[0].includes('-0.3 kg/周'), '未扣发时写出真实斜率（句中取一位小数,round1(−0.35)→−0.3）');
  assert(openForecast.confidence === 'medium', '21 日有效 → medium');

  const reviewForecast = f_weight_forecast({
    latestWeight: 70,
    trendKgPerWeek: -0.35,
    basedOnDays: 21,
    inputWindowDays: 30,
    quality: { flag: 'needs_review', reasons: ['weight_deviates_from_rolling_mean'], detail: {} },
    modelVersion: 'test-1',
  });
  assert(reviewForecast.withheld === true, '体征待核 → 扣发');
  assert(reviewForecast.withheldReason === 'weight_deviates_from_rolling_mean', '扣发原因可机器判读');
  console.log('   ✓ f_weight_forecast withholding honesty passed.');

  // ==========================================
  // Test 12: Mifflin 跨实现一致 + ready 文案不称「俱足」
  // ==========================================
  console.log('12. Testing cross-implementation Mifflin & ready copy...');
  const maleA = f_RMR({ currentWeight: 70, height: 175, age: 30, sex: 'male' });
  const maleB = mifflinStJeor({ weightKg: 70, heightCm: 175, ageYears: 30, sex: 'male' });
  assert(maleB !== null && maleA.predictedRMR === maleB, `male +5 跨实现一致 (f_RMR ${maleA.predictedRMR} vs domain ${maleB})`);
  const femaleA = f_RMR({ currentWeight: 70, height: 175, age: 30, sex: 'female' });
  const femaleB = mifflinStJeor({ weightKg: 70, heightCm: 175, ageYears: 30, sex: 'female' });
  assert(femaleB !== null && femaleA.predictedRMR === femaleB, `female −161 跨实现一致 (f_RMR ${femaleA.predictedRMR} vs domain ${femaleB})`);
  const otherA = f_RMR({ currentWeight: 70, height: 175, age: 30, sex: 'other' });
  const otherB = mifflinStJeor({ weightKg: 70, heightCm: 175, ageYears: 30, sex: 'other' });
  assert(otherB !== null && otherA.predictedRMR === otherB, `other −78 跨实现一致 (f_RMR ${otherA.predictedRMR} vs domain ${otherB})`);

  const readyState = f_training_state({ sleepHours: 8, energy: 4, soreness: 1, workoutCompletedToday: false });
  assert(!readyState.heuristicReason.includes('俱足') && !readyState.heuristicReason.includes('俱佳'), 'ready 文案不称「俱足/俱佳」（可为未录）');
  const readyWorkout = f_workout({ ...contextHighDeficit, now: new Date('2026-09-24T13:00:00') });
  assert(!readyWorkout.reason.includes('俱足') && !readyWorkout.reason.includes('俱佳'), '课程理由同样不称「俱足/俱佳」');
  console.log('   ✓ cross-implementation Mifflin & ready copy passed.');

  // ==========================================
  // Test 13: 训练规划器 —— 台账轮转 × 预算 × 摄入就绪门（engineering_heuristic）
  // ==========================================
  console.log('13. Testing offline session planner (ledger / budget / intake gate)...');
  const NOW = new Date('2026-09-24T13:00:00');

  // 台账：旧记录缺 movementPattern → 按动作名回查库补位；未练模式缺席不编 0
  const yesterdayWorkout: WorkoutRecord = {
    id: 'w-1', date: '2026-09-23', time: '18:00', title: '昨日课', durationMinutes: 30,
    durationSource: 'estimated',
    exercises: [
      { name: '标准俯卧撑', sets: 3, repsOrDuration: '8–10 次' },
      { name: '徒手深蹲', sets: 3, repsOrDuration: '12 次', movementPattern: 'lower body' },
    ],
    perceivedDifficulty: 'moderate', completed: true, category: 'resistance',
  };
  const ledger = muscleGroupLedger([yesterdayWorkout], NOW);
  assert(ledger.push?.weekSets === 3 && ledger.push.daysSince === 1, '旧记录按名回查补 push 台账');
  assert(ledger['lower body']?.weekSets === 3 && ledger['lower body'].daysSince === 1, '昨日下肢在册');
  assert(ledger['posterior chain'] === undefined, '未练模式缺席（不编造 0 日）');
  const skipped: WorkoutRecord = { ...yesterdayWorkout, completed: false };
  assert(muscleGroupLedger([skipped], NOW).push === undefined, '未完成的计划不入台账');

  // 恢复门：昨日练过的族过门换族；焦点轮转到缺口大且已恢复的模式
  const pick = selectSession({
    state: 'NORMAL', goal: 'maintain', budgetMinutes: 20, ledger,
    recentWorkouts: [yesterdayWorkout], intake: { kcalRatio: 1, proteinRatio: 1 }, now: NOW,
  });
  assert(pick.durationMinutes <= 18, `预算 20 分钟 → 估时 ≤18（留热身 2 分），得 ${pick.durationMinutes}`);
  assert(pick.exercises.length >= 3, '20 分钟仍凑 ≥3 动作');
  assert(pick.exercises.every((e) => !e.exerciseId?.startsWith('squat-') && !e.exerciseId?.startsWith('push-up-')), '昨日的 squat/push-up 族未过恢复门 → 换族，不重复排');
  assert(pick.focusPatterns.every((f) => f !== 'push' && f !== 'lower body'), '昨日练过（1 天 < 恢复门）的模式不占今日焦点');

  // 进阶：同族过恢复门（3 天前）→ tier+1（库无更高阶则 +1 组）
  const oldWorkout: WorkoutRecord = { ...yesterdayWorkout, id: 'w-2', date: '2026-09-21' };
  const progressed = selectSession({
    state: 'NORMAL', goal: 'maintain', budgetMinutes: 40, ledger: {},
    recentWorkouts: [oldWorkout], intake: { kcalRatio: 1, proteinRatio: 1 }, now: NOW,
  });
  assert(progressed.exercises.some((e) => e.exerciseId === 'push-up-t3'), 'push-up 族上次 t2 → 本次进阶 t3');
  assert(progressed.exercises.some((e) => e.exerciseId === 'squat-t2'), 'squat 族上次 t1 → 本次进阶 t2');
  assert(progressed.exercises.length >= 4 && progressed.durationMinutes <= 38, '40 分钟预算装得更满且不超');

  // 摄入就绪门：常规状态 + 食入未半 → 轻量，规则与 trace 如实可判
  const gate = selectSession({
    state: 'NORMAL', goal: 'maintain', budgetMinutes: 30, ledger: {},
    recentWorkouts: [], intake: { kcalRatio: 0.2, proteinRatio: 0.13 }, now: NOW,
  });
  assert(gate.state === 'LIGHT' && gate.downgraded === 'low_intake_before_session', '食入 <50% → 常规降轻量并记原因');
  assert(gate.ruleId === 'RULE_WORKOUT_PLAN_INTAKE_GATE_02' && gate.extraRuleIds.includes('RULE_WORKOUT_PLAN_SELECT_01'), '降档规则与排课规则都入 trace');
  const fed = selectSession({
    state: 'NORMAL', goal: 'maintain', budgetMinutes: 30, ledger: {},
    recentWorkouts: [], intake: { kcalRatio: 1, proteinRatio: 1 }, now: NOW,
  });
  assert(fed.state === 'NORMAL' && fed.downgraded === null, '食入充足 → 常规课不降档');
  const noTargets = selectSession({
    state: 'NORMAL', goal: 'maintain', budgetMinutes: 30, ledger: {},
    recentWorkouts: [], intake: { kcalRatio: null, proteinRatio: null }, now: NOW,
  });
  assert(noTargets.state === 'NORMAL', '无目标无记录 → 不猜摄入，不降档');

  // 减脂目标联动：预算够时收一条心肺收尾；增肌 → 分化（焦点 ≤2 部位）
  const fatLoss = selectSession({
    state: 'NORMAL', goal: 'fat loss', budgetMinutes: 30, ledger: {},
    recentWorkouts: [], intake: { kcalRatio: 1, proteinRatio: 1 }, now: NOW,
  });
  assert(fatLoss.exercises.some((e) => e.movementPattern === 'cardio'), '减脂课有心肺收尾');
  const muscleGain = selectSession({
    state: 'NORMAL', goal: 'muscle gain', budgetMinutes: 30, ledger: {},
    recentWorkouts: [], intake: { kcalRatio: 1, proteinRatio: 1 }, now: NOW,
  });
  assert(muscleGain.focusPatterns.length === 2, '增肌 → 两部位分化');
  assert(fatLoss.title !== muscleGain.title, '不同目标不同课名（组合不同）');

  // 端到端：f_workout 在食入未半的语境下降档且幂等
  const gateWorkoutA = f_workout(contextHighDeficit);
  const gateWorkoutB = f_workout(contextHighDeficit);
  assert(gateWorkoutA.sessionType === 'Light session', 'f_workout：食入未半 → 轻量课');
  assert(gateWorkoutA.trace.ruleIds.includes('RULE_WORKOUT_PLAN_INTAKE_GATE_02'), 'trace 记降档规则');
  assert(JSON.stringify(gateWorkoutA) === JSON.stringify(gateWorkoutB), '规划器端到端幂等');
  console.log('   ✓ offline session planner passed.');

  console.log('\nALL V3 SCIENTIFIC AUDIT TESTS PASSED.\n');
  return true;
}

// Execute if run directly via tsx
runScientificAuditTests();
