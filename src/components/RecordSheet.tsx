// Serif for the sheet title; the sheet clips its own scrolled content.
// 三列 = 进食/习练/体征这三个录入页签,数量由产品语义决定。
// 版式与主页同源：墨线版框、三签下划线签、组题分段、无阴影无卡片。
// deslop-ignore-file 07 22 28
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, Utensils, Dumbbell, Activity, AlertTriangle } from 'lucide-react';
import {
  FoodItem,
  MealItem,
  BodyweightExercise,
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  MealCategory,
  SleepEntry,
  WorkoutCategory,
} from '../types/health';
import { intervalMinutes } from '../domain/sleep';
import { hydrateExercise } from '../domain/trainingPlan';
import { foodItemNutrition, sumMealItems } from '../domain/nutrition';
import { COMMON_FOOD_DATABASE, foodById } from '../data/foods';
import { formatNightDuration } from '../domain/format';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import { DotScale, energyWord, sorenessWord } from './DotScale';

export type RecordTab = 'meal' | 'workout' | 'body';

export interface RecordDefaults {
  weight?: number;
  sleepStart?: string;
  wakeTime?: string;
  sleepMinutes?: number;
  energy?: number;
  soreness?: number;
  /** 今日已有的随笔（有则预填，不被空提交抹掉）。 */
  note?: string;
  /** 今日之荐（训练规划器所排；有则习练页按此预填）。 */
  workoutTitle?: string;
  workoutExercises?: BodyweightExercise[];
  workoutDuration?: number;
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

/** 表单控件共用一笔（16px 防 iOS 聚焦缩放；焦点墨线由全局提供）。 */
const INPUT =
  'w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent';

/** 组题：与主页 .group-head 同款，配点线分段，不设卡片底（须在模块作用域,免得每次渲染重挂输入）。 */
const Group: React.FC<{ title: string; children: React.ReactNode; first?: boolean }> = ({
  title,
  children,
  first,
}) => (
  <div className={first ? '' : 'pt-3.5 mt-1 border-t border-dotted border-linehover'}>
    <span className="group-head">{title}</span>
    <div className="mt-2">{children}</div>
  </div>
);

/** 无荐时的默认课表（动作名与库对齐，部位随库补位）。 */
function fallbackWorkoutRows(): BodyweightExercise[] {
  return [
    hydrateExercise('徒手深蹲', 3, '12 次'),
    hydrateExercise('标准俯卧撑', 3, '8–10 次'),
    hydrateExercise('交替后箭步蹲', 3, '每侧 8 次'),
    hydrateExercise('平板支撑', 3, '30 秒'),
  ];
}

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
  /** 体征页空录之戒：一字未填时给一句提示,不发空请求。 */
  const [formHint, setFormHint] = useState<string | null>(null);

  // Meal Form States
  const [mealCategory, setMealCategory] = useState<MealCategory>('dinner');
  const [foodText, setFoodText] = useState('');
  const [mealCalories, setMealCalories] = useState<number | ''>('');
  const [mealProtein, setMealProtein] = useState<number | ''>('');

  // Workout Form States（习练行依今日之荐预填；组数与次数逐行可改）
  const [workoutTitle, setWorkoutTitle] = useState('徒手基础习练');
  const [workoutCategory, setWorkoutCategory] = useState<WorkoutCategory>('resistance');
  const [workoutRows, setWorkoutRows] = useState<BodyweightExercise[]>(() => fallbackWorkoutRows());
  /** 库选行（食物库 → 折算之账）；空即手录模式。 */
  const [pickedRows, setPickedRows] = useState<{ foodId: string; gramsText: string }[]>([]);
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

  // 库选折算：每行按克数换算，合计回填约计（全走 domain，组件内无业务算术）
  const pickedLines = useMemo(
    () =>
      pickedRows.map((r) => {
        const food = foodById(r.foodId);
        const raw = Number(r.gramsText.trim());
        const grams = Number.isFinite(raw) && raw > 0 ? raw : 0;
        return { ...r, food, item: food ? foodItemNutrition(food, grams) : null };
      }),
    [pickedRows]
  );
  const pickedItems = useMemo(
    () => pickedLines.map((l) => l.item).filter((x): x is MealItem => x !== null),
    [pickedLines]
  );
  const pickedTotals = pickedItems.length > 0 ? sumMealItems(pickedItems) : null;
  // 搜索建议：仅作可选项陈列，不自动入账（查无此物时手录照旧可用）
  const foodMatches = useMemo(() => {
    const q = foodText.trim();
    if (!q) return [];
    const tokens = q.split(/[,，、\s]+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return COMMON_FOOD_DATABASE.filter((f) => tokens.some((t) => f.name.includes(t))).slice(0, 6);
  }, [foodText]);

  // Esc 阖之、点遮罩阖之、开时锁背景滚动、阖时焦点归位（三弹层共用）
  const { panelRef, backdropProps } = useSheetBehavior(isOpen, onClose);

  // Re-sync to the requested tab (and today's actual values) each time the sheet opens.
  // defaults 走 ref 取最新值：依赖项只认「开合与页签」，页面别处的重渲染不会
  // 中途回来清掉用户正在填写的内容；每回开启时则一律回到今日之实与空白。
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  useEffect(() => {
    if (!isOpen) return;
    const d = defaultsRef.current;
    setTab(initialTab);
    setIsSavedFeedback(false);
    setIsSubmitting(false);
    setFormHint(null);
    // 进食页：上回所书不带到下一回（速记不留残稿）
    setFoodText('');
    setMealCalories('');
    setMealProtein('');
    setPickedRows([]);
    // 习练页：依今日之荐预填；休整无荐则回默认课表
    setWorkoutTitle(d?.workoutTitle ?? '徒手基础习练');
    setWorkoutCategory('resistance');
    setWorkoutRows(
      d?.workoutExercises && d.workoutExercises.length > 0
        ? d.workoutExercises.map((ex) => ({ ...ex }))
        : fallbackWorkoutRows()
    );
    setWorkoutDuration(d?.workoutDuration ?? 20);
    setDurationSource('estimated');
    // 体征页：预填今日既有之录，未录即空白
    setWeight(d?.weight ?? '');
    setWeightAck(false);
    setSleepStart(d?.sleepStart ?? '');
    setWakeTime(d?.wakeTime ?? '');
    setSleepMinutes(d?.sleepMinutes ?? '');
    setSleepMode(d?.sleepStart && d?.wakeTime ? 'interval' : d?.sleepMinutes ? 'duration' : 'interval');
    setEnergy(d?.energy ?? null);
    setSoreness(d?.soreness ?? null);
    setStateNotes(d?.note ?? '');
  }, [isOpen, initialTab]);

  const sleepIntervalPreview = useMemo(() => {
    if (sleepMode !== 'interval' || !sleepStart || !wakeTime) return null;
    return intervalMinutes(sleepStart, wakeTime);
  }, [sleepMode, sleepStart, wakeTime]);
  /** 两刻相同推得零分钟：不作为眠录提交，改以一句提示请用户核对。 */
  const sleepIntervalValid = sleepIntervalPreview !== null && sleepIntervalPreview > 0;

  if (!isOpen) return null;

  const weightWarning = typeof weight === 'number' && weightWarningFor ? weightWarningFor(weight) : null;
  /** 越常体重的二次确认只在体征页生效：别的页签不许被它拦下。 */
  const weightNeedsAck = tab === 'body' && weightWarning !== null && !weightAck;

  const switchTab = (next: RecordTab) => {
    setTab(next);
    setFormHint(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 体重越常度需二次确认：只提示，绝不替用户改数
    if (weightNeedsAck) {
      setWeightAck(true);
      return;
    }

    // 体征页空录之戒：一无所有就不发请求
    if (tab === 'body') {
      const hasAny =
        typeof weight === 'number' ||
        sleepIntervalValid ||
        (sleepMode === 'duration' && typeof sleepMinutes === 'number' && sleepMinutes > 0) ||
        energy !== null ||
        soreness !== null ||
        stateNotes.trim() !== '';
      if (!hasAny) {
        setFormHint('此页尚无一录可入——填得一项再照准。');
        return;
      }
    }

    setFormHint(null);
    setIsSubmitting(true);

    try {
      let saved = true;

      if (tab === 'meal') {
        if (pickedRows.length > 0 && pickedItems.length > 0) {
          // 库选之账：行值即所见（先各自取整再加），脂肪随之入账
          const totals = sumMealItems(pickedItems);
          const names = pickedItems.map((i) => i.name);
          saved = await onSaveMeal({
            category: mealCategory,
            name: names.length <= 2 ? names.join('、') : `${names[0]}等 ${names.length} 品`,
            foods: names,
            estimatedCalories: totals.kcal,
            estimatedProtein: totals.proteinG,
            estimatedFatG: totals.fatG,
            items: pickedItems,
            source: 'database',
          });
        } else {
          if (pickedRows.length > 0) {
            // 所选行折不出（id 失效）却也无手录文字：不拿空账糊弄
            setFormHint('所选之物折算不出——删掉该行改手录，或先清空所选。');
            setIsSubmitting(false);
            return;
          }
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
        }
      } else if (tab === 'workout') {
        saved = await onSaveWorkout({
          title: workoutTitle,
          category: workoutCategory,
          durationMinutes: Number(workoutDuration) || 0,
          durationSource,
          exercises: workoutRows.filter((row) => row.name.trim() !== ''),
          perceivedDifficulty: 'moderate',
          completed: true,
        });
      } else if (tab === 'body') {
        let sleep: SleepEntry | undefined;
        if (sleepMode === 'interval' && sleepIntervalValid) {
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      {...backdropProps}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-sheet-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        /* 版框：与主页同源的外粗内细墨线,不用阴影 */
        className="w-full sm:max-w-lg bg-paper rounded-t-lg sm:rounded-lg border-2 border-ink p-[3px] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex flex-col min-h-0 flex-1 border border-ink/55 rounded-[5px] overflow-hidden">
          {/* Header：章节题式 2px 墨线收口 */}
          <div className="px-4 sm:px-5 py-3.5 border-b-2 border-ink flex items-center justify-between">
            <h3 id="record-sheet-title" className="font-serif text-lg font-medium text-ink">
              录一笔
            </h3>
            <button
              onClick={onClose}
              aria-label="阖之"
              className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 三签：下划线签,选中者 2px 墨线（无底色无阴影） */}
          <div className="mx-4 sm:mx-5 mt-3 grid grid-cols-3 text-[13px] font-sans border-b border-line">
            {([
              ['meal', '进食', Utensils],
              ['workout', '习练', Dumbbell],
              ['body', '体征', Activity],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                aria-pressed={tab === key}
                className={`-mb-px py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                  tab === key
                    ? 'border-ink text-ink font-medium'
                    : 'border-transparent text-ink3 hover:text-ink'
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

                <Group title="餐别" first={!todayIntake}>
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
                </Group>

                <Group title="所食">
                  <label htmlFor="rs-food" className="sr-only">搜库或手录所食之物</label>
                  <input
                    id="rs-food"
                    type="text"
                    required={pickedRows.length === 0}
                    value={foodText}
                    onChange={(e) => setFoodText(e.target.value)}
                    className={INPUT}
                    placeholder="搜库（如：鸡胸、糙米）；查无此物可逗号分隔手录"
                  />
                  {foodMatches.length > 0 && (
                    <div className="mt-2 border border-control rounded-lg overflow-hidden divide-y divide-linesoft">
                      {foodMatches.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setPickedRows((rows) =>
                              rows.some((r) => r.foodId === f.id)
                                ? rows
                                : [...rows, { foodId: f.id, gramsText: String(f.defaultGrams) }]
                            );
                            setFoodText('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-surface transition-colors"
                        >
                          <span className="text-[13px] text-ink">{f.name}</span>
                          <span className="text-[12px] text-ink3 tabular-nums">
                            {' '}
                            每 100g：{f.per100.kcal} 千卡 · 蛋 {f.per100.proteinG} · 脂 {f.per100.fatG}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Group>

                {pickedRows.length > 0 && (
                  <Group title="已选之物（克数可改）">
                    <div className="space-y-2">
                      {pickedLines.map((line, idx) => (
                        <div key={`${line.foodId}-${idx}`} className="grid grid-cols-[1fr_66px_26px_30px] gap-2 items-center">
                          <span className="text-[13px] text-ink leading-tight">
                            {line.item ? line.item.name : line.foodId}
                            {line.item ? (
                              <span className="text-ink3 tabular-nums">
                                {' '}
                                {line.item.kcal} 千卡 · 蛋 {line.item.proteinG} · 脂 {line.item.fatG}
                              </span>
                            ) : (
                              <span className="text-danger"> 库中无此 id</span>
                            )}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            aria-label={line.item ? `${line.item.name} 克数` : '克数'}
                            value={line.gramsText}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPickedRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, gramsText: v } : r))
                              );
                            }}
                            className={`${INPUT} tabular-nums`}
                          />
                          <span className="text-ink3 text-[12px]">g</span>
                          <button
                            type="button"
                            aria-label={line.item ? `删${line.item.name}` : '删此行'}
                            onClick={() =>
                              setPickedRows((rows) => rows.filter((_, i) => i !== idx))
                            }
                            className="text-ink3 hover:text-ink text-[14px]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {pickedTotals && (
                      <p className="mt-2 text-[12px] text-ink3 tabular-nums">
                        合计 {pickedTotals.kcal} 千卡 · 蛋白 {pickedTotals.proteinG} · 脂肪{' '}
                        {pickedTotals.fatG} g——已回填约计。
                      </p>
                    )}
                    {foodText.trim() !== '' && (
                      <p className="mt-1 text-[12px] text-danger">
                        所选已入账；库外文字不计——想手录请先清空所选。
                      </p>
                    )}
                  </Group>
                )}

                <Group title={pickedTotals ? '约计（由所选之物折算）' : '约计（可无，留空即 0）'}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rs-kcal" className="block text-ink3 mb-1">约计热量 (kcal)</label>
                      <input
                        id="rs-kcal"
                        type="number"
                        min="0"
                        max="2000"
                        readOnly={!!pickedTotals}
                        value={pickedTotals ? pickedTotals.kcal : mealCalories}
                        onChange={(e) => setMealCalories(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${INPUT} tabular-nums${pickedTotals ? ' bg-linesoft' : ''}`}
                        placeholder="留空即 0"
                      />
                    </div>
                    <div>
                      <label htmlFor="rs-protein" className="block text-ink3 mb-1">约计蛋白质 (g)</label>
                      <input
                        id="rs-protein"
                        type="number"
                        min="0"
                        max="150"
                        readOnly={!!pickedTotals}
                        value={pickedTotals ? pickedTotals.proteinG : mealProtein}
                        onChange={(e) => setMealProtein(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${INPUT} tabular-nums${pickedTotals ? ' bg-linesoft' : ''}`}
                        placeholder="留空即 0"
                      />
                    </div>
                  </div>
                </Group>
              </div>
            )}

            {tab === 'workout' && (
              <div className="space-y-3.5">
                <Group title="练名（徒手之习）" first>
                  <input
                    id="rs-workout-title"
                    type="text"
                    required
                    value={workoutTitle}
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    className={INPUT}
                    placeholder="徒手自重循环"
                  />
                </Group>

                {/* 类别是结构化事实：抗阻统计只认它，不靠标题文字 */}
                <Group title="类别（抗阻统计据此计）">
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
                </Group>

                <Group title="习练动作（依今日之荐，可改）">
                  <div className="space-y-2.5">
                    {workoutRows.length === 0 && (
                      <p className="text-[12px] text-ink3">今日无荐（休整之日）——可自行添录，或不录。</p>
                    )}
                    {workoutRows.map((row, idx) => (
                      <div
                        key={`${row.name}-${idx}`}
                        className="grid grid-cols-[1fr_58px_1fr] gap-2 items-center"
                      >
                        <span className="text-[13px] text-ink leading-tight">
                          {row.name}
                          {row.muscleGroups && row.muscleGroups.length > 0 ? (
                            <span className="text-ink3"> · {row.muscleGroups.join('/')}</span>
                          ) : null}
                        </span>
                        <input
                          type="number"
                          min={1}
                          aria-label={`${row.name} 组数`}
                          value={row.sets}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setWorkoutRows((rows) =>
                              rows.map((r, i) =>
                                i === idx ? { ...r, sets: Number.isFinite(n) && n > 0 ? n : 1 } : r
                              )
                            );
                          }}
                          className={`${INPUT} tabular-nums`}
                        />
                        <input
                          type="text"
                          aria-label={`${row.name} 次数或时长`}
                          value={row.repsOrDuration}
                          onChange={(e) => {
                            const v = e.target.value;
                            setWorkoutRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, repsOrDuration: v } : r))
                            );
                          }}
                          className={INPUT}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-ink3">
                    组数与次数可改；部位随动作入库，台账据以轮转下一练。
                  </p>
                </Group>

                <Group title="时长">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="rs-duration" className="block text-ink3 mb-1">时长（分钟）</label>
                      <input
                        id="rs-duration"
                        type="number"
                        min="0"
                        max="240"
                        value={workoutDuration}
                        onChange={(e) => setWorkoutDuration(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${INPUT} tabular-nums`}
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
                </Group>
              </div>
            )}

            {tab === 'body' && (
              <div className="space-y-3.5">
                <Group title="今日之重 (kg)" first>
                  <input
                    id="rs-weight"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value === '' ? '' : Number(e.target.value));
                      setWeightAck(false);
                      setFormHint(null);
                    }}
                    placeholder="未录"
                    className={`${INPUT} tabular-nums`}
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
                </Group>

                {/* 睡眠：时刻优先，时长由时刻推得；只记得总时长才切手录 */}
                <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
                  <div className="flex items-center justify-between">
                    <span className="group-head">昨夜之眠</span>
                    <button
                      type="button"
                      onClick={() => setSleepMode(sleepMode === 'interval' ? 'duration' : 'interval')}
                      className="btn-link text-[12px]"
                    >
                      {sleepMode === 'interval' ? '改用手录眠时' : '改用就寝/起身时刻'}
                    </button>
                  </div>

                  <div className="mt-2 space-y-2.5">
                    {sleepMode === 'interval' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="rs-sleep-start" className="block text-ink3 mb-1 text-[12px]">就寝</label>
                          <input
                            id="rs-sleep-start"
                            type="time"
                            value={sleepStart}
                            onChange={(e) => {
                              setSleepStart(e.target.value);
                              setFormHint(null);
                            }}
                            className={`${INPUT} tabular-nums`}
                          />
                        </div>
                        <div>
                          <label htmlFor="rs-wake-time" className="block text-ink3 mb-1 text-[12px]">起身</label>
                          <input
                            id="rs-wake-time"
                            type="time"
                            value={wakeTime}
                            onChange={(e) => {
                              setWakeTime(e.target.value);
                              setFormHint(null);
                            }}
                            className={`${INPUT} tabular-nums`}
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="rs-sleep-minutes" className="block text-ink3 mb-1 text-[12px]">手录眠时（分钟）</label>
                        <input
                          id="rs-sleep-minutes"
                          type="number"
                          min="0"
                          max="840"
                          value={sleepMinutes}
                          onChange={(e) => {
                            setSleepMinutes(e.target.value === '' ? '' : Number(e.target.value));
                            setFormHint(null);
                          }}
                          className={`${INPUT} tabular-nums`}
                        />
                      </div>
                    )}

                    <p className="text-[12px] text-ink3 tabular-nums">
                      {sleepMode === 'interval'
                        ? sleepIntervalPreview === null
                          ? '填齐就寝与起身时刻，方得时长。'
                          : sleepIntervalValid
                          ? `时长由时刻推得：${formatNightDuration(sleepIntervalPreview)}`
                          : '两刻相同推得零分——请核就寝与起身时刻。'
                        : typeof sleepMinutes === 'number' && sleepMinutes > 0
                        ? `手录眠时：${formatNightDuration(sleepMinutes)}`
                        : '未填则今日之眠记为未录。'}
                    </p>
                  </div>
                </div>

                {/* 体感两点：与首页「今日体感」同控件同词表 */}
                <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
                  <span className="group-head">体感</span>
                  <div className="mt-2.5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-ink3">
                        精力（1=惫，5=甚充沛）
                        {energy === null ? '：未录' : `：${energy}/5 ${energyWord(energy)}`}
                      </label>
                      <DotScale value={energy} onChange={setEnergy} label="精力" />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-ink3">
                        酸痛（1=无恙，5=沉痛）
                        {soreness === null ? '：未录' : `：${soreness}/5 ${sorenessWord(soreness)}`}
                      </label>
                      <DotScale value={soreness} onChange={setSoreness} label="酸痛" />
                    </div>
                  </div>
                </div>

                <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
                  <label htmlFor="rs-notes" className="group-head">随笔（可无）</label>
                  <input
                    id="rs-notes"
                    type="text"
                    value={stateNotes}
                    onChange={(e) => {
                      setStateNotes(e.target.value);
                      setFormHint(null);
                    }}
                    className={`${INPUT} mt-2`}
                    placeholder="昨夜之眠、晨起之神……"
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-2">
              {formHint && (
                <p role="status" className="mb-2 text-[12px] text-danger">
                  {formHint}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-accentbright" />
                    <span>已录于册</span>
                  </>
                ) : (
                  <span>{weightNeedsAck ? '仍要录之' : '照准'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
