/**
 * Personal Health Coach · Living Journal (V3 Product Definition)
 *
 * Strict three domains:
 * 1. TODAY: Daily action items (Todos, Daily Note, "+ Record")
 * 2. BODY: Current physiological state, Next Meal, Next Workout, Weight trend & forecast
 * 3. LIFE: Longitudinal activity hours (Coding, Learning, Exercise, Reading) & Recent moments
 *
 * Strict scientific model categorization:
 * - evidence_derived: Direct formulas/equations from literature (e.g. Mifflin-St Jeor 1990)
 * - evidence_constrained: Constraints/ranges from meta-analyses/guidelines (e.g. Morton 2018, WHO diet)
 * - engineering_heuristic: Product logic/rules bridging practice (e.g. energy threshold, meal ranking)
 *
 * LLM = OFF. Deterministic TypeScript pure functions: y = f(x).
 */

export type FitnessGoal = 'fat loss' | 'maintain' | 'muscle gain' | 'general fitness';

export interface UserProfile {
  name: string;
  age: number;
  sex: 'female' | 'male' | 'other';
  height: number; // cm
  currentWeight: number; // kg
  goal: FitnessGoal;
  dailyCalorieTarget: number;
  dailyProteinTarget: number; // grams
}

export interface WeightRecord {
  id: string;
  /** 本地日键 YYYY-MM-DD —— 唯一的窗口判定字段。 */
  date: string;
  weight: number; // kg
  note?: string;
  /** 测量来源；原始体重只能来自这里，没有第二份「今之体重」。 */
  source: 'manual' | 'scale';
  /** 同日多条的排序依据（HH:MM），缺省视为当日唯一。 */
  time?: string;
}

/**
 * 睡眠的唯一事实来源：区间（由时刻推得时长）与手录眠时二者互斥，
 * 因此不会出现 duration 与 bedtime/wakeTime 互相打架。
 */
export type SleepEntry =
  | { kind: 'interval'; sleepStart: string; wakeTime: string }
  | { kind: 'duration'; minutes: number };

/**
 * 今日体感的条目：字段可缺席（用户可能只记了酸痛）。
 * 缺席即「未录」，绝不填默认值冒充记录。
 */
export interface DailyState {
  date: string; // YYYY-MM-DD
  sleep?: SleepEntry;
  energy?: number; // 1 - 5 (1=low, 5=high)
  soreness?: number; // 1 - 5 (1=none, 5=high)
  notes?: string;
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** 实际摄入（MealLog）。计划膳是 MealRecommendation，永不自动进入此表。 */
export interface MealRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // "12:30"
  category: MealCategory;
  name: string;
  foods: string[];
  estimatedCalories: number;
  estimatedProtein: number; // grams
  /** 手录 / 采纳建议（一键照准）/ 食物库。 */
  source: 'manual' | 'suggested' | 'database';
  /** 只有确认入账的记录才计入今日所食。 */
  confirmed: boolean;
}

export interface BodyweightExercise {
  name: string;
  sets: number;
  repsOrDuration: string; // e.g. "12 reps", "8-12 reps", "30 sec"
  progressionNote?: string;
  movementPattern?: 'push' | 'lower body' | 'core' | 'posterior chain' | 'pull (limited)';
}

export type PerceivedDifficulty = 'light' | 'moderate' | 'challenging';

/** 训练分类是结构化事实，抗阻统计只认它，绝不靠标题文字判断。 */
export type WorkoutCategory = 'resistance' | 'recovery' | 'cardio' | 'mobility' | 'other';

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  durationMinutes: number;
  /** 时长来源：用户计时/时段差 = actual，产品估算 = estimated（二者不可混称）。 */
  durationSource: 'actual' | 'estimated';
  exercises: BodyweightExercise[];
  perceivedDifficulty: PerceivedDifficulty;
  completed: boolean;
  feeling?: string;
  category: WorkoutCategory;
}

// ==========================================
// Scientific Audit & Evidence Classification
// ==========================================

export type RuleStatus =
  | 'evidence_derived'
  | 'evidence_constrained'
  | 'engineering_heuristic';

export type TrainingState =
  | 'REST'
  | 'RECOVERY'
  | 'LIGHT'
  | 'NORMAL';

export interface EvidenceReference {
  id: string;
  title: string;
  authors?: string;
  organization?: string;
  year: number;
  sourceType:
    | 'prediction_equation'
    | 'systematic_review_meta_analysis'
    | 'review_practical_recommendation'
    | 'position_stand'
    | 'public_health_guideline'
    | 'autoregulation_framework'
    | 'dynamic_energy_model';
  topic: 'nutrition' | 'exercise' | 'metabolism' | 'recovery' | 'sleep';
  claim: string;
  limitations: string;
  url?: string;
}

export interface RecommendationEvidenceTrace {
  evidenceId: string;
  relevance: string;
  evidenceStrength: 'High' | 'Moderate' | 'Limited';
  reference: EvidenceReference;
}

export interface DecisionTrace {
  inputSnapshot: Record<string, unknown>;
  derivedValues: Record<string, unknown>;
  ruleIds: string[];
  ruleStatuses: RuleStatus[];
  evidenceIds: string[];
  assumptions: string[];
  limitations: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface EnergyCalibration {
  estimatedMaintenanceRange: { min: number; max: number };
  confidence: 'low' | 'medium' | 'high';
  method: string;
  notes: string;
}

// Next Action Recommendations
export interface MealRecommendation {
  mealName: string;
  suggestedItems: string[];
  estimatedCalories: number; // Midpoint for quick logging
  estimatedProtein: number;  // Midpoint for quick logging
  energyRange: { min: number; max: number }; // Honest estimated energy range (no fake single integer)
  proteinRange: { min: number; max: number }; // Honest protein range
  reason: string;
  ruleId: string;
  ruleName: string;
  ruleStatus: RuleStatus;
  trace: DecisionTrace;
  evidenceTraces: RecommendationEvidenceTrace[];
  isUncertaintyNoted?: boolean;
  uncertaintyMessage?: string;
}

export interface WorkoutRecommendation {
  title: string;
  sessionType: 'Normal session' | 'Light session' | 'Recovery session' | 'Rest';
  trainingState: TrainingState;
  trainingStateHeuristicNote: string;
  durationMinutes: number;
  /** 建议时长是估算（计划），不得当作用户实际计时。 */
  durationSource: 'estimated';
  reason: string;
  exercises: BodyweightExercise[];
  recoveryGuidance: string;
  progressionTip?: string;
  equipmentCoverage: {
    push: 'well covered';
    lowerBody: 'well covered';
    core: 'well covered';
    posteriorChain: 'moderately covered';
    pull: 'limited (no pull-up bar / external equipment)';
  };
  engineeringTranslationNote: string;
  ruleId: string;
  ruleName: string;
  ruleStatus: RuleStatus;
  trace: DecisionTrace;
  evidenceTraces: RecommendationEvidenceTrace[];
  isUncertaintyNoted?: boolean;
}

// ==========================================
// V3 New Models: Trends, Forecasts, Food & Diet
// ==========================================

export interface ForecastPeriod {
  weeks: number;
  range: { min: number; max: number }; // kg range e.g. { min: 67.6, max: 68.3 }
  unit: string;
  label: string;
}

/**
 * 体重区间推演：明确是「情景外推（trend projection）」，不是承诺、不是目标、
 * 也不得与实测混为一谈；`withheld` 表示因数据存疑/不足而不出数。
 */
export interface WeightForecast {
  fourWeeks: ForecastPeriod;
  eightWeeks: ForecastPeriod;
  twelveWeeks: ForecastPeriod;
  confidence: 'low' | 'medium' | 'high';
  /** 模型出处，页面必须展示。 */
  modelVersion: string;
  method: 'scenario_trend_projection';
  /** 推演依据的窗口与有效日数。 */
  inputWindowDays: number;
  basedOnDays: number;
  /** 数据质量不达标时不出数。 */
  withheld: boolean;
  withheldReason?: 'insufficient_weight_days' | 'weight_deviates_from_rolling_mean';
  assumptions: string[];
  limitations: string[];
}

export interface FoodItem {
  id: string;
  name: string;
  foodGroup: 'protein' | 'vegetable' | 'fruit' | 'grain' | 'dairy' | 'fat' | 'legume';
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number; // mg
}

export interface DietQualityAssessment {
  scoreCategory: 'optimal' | 'adequate' | 'needs_attention';
  fruitAndVegetableServings: number;
  fiberGrams: number;
  wholeGrainsPresent: boolean;
  excessFreeSugar: boolean;
  foodDiversityScore: number;
  ruleStatus: 'evidence_constrained';
  constraintsNotes: string[];
  evidenceIds: string[];
}

// ==========================================
// V3 Journal & Life Domain Types
// ==========================================

export interface TodoItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  /** 计划用时（拟），不是实际时长记录。 */
  estimatedMinutes?: number;
  priority?: 'low' | 'medium' | 'high';
  /** 完成与否只由 status 决定，不由「有时长」反推。 */
  status: 'todo' | 'done' | 'skipped';
  category?: 'workout' | 'reading' | 'work' | 'life';
}

export type LifeCategory = 'Coding' | 'Learning' | 'Exercise' | 'Reading' | 'Life';

/** 活动记录（ActivityLog）与手记（JournalEntry）共用一张表：有 content 即手记，有时长即活动。 */
export interface LifeLog {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  /** 可以留空：只记时长的手帐行。 */
  content?: string;
  category: LifeCategory;
  durationMinutes: number;
  project?: string;
}

export interface DailyNote {
  id: string;
  date: string;
  content: string;
  tags: string[];
  timestamp: string;
}

// Context passed to Decision Engine
export interface HealthContext {
  /**
   * Injected wall clock. The engine reads time ONLY from here — never from
   * `new Date()` — so a decision is reproducible for a given input, and a
   * server-side recompute of the same context yields the same answer.
   */
  now: Date;
  profile: UserProfile;
  currentWeight: number;
  todayState: DailyState;
  todayMeals: MealRecord[];
  recentMeals: MealRecord[];
  recentWorkouts: WorkoutRecord[];
  weightHistory?: WeightRecord[];
  todayWorkout?: WorkoutRecord;
  /** 由 domain/decideWorkoutMode 预先算出的决策（传入即复用，避免二次推断）。 */
  trainingDecision?: import('../domain/types').WorkoutDecision;
  hasIncompleteData?: boolean;
}

/**
 * 页面视图模型 = 原始记录（今日切片）+ 派生指标 + 决策结果。
 * 展示层只读不改算：任何数字都能在 domain/ 里找到唯一公式。
 */
export interface TodayData {
  date: string;
  displayDate: string; // "丙午年 · 九月廿五 · 星期五"
  timeGreeting: string; // "朝安。/昼安。/夜安。"
  profile: UserProfile;
  /** Which meal the current recommendation targets (same rule as f_meal). */
  mealSlot: 'breakfast' | 'lunch' | 'dinner';

  // ---- 原始记录（今日切片） ----
  todos: TodoItem[];
  notes: DailyNote[];
  todayMeals: MealRecord[];

  // ---- 派生指标 ----
  tasks: import('../domain/types').TaskProgress;
  weight: import('../domain/types').WeightSummary;
  nutrition: import('../domain/types').NutritionSummary;
  sleep: import('../domain/types').SleepSummary;
  activity: import('../domain/types').ActivitySummary;
  journal: import('../domain/types').JournalSummary;
  state: DailyState;
  /** 图表输入：近三十日每日代表值（升序）。 */
  weightSeries: { date: string; weight: number }[];

  // ---- 决策与模型 ----
  training: import('../domain/types').TrainingSummary;
  dataQuality: {
    flags: import('../domain/types').DataQuality[];
    reviewCount: number;
  };
  forecast: WeightForecast;
  nextMeal: MealRecommendation;
  nextWorkout: WorkoutRecommendation;
  dietQuality: DietQualityAssessment;
}

// Inputs for creation
export interface CreateMealInput {
  date?: string;
  time?: string;
  category: MealCategory;
  name: string;
  foods?: string[];
  estimatedCalories: number;
  estimatedProtein: number;
  /** 缺省视为手录；「照准」采纳建议时传 suggested。 */
  source?: MealRecord['source'];
}

export interface CreateWorkoutInput {
  date?: string;
  time?: string;
  title: string;
  durationMinutes: number;
  /** 缺省 estimated：由产品估算；用户计时才传 actual。 */
  durationSource?: WorkoutRecord['durationSource'];
  exercises: BodyweightExercise[];
  perceivedDifficulty?: PerceivedDifficulty;
  completed?: boolean;
  feeling?: string;
  category?: WorkoutCategory;
}

export interface CreateDailyStateInput {
  date?: string;
  weight?: number;
  weightTime?: string;
  /** 未传则保留当日既有之眠。 */
  sleep?: SleepEntry;
  energy?: number;
  soreness?: number;
  notes?: string;
}

export interface CreateTodoInput {
  title: string;
  estimatedMinutes?: number;
  priority?: 'low' | 'medium' | 'high';
  category?: 'workout' | 'reading' | 'work' | 'life';
}

export interface CreateLifeLogInput {
  title: string;
  content: string;
  category: LifeCategory;
  durationMinutes: number;
  project?: string;
}

export interface CreateNoteInput {
  content: string;
  tags?: string[];
}
