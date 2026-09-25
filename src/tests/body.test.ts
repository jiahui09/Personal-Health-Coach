/**
 * 体征档测试：BMI / 腰围 / RMR / TDEE / 目标 / 建议 / 处方
 *
 * 固定 clock：2026-09-25 —— 年龄由出生年派生，因此必须注入时钟。
 * 这些是「应用能否回答胖瘦、该增还是该减、该吃多少、该练多少」的可执行证明。
 */

import {
  ACTIVITY_PAL,
  WAIST_LIMIT_CM,
  adviseWeightGoal,
  ageYears,
  bmi,
  bmiCategory,
  bodySummary,
  decideTrainingTarget,
  deriveNutritionTargets,
  mifflinStJeor,
  profileCheck,
  totalDailyEnergy,
  waistAssessment,
} from '../domain';
import type { UserProfile } from '../types/health';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const NOW = new Date(2026, 8, 25, 21, 30);
let checks = 0;
const ok = (message: string): void => {
  checks += 1;
  console.log(`   ✓ ${message}`);
};

// ---------------- 1. 年龄由出生年派生 ----------------
assert(ageYears(1998, NOW) === 28, '1998 → 28 岁');
assert(ageYears(1950, NOW) === 76, '1950 → 76 岁');
assert(ageYears(1900, NOW) === null, '>120 岁不合常理 → null（不编造）');
assert(ageYears(1800, NOW) === null, '不合法的出生年 → null');
ok('年龄由出生年派生，不另存一份');

// ---------------- 2. BMI 与 WHO 分类 ----------------
assert(bmi(68.4, 175) !== null && Math.round(bmi(68.4, 175)! * 10) / 10 === 22.3, 'BMI 68.4kg/175cm = 22.3');
assert(bmi(null, 175) === null && bmi(70, null) === null, '缺体重或身高 → null（不猜）');
assert(bmiCategory(18.4) === 'underweight', '<18.5 偏瘦');
assert(bmiCategory(18.5) === 'normal' && bmiCategory(24.9) === 'normal', '18.5–24.9 正常');
assert(bmiCategory(25) === 'overweight' && bmiCategory(29.9) === 'overweight', '25–29.9 超重');
assert(bmiCategory(30) === 'obese_1' && bmiCategory(35) === 'obese_2', '≥30 肥胖（一/二度）');
ok('BMI 与 WHO 分类边界正确');

// ---------------- 3. 腰围（亚太标准） ----------------
assert(WAIST_LIMIT_CM.male === 90 && WAIST_LIMIT_CM.female === 80, '亚太提示线：男 90 / 女 80 cm');
assert(waistAssessment(84, 'male')?.elevated === false, '男 84cm 未越线');
assert(waistAssessment(92, 'male')?.elevated === true, '男 92cm 越线');
assert(waistAssessment(82, 'female')?.elevated === true, '女 82cm 越线');
assert(waistAssessment(undefined, 'male') === null, '未录腰围 → null（不猜）');
ok('腰围判定：未录即 null，越线即提示');

// ---------------- 4. RMR（Mifflin-St Jeor）与 TDEE（PAL） ----------------
const rmr = mifflinStJeor({ weightKg: 68.4, heightCm: 175, ageYears: 28, sex: 'male' });
assert(rmr === 1643, `RMR 1643 kcal（10×68.4 + 6.25×175 − 5×28 + 5），得 ${rmr}`);
const rmrFemale = mifflinStJeor({ weightKg: 60, heightCm: 165, ageYears: 30, sex: 'female' });
assert(rmrFemale !== null && rmrFemale > 0 && rmrFemale < rmr!, '女性同条件 RMR 低于男性（−166 偏移）');
assert(mifflinStJeor({ weightKg: 0, heightCm: 175, ageYears: 28, sex: 'male' }) === null, '无体重 → null');

const sedentary = totalDailyEnergy(1643, 'sedentary');
const light = totalDailyEnergy(1643, 'light');
const active = totalDailyEnergy(1643, 'active');
assert(sedentary?.kcal === Math.round(1643 * ACTIVITY_PAL.sedentary), '久坐 = RMR × 1.2');
assert(light?.kcal === Math.round(1643 * 1.375), '轻 = RMR × 1.375');
assert(active?.kcal === Math.round(1643 * 1.725), '高 = RMR × 1.725');
assert(totalDailyEnergy(null, 'light') === null, '无 RMR → 无 TDEE');
ok('RMR 为预测值、TDEE 由活动水平决定（不再是写死的 1.15–1.25）');

// ---------------- 5. 目标热量与蛋白由 TDEE/体重派生 ----------------
const lose = deriveNutritionTargets({ tdeeKcal: 2259, weightKg: 68.4, direction: 'lose', sex: 'male' });
assert(lose?.caloriesKcal === Math.round(2259 * 0.8) && lose.ratio === 0.8, '减脂 = TDEE × 0.8');
const maintain = deriveNutritionTargets({ tdeeKcal: 2259, weightKg: 68.4, direction: 'maintain', sex: 'male' });
assert(maintain?.caloriesKcal === 2259, '维持 = TDEE');
const gain = deriveNutritionTargets({ tdeeKcal: 2259, weightKg: 68.4, direction: 'gain', sex: 'male' });
assert(gain?.caloriesKcal === Math.round(2259 * 1.1), '增重 = TDEE × 1.1');
assert(lose?.proteinRange.min === Math.round(68.4 * 1.4) && lose?.proteinRange.max === Math.round(68.4 * 2.0), '蛋白区间 1.4–2.0 g/kg（Morton 2018）');
assert(lose?.proteinG === Math.round((96 + 137) / 2), '蛋白目标取区间中点');
const floored = deriveNutritionTargets({ tdeeKcal: 1400, weightKg: 45, direction: 'lose', sex: 'female' });
assert(floored?.caloriesKcal === 1200 && floored.floored === true, '计算结果低于下限时托到 1200 并如实标注');
const notFloored = deriveNutritionTargets({ tdeeKcal: 1500, weightKg: 45, direction: 'lose', sex: 'female' });
assert(notFloored?.caloriesKcal === 1200 && notFloored.floored === false, '恰好等于下限不算被托');
assert(deriveNutritionTargets({ tdeeKcal: null, weightKg: 68.4, direction: 'lose', sex: 'male' }) === null, '无 TDEE → 无目标（不编造）');
assert(lose?.targetRateKgPerWeek !== null && lose!.targetRateKgPerWeek!.max <= 0.7, '减脂速率 0.5–1.0 %体重/周');
ok('每日目标热量与蛋白由 TDEE、体重与目标方向派生');

// ---------------- 6. 建议：「该减、该守、还是该增」 ----------------
const fatAdvice = adviseWeightGoal({ bmiCategory: 'obese_1', waistElevated: null, goal: 'fat loss' });
assert(fatAdvice.direction === 'lose' && fatAdvice.conflicting === false, '肥胖 + 想减脂 → 一致');
const waistAdvice = adviseWeightGoal({ bmiCategory: 'normal', waistElevated: true, goal: undefined });
assert(waistAdvice.direction === 'lose' && waistAdvice.reasons.includes('waist_elevated'), '指数正常但腰围越线 → 建议减脂');
const thinAdvice = adviseWeightGoal({ bmiCategory: 'underweight', waistElevated: false, goal: 'fat loss' });
assert(thinAdvice.direction === 'gain' && thinAdvice.conflicting === true, '偏瘦却选了减脂 → 建议增重并标出相悖');
const okAdvice = adviseWeightGoal({ bmiCategory: 'normal', waistElevated: false, goal: 'fat loss' });
assert(okAdvice.direction === 'maintain' && okAdvice.conflicting === false, '正常区间 + 减脂：建议维持（并列显示,不报警）');
const muscleAdvice = adviseWeightGoal({ bmiCategory: 'normal', waistElevated: false, goal: 'muscle gain' });
assert(muscleAdvice.direction === 'maintain' && muscleAdvice.conflicting === false, '想增肌且指数正常 → 不冲突');
const obeseGain = adviseWeightGoal({ bmiCategory: 'obese_1', waistElevated: true, goal: 'muscle gain' });
assert(obeseGain.direction === 'lose' && obeseGain.conflicting === true, '肥胖却想增重 → 方向相反,标出相悖');
ok('建议只由 BMI 与腰围给出；与自选目标相悖时标出，不替用户改目标');

// ---------------- 7. 每周抗阻处方 ----------------
const baseline = decideTrainingTarget({ direction: 'lose', goal: 'fat loss', activityLevel: 'light' });
assert(baseline.resistanceDaysPerWeek === 2, '人群基线：每周 2 日（WHO）');
const muscleTarget = decideTrainingTarget({ direction: 'gain', goal: 'muscle gain', activityLevel: 'light' });
assert(muscleTarget.resistanceDaysPerWeek === 3 && muscleTarget.sessionMinutes.max >= 45, '增肌 → 3 日、单次更久');
const activeTarget = decideTrainingTarget({ direction: 'maintain', goal: 'general fitness', activityLevel: 'active' });
assert(activeTarget.resistanceDaysPerWeek === 4, '高活动水平 → 4 日');
ok('每周抗阻日数与时长按目标与活动水平给出');

// ---------------- 8. 建档完整性：未建档不显示人体数字 ----------------
const empty: UserProfile = {};
const emptyCheck = profileCheck(empty, NOW);
assert(emptyCheck.complete === false, '空档案 → 未建档');
assert(
  ['sex', 'birthYear', 'heightCm', 'activityLevel', 'goal'].every((f) => emptyCheck.missing.includes(f)),
  '缺项如实列出'
);
const emptyBody = bodySummary(empty, 68.4, NOW);
assert(emptyBody.bmi === null && emptyBody.rmrKcal === null && emptyBody.tdeeKcal === null, '未建档 → BMI/RMR/TDEE 全为 null');
const badHeight = profileCheck({ sex: 'male', birthYear: 1990, heightCm: 30, activityLevel: 'light', goal: 'maintain' }, NOW);
assert(badHeight.complete === false && badHeight.missing.includes('heightCm'), '身高 30cm 不合常理 → 视为缺项');

const complete: UserProfile = {
  sex: 'male',
  birthYear: 1998,
  heightCm: 175,
  activityLevel: 'light',
  waistCm: 84,
  goal: 'fat loss',
};
const fullBody = bodySummary(complete, 68.4, NOW);
assert(fullBody.complete && fullBody.bmi === 22.3 && fullBody.rmrKcal === 1643 && fullBody.tdeeKcal === 2259, '齐备 → 一路算到 TDEE');
ok('未建档即「未录」，绝不拿演示数据冒充');

console.log(`ALL BODY TESTS PASSED. (${checks} checks)`);
