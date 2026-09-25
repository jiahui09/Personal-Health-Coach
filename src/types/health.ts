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
  date: string; // YYYY-MM-DD
  weight: number; // kg
  note?: string;
}

export interface DailyState {
  date: string; // YYYY-MM-DD
  sleepHours: number; // e.g. 7.33 (7h 20m)
  sleepBedtime?: string;
  sleepWakeup?: string;
  energy: number; // 1 - 5 (1=low, 5=high)
  soreness: number; // 1 - 5 (1=none, 5=high)
  notes?: string;
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // "12:30"
  category: MealCategory;
  name: string;
  foods: string[];
  estimatedCalories: number;
  estimatedProtein: number; // grams
}

export interface BodyweightExercise {
  name: string;
  sets: number;
  repsOrDuration: string; // e.g. "12 reps", "8-12 reps", "30 sec"
  progressionNote?: string;
  movementPattern?: 'push' | 'lower body' | 'core' | 'posterior chain' | 'pull (limited)';
}

export type PerceivedDifficulty = 'light' | 'moderate' | 'challenging';

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  title: string;
  durationMinutes: number;
  exercises: BodyweightExercise[];
  perceivedDifficulty: PerceivedDifficulty;
  completed: boolean;
  feeling?: string;
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

export interface WeightTrendResult {
  rollingAverage7d: number;
  trendPerWeek: number; // kg per week (e.g. -0.18)
  currentTrend: 'decreasing' | 'stable' | 'increasing';
  dataPointsCount: number;
}

export interface ForecastPeriod {
  weeks: number;
  range: { min: number; max: number }; // kg range e.g. { min: 67.6, max: 68.3 }
  unit: string;
  label: string;
}

export interface WeightForecast {
  fourWeeks: ForecastPeriod;
  eightWeeks: ForecastPeriod;
  twelveWeeks: ForecastPeriod;
  confidence: 'low' | 'medium' | 'high';
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
  estimatedMinutes?: number;
  priority?: 'low' | 'medium' | 'high';
  completed: boolean;
  category?: 'workout' | 'reading' | 'work' | 'life';
}

export type LifeCategory = 'Coding' | 'Learning' | 'Exercise' | 'Reading' | 'Life';

export interface LifeLog {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  category: LifeCategory;
  durationMinutes: number;
  project?: string;
}

export interface WeeklyLifeStat {
  category: LifeCategory;
  hours: number;
  sessions?: number;
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
  profile: UserProfile;
  currentWeight: number;
  todayState: DailyState;
  todayMeals: MealRecord[];
  recentMeals: MealRecord[];
  recentWorkouts: WorkoutRecord[];
  weightHistory?: WeightRecord[];
  todayWorkout?: WorkoutRecord;
  hasIncompleteData?: boolean;
}

// Primary Aggregated View Model for App
export interface TodayData {
  date: string;
  displayDate: string; // "Thursday, September 24"
  timeGreeting: string; // "GOOD MORNING."
  profile: UserProfile;
  weight: {
    current: number;
    monthDelta: number; // e.g. -0.8
  };
  state: DailyState;
  todos: TodoItem[];
  notes: DailyNote[];
  nutritionSummary: {
    consumedCalories: number;
    targetCalories: number;
    consumedProtein: number;
    targetProtein: number;
    meals: MealRecord[];
  };
  nextMeal: MealRecommendation;
  nextWorkout: WorkoutRecommendation;
  dietQuality: DietQualityAssessment;
  weightTrend: WeightTrendResult;
  weightForecast: WeightForecast;
  recentLifeLogs: LifeLog[];
  weeklyLifeStats: WeeklyLifeStat[];
  recentStats: {
    weightChange30d: number;
    workoutsThisWeek: number;
    avgDailyProtein: number;
    avgSleepHours: number;
  };
  personalNote: string;
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
}

export interface CreateWorkoutInput {
  date?: string;
  time?: string;
  title: string;
  durationMinutes: number;
  exercises: BodyweightExercise[];
  perceivedDifficulty?: PerceivedDifficulty;
  completed?: boolean;
  feeling?: string;
}

export interface CreateDailyStateInput {
  date?: string;
  weight?: number;
  sleepHours: number;
  energy: number;
  soreness: number;
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
