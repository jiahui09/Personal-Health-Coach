/**
 * TodayData 组装（本地与云端共用的一段）
 *
 * 「原始记录 → 派生指标 → 决策 → 视图模型」只此一处：
 *   - MockHealthRepository：读 localStorage 后调用本函数
 *   - SupabaseHealthRepository：从 PostgREST 取行、映射为域模型后调用同一函数
 * 因此两条数据路径不可能算出不同的结果（由 supabaseContract 的跨路径一致性用例锁定）。
 *
 * 本函数是纯函数：不读时钟、不碰存储、不发请求。
 */

import {
  DailyState,
  HealthContext,
  MealRecord,
  TodoItem,
  TodayData,
  UserProfile,
  WeightRecord,
  WorkoutRecord,
} from '../types/health';
import {
  adviseWeightGoal,
  bodySummary,
  buildNutritionSummary,
  buildTrainingSummary,
  calculateTaskProgress,
  dailyRepresentatives,
  decideTrainingTarget,
  decideWorkoutMode,
  deriveNutritionTargets,
  makeDayContext,
  profileCheck,
  sleepSummary,
  tasksForDay,
  weightSummary,
} from '../domain';
import { formatDisplayDate, timeGreetingOf } from '../utils/calendar';
import { scientificDecisionEngine } from './scientificDecisionEngine';
import { f_meal_slot } from './scientificRules';

/** 组装 TodayData 所需的全部原始记录（一次取齐，不在函数内再查询）。 */
export interface RawSnapshot {
  profile: UserProfile;
  weights: WeightRecord[];
  dailyStates: DailyState[];
  meals: MealRecord[];
  workouts: WorkoutRecord[];
  todos: TodoItem[];
}

export function assembleToday(snapshot: RawSnapshot, now: Date): TodayData {
  const { profile, weights, dailyStates, meals, workouts, todos } = snapshot;
  const ctx = makeDayContext(now);
  const today = ctx.todayKey;

  // --- 原始记录的今日切片 ---
  const todayMeals = meals.filter((meal) => meal.date === today && meal.confirmed !== false);
  const todayTodos = tasksForDay(todos, today);
  const todayWorkout = workouts.find((w) => w.date === today && w.completed);
  const todayState = dailyStates.find((state) => state.date === today);

  // --- 派生指标（domain 纯函数，全站唯一计算处） ---
  const weight = weightSummary(weights, ctx);
  const body = bodySummary(profile, weight.latest, now);
  const check = profileCheck(profile, now);

  // 建议（据 BMI/腰围）→ 用户目标方向 → 每日目标 → 每周抗阻处方
  const goalAdvice = adviseWeightGoal({
    bmiCategory: body.bmiCategory,
    waistElevated: body.waist ? body.waist.elevated : null,
    goal: profile.goal,
  });
  const direction =
    profile.goal === undefined
      ? goalAdvice.direction
      : profile.goal === 'fat loss'
      ? 'lose'
      : profile.goal === 'muscle gain'
      ? 'gain'
      : 'maintain';
  const targets = deriveNutritionTargets({
    tdeeKcal: body.tdeeKcal,
    weightKg: weight.latest,
    direction,
    sex: profile.sex,
  });
  const trainingTarget = decideTrainingTarget({
    direction,
    goal: profile.goal,
    activityLevel: profile.activityLevel,
  });

  const nutrition = buildNutritionSummary(
    todayMeals,
    targets ? targets.caloriesKcal : 0,
    targets ? targets.proteinG : 0
  );
  const sleep = sleepSummary(dailyStates, ctx);
  const tasks = calculateTaskProgress(todayTodos);

  // --- 决策：训练模式由纯函数判定；体重不在入参内，异常体重无法污染它 ---
  const decision = decideWorkoutMode({
    sleepMinutes: sleep.today ? sleep.today.minutes : null,
    energy: todayState?.energy ?? null,
    soreness: todayState?.soreness ?? null,
    completedToday: !!todayWorkout,
  });
  const training = buildTrainingSummary(workouts, ctx, decision, trainingTarget.resistanceDaysPerWeek);

  // --- 决策：引擎推荐（餐食/训练课表），复用同一决策结果 ---
  const context: HealthContext = {
    now,
    profile,
    currentWeight: weight.latest ?? 0,
    todayState: todayState ?? { date: today },
    todayMeals,
    recentMeals: meals,
    recentWorkouts: workouts,
    weightHistory: weights,
    todayWorkout,
    trainingDecision: decision,
    targets,
  };

  const nextMeal = scientificDecisionEngine.recommendNextMeal(context);
  const nextWorkout = scientificDecisionEngine.recommendNextWorkout(context);
  const dietQuality = scientificDecisionEngine.assessDietQuality(context);
  const forecast = scientificDecisionEngine.computeWeightForecast({
    latestWeight: weight.latest,
    trendKgPerWeek: weight.trendKgPerWeek,
    basedOnDays: weight.trendDays,
    inputWindowDays: weight.windowDays,
    quality: weight.quality,
  });

  const flags = [weight.quality, nutrition.quality, sleep.quality];
  const weightPoints = dailyRepresentatives(weights)
    .slice(-ctx.last30Keys.length)
    .map((point) => ({ date: point.dayKey, weight: point.weight }));

  return {
    date: today,
    displayDate: formatDisplayDate(now),
    timeGreeting: timeGreetingOf(ctx.hour),
    profile,
    mealSlot: f_meal_slot(ctx.hour),

    todos: todayTodos,
    todayMeals,

    tasks,
    weight,
    nutrition,
    sleep,
    state: todayState ?? { date: today },
    weightSeries: weightPoints,

    training,
    dataQuality: {
      flags,
      reviewCount: flags.filter((flag) => flag.flag === 'needs_review').length,
    },
    forecast,
    nextMeal,
    nextWorkout,
    dietQuality,

    profileStatus: check.complete ? 'complete' : 'incomplete',
    missingProfileFields: check.missing,
    body,
    targets,
    goalAdvice,
    trainingTarget,
  };
}
