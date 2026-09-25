/**
 * 训练决策（Decision）与抗阻进度（Derived）
 *
 * decideWorkoutMode 是纯函数：输入只有体感、睡眠与「今日是否已练」——
 * 体重不在入参里，因此异常体重永远无法污染训练决策。
 */

import type { WorkoutRecord } from '../types/health';
import { TRAINING_POLICY, type TrainingDecisionPolicy } from './policy';
import type { ResistanceProgress, TrainingSummary, WorkoutDecision, WorkoutReason } from './types';
import { isInWeek, type DayContext } from './time';

export interface WorkoutDecisionInput {
  /** 今日之眠（分钟）；无记录传 null。 */
  sleepMinutes: number | null;
  /** 精力自评；未录传 null（不填默认值冒充）。 */
  energy: number | null;
  /** 酸痛自评；未录传 null。 */
  soreness: number | null;
  completedToday: boolean;
}

export function decideWorkoutMode(
  input: WorkoutDecisionInput,
  policy: TrainingDecisionPolicy = TRAINING_POLICY
): WorkoutDecision {
  const { sleepMinutes, energy, soreness, completedToday } = input;
  const thresholds = {
    lowEnergyMax: policy.lowEnergyMax,
    highSorenessMin: policy.highSorenessMin,
    shortSleepHours: policy.shortSleepHours,
    moderateEnergy: policy.moderateEnergy,
    moderateSoreness: policy.moderateSoreness,
  };
  const evidenceStatus = policy.evidenceStatus;

  if (completedToday) {
    return { mode: 'rest', reasons: ['workout_completed_today'], thresholds, evidenceStatus };
  }

  // 未录体感 → 不猜，按常规课表并如实说明判据缺失
  if (energy === null && soreness === null) {
    return { mode: 'normal', reasons: ['no_wellbeing_record'], thresholds, evidenceStatus };
  }

  const reasons: WorkoutReason[] = [];
  if (soreness !== null && soreness >= policy.highSorenessMin) reasons.push('high_soreness');
  if (energy !== null && energy <= policy.lowEnergyMax) reasons.push('low_energy');
  if (reasons.length > 0) {
    return { mode: 'recovery', reasons, thresholds, evidenceStatus };
  }

  const shortSleep =
    sleepMinutes !== null && sleepMinutes < policy.shortSleepHours * 60;
  if (shortSleep) reasons.push('short_sleep');
  if (energy !== null && energy === policy.moderateEnergy) reasons.push('moderate_energy');
  if (soreness !== null && soreness === policy.moderateSoreness) reasons.push('moderate_soreness');
  if (reasons.length > 0) {
    return { mode: 'light', reasons, thresholds, evidenceStatus };
  }

  return { mode: 'normal', reasons: ['ready'], thresholds, evidenceStatus };
}

/** 本周（周一起）抗阻次数 / 目标；非抗阻训练只计入「全部运动」。 */
export function resistanceProgress(
  workouts: WorkoutRecord[],
  ctx: DayContext,
  policy: TrainingDecisionPolicy = TRAINING_POLICY
): ResistanceProgress {
  const thisWeek = workouts.filter((workout) => workout.completed && isInWeek(ctx, workout.date));
  const completed = thisWeek.filter((workout) => workout.category === 'resistance').length;
  const target = policy.weeklyResistanceTarget;
  return {
    completed,
    target,
    ratio: target > 0 ? completed / target : 0,
    remaining: Math.max(target - completed, 0),
    met: target > 0 && completed >= target,
    totalWorkoutsThisWeek: thisWeek.length,
  };
}

export function buildTrainingSummary(
  workouts: WorkoutRecord[],
  ctx: DayContext,
  decision: WorkoutDecision,
  policy: TrainingDecisionPolicy = TRAINING_POLICY
): TrainingSummary {
  const todaySession =
    workouts.find((workout) => workout.date === ctx.todayKey && workout.completed) ?? null;
  return {
    decision,
    todaySession,
    resistance: resistanceProgress(workouts, ctx, policy),
  };
}
