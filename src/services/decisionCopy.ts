/**
 * 决策结果的中文表述（唯一出处）
 *
 * 训练状态、原因、阈值句都由这里生成：规则层写进 heuristicReason，
 * 页面写进可见句子，二者不会各说一套。
 */

import type { TrainingState } from '../types/health';
import type { WorkoutDecision, WorkoutMode, WorkoutReason } from '../domain/types';

export const WORKOUT_MODE_CN: Record<WorkoutMode, string> = {
  rest: '休整',
  recovery: '恢复',
  light: '轻量',
  normal: '常规',
};

export const TRAINING_STATE_CN: Record<TrainingState, string> = {
  REST: '休整',
  RECOVERY: '恢复',
  LIGHT: '轻量',
  NORMAL: '常规',
};

export const WORKOUT_REASON_CN: Record<WorkoutReason, string> = {
  workout_completed_today: '今日既定之练已毕',
  no_wellbeing_record: '今日尚未录体感',
  high_soreness: '酸痛显著',
  low_energy: '精力偏低',
  short_sleep: '眠时不足',
  moderate_energy: '精力平平',
  moderate_soreness: '酸痛未消',
  ready: '精力与睡眠俱足',
};

export const trainingStateOf = (mode: WorkoutMode): TrainingState => {
  switch (mode) {
    case 'rest':
      return 'REST';
    case 'recovery':
      return 'RECOVERY';
    case 'light':
      return 'LIGHT';
    default:
      return 'NORMAL';
  }
};

/** 「酸痛 ≥4 或 精力 ≤2（眠不足 6 时亦然）则降为恢复」——阈值直接取自 policy。 */
export function describeTrainingPolicy(decision: WorkoutDecision): string {
  const { highSorenessMin, lowEnergyMax, shortSleepHours } = decision.thresholds;
  return `酸痛 ≥${highSorenessMin} 或 精力 ≤${lowEnergyMax}（眠不足 ${shortSleepHours} 时亦然）则降为恢复`;
}

/** 由原因码拼出「为何如此」的句子；原因码是机器可判的，句子只是它的表述。 */
export function describeWorkoutReasons(decision: WorkoutDecision): string {
  return decision.reasons.map((reason) => WORKOUT_REASON_CN[reason]).join('、');
}

export function describeWorkoutDecision(decision: WorkoutDecision): string {
  return `定为${WORKOUT_MODE_CN[decision.mode]} · ${describeWorkoutReasons(decision)}`;
}
