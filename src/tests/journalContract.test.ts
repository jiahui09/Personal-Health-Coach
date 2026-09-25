/**
 * Journal data-contract regression tests (behavior lock)
 *
 * 锁定「页面只读 TodayData 的结构化结果」这一契约：原始记录切片、派生指标、
 * 决策结果三层都必须是 domain 算好的值，展示层不再自行计算。
 *
 * 固定 clock：2026-09-25（周五）21:30 —— 本周一 = 2026-09-21。
 *
 * 1. f_meal_slot boundaries (meal slot rule shared with the UI caption)
 * 2. TodayData contract: tasks / weight / nutrition / sleep / training / forecast
 * 3. storage fallback: corrupt localStorage key falls back to seed data
 */

import { f_meal_slot } from '../services/scientificRules';
import { MockHealthRepository } from '../services/mockHealthRepository';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

// --- 1. meal slot boundaries -------------------------------------------------
assert(f_meal_slot(0) === 'breakfast', 'hour 0 is breakfast');
assert(f_meal_slot(9) === 'breakfast', 'hour 9 is breakfast');
assert(f_meal_slot(10) === 'lunch', 'hour 10 is lunch');
assert(f_meal_slot(14) === 'lunch', 'hour 14 is lunch');
assert(f_meal_slot(15) === 'dinner', 'hour 15 is dinner');
assert(f_meal_slot(23) === 'dinner', 'hour 23 is dinner');

// --- 2. TodayData contract (fixed clock → deterministic seed windows) --------
const CLOCK = (): Date => new Date(2026, 8, 25, 21, 30);
const repository = new MockHealthRepository({ clock: CLOCK });

// --- 2a. 未建档：只出「未建档」，不拿演示数据冒充你 -------------------------
const fresh = await repository.getToday();
assert(fresh.profileStatus === 'incomplete', 'fresh demo profile is incomplete (未建档)');
assert(
  ['sex', 'birthYear', 'heightCm', 'activityLevel', 'goal'].every((f) =>
    fresh.missingProfileFields.includes(f)
  ),
  'missing profile fields are listed'
);
assert(fresh.targets === null, 'no targets before 建档');
assert(fresh.body.bmi === null && fresh.body.rmrKcal === null && fresh.body.tdeeKcal === null, 'no body numbers before 建档');
assert(fresh.nextMeal.unavailable === true, 'no meal suggestion before 建档（不编造菜名）');
assert(fresh.nutrition.calories.target === 0, 'no fake calorie target before 建档');

// --- 2b. 建档（改档）：派生 BMI / RMR / TDEE / 目标 ------------------------
const stored = await repository.updateProfile({
  sex: 'male',
  birthYear: 1998,
  heightCm: 175,
  activityLevel: 'light',
  waistCm: 84,
  goal: 'fat loss',
  goalSource: 'user',
});
assert(stored.heightCm === 175, 'profile write lands');
const today = await repository.getToday();

assert(today.date === '2026-09-25', `date is the injected day (got ${today.date})`);
assert(today.mealSlot === 'dinner', 'hour 21 → dinner slot');
assert(['朝安。', '昼安。', '夜安。'].includes(today.timeGreeting), 'timeGreeting in {朝安,昼安,夜安}');
assert(today.displayDate.includes('年'), 'displayDate uses the Chinese calendar line');

// 任务：4 事 1 成（seed），完成率由 domain 算出
assert(today.todos.length === 4, 'today slice carries the 4 seeded tasks');
assert(today.tasks.total === 4 && today.tasks.completed === 1, '1/4 comes from status, not from durations');
assert(approx(today.tasks.ratio, 0.25), 'task ratio matches completed/total');

// 体重：条数与有效日数分开，端点变化与斜率不同名
assert(today.weight.latest === 68.4, `latest seed weight is 68.4 (got ${today.weight.latest})`);
assert(today.weight.readingCount === 30 && today.weight.daysWithRecords === 30, '30 records over 30 days');
assert(today.weight.endpointChangeKg === -0.9, `endpoint change 69.3→68.4 = -0.9 (got ${today.weight.endpointChangeKg})`);
assert(today.weight.rollingMean7d !== null && today.weight.rollingMean7dDays === 7, '7-day mean over 7 recorded days');
assert(today.weight.trendKgPerWeek !== null && today.weight.trendDays === 30, 'trend uses the 30-day window');
assert(today.weight.quality.flag === 'normal', 'seed data is within normal range');
assert(today.weightSeries.length === 30, 'chart series = 30 daily representatives');
for (let i = 1; i < today.weightSeries.length; i++) {
  assert(today.weightSeries[i - 1].date < today.weightSeries[i].date, 'weightSeries dates ascend');
}

// 体征档：身高/性别/出生年/活动水平/腰围齐备，派生 BMI/RMR/TDEE
assert(today.profileStatus === 'complete' && today.missingProfileFields.length === 0, 'seed profile is complete');
assert(today.body.bmi === 22.3 && today.body.bmiCategory === 'normal', `BMI 22.3 normal (got ${today.body.bmi}/${today.body.bmiCategory})`);
assert(today.body.waist !== null && today.body.waist.elevated === false, 'waist 84cm under the 90cm limit');
// Mifflin-St Jeor: 10×68.4 + 6.25×175 − 5×28 + 5 = 1643 kcal
assert(today.body.rmrKcal === 1643, `RMR 1643 kcal (got ${today.body.rmrKcal})`);
assert(today.body.pal === 1.375 && today.body.tdeeKcal === Math.round(1643 * 1.375), 'TDEE = RMR × PAL(light)');

// 目标由 TDEE 与目标方向派生（不再是档案里的常量）
assert(today.targets !== null, 'targets are derived for a complete profile');
const t = today.targets!;
assert(t.caloriesKcal === Math.round(today.body.tdeeKcal! * 0.8), 'lose target = TDEE × 0.8');
assert(t.proteinG === Math.round((t.proteinRange.min + t.proteinRange.max) / 2), 'protein target = midpoint of 1.4–2.0 g/kg');
assert(t.proteinRange.min === Math.round(68.4 * 1.4) && t.proteinRange.max === Math.round(68.4 * 2.0), 'protein range from body weight');

// 建议与用户目标相悖时如实标出（BMI 正常却选了减脂）
assert(today.goalAdvice.direction === 'maintain', 'BMI 22.3 + 腰围未越线 → 建议维持');
assert(today.goalAdvice.conflicting === false, '建议维持与「减脂」并不相反 → 不报警,仅并列显示');
assert(today.trainingTarget.resistanceDaysPerWeek >= 2, '抗阻周目标不低于 WHO 基线 2 日');

// 营养：实测入账 vs 派生目标，余量与超额同源
assert(today.nutrition.calories.consumed === 1020, 'seed intake 1020 kcal');
assert(today.nutrition.calories.target === t.caloriesKcal, 'nutrition target reads the derived target');
assert(today.nutrition.protein.target === t.proteinG, 'protein target reads the derived target');
assert(approx(today.nutrition.calories.remaining, t.caloriesKcal - 1020), 'remaining calories = target - consumed');
assert(today.nutrition.calories.status === 'under' && today.nutrition.protein.status === 'under', 'under target');
assert(approx(today.nutrition.calories.ratio, 1020 / t.caloriesKcal), 'ratio === consumed/target (single source)');
assert(today.nutrition.mealCount === 2, 'meal count = confirmed logs today');
assert(today.nutrition.quality.flag === 'normal', 'seed intake is plausible');

// 睡眠：由时刻推得，近七日均如实报告夜数
assert(today.sleep.today?.minutes === 440, '00:55→08:15 = 440 min (7h20m)');
assert(today.sleep.today?.source === 'interval', 'sleep came from the clock interval');
assert(today.sleep.nights === 1 && today.sleep.windowDays === 7, 'only 1 night recorded → 1/7 reported');
assert(today.sleep.avgMinutes === 440, 'average is over recorded nights only');
assert(today.sleep.meetsReference === true, '440 min meets the 7h reference');

// 训练：决策来自纯函数；抗阻只数本周抗阻
assert(today.training.decision.mode === 'normal', 'seed (energy 4 / soreness 2 / 7h20m) → normal session');
assert(today.training.resistance.target === today.trainingTarget.resistanceDaysPerWeek, '抗阻目标来自体征档处方');
assert(today.training.resistance.completed <= today.training.resistance.totalWorkoutsThisWeek, 'resistance ⊆ all workouts');
assert(today.training.todaySession === null, 'no workout recorded today in seed');

// 决策与推荐
assert(today.nextMeal.reason.length > 0, 'nextMeal carries a reason sentence');
assert(today.nextWorkout.recoveryGuidance.length > 0, 'nextWorkout carries recovery guidance');
assert(today.nextWorkout.durationSource === 'estimated', 'recommended duration is explicitly estimated');

// 情景外推：写明出处与依据日数，且与实测分离
assert(today.forecast.modelVersion.length > 0, 'forecast carries its model version');
assert(today.forecast.method === 'scenario_trend_projection', 'forecast is labelled as a scenario projection');
assert(today.forecast.basedOnDays === 30 && today.forecast.inputWindowDays === 30, 'forecast reports its window');
if (!today.forecast.withheld) {
  for (const period of [today.forecast.fourWeeks, today.forecast.eightWeeks, today.forecast.twelveWeeks]) {
    assert(period.range.min > 0 && period.range.min <= period.range.max, 'forecast intervals are ordered');
  }
}
assert(today.forecast.assumptions.length > 0, 'forecast carries assumptions');
assert(today.forecast.limitations.length > 0, 'forecast carries limitations');

// 数据质量的汇总
assert(Array.isArray(today.dataQuality.flags) && today.dataQuality.reviewCount >= 0, 'quality flags present');

// 同一 clock 两次调用必须完全一致（可复算）
const again = await repository.getToday();
assert(JSON.stringify(again) === JSON.stringify(today), 'getToday is deterministic for a fixed clock');

// --- 3. storage fallback: corrupt key -> seed data, no throw ----------------
const storage = (globalThis as { localStorage?: Storage }).localStorage;
if (storage) {
  storage.setItem('phc_todos_v3', '{corrupt json');
  const fallbackRepository = new MockHealthRepository({ clock: CLOCK });
  const todos = await fallbackRepository.getTodos();
  assert(todos.length === 4, 'corrupt todos key falls back to seed data');
} else {
  // No storage at all (Node without Web Storage): construction must still work
  // because getStorage treats the missing store as the same fail-safe boundary.
  const todos = await repository.getTodos();
  assert(Array.isArray(todos), 'todos readable without a storage backend');
}

console.log('ALL JOURNAL CONTRACT TESTS PASSED.');
