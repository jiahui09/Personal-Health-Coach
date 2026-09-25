/**
 * 睡眠（Derived）
 *
 * 唯一事实来源：DailyState.sleep（判别联合）。
 *   interval  就寝/起身时刻 → 时长由时刻差推出（跨午夜自然处理）
 *   duration  手录眠时（用户确实只记得总时长时使用）
 * 二者互斥，因此不会再出现「7h18m 与 00:55→08:15 打架」。
 */

import type { DailyState, SleepEntry } from '../types/health';
import { round1 } from './format';
import { SLEEP_POLICY, type SleepPolicy } from './policy';
import type { SleepNight, SleepSummary } from './types';
import { isInLast7, type DayContext } from './time';

/** "HH:MM" → 当日分钟数；非法输入返回 null。 */
export function parseClockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 由就寝与起身时刻推出睡眠分钟数（跨午夜取模）。 */
export function intervalMinutes(sleepStart: string, wakeTime: string): number | null {
  const start = parseClockToMinutes(sleepStart);
  const wake = parseClockToMinutes(wakeTime);
  if (start === null || wake === null) return null;
  return (wake - start + 24 * 60) % (24 * 60);
}

/** 单一来源解析：区间优先于手录眠时（联合类型保证二者不会并存）。 */
export function resolveSleepMinutes(sleep: SleepEntry | undefined): {
  minutes: number;
  source: 'interval' | 'duration';
  sleepStart?: string;
  wakeTime?: string;
} | null {
  if (!sleep) return null;
  if (sleep.kind === 'interval') {
    const minutes = intervalMinutes(sleep.sleepStart, sleep.wakeTime);
    if (minutes === null) return null;
    return { minutes, source: 'interval', sleepStart: sleep.sleepStart, wakeTime: sleep.wakeTime };
  }
  const minutes = Math.round(sleep.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return { minutes, source: 'duration' };
}

export function sleepNightOf(state: DailyState | undefined): SleepNight | null {
  if (!state) return null;
  const resolved = resolveSleepMinutes(state.sleep);
  if (!resolved) return null;
  return {
    dayKey: state.date,
    minutes: resolved.minutes,
    source: resolved.source,
    sleepStart: resolved.sleepStart,
    wakeTime: resolved.wakeTime,
  };
}

/** 今日之眠 + 近七日平均（按有记录的夜数平均，并如实报告夜数）。 */
export function sleepSummary(
  states: DailyState[],
  ctx: DayContext,
  policy: SleepPolicy = SLEEP_POLICY
): SleepSummary {
  const todayState = states.find((state) => state.date === ctx.todayKey);
  const today = sleepNightOf(todayState);

  const windowNights = states
    .filter((state) => isInLast7(ctx, state.date))
    .map((state) => sleepNightOf(state))
    .filter((night): night is SleepNight => night !== null);

  const nights = windowNights.length;
  const totalMinutes = windowNights.reduce((sum, night) => sum + night.minutes, 0);
  const avgMinutes = nights > 0 ? totalMinutes / nights : null;

  return {
    today,
    avgMinutes,
    avgHours: avgMinutes === null ? null : round1(avgMinutes / 60),
    nights,
    windowDays: ctx.last7Keys.length,
    meetsReference: avgMinutes === null ? null : avgMinutes >= policy.targetMinutes,
    ratioOfTarget:
      avgMinutes === null || policy.targetMinutes <= 0 ? null : avgMinutes / policy.targetMinutes,
    quality:
      nights === 0
        ? { flag: 'insufficient', reasons: ['insufficient_sleep_nights'], detail: { nights: 0 } }
        : { flag: 'normal', reasons: [], detail: { nights } },
  };
}
