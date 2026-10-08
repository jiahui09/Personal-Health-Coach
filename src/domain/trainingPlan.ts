/**
 * 训练规划器（离线排课）· 台账轮转 + 目标拆分 + 预算贪心 + 摄入就绪门
 *
 * 定位：Decision 层纯函数。阈值全部出自 TRAINING_POLICY.planner，
 * 一律 engineering_heuristic（无临床处方含义）；规则 id 由 f_workout 注册进 DecisionTrace。
 *
 * 设计要点——每一练都影响下一练，每一日都不独立：
 *  1. 台账 muscleGroupLedger：trailing 7 天内各运动模式（push/lower body/…）的
 *     最近训练日与累计组数；旧记录缺 movementPattern 时按动作名回查动作库补位。
 *  2. 优先级 = 周缺口（目标组数 − 已练组数） × 恢复门（≥ recoveryGapDays 才重复同族）
 *     × 目标权重（增肌偏推腿后链、减脂全身、维持均衡）。
 *  3. 预算贪心：复合动作优先，估计分钟之和 ≤ 预算 − 热身预留；减脂课先为心肺
 *     收尾留位（否则装箱吃净余量，收尾永远排不上），再用余量收一条收尾。
 *  4. 进阶 HEURISTIC_PROGRESSION_01：同族过门后 tier+1；库无更高阶 → +1 组（≤4 组）。
 *  5. 摄入就绪门：今日热量或蛋白达成 < intakeReadyRatio → NORMAL 降 LIGHT，
 *     trace 记 low_intake_before_session——「饮食影响锻炼」的显式通道。
 *     （短眠维度上游 f_training_state 已判：< 6 时即降 LIGHT，本门只补饮食维度。）
 *  6. 组合与目标联动：增肌 → 分化（top2 部位）、减脂/维持/未设 → 全身（top3 部位）。
 */

import type { BodyweightExercise, FitnessGoal, WorkoutRecord } from '../types/health';
import { TRAINING_POLICY } from './policy';
import {
  EXERCISE_LIBRARY,
  exerciseByName,
  exerciseFamily,
  type ExerciseTemplate,
  type MovementPattern,
} from '../data/exercises';

// ---------------- 台账（每练都入账，影响下一练） ----------------

export interface PatternLedgerEntry {
  lastTrainedDate: string | null;
  /** 距今天数（仅 7 天窗口内有记录时）。 */
  daysSince: number | null;
  /** 近 7 天该模式累计组数。 */
  weekSets: number;
}

export type PatternLedger = Partial<Record<MovementPattern, PatternLedgerEntry>>;

const dayMs = 24 * 60 * 60 * 1000;

function dateKeyMs(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * 近 7 天训练台账（含未练模式缺席，不编造 0 日）。
 * 只数 completed 的训练——计划未执行不得记入缺口。
 */
export function muscleGroupLedger(recentWorkouts: WorkoutRecord[], now: Date): PatternLedger {
  const ledger: PatternLedger = {};
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  for (const w of recentWorkouts) {
    if (!w.completed) continue;
    const ms = dateKeyMs(w.date);
    if (ms === null) continue;
    const days = Math.round((todayMs - ms) / dayMs);
    if (days < 0 || days > 6) continue; // trailing 7 天窗口（含今日）
    for (const ex of w.exercises) {
      const pattern =
        ex.movementPattern ?? exerciseByName(ex.name)?.movementPattern;
      if (!pattern) continue; // 认不出模式的动作如实跳过，不猜
      const entry = (ledger[pattern] ??= { lastTrainedDate: null, daysSince: null, weekSets: 0 });
      entry.weekSets += ex.sets;
      if (entry.lastTrainedDate === null || w.date > entry.lastTrainedDate) {
        entry.lastTrainedDate = w.date;
        entry.daysSince = days;
      }
    }
  }
  return ledger;
}

// ---------------- 动作族历史（进阶依据） ----------------

interface FamilyHistory {
  /** 上次训练所在日期（7 天窗口内）。 */
  lastDate: string;
  /** 上次练到的阶梯。 */
  lastTier: number;
  daysSince: number;
}

function familyHistory(recentWorkouts: WorkoutRecord[], now: Date): Map<string, FamilyHistory> {
  const hist = new Map<string, FamilyHistory>();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  for (const w of recentWorkouts) {
    if (!w.completed) continue;
    const ms = dateKeyMs(w.date);
    if (ms === null) continue;
    const days = Math.round((todayMs - ms) / dayMs);
    if (days < 0 || days > 6) continue;
    for (const ex of w.exercises) {
      const tpl = exerciseByName(ex.name);
      if (!tpl) continue;
      const prev = hist.get(tpl.family);
      if (!prev || w.date > prev.lastDate || (w.date === prev.lastDate && tpl.tier > prev.lastTier)) {
        hist.set(tpl.family, { lastDate: w.date, lastTier: tpl.tier, daysSince: days });
      }
    }
  }
  return hist;
}

// ---------------- 选择会话 ----------------

export interface SessionPlanInput {
  /** f_training_state 的判定（A1 门已过：非 REST/RECOVERY）。 */
  state: 'NORMAL' | 'LIGHT';
  goal: FitnessGoal | undefined;
  /** 每日时间预算（分钟）；调用方已由档案取值并夹到政策上下限。 */
  budgetMinutes: number;
  ledger: PatternLedger;
  recentWorkouts: WorkoutRecord[];
  /** 今日摄入达成（相对今日之标；无目标/无记录为 null）。 */
  intake: { kcalRatio: number | null; proteinRatio: number | null };
  now: Date;
}

export interface SessionPlan {
  /** 摄入门可能把 NORMAL 降为 LIGHT。 */
  state: 'NORMAL' | 'LIGHT';
  title: string;
  sessionType: 'Normal session' | 'Light session';
  durationMinutes: number;
  exercises: BodyweightExercise[];
  focusPatterns: MovementPattern[];
  reason: string;
  ruleId: string;
  ruleName: string;
  /** 除主规则外一并入 trace 的规则 id（长度与 ruleStatuses 对应）。 */
  extraRuleIds: string[];
  downgraded: 'low_intake_before_session' | null;
  progressedFamilies: string[];
  notes: string[];
}

/** 聚焦部位（心肺不参与轮转评分，只作收尾候选）。 */
const FOCUS_PATTERNS: MovementPattern[] = [
  'push',
  'lower body',
  'posterior chain',
  'core',
  'pull (limited)',
];

const PATTERN_CN: Record<string, string> = {
  push: '推·胸肩臂',
  'lower body': '下肢',
  'posterior chain': '后链',
  core: '核心',
  'pull (limited)': '拉·背臂（受限）',
  cardio: '心肺',
};

/** 目标 → 部位权重（工程启发式：增肌偏大肌群、维持均衡）。 */
function goalWeights(goal: FitnessGoal | undefined): Record<string, number> {
  if (goal === 'muscle gain') {
    return { push: 1.3, 'lower body': 1.3, 'posterior chain': 1.2, core: 1, 'pull (limited)': 1.1 };
  }
  return { push: 1, 'lower body': 1, 'posterior chain': 1, core: 1, 'pull (limited)': 1 };
}

function clampBudget(minutes: number): number {
  const P = TRAINING_POLICY.planner;
  if (!Number.isFinite(minutes)) return P.budgetDefaultMinutes;
  return Math.min(P.budgetMaxMinutes, Math.max(P.budgetMinMinutes, Math.round(minutes)));
}

/** 进阶后的目标阶梯：过恢复门 +1；库无更高阶则维持最高阶（组数另行 +1）。 */
function targetTier(hist: FamilyHistory | undefined, ladder: ExerciseTemplate[]): { tier: number; extraSet: boolean } {
  if (!hist) return { tier: ladder[0].tier, extraSet: false };
  const maxTier = ladder[ladder.length - 1].tier;
  const next = hist.lastTier + 1;
  if (next <= maxTier) return { tier: next, extraSet: false };
  return { tier: maxTier, extraSet: true };
}

/**
 * 手录动作按库补位：填 movementPattern / muscleGroups / exerciseId / progressionNote。
 * 名在库中则齐四件；不在则如实只留用户所填（台账届时按名回查，认不出即跳过）。
 */
export function hydrateExercise(
  name: string,
  sets: number,
  repsOrDuration: string
): BodyweightExercise {
  const tpl = exerciseByName(name);
  const base: BodyweightExercise = { name, sets, repsOrDuration };
  if (!tpl) return base;
  return {
    ...base,
    movementPattern: tpl.movementPattern,
    muscleGroups: tpl.muscleGroups,
    exerciseId: `${tpl.family}-t${tpl.tier}`,
    progressionNote: tpl.progressionNote,
  };
}

export function selectSession(input: SessionPlanInput): SessionPlan {
  const P = TRAINING_POLICY.planner;
  const budget = clampBudget(input.budgetMinutes);
  const notes: string[] = [];

  // ---- 摄入就绪门：饮食影响锻炼的显式通道 ----
  // 短眠维度上游 f_training_state 已判（< shortSleepHours 即 LIGHT），此门只补饮食维度。
  let state = input.state;
  let downgraded: SessionPlan['downgraded'] = null;
  const kcalLow =
    input.intake.kcalRatio !== null && input.intake.kcalRatio < P.intakeReadyRatio;
  const proteinLow =
    input.intake.proteinRatio !== null && input.intake.proteinRatio < P.intakeReadyRatio;
  if (state === 'NORMAL' && (kcalLow || proteinLow)) {
    state = 'LIGHT';
    downgraded = 'low_intake_before_session';
    notes.push('今日食入未半，常规课降为轻量');
  }

  // ---- 部位评分：周缺口 × 恢复门 × 目标权重 ----
  const weights = goalWeights(input.goal);
  const scored = FOCUS_PATTERNS.map((p) => {
    const entry = input.ledger[p];
    const target = P.weeklyPatternSets[p] ?? 6;
    const deficit = entry ? Math.max(0, target - entry.weekSets) : target;
    const recovered = !entry || entry.daysSince === null || entry.daysSince >= P.recoveryGapDays;
    const score = (deficit + 1) * (recovered ? 1 : 0.35) * (weights[p] ?? 1);
    return { pattern: p, score, recovered, deficit, daysSince: entry?.daysSince ?? null };
  }).sort((a, b) => (b.score - a.score) || a.pattern.localeCompare(b.pattern));

  const focusCount = state === 'LIGHT' ? 2 : input.goal === 'muscle gain' ? 2 : 3;
  const focus = scored.slice(0, focusCount);
  const focusPatterns = focus.map((f) => f.pattern);
  notes.push(
    focus
      .map((f) => `${PATTERN_CN[f.pattern]}缺口 ${f.deficit} 组${f.daysSince === null ? '（近七日未练）' : `，距上次 ${f.daysSince} 天`}`)
      .join('；')
  );

  const hist = familyHistory(input.recentWorkouts, input.now);
  // 减脂课先给心肺收尾留位（否则贪心装箱会把余量吃净，收尾永远排不上）
  const wantsFinisher = input.goal === 'fat loss' && state === 'NORMAL';
  const finisherReserve = wantsFinisher
    ? Math.max(
        0,
        ...EXERCISE_LIBRARY.filter((t) => t.finisher === true).map((t) => t.estMinutes)
      )
    : 0;
  const cap = budget - P.warmupReserveMinutes - finisherReserve;

  // ---- 预算贪心：复合优先、恢复门内轮转、估计分钟装箱 ----
  const picked: ExerciseTemplate[] = [];
  const progressed: string[] = [];
  let used = 0;
  const maxPerPattern = state === 'LIGHT' ? 2 : 3;
  let grew = true;
  while (grew && used < cap) {
    grew = false;
    for (const f of focus) {
      if (picked.filter((t) => t.movementPattern === f.pattern).length >= maxPerPattern) continue;
      const cands = EXERCISE_LIBRARY.filter(
        (t) => t.movementPattern === f.pattern && !picked.some((x) => x.family === t.family)
      );
      if (cands.length === 0) continue;
      // 恢复门：同族未过门则换族；全族未过门时才放行（记 note，不空课）
      let pool = cands.filter((t) => {
        const h = hist.get(t.family);
        return !h || h.daysSince >= P.recoveryGapDays;
      });
      if (pool.length === 0) {
        pool = cands;
        notes.push(`${PATTERN_CN[f.pattern]}各族未全过恢复门，取其中基础动作`);
      }
      // 每族取进阶后的阶梯，复合优先，再按估时升序（短者先入箱）
      const ladderPicks = pool.map((t) => {
        const ladder = exerciseFamily(t.family);
        const { tier, extraSet } = targetTier(hist.get(t.family), ladder);
        const base = ladder.find((e) => e.tier === tier) ?? ladder[0];
        const entry: ExerciseTemplate = extraSet
          ? { ...base, sets: Math.min(4, base.sets + 1) }
          : base;
        return entry;
      });
      ladderPicks.sort(
        (a, b) =>
          Number(b.compound) - Number(a.compound) ||
          a.estMinutes - b.estMinutes ||
          // 同价取已过门且有历史者：进阶动作优先出列（否则中文名排序会把进阶挤出预算）
          Number(hist.has(b.family)) - Number(hist.has(a.family)) || // 有历史者排前
          a.name.localeCompare(b.name)
      );
      const fit = ladderPicks.find((t) => used + t.estMinutes <= cap);
      if (!fit) continue;
      picked.push(fit);
      used += fit.estMinutes;
      const h = hist.get(fit.family);
      if (h && targetTier(h, exerciseFamily(fit.family)).tier > h.lastTier) progressed.push(fit.family);
      grew = true;
      if (used >= cap) break;
    }
  }

  // ---- 减脂收尾：给收尾留出的位，装一条心肺 ----
  if (wantsFinisher) {
    const finishers = EXERCISE_LIBRARY.filter(
      (t) =>
        t.finisher === true &&
        !picked.some((x) => x.family === t.family) &&
        used + t.estMinutes <= cap + finisherReserve
    ).sort((a, b) => a.estMinutes - b.estMinutes || a.name.localeCompare(b.name));
    if (finishers.length > 0) {
      picked.push(finishers[0]);
      used += finishers[0].estMinutes;
      notes.push(`减脂课留位，收一条心肺收尾：${finishers[0].name}`);
    } else {
      notes.push('预算过紧，心肺收尾未排入（如实不编）');
    }
  }

  const exercises: BodyweightExercise[] = picked.map((t) => ({
    name: t.name,
    sets: t.sets,
    repsOrDuration: t.repsOrDuration,
    progressionNote: t.progressionNote,
    movementPattern: t.movementPattern,
    muscleGroups: t.muscleGroups,
    exerciseId: `${t.family}-t${t.tier}`,
  }));
  const durationMinutes = Math.max(1, used);
  const focusCN = focusPatterns.map((p) => PATTERN_CN[p]).join('·');

  // ---- 标题与理由（语气：御批奏折；不得称「俱足/俱佳」） ----
  let title: string;
  let reason: string;
  if (state === 'LIGHT') {
    title = `徒手轻量循环（${durationMinutes} 分钟）`;
    reason = downgraded
      ? '今日食入未半，先以轻量组合唤醒肌群，能量不足时不强训；此练亦入台账，明日续排。'
      : `今日以${focusCN}轻量组合，留恢复之余地；练皆入账，明日之课由此续排。`;
  } else if (input.goal === 'muscle gain') {
    title = `${focusCN}分化循环（${durationMinutes} 分钟）`;
    reason = `依体征档之目标与今日时间之预算，按近七日${focusCN}部位缺口与恢复门轮转排课；每练皆入台账，后日之课由此续排。`;
  } else if (input.goal === 'fat loss') {
    title = `全身燃动循环（${durationMinutes} 分钟）`;
    reason = `按近七日部位缺口排全身循环并留心肺收尾；饮食之盈亏与训练之消耗同记一账，明日之课由今日之练续排。`;
  } else {
    title = `徒手全身循环（${durationMinutes} 分钟）`;
    reason = `依今日${focusCN}之时间预算与近七日缺口轮转排定；每练皆入台账，明日之课由此续排。`;
  }

  return {
    state,
    title,
    sessionType: state === 'LIGHT' ? 'Light session' : 'Normal session',
    durationMinutes,
    exercises,
    focusPatterns,
    reason,
    ruleId: downgraded ? 'RULE_WORKOUT_PLAN_INTAKE_GATE_02' : 'RULE_WORKOUT_PLAN_SELECT_01',
    ruleName: downgraded ? '摄入就绪降档门' : '台账轮转预算贪心排课',
    extraRuleIds: downgraded ? ['RULE_WORKOUT_PLAN_SELECT_01'] : [],
    downgraded,
    progressedFamilies: progressed,
    notes,
  };
}
