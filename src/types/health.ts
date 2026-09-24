/**
 * Personal Health Coach - V2.1 Lean & Scientific Type Definitions
 * 
 * Strict separation of:
 * 1. Evidence-derived model (formula & numbers explicitly provided by literature)
 * 2. Evidence-constrained model (ranges & directions provided by science, translated by rules)
 * 3. Engineering heuristic (practical product logic, explicitly marked as heuristic)
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
    | 'autoregulation_framework';
  topic: 'nutrition' | 'exercise' | 'metabolism' | 'recovery';
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
  estimatedCalories: number; // Midpoint for logging convenience
  estimatedProtein: number;  // Midpoint for logging convenience
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

export interface HealthContext {
  profile: UserProfile;
  currentWeight: number;
  todayState: DailyState;
  todayMeals: MealRecord[];
  recentMeals: MealRecord[];
  recentWorkouts: WorkoutRecord[];
  todayWorkout?: WorkoutRecord;
  hasIncompleteData?: boolean;
}

export interface TodayData {
  date: string;
  displayDate: string; // "Thursday, September 24"
  timeGreeting: string; // "Good morning." / "Good afternoon." / "Good evening."
  profile: UserProfile;
  weight: {
    current: number;
    monthDelta: number; // e.g. -0.8
  };
  state: DailyState;
  nutritionSummary: {
    consumedCalories: number;
    targetCalories: number;
    consumedProtein: number;
    targetProtein: number;
    meals: MealRecord[];
  };
  nextMeal: MealRecommendation;
  nextWorkout: WorkoutRecommendation;
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
