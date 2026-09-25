/**
 * 体重（Derived + Decision）
 *
 * 原始记录：WeightRecord[]（同日可多条 → 取当日最新一条为当日代表值）。
 * 下列全部由原始记录派生，绝不另存：今之体重、条数、有记录日数、首末值、最高最低、
 * 近七日均重、回归斜率、偏离度、数据质量。
 */

import type { WeightRecord } from '../types/health';
import { WEIGHT_POLICY, type WeightPolicy } from './policy';
import type { DailyWeightPoint, DataQuality, WeightSummary } from './types';
import { isInLast7, isInLast30, type DayContext } from './time';

const round1 = (n: number): number => Math.round(n * 10) / 10;

const laterOf = (a: WeightRecord, b: WeightRecord): WeightRecord => {
  if (a.date !== b.date) return a.date > b.date ? a : b;
  const at = a.time ?? '';
  const bt = b.time ?? '';
  if (at === bt) return a;
  return at > bt ? a : b;
};

/** 当日代表值：该日最新一次有效测量。 */
export function dailyRepresentatives(records: WeightRecord[]): DailyWeightPoint[] {
  const byDay = new Map<string, { record: WeightRecord; readings: number }>();
  for (const record of records) {
    if (!Number.isFinite(record.weight) || record.weight <= 0) continue;
    const current = byDay.get(record.date);
    if (!current) {
      byDay.set(record.date, { record, readings: 1 });
    } else {
      byDay.set(record.date, {
        record: laterOf(current.record, record),
        readings: current.readings + 1,
      });
    }
  }
  return [...byDay.entries()]
    .map(([dayKey, value]) => ({ dayKey, weight: value.record.weight, readings: value.readings }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/** 以「距首日的天数」为横轴的线性回归，返回每日斜率（kg/日）。 */
export function regressionSlopePerDay(points: DailyWeightPoint[]): number | null {
  if (points.length < 2) return null;
  const base = points[0].dayKey;
  const dayIndex = (dayKey: string): number => {
    const [y1, m1, d1] = base.split('-').map(Number);
    const [y2, m2, d2] = dayKey.split('-').map(Number);
    return Math.round(
      (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (24 * 60 * 60 * 1000)
    );
  };
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const point of points) {
    const x = dayIndex(point.dayKey);
    sumX += x;
    sumY += point.weight;
    sumXY += x * point.weight;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * 质量校验：只标记，不改数。今录相对近七日均重的偏离超过
 * max(绝对阈值, 均值×比例) 即需核对（漏记、重复录入或测量条件变化）。
 */
export function validateWeightMeasurement(
  latest: number | null,
  rollingMean7d: number | null,
  windowDaysWithRecords: number,
  policy: WeightPolicy = WEIGHT_POLICY
): DataQuality {
  if (latest === null) {
    return { flag: 'insufficient', reasons: ['insufficient_weight_days'], detail: { days: 0 } };
  }
  if (rollingMean7d === null || windowDaysWithRecords < 2) {
    return {
      flag: 'insufficient',
      reasons: ['insufficient_weight_days'],
      detail: { days: windowDaysWithRecords },
    };
  }
  const delta = latest - rollingMean7d;
  const threshold = Math.max(policy.anomalyAbsKg, Math.abs(rollingMean7d) * policy.anomalyRatio);
  if (Math.abs(delta) > threshold) {
    return {
      flag: 'needs_review',
      reasons: ['weight_deviates_from_rolling_mean'],
      comparison: delta > 0 ? 'above' : 'below',
      detail: {
        latest,
        rollingMean7d: round1(rollingMean7d),
        deltaKg: round1(delta),
        thresholdKg: round1(threshold),
      },
    };
  }
  return {
    flag: 'normal',
    reasons: [],
    detail: { deltaKg: round1(delta) },
    comparison: delta > 0 ? 'above' : delta < 0 ? 'below' : undefined,
  };
}

/** 近三十日体重全景：端点变化与回归斜率是两个独立指标，分开输出。 */
export function weightSummary(
  records: WeightRecord[],
  ctx: DayContext,
  policy: WeightPolicy = WEIGHT_POLICY
): WeightSummary {
  const reps = dailyRepresentatives(records);
  const windowReps = reps.filter((point) => isInLast30(ctx, point.dayKey));
  const windowRecords = records.filter((record) => isInLast30(ctx, record.date));

  const todayRep = windowReps.find((point) => point.dayKey === ctx.todayKey) ?? null;
  const lastRep = windowReps.length > 0 ? windowReps[windowReps.length - 1] : null;
  const latestPoint = todayRep ?? lastRep;
  const firstRep = windowReps.length > 0 ? windowReps[0] : null;

  const last7Reps = reps.filter((point) => isInLast7(ctx, point.dayKey));
  const rollingMean7d =
    last7Reps.length > 0
      ? last7Reps.reduce((sum, point) => sum + point.weight, 0) / last7Reps.length
      : null;

  const slopePerDay =
    windowReps.length >= policy.minDaysForTrend ? regressionSlopePerDay(windowReps) : null;
  const trendKgPerWeek = slopePerDay === null ? null : slopePerDay * 7;

  let direction: WeightSummary['direction'] = 'insufficient_data';
  if (trendKgPerWeek !== null) {
    if (trendKgPerWeek < -policy.directionThresholdKgPerWeek) direction = 'down';
    else if (trendKgPerWeek > policy.directionThresholdKgPerWeek) direction = 'up';
    else direction = 'flat';
  }

  return {
    latest: latestPoint ? latestPoint.weight : null,
    latestDayKey: latestPoint ? latestPoint.dayKey : null,
    readingCount: windowRecords.length,
    daysWithRecords: windowReps.length,
    windowDays: ctx.last30Keys.length,
    firstInWindow: firstRep,
    lastInWindow: lastRep,
    series: windowReps,
    endpointChangeKg:
      firstRep && lastRep && windowReps.length >= 2
        ? round1(lastRep.weight - firstRep.weight)
        : null,
    rollingMean7d: rollingMean7d === null ? null : round1(rollingMean7d),
    rollingMean7dDays: last7Reps.length,
    trendKgPerWeek: trendKgPerWeek === null ? null : Math.round(trendKgPerWeek * 100) / 100,
    trendDays: windowReps.length,
    direction,
    quality: validateWeightMeasurement(
      latestPoint ? latestPoint.weight : null,
      rollingMean7d,
      last7Reps.length,
      policy
    ),
  };
}
