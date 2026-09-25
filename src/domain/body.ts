/**
 * 体征派生（Derived）
 *
 * 输入只有「你告诉我的原始事实」：性别、出生年、身高、活动水平、腰围、体重记录。
 * 输出 BMI / 腰围判定 / RMR / TDEE —— 全部可复算，页面不再手写任何人体数字。
 *
 * 诚实边界（必须同步进 README）：
 *   - BMI 分不清肌肉与脂肪，力量训练者可能被误判为超重；因此只表述「指数落在某区间」，
 *     并以腰围作为第二证据，绝不下「你胖」的判决。
 *   - 腰围用亚太标准（男 ≥90cm / 女 ≥80cm）为提示线：本应用面向中文用户。
 *   - RMR 为预测值（Mifflin-St Jeor 总体模型），非实测代谢率；个体误差约 ±10%。
 */

import type { ActivityLevel, UserProfile } from '../types/health';
import type { BodySummary } from './types';

/** 活动水平 → 身体活动系数（PAL）。 */
export const ACTIVITY_PAL: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** 亚太标准腰围提示线（cm）。 */
export const WAIST_LIMIT_CM = { male: 90, female: 80 } as const;

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese_1' | 'obese_2';

/** 出生年 → 周岁（用注入时钟，年龄不另存一份）。 */
export function ageYears(birthYear: number, now: Date): number | null {
  if (!Number.isFinite(birthYear) || birthYear < 1900) return null;
  const age = now.getFullYear() - birthYear;
  return age >= 0 && age <= 120 ? age : null;
}

/** BMI = kg / m²；输入不成立返回 null（不编造）。 */
export function bmi(weightKg: number | null, heightCm: number | null | undefined): number | null {
  if (weightKg === null || !heightCm || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return weightKg / (meters * meters);
}

/** WHO 成人 BMI 分类。 */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight';
  if (value < 25) return 'normal';
  if (value < 30) return 'overweight';
  if (value < 35) return 'obese_1';
  return 'obese_2';
}

/**
 * 腰围判定：超过亚太提示线即「中心性肥胖风险升高」。
 * 未录腰围返回 null —— 不猜。
 */
export function waistAssessment(
  waistCm: number | null | undefined,
  sex: UserProfile['sex']
): { limitCm: number; elevated: boolean } | null {
  if (!waistCm || waistCm <= 0) return null;
  if (sex !== 'male' && sex !== 'female') return null;
  const limitCm = WAIST_LIMIT_CM[sex];
  return { limitCm, elevated: waistCm >= limitCm };
}

/** Mifflin-St Jeor 预测静息代谢率（kcal/日）。 */
export function mifflinStJeor(input: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: UserProfile['sex'];
}): number | null {
  const { weightKg, heightCm, ageYears: age, sex } = input;
  if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null;
  if (sex !== 'male' && sex !== 'female' && sex !== 'other') return null;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + offset);
}

/** 总消耗 = RMR × PAL。 */
export function totalDailyEnergy(
  rmrKcal: number | null,
  level: UserProfile['activityLevel']
): { pal: number; kcal: number } | null {
  if (rmrKcal === null || !level || !(level in ACTIVITY_PAL)) return null;
  const pal = ACTIVITY_PAL[level];
  return { pal, kcal: Math.round(rmrKcal * pal) };
}

/** 建档完整性的唯一判据（含合理性检查，防止 0 或离谱值混入）。 */
export function profileCheck(profile: UserProfile, now: Date): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (profile.sex !== 'male' && profile.sex !== 'female') missing.push('sex');
  const age = profile.birthYear === undefined ? null : ageYears(profile.birthYear, now);
  if (age === null || age < 10) missing.push('birthYear');
  if (!profile.heightCm || profile.heightCm < 100 || profile.heightCm > 250) missing.push('heightCm');
  if (!profile.activityLevel || !(profile.activityLevel in ACTIVITY_PAL)) {
    missing.push('activityLevel');
  }
  if (!profile.goal) missing.push('goal');
  return { complete: missing.length === 0, missing };
}

/** 体征全景：未建档的字段一律为 null，页面显示「未录」。 */
export function bodySummary(
  profile: UserProfile,
  latestWeightKg: number | null,
  now: Date
): BodySummary {
  const check = profileCheck(profile, now);
  const age = profile.birthYear === undefined ? null : ageYears(profile.birthYear, now);
  const bmiValue = check.missing.includes('heightCm') ? null : bmi(latestWeightKg, profile.heightCm);
  const rmr =
    latestWeightKg !== null && profile.heightCm && age !== null && profile.sex
      ? mifflinStJeor({
          weightKg: latestWeightKg,
          heightCm: profile.heightCm,
          ageYears: age,
          sex: profile.sex,
        })
      : null;
  const tdee = totalDailyEnergy(rmr, profile.activityLevel);
  return {
    complete: check.complete,
    missing: check.missing,
    ageYears: age,
    heightCm: profile.heightCm ?? null,
    sex: profile.sex ?? null,
    activityLevel: profile.activityLevel ?? null,
    waistCm: profile.waistCm ?? null,
    weightKg: latestWeightKg,
    bmi: bmiValue === null ? null : Math.round(bmiValue * 10) / 10,
    bmiCategory: bmiValue === null ? null : bmiCategory(bmiValue),
    waist: waistAssessment(profile.waistCm, profile.sex),
    rmrKcal: rmr,
    tdeeKcal: tdee ? tdee.kcal : null,
    pal: tdee ? tdee.pal : null,
  };
}
