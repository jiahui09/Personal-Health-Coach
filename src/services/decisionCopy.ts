/**
 * 决策与体征的中文表述（唯一出处）
 *
 * 训练状态、原因、阈值句、体征档标签都由这里生成：
 * 规则层写进 heuristicReason，页面写进可见句子，二者不会各说一套。
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
  // ready 只意味「已录项皆未越阈」——精力或眠可能未录，不得称「俱足」
  ready: '已录之体感未见其碍',
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

/** 阈值取自 policy；分级与 decideWorkoutMode 一致：越阈→恢复，居中/短眠→轻量。 */
export function describeTrainingPolicy(decision: WorkoutDecision): string {
  const { highSorenessMin, lowEnergyMax, shortSleepHours } = decision.thresholds;
  return `酸痛 ≥${highSorenessMin} 或 精力 ≤${lowEnergyMax} 则降为恢复；眠不足 ${shortSleepHours} 或精力、酸痛居中则降为轻量`;
}

/** 由原因码拼出「为何如此」的句子；原因码是机器可判的，句子只是它的表述。 */
export function describeWorkoutReasons(decision: WorkoutDecision): string {
  return decision.reasons.map((reason) => WORKOUT_REASON_CN[reason]).join('、');
}

export function describeWorkoutDecision(decision: WorkoutDecision): string {
  return `定为${WORKOUT_MODE_CN[decision.mode]} · ${describeWorkoutReasons(decision)}`;
}

// ---------------- 体征档（Raw → Derived → Decision） ----------------

export const SEX_CN: Record<'female' | 'male' | 'other', string> = {
  female: '女',
  male: '男',
  other: '其他',
};

export const ACTIVITY_CN: Record<
  'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
  { label: string; hint: string }
> = {
  sedentary: { label: '久坐', hint: '几乎不运动 · PAL 1.2' },
  light: { label: '轻', hint: '每周 1–3 练 · PAL 1.375' },
  moderate: { label: '中', hint: '每周 3–5 练 · PAL 1.55' },
  active: { label: '高', hint: '每周 6–7 练 · PAL 1.725' },
  very_active: { label: '极高', hint: '每日训练或体力工作 · PAL 1.9' },
};

export const BMI_CATEGORY_CN: Record<
  'underweight' | 'normal' | 'overweight' | 'obese_1' | 'obese_2' | 'obese_3',
  string
> = {
  underweight: '偏瘦',
  normal: '正常',
  overweight: '超重',
  obese_1: '肥胖一度',
  obese_2: '肥胖二度',
  obese_3: '肥胖三度',
};

export const DIRECTION_CN: Record<'lose' | 'maintain' | 'gain', string> = {
  lose: '减脂',
  maintain: '维持',
  gain: '增重',
};

export const GOAL_CN: Record<string, string> = {
  'fat loss': '减脂之期',
  maintain: '守成之期',
  'muscle gain': '增肌之期',
  'general fitness': '日常强身',
};

/** 体征档缺项的中文名，用于「未建档」提示。 */
export const PROFILE_FIELD_CN: Record<string, string> = {
  sex: '性别',
  birthYear: '出生年',
  heightCm: '身高',
  activityLevel: '活动水平',
  goal: '目标',
};
