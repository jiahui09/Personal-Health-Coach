// Serif for the sheet title; the sheet clips its own scrolled content.
// 三列 = 进食/习练/体征这三个录入页签,数量由产品语义决定。
// deslop-ignore-file 07 22 28
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Utensils, Dumbbell, Activity, AlertTriangle } from 'lucide-react';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  MealCategory,
  SleepEntry,
  WorkoutCategory,
} from '../types/health';
import { intervalMinutes } from '../domain/sleep';
import { formatNightDuration } from '../domain/format';

export type RecordTab = 'meal' | 'workout' | 'body';

export interface RecordDefaults {
  weight?: number;
  sleepStart?: string;
  wakeTime?: string;
  sleepMinutes?: number;
  energy?: number;
  soreness?: number;
}

interface RecordSheetProps {
  isOpen: boolean;
  initialTab?: RecordTab;
  onClose: () => void;
  /** Save handlers resolve false when the write failed; App already toasted the reason. */
  onSaveMeal: (input: CreateMealInput) => Promise<boolean>;
  onSaveWorkout: (input: CreateWorkoutInput) => Promise<boolean>;
  onSaveDailyState: (input: CreateDailyStateInput) => Promise<boolean>;
  /** 今日已入账之食；未传则不显示累计。 */
  todayIntake?: { mealCount: number; caloriesKcal: number; proteinG: number };
  /** 今日既有记录（缺省即「未录」，绝不预填假数）。 */
  defaults?: RecordDefaults;
  /** 体重偏离近七日均重时的提示句；返回 null 表示在常度之内。 */
  weightWarningFor?: (value: number) => string | null;
}

const WORKOUT_CATEGORY_CN: Record<WorkoutCategory, string> = {
  resistance: '抗阻',
  recovery: '恢复',
  cardio: '有氧',
  mobility: '柔韧',
  other: '其他',
};

export const RecordSheet: React.FC<RecordSheetProps> = ({
  isOpen,
  initialTab = 'meal',
  onClose,
  onSaveMeal,
  onSaveWorkout,
  onSaveDailyState,
  todayIntake,
  defaults,
  weightWarningFor,
}) => {
  const [tab, setTab] = useState<RecordTab>(initialTab);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Meal Form States
  const [mealCategory, setMealCategory] = useState<MealCategory>('dinner');
  const [foodText, setFoodText] = useState('');
  const [mealCalories, setMealCalories] = useState<number | ''>('');
  const [mealProtein, setMealProtein] = useState<number | ''>('');

  // Workout Form States
  const [workoutTitle, setWorkoutTitle] = useState('徒手基础习练');
  const [workoutCategory, setWorkoutCategory] = useState<WorkoutCategory>('resistance');
  const [squatReps, setSquatReps] = useState('3 × 12');
  const [pushupReps, setPushupReps] = useState('3 × 10');
  const [lungeReps, setLungeReps] = useState('3 × 8 / 侧');
  const [plankTime, setPlankTime] = useState('3 × 30 秒');
  const [workoutDuration, setWorkoutDuration] = useState<number | ''>(20);
  const [durationSource, setDurationSource] = useState<'actual' | 'estimated'>('estimated');

  // Body & State & Sleep Form States
  const [weight, setWeight] = useState<number | ''>('');
  const [weightAck, setWeightAck] = useState(false);
  const [sleepMode, setSleepMode] = useState<'interval' | 'duration'>('interval');
  const [sleepStart, setSleepStart] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [sleepMinutes, setSleepMinutes] = useState<number | ''>('');
  const [energy, setEnergy] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [stateNotes, setStateNotes] = useState('');

  // Re-sync to the requested tab (and today's actual values) each time the sheet opens.
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setIsSavedFeedback(false);
      setIsSubmitting(false);
      setWeight(defaults?.weight ?? '');
      setWeightAck(false);
      setSleepStart(defaults?.sleepStart ?? '');
      setWakeTime(defaults?.wakeTime ?? '');
      setSleepMinutes(defaults?.sleepMinutes ?? '');
      setSleepMode(defaults?.sleepStart && defaults?.wakeTime ? 'interval' : defaults?.sleepMinutes ? 'duration' : 'interval');
      setEnergy(defaults?.energy ?? null);
      setSoreness(defaults?.soreness ?? null);
    }
  }, [isOpen, initialTab, defaults]);

  const sleepIntervalPreview = useMemo(() => {
    if (sleepMode !== 'interval' || !sleepStart || !wakeTime) return null;
    return intervalMinutes(sleepStart, wakeTime);
  }, [sleepMode, sleepStart, wakeTime]);

  if (!isOpen) return null;

  const weightWarning = typeof weight === 'number' && weightWarningFor ? weightWarningFor(weight) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 体重越常度需二次确认：只提示，绝不替用户改数
    if (tab === 'body' && weightWarning && !weightAck) {
      setWeightAck(true);
      return;
    }

    setIsSubmitting(true);

    try {
      let saved = true;

      if (tab === 'meal') {
        const foodsArray = foodText
          .split(/[,，、\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        saved = await onSaveMeal({
          category: mealCategory,
          name: foodText,
          foods: foodsArray.length > 0 ? foodsArray : [foodText],
          estimatedCalories: Number(mealCalories) || 0,
          estimatedProtein: Number(mealProtein) || 0,
          source: 'manual',
        });
      } else if (tab === 'workout') {
        saved = await onSaveWorkout({
          title: workoutTitle,
          category: workoutCategory,
          durationMinutes: Number(workoutDuration) || 0,
          durationSource,
          exercises: [
            { name: '徒手深蹲', sets: 3, repsOrDuration: squatReps },
            { name: '标准俯卧撑', sets: 3, repsOrDuration: pushupReps },
            { name: '后退箭步蹲', sets: 3, repsOrDuration: lungeReps },
            { name: '平板支撑', sets: 3, repsOrDuration: plankTime },
          ],
          perceivedDifficulty: 'moderate',
          completed: true,
        });
      } else if (tab === 'body') {
        let sleep: SleepEntry | undefined;
        if (sleepMode === 'interval' && sleepIntervalPreview !== null) {
          sleep = { kind: 'interval', sleepStart, wakeTime };
        } else if (sleepMode === 'duration' && typeof sleepMinutes === 'number' && sleepMinutes > 0) {
          sleep = { kind: 'duration', minutes: sleepMinutes };
        }

        saved = await onSaveDailyState({
          // 未填则不写：不把默认值当记录
          weight: typeof weight === 'number' && weight > 0 ? weight : undefined,
          sleep,
          energy: energy ?? undefined,
          soreness: soreness ?? undefined,
          notes: stateNotes,
        });
      }

      // 失败：面板保持打开，提示已由 App 弹出；只有真存上了才亮勾并关闭
      if (!saved) {
        setIsSubmitting(false);
        setWeightAck(false);
        return;
      }

      setIsSavedFeedback(true);
      setTimeout(() => {
        setIsSavedFeedback(false);
        onClose();
      }, 700);
    } catch (err) {
      // Handlers own their error toasts; this guard only stops a rejected
      // handler from running the success animation.
      console.error('Failed to save record:', err);
      setIsSubmitting(false);
    }
  };

  const chipClass = (active: boolean) =>
    `py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
      active ? 'bg-ink text-white border-ink' : 'bg-surface border-control text-ink2'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full sm:max-w-lg bg-paper rounded-t-lg sm:rounded-lg border border-line shadow-md overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* deslop-ignore-next-line 19 — literal 6px status dot */}
            <span className="w-2 h-2 rounded-full bg-accent" />
            <h3 className="font-serif text-lg font-medium text-ink">录一笔</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="阖之"
            className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 p-1.5 mx-4 sm:mx-5 mt-4 bg-surface rounded-lg text-[13px] font-sans">
          {([
            ['meal', '进食', Utensils],
            ['workout', '习练', Dumbbell],
            ['body', '体征', Activity],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                tab === key ? 'bg-surface text-ink font-medium shadow-xs' : 'text-ink3 hover:text-ink'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px] font-sans">
          {tab === 'meal' && (
            <div className="space-y-3.5">
              {todayIntake && (
                <p className="text-[12px] text-ink3 tabular-nums">
                  今日已录 {todayIntake.mealCount} 膳 · {todayIntake.caloriesKcal} 千卡 ·{' '}
                  {todayIntake.proteinG} g 蛋白质
                </p>
              )}

              <div>
                <label className="block text-ink3 mb-1">餐别</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as MealCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMealCategory(cat)}
                      className={chipClass(mealCategory === cat)}
                    >
                      {cat === 'breakfast'
                        ? '早膳'
                        : cat === 'lunch'
                        ? '午膳'
                        : cat === 'dinner'
                        ? '晚膳'
                        : '小食'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-ink3 mb-1">所食之物（逗号分隔）</label>
                <input
                  type="text"
                  required
                  value={foodText}
                  onChange={(e) => setFoodText(e.target.value)}
                  className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
                  placeholder="如：去皮鸡腿、糙米饭、清炒时蔬"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink3 mb-1">约计热量 (kcal)</label>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    required
                    value={mealCalories}
                    onChange={(e) => setMealCalories(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-ink3 mb-1">约计蛋白质 (g)</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    required
                    value={mealProtein}
                    onChange={(e) => setMealProtein(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'workout' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-ink3 mb-1">练名（徒手之习）</label>
                <input
                  type="text"
                  required
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
                  placeholder="徒手自重循环"
                />
              </div>

              {/* 类别是结构化事实：抗阻统计只认它，不靠标题文字 */}
              <div>
                <label className="block text-ink3 mb-1">类别（抗阻统计据此计）</label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(WORKOUT_CATEGORY_CN) as WorkoutCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setWorkoutCategory(cat)}
                      className={chipClass(workoutCategory === cat)}
                    >
                      {WORKOUT_CATEGORY_CN[cat]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="p-2.5 rounded-lg bg-surface border border-linesoft space-y-1">
                  <div className="text-ink3">深蹲组数</div>
                  <input
                    type="text"
                    value={squatReps}
                    onChange={(e) => setSquatReps(e.target.value)}
                    className="w-full bg-surface border border-control rounded-lg px-2 py-1 text-[13px]"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-linesoft space-y-1">
                  <div className="text-ink3">俯卧撑组数</div>
                  <input
                    type="text"
                    value={pushupReps}
                    onChange={(e) => setPushupReps(e.target.value)}
                    className="w-full bg-surface border border-control rounded-lg px-2 py-1 text-[13px]"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-linesoft space-y-1">
                  <div className="text-ink3">箭步蹲组数</div>
                  <input
                    type="text"
                    value={lungeReps}
                    onChange={(e) => setLungeReps(e.target.value)}
                    className="w-full bg-surface border border-control rounded-lg px-2 py-1 text-[13px]"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-linesoft space-y-1">
                  <div className="text-ink3">平板支撑之刻</div>
                  <input
                    type="text"
                    value={plankTime}
                    onChange={(e) => setPlankTime(e.target.value)}
                    className="w-full bg-surface border border-control rounded-lg px-2 py-1 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink3 mb-1">时长（分钟）</label>
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-ink3 mb-1">时长来源</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDurationSource('actual')}
                      className={chipClass(durationSource === 'actual')}
                    >
                      实际计时
                    </button>
                    <button
                      type="button"
                      onClick={() => setDurationSource('estimated')}
                      className={chipClass(durationSource === 'estimated')}
                    >
                      产品估算
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'body' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-ink3 mb-1">今日之重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value === '' ? '' : Number(e.target.value));
                    setWeightAck(false);
                  }}
                  placeholder="未录"
                  className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                />
                {weightWarning && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-danger leading-relaxed">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      {weightWarning}
                      {weightAck ? ' —— 既已确认，仍照原数录入。' : ' —— 再点一次「照准」即照原数录入。'}
                    </span>
                  </p>
                )}
              </div>

              {/* 睡眠：时刻优先，时长由时刻推得；只记得总时长才切手录 */}
              <div className="p-3 rounded-lg bg-surface border border-linesoft space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink3">昨夜之眠</span>
                  <button
                    type="button"
                    onClick={() => setSleepMode(sleepMode === 'interval' ? 'duration' : 'interval')}
                    className="btn-link text-[12px]"
                  >
                    {sleepMode === 'interval' ? '改用手录眠时' : '改用就寝/起身时刻'}
                  </button>
                </div>

                {sleepMode === 'interval' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-ink3 mb-1 text-[12px]">就寝</label>
                      <input
                        type="time"
                        value={sleepStart}
                        onChange={(e) => setSleepStart(e.target.value)}
                        className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-ink3 mb-1 text-[12px]">起身</label>
                      <input
                        type="time"
                        value={wakeTime}
                        onChange={(e) => setWakeTime(e.target.value)}
                        className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-ink3 mb-1 text-[12px]">手录眠时（分钟）</label>
                    <input
                      type="number"
                      min="0"
                      max="840"
                      value={sleepMinutes}
                      onChange={(e) => setSleepMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
                    />
                  </div>
                )}

                <p className="text-[12px] text-ink3 tabular-nums">
                  {sleepMode === 'interval'
                    ? sleepIntervalPreview !== null
                      ? `时长由时刻推得：${formatNightDuration(sleepIntervalPreview)}`
                      : '填齐就寝与起身时刻，方得时长。'
                    : typeof sleepMinutes === 'number' && sleepMinutes > 0
                    ? `手录眠时：${formatNightDuration(sleepMinutes)}`
                    : '未填则今日之眠记为未录。'}
                </p>
              </div>

              <div>
                <label className="block text-ink3 mb-1">
                  精力（1=惫，5=充沛）{energy === null ? '：未录' : `: ${energy}/5`}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEnergy(lvl)}
                      className={chipClass(energy === lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-ink3 mb-1">
                  酸痛（1=无，5=甚）{soreness === null ? '：未录' : `: ${soreness}/5`}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSoreness(lvl)}
                      className={chipClass(soreness === lvl)}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-ink3 mb-1">随笔（可无）</label>
                <input
                  type="text"
                  value={stateNotes}
                  onChange={(e) => setStateNotes(e.target.value)}
                  className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
                  placeholder="昨夜之眠、晨起之神……"
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavedFeedback ? (
                <>
                  <Check className="w-4 h-4 text-accentbright" />
                  <span>已录于册</span>
                </>
              ) : (
                <span>{weightWarning && !weightAck ? '仍要录之' : '照准'}</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
