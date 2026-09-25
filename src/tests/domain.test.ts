/**
 * Domain 纯函数回归测试（behavior lock）
 *
 * 固定 clock：2026-09-25（星期五）21:30 —— 本周一为 2026-09-21。
 * 覆盖：任务完成率、营养余量/超额、睡眠时长与均值、体重端点/斜率/质量、
 *       时间窗口（本周 vs 近七日）、训练决策与抗阻进度。
 */

import {
  SLEEP_POLICY,
  TRAINING_POLICY,
  WEIGHT_POLICY,
  calculateNutritionProgress,
  calculateTaskProgress,
  decideWorkoutMode,
  formatNightDuration,
  intervalMinutes,
  makeDayContext,
  regressionSlopePerDay,
  resistanceProgress,
  resolveSleepMinutes,
  sleepSummary,
  toDayKey,
  validateWeightMeasurement,
  weightSummary,
} from '../domain';
import { buildNutritionSummary } from '../domain/nutrition';
import type { DailyState, MealRecord, TodoItem, WeightRecord, WorkoutRecord } from '../types/health';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const approx = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) < eps;

const NOW = new Date(2026, 8, 25, 21, 30); // 2026-09-25 周五
const ctx = makeDayContext(NOW);

let checks = 0;
const ok = (message: string): void => {
  checks += 1;
  console.log(`   ✓ ${message}`);
};

// ---------------- 0. 时间窗口 ----------------
assert(ctx.todayKey === '2026-09-25', `todayKey ${ctx.todayKey}`);
assert(ctx.weekStartKey === '2026-09-21', `weekStartKey ${ctx.weekStartKey}`);
assert(ctx.weekEndKey === '2026-09-27', `weekEndKey ${ctx.weekEndKey}`);
assert(ctx.last7Keys[0] === '2026-09-19' && ctx.last7Keys[6] === '2026-09-25', 'last7 bounds');
assert(ctx.last30Keys[0] === '2026-08-27' && ctx.last30Keys.length === 30, 'last30 bounds');
assert(toDayKey(NOW) === '2026-09-25', 'toDayKey is local-day based');

// 周日属上一自然周；周一 00:00 起算新的一周 —— 二者在「本周 / 近七日」下归属不同
const sundayWorkout = { date: '2026-09-20', completed: true, category: 'resistance' } as WorkoutRecord;
const mondayWorkout = { date: '2026-09-21', completed: true, category: 'resistance' } as WorkoutRecord;
const windowProbe = resistanceProgress([sundayWorkout, mondayWorkout], ctx);
assert(windowProbe.completed === 1, '本周只认周一之后：周日的抗阻不计入本周');
assert(ctx.last7Keys.includes('2026-09-20'), '周日仍在近七日窗口内（与本周不同）');
ok('时间窗口：本周（周一起）与滚动近七日互不混用');

// ---------------- 1. 任务完成率 ----------------
const todo = (status: TodoItem['status'], id: string): TodoItem => ({
  id,
  title: id,
  date: ctx.todayKey,
  status,
});

const p0 = calculateTaskProgress([todo('todo', 'a'), todo('todo', 'b'), todo('todo', 'c'), todo('todo', 'd')]);
assert(p0.total === 4 && p0.completed === 0 && p0.ratio === 0, '4 事 0 成 → 0/4');
const p2 = calculateTaskProgress([todo('done', 'a'), todo('done', 'b'), todo('todo', 'c'), todo('todo', 'd')]);
assert(p2.completed === 2 && p2.total === 4, '4 事 2 成 → 2/4');
const p4 = calculateTaskProgress([todo('done', 'a'), todo('done', 'b'), todo('done', 'c'), todo('done', 'd')]);
assert(p4.completed === 4 && p4.ratio === 1, '4 事 4 成 → 4/4');
const pSkip = calculateTaskProgress([todo('done', 'a'), todo('skipped', 'b')]);
assert(pSkip.total === 1 && pSkip.skipped === 1 && pSkip.ratio === 1, '略过者不计入分母');
ok('任务完成率：只由 status 决定，略过项不计入分母');

// ---------------- 2. 营养：余量 / 达标 / 超额同源 ----------------
const n90 = calculateNutritionProgress(90, 110);
assert(approx(n90.remaining, 20) && n90.status === 'under', '90/110 → 尚余 20');
const n110 = calculateNutritionProgress(110, 110);
assert(n110.remaining === 0 && n110.over === 0 && n110.status === 'met', '110/110 → 达标');
const n120 = calculateNutritionProgress(120, 110);
assert(approx(n120.over, 10) && n120.status === 'over', '120/110 → 已超 10');
assert(approx(calculateNutritionProgress(89.9, 110).remaining, 20.1), '89.9/110 → 尚余 20.1');
assert(approx(n120.ratio, 120 / 110), '比例与分子分母同源');
ok('营养：比例、余量、超额由同一函数产出');

// ---------------- 3. 睡眠：时刻差为唯一来源 ----------------
assert(intervalMinutes('00:55', '08:15') === 440, '00:55 → 08:15 = 440 分（7h20m）');
assert(intervalMinutes('23:30', '07:00') === 450, '跨午夜 23:30 → 07:00 = 450 分');
assert(formatNightDuration(440) === '7h20m', 'formatNightDuration(440) = 7h20m');
assert(resolveSleepMinutes({ kind: 'duration', minutes: 438 })?.source === 'duration', '手录眠时来源标注');
assert(resolveSleepMinutes({ kind: 'duration', minutes: 438 })?.minutes === 438, '手录眠时不与时刻混算');

const oneNight: DailyState[] = [
  { date: '2026-09-25', sleep: { kind: 'interval', sleepStart: '00:55', wakeTime: '08:15' }, energy: 4, soreness: 2 },
];
const sleep1 = sleepSummary(oneNight, ctx);
assert(sleep1.nights === 1 && sleep1.windowDays === 7, '只录一夜 → 报告 1/7 夜（不伪造七日平均）');
assert(sleep1.avgMinutes === 440, '均值只按有记录的夜数平均');
assert(sleep1.meetsReference === true, '440 分 ≥ 七时之基');

const sleepNone = sleepSummary([{ date: '2026-09-25', energy: 4 }], ctx);
assert(sleepNone.nights === 0 && sleepNone.avgMinutes === null, '未录眠时 → 均值为 null');
assert(sleepNone.quality.flag === 'insufficient', '未录眠时 → 数据不足');
assert(SLEEP_POLICY.targetMinutes === 420, '参考目标来自 policy');
ok('睡眠：时长由时刻推得，均值按有效夜数报告');

// ---------------- 4. 体重：端点 ≠ 斜率，条数 ≠ 日数 ----------------
const day = (offset: number, weight: number, time?: string): WeightRecord => ({
  id: `w${offset}-${time ?? ''}`,
  date: toDayKey(new Date(2026, 8, 25 + offset, 12, 0)),
  weight,
  source: 'manual',
  time,
});

// 同日两条 → 取最新一条为代表值
const sameDay = weightSummary([day(-1, 69.0, '07:00'), day(-1, 68.2, '20:00')], ctx);
assert(sameDay.daysWithRecords === 1 && sameDay.readingCount === 2, '同日两条：日数 1、条数 2');
assert(sameDay.latest === 68.2, '当日代表值取最新一次测量');

// 端点变化：首末之差
const endpoints = weightSummary([day(-29, 69.3), day(-10, 68.8), day(0, 57)], ctx);
assert(endpoints.endpointChangeKg === -12.3, `端点变化应为 -12.3，得 ${endpoints.endpointChangeKg}`);
assert(endpoints.trendKgPerWeek !== null && endpoints.trendKgPerWeek < -0.5, '斜率另算（含异常点时更陡）');
assert(Math.abs(endpoints.trendKgPerWeek! - endpoints.endpointChangeKg!) > 1, '端点变化与斜率是两个指标，不得互称');
ok('体重：端点变化（首末差）与回归斜率分开输出');

// 线性序列的斜率可验算：每日 +0.1 kg → 0.7 kg/周
const slopeProbe = regressionSlopePerDay([
  { dayKey: '2026-09-01', weight: 68.0, readings: 1 },
  { dayKey: '2026-09-03', weight: 68.2, readings: 1 },
  { dayKey: '2026-09-05', weight: 68.4, readings: 1 },
]);
assert(slopeProbe !== null && approx(slopeProbe, 0.1, 1e-9), `斜率应为 0.1 kg/日，得 ${slopeProbe}`);

// 有效日数不足 → 不出趋势（而不是编一个）
const tooFew = weightSummary([day(-2, 68.5), day(-1, 68.4)], ctx);
assert(tooFew.trendKgPerWeek === null && tooFew.direction === 'insufficient_data', '样本不足 → 数据不足');

// 异常值保护：57 vs 近七日均重 66.8 → needs_review，且不改数
const anomaly = validateWeightMeasurement(57, 66.8, 7);
assert(anomaly.flag === 'needs_review', '57 相对 66.8 应标为待核');
assert(approx(Number(anomaly.detail.deltaKg), -9.8, 0.05), `偏离应为 -9.8，得 ${anomaly.detail.deltaKg}`);
const normal = validateWeightMeasurement(68.0, 68.4, 7);
assert(normal.flag === 'normal', '常度之内不打扰');
assert(WEIGHT_POLICY.rollingAvgDays === 7 && WEIGHT_POLICY.trendWindowDays === 30, '窗口来自 policy');
ok('体重：异常只标记待核，绝不修改原始数值');

// ---------------- 5. 训练决策与抗阻进度 ----------------
const rest = decideWorkoutMode({ sleepMinutes: 480, energy: 5, soreness: 1, completedToday: true });
assert(rest.mode === 'rest' && rest.reasons.includes('workout_completed_today'), '今日已练 → 休整');
const recSoreness = decideWorkoutMode({ sleepMinutes: 480, energy: 4, soreness: 4, completedToday: false });
assert(recSoreness.mode === 'recovery' && recSoreness.reasons.includes('high_soreness'), '酸痛 ≥4 → 恢复');
const recEnergy = decideWorkoutMode({ sleepMinutes: 300, energy: 2, soreness: 2, completedToday: false });
assert(recEnergy.mode === 'recovery' && recEnergy.reasons.includes('low_energy'), '精力 ≤2 → 恢复');
const light = decideWorkoutMode({ sleepMinutes: 420, energy: 3, soreness: 2, completedToday: false });
assert(light.mode === 'light' && light.reasons.includes('moderate_energy'), '精力 3 → 轻量');
const shortSleep = decideWorkoutMode({ sleepMinutes: 300, energy: 4, soreness: 2, completedToday: false });
assert(shortSleep.mode === 'light' && shortSleep.reasons.includes('short_sleep'), '眠不足 6 时 → 轻量');
const normalMode = decideWorkoutMode({ sleepMinutes: 450, energy: 4, soreness: 2, completedToday: false });
assert(normalMode.mode === 'normal' && normalMode.reasons.includes('ready'), '俱足 → 常规');
const noReport = decideWorkoutMode({ sleepMinutes: null, energy: null, soreness: null, completedToday: false });
assert(noReport.mode === 'normal' && noReport.reasons.includes('no_wellbeing_record'), '未录体感 → 不猜，明说');
assert(noReport.thresholds.highSorenessMin === TRAINING_POLICY.highSorenessMin, '阈值快照来自 policy');
ok('训练决策：纯函数、原因可机器判读、体重不在入参内');

const resistance2 = resistanceProgress(
  [dayWorkout('2026-09-21', 'resistance'), dayWorkout('2026-09-23', 'resistance')],
  ctx
);
assert(resistance2.completed === 2 && resistance2.met, '本周 2 次抗阻 → 2/2');
const mixed = resistanceProgress(
  [dayWorkout('2026-09-21', 'resistance'), dayWorkout('2026-09-22', 'cardio')],
  ctx
);
assert(mixed.completed === 1 && mixed.totalWorkoutsThisWeek === 2 && !mixed.met, '1 抗阻 + 1 有氧 → 1/2（非 2/2）');
ok('抗阻进度：只数本周 category === resistance');

function dayWorkout(date: string, category: WorkoutRecord['category']): WorkoutRecord {
  return {
    id: `wo-${date}-${category}`,
    date,
    time: '18:00',
    title: category,
    durationMinutes: 20,
    durationSource: 'estimated',
    exercises: [],
    perceivedDifficulty: 'moderate',
    completed: true,
    category,
  };
}

// ---------------- 6. 营养质量与餐数 ----------------
const meals: MealRecord[] = [
  {
    id: 'm1',
    date: ctx.todayKey,
    time: '09:00',
    category: 'breakfast',
    name: '早膳',
    foods: [],
    estimatedCalories: 14159,
    estimatedProtein: 899,
    source: 'suggested',
    confirmed: true,
  },
];
const heavy = buildNutritionSummary(meals, 1950, 110);
assert(heavy.calories.status === 'over' && heavy.quality.flag === 'needs_review', '14159/1950 → 待核');
assert(heavy.mealCount === 1, '餐数来自已确认入账的记录');
ok('营养质量：越常度只标记待核，不静默改写');

console.log(`ALL DOMAIN TESTS PASSED. (${checks} checks)`);
