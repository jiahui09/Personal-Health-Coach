/**
 * Personal Health Coach · Living Journal (V3)
 *
 * Single-page personal workbench:
 * Flow: Greeting -> PAIRED(todos | workout) -> BODY -> NUTRITION -> STATS
 *
 * LLM STATUS = OFF
 * Deterministic pure functions: y = f(x)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Check, RotateCcw, X } from 'lucide-react';
import { HeaderGreeting } from './components/HeaderGreeting';
import { TodayTasks } from './components/TodayTasks';
import { BodySection } from './components/BodySection';
import { NutritionSection } from './components/NutritionSection';
import { StatsSection } from './components/StatsSection';
import { NextMealCard } from './components/NextMealCard';
import { NextWorkoutCard } from './components/NextWorkoutCard';
import { RecordDefaults, RecordTab } from './components/SheetShell';
import { MealSheet } from './components/MealSheet';
import { WorkoutSheet } from './components/WorkoutSheet';
import { BodySheet } from './components/BodySheet';
import { ProfileSheet } from './components/ProfileSheet';
import { formatAbs, round1 } from './domain/format';
import { normalizeEstimateMinutes } from './domain/tasks';
import { validateWeightMeasurement } from './domain/weight';
import { normalizeTrainingMinutesBudget } from './domain/training';
import { healthRepository, repositoryKind } from './services/repository';
import { AuthGate } from './components/AuthGate';
import { SyncSheet } from './components/SyncSheet';
import { toRepositoryError } from './services/healthRepository';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  TodayData,
  UserProfile,
} from './types/health';

const GOAL_CN: Record<string, string> = {
  'fat loss': '减脂之期',
  maintain: '守成之期',
  'muscle gain': '增肌之期',
  'general fitness': '日常强身',
};

const SLOT_CN: Record<string, string> = {
  breakfast: '早膳',
  lunch: '午膳',
  dinner: '晚膳',
  snack: '加餐',
};

export default function App() {
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * 云端身份状态：
   *   ready   —— 已可读写（本机模式也直接是 ready）
   *   entering—— 首次进入,正在静默建立本机身份（用户只看到一句话）
   *   setup   —— 静默建立失败（通常是 Supabase 没开匿名登录）→ 才显示提示
   * 正常自用路径不会出现任何登录界面。
   */
  const [authStage, setAuthStage] = useState<'ready' | 'entering' | 'setup'>('ready');
  /** 静默进入失败的原因码：决定提示怎么修。 */
  const [authReason, setAuthReason] = useState<string | null>(null);

  // Modals
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [recordTab, setRecordTab] = useState<RecordTab>('meal');
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  /** 多端同步：把本机身份换成固定账号。 */
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  // Subtle toast feedback
  const [toast, setToast] = useState<{ message: string; ack: boolean } | null>(null);
  /** 上一条回执的清撤计时器：新回执先撤旧计,免得迟到的计时把新回执提前抹掉。 */
  const toastTimerRef = useRef<number | null>(null);

  /** 御批回执:成功之报冠以「知道了 ·」并押朱勾,失败之报不冠不押（图标不说谎）。 */
  const showToast = (msg: string, ack = true) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToast({ message: ack ? `知道了 · ${msg}` : msg, ack });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);
  };

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    },
    []
  );

  /**
   * 同一动作的单发闸：快速双击「照准 / 毕此一练」等一次性动作时,
   * 第二次点击在前一次落定前直接忽略,不产生重复记录。不同动作互不相扰。
   */
  const inflightRef = useRef<Set<string>>(new Set());

  /**
   * Error boundary for repository mutations. A transport / auth / conflict
   * failure surfaces as a typed toast and reports false, so callers (notably
   * the record sheet) never play success feedback for a save that did not land.
   */
  const runMutation = async (
    action: () => Promise<void>,
    failureMessage: string,
    singleFlightKey?: string
  ): Promise<boolean> => {
    if (singleFlightKey) {
      if (inflightRef.current.has(singleFlightKey)) return false;
      inflightRef.current.add(singleFlightKey);
    }
    try {
      await action();
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error(`[App] ${failureMessage}:`, error);
      showToast(`${failureMessage}（${error.code}）`, false);
      return false;
    } finally {
      if (singleFlightKey) inflightRef.current.delete(singleFlightKey);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const today = await healthRepository.getToday();
      setTodayData(today);
      setAuthStage('ready');
    } catch (err) {
      const error = toRepositoryError(err);
      console.error('Failed to load health diary:', error);
      if (error.code === 'auth' && repositoryKind === 'supabase') {
        // 有身份但取数失败（令牌失效等）→ 提示；**不静默新建身份**，否则新身份看不到旧数据
        setAuthReason('auth');
        setAuthStage('setup');
        return;
      }
      setLoadError(
        error.code === 'not_implemented'
          ? '云库（Supabase）既配而后端之法未通：请去 .env 中 VITE_SUPABASE_* 之项，或补其实作。'
          : `手记取阅未成（${error.code}）`
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 启动流程：本机模式下直接取数；云端模式下若本机从未有过身份,静默建立一个匿名身份
   * （用户不需要看到任何登录界面）。已有身份但失效时不新建,交给 loadData 走提示分支。
   */
  useEffect(() => {
    if (repositoryKind !== 'supabase') {
      void loadData();
      return;
    }
    if (healthRepository.hasSession()) {
      void loadData();
      return;
    }
    let cancelled = false;
    setAuthStage('entering');
    void (async () => {
      try {
        await healthRepository.signInAnonymously();
        if (!cancelled) await loadData();
      } catch (err) {
        const error = toRepositoryError(err);
        console.error('[App] 静默建立云端身份未成:', error);
        if (!cancelled) {
          setAuthReason(error.code);
          setAuthStage('setup');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  // 云端登录态变化（magic link 回跳建立会话 / 退出）→ 立即重新取数，避免停在登录页
  /** 最近一次成功载入的数据（供下面的登录态回调判断「有无内容可显」）。 */
  const todayDataRef = useRef<TodayData | null>(null);
  useEffect(() => {
    todayDataRef.current = todayData;
  }, [todayData]);

  useEffect(() => {
    const unsubscribe = healthRepository.onAuthChange((user) => {
      if (user) {
        // 只有「还没有数据」时才进全屏载入：令牌自动刷新时手记已有内容,
        // 不切载入页才不会把用户正开着的录事件与正在输入的内容一并掀掉。
        if (todayDataRef.current === null) setIsLoading(true);
        void loadData();
      } else if (repositoryKind === 'supabase') {
        setTodayData(null);
        setAuthStage('setup');
      }
    });
    return unsubscribe;
  }, [loadData]);

  /**
   * 录事件的表单默认值（体征页预填「今日既有记录」，今日未录即留空）。
   * 记成 memo 只随数据换新身份——否则任何一次无关重渲染（如回执计时器到点）
   * 都会造出「新默认值」，把用户正在填写的内容清掉。
   */
  const recordDefaults = useMemo<RecordDefaults | undefined>(() => {
    if (!todayData) return undefined;
    return {
      weight:
        todayData.weight.latestDayKey === todayData.date
          ? todayData.weight.latest ?? undefined
          : undefined,
      sleepStart: todayData.sleep.today?.sleepStart,
      wakeTime: todayData.sleep.today?.wakeTime,
      sleepMinutes:
        todayData.sleep.today?.source === 'duration' ? todayData.sleep.today.minutes : undefined,
      energy: todayData.state.energy,
      soreness: todayData.state.soreness,
      note: todayData.state.notes,
      // 腰围：会变之数预填档中所存（未改动即不重写）
      waistCm: todayData.profile.waistCm ?? undefined,
      // 习练页依今日之荐预填（休整之日无荐 → 记录页回默认课表）
      workoutTitle: todayData.nextWorkout.exercises.length > 0 ? todayData.nextWorkout.title : undefined,
      workoutExercises: todayData.nextWorkout.exercises.length > 0 ? todayData.nextWorkout.exercises : undefined,
      workoutDuration: todayData.nextWorkout.exercises.length > 0 ? todayData.nextWorkout.durationMinutes : undefined,
    };
  }, [todayData]);

  /** 一键进入（匿名登录）：自用场景不折腾邮箱；数据仍按你的身份隔离在云端。 */
  const handleAnonymousSignIn = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      await healthRepository.signInAnonymously();
      setAuthReason(null);
      setAuthStage('ready');
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error('[App] 一键进入未成:', error);
      setIsLoading(false);
      showToast(
        error.code === 'not_implemented'
          ? '请先在 Supabase 打开 Authentication → Allow anonymous sign-ins'
          : `一键进入未成（${error.code}）`,
        false
      );
      return false;
    }
  };

  /**
   * 云端登录：发送 magic link（点击邮件后回跳并建立会话）。
   * 限流（429）单独给出可执行建议 —— Supabase 内置邮件按小时计额。
   */
  const handleSendLoginLink = async (email: string): Promise<boolean> => {
    try {
      await healthRepository.signIn(email, '');
      showToast('登录链接已发出 · 请查收邮件');
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error('[App] 登录链接未发出:', error);
      showToast(
        error.code === 'rate_limited'
          ? '发信已达小时限额 · 等约一小时,或改用一键进入'
          : `登录链接未发出（${error.code}）`,
        false
      );
      return false;
    }
  };

  /** 多端同步：用邮箱+密码登录到同一账号（不发邮件、不受发信限额）。 */
  const handleSyncToAccount = async (email: string, password: string): Promise<boolean> => {
    try {
      // 不切全屏载入:同步弹层自己显示「登录中…」,失败时弹层不塌、已输之邮箱密码不丢。
      await healthRepository.signIn(email, password);
      await loadData();
      showToast('已同步到你的账号');
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error('[App] 同步未成:', error);
      showToast(error.code === 'auth' ? '邮箱或密码不正确' : `同步未成（${error.code}）`, false);
      return false;
    }
  };

  // Open Quick Record
  const handleOpenRecord = (tab: RecordTab = 'meal') => {
    setRecordTab(tab);
    setRecordSheetOpen(true);
  };

  // Actions: Meals
  const handleSaveMeal = (input: CreateMealInput) =>
    runMutation(async () => {
      await healthRepository.addMeal(input);
      await loadData();
      // 归膳回执：既由时钟判定，就把去处一并说清（14:59 与 15:01 归宿不同，当场可核）
      showToast(`膳食已录于册 · 归${SLOT_CN[input.category] ?? '今日'}`);
    }, '膳食之录未成');

  const handleQuickLogSuggestedMeal = () => {
    if (!todayData) return Promise.resolve(false);
    const { nextMeal } = todayData;
    return runMutation(async () => {
      await healthRepository.addMeal({
        category: todayData.mealSlot,
        name: nextMeal.mealName,
        foods: nextMeal.suggestedItems,
        estimatedCalories: nextMeal.estimatedCalories,
        estimatedProtein: nextMeal.estimatedProtein,
      });
      await loadData();
      showToast('建议之膳已录于册');
    }, '建议之膳录之未成', 'quick-log-meal');
  };

  // Actions: Workouts
  const handleSaveWorkout = (input: CreateWorkoutInput) =>
    runMutation(async () => {
      await healthRepository.addWorkout(input);
      await loadData();
      showToast('徒手课表已录毕');
    }, '训练之录未成');

  const handleCompleteTodayWorkout = () =>
    runMutation(async () => {
      await healthRepository.completeTodayWorkout();
      await loadData();
      showToast('今日徒手之练已毕');
    }, '训练勾销未成', 'complete-workout');

  /** 建档 / 改档：只写原始输入，派生目标由 domain 重算。 */
  const handleSaveProfile = (patch: Partial<UserProfile>) =>
    runMutation(async () => {
      // 训练时间预算在此规范化（组件不写阈值）；未出现的键不动已存值
      const normalized: Partial<UserProfile> = 'trainingMinutesBudget' in patch
        ? { ...patch, trainingMinutesBudget: normalizeTrainingMinutesBudget(patch.trainingMinutesBudget) }
        : patch;
      await healthRepository.updateProfile(normalized);
      await loadData();
      showToast('体征档已录');
    }, '体征档之录未成');

  // Actions: Body & State
  const handleSaveBody = (input: CreateDailyStateInput, waistCm?: number) =>
    runMutation(async () => {
      // 腰围是会变之数，存于档中（最新值覆盖）：填了且与档中不同才重写，留空不改档
      if (typeof waistCm === 'number' && waistCm > 0 && waistCm !== todayData?.profile.waistCm) {
        await healthRepository.updateProfile({ waistCm });
      }
      await healthRepository.saveDailyState(input);
      await loadData();
      showToast('体征状态已录');
    }, '体征状态之录未成');

  const handleUpdateMetricQuick = (key: 'energy' | 'soreness', val: number) => {
    if (!todayData) return;
    return runMutation(async () => {
      // 只写这一项；当日其余字段（含睡眠）由 repository 保留，不互相覆盖
      await healthRepository.saveDailyState({ [key]: val });
      await loadData();
      showToast(key === 'energy' ? `精力记为 ${val}/5` : `酸痛记为 ${val}/5`);
    }, '状态改换未成');
  };

  /** 掷还一条误录之膳：原始记录可删，但绝不静默改写数值。 */
  const handleDeleteMeal = (id: string) =>
    runMutation(async () => {
      await healthRepository.deleteMeal(id);
      await loadData();
      showToast('此膳已掷还');
    }, '掷还未成', `delete-meal:${id}`);

  // Actions: Todos
  const handleToggleTodo = (id: string) =>
    runMutation(async () => {
      await healthRepository.toggleTodo(id);
      await loadData();
      showToast('此事已勾');
    }, '此事勾选未成', `toggle-todo:${id}`);

  const handleAddTodo = (title: string, estimatedMinutes: string) =>
    runMutation(async () => {
      const minutes = normalizeEstimateMinutes(estimatedMinutes);
      await healthRepository.addTodo({ title, estimatedMinutes: minutes ?? undefined });
      await loadData();
      showToast('此事已列入今日之册');
    }, '添事未成', 'add-todo');

  /** 改拟时长（null = 取消时长）：原始字符串同样交 domain 规范化。 */
  const handleUpdateTodoEstimate = (id: string, minutes: string | null) =>
    runMutation(async () => {
      const normalized = minutes === null ? null : normalizeEstimateMinutes(minutes);
      await healthRepository.updateTodo(id, { estimatedMinutes: normalized });
      await loadData();
      showToast(normalized === null ? '此事项时长已取消' : `此事项拟时长记为 ${normalized} 分`);
    }, '改时长未成', `update-todo:${id}`);

  const handleDeleteTodo = (id: string) =>
    runMutation(async () => {
      await healthRepository.deleteTodo(id);
      await loadData();
      showToast('此事已掷还');
    }, '去事未成', `delete-todo:${id}`);

  const handleResetData = () => {
    if (!window.confirm('确认将手记复为最初之三十日平稳模拟之数？')) return;
    return runMutation(async () => {
      await healthRepository.resetToDefault();
      await loadData();
      showToast('手记已复其初');
    }, '复其初未成');
  };

  if (authStage === 'entering') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-ink3 font-sans text-xs">
        <div className="flex items-center gap-2">
          {/* deslop-ignore-next-line 19 — literal 6px status dot */}
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>正在建立本机凭据…</span>
        </div>
      </div>
    );
  }

  if (authStage === 'setup') {
    return (
      <MotionConfig reducedMotion="user">
      <div className="min-h-screen text-ink selection:bg-accentsoft selection:text-ink">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              role="status"
              aria-live="polite"
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink text-white text-xs font-medium flex items-center gap-1.5"
            >
              {toast.ack ? (
                <Check className="w-3.5 h-3.5 text-accentbright stroke-[2.5]" />
              ) : (
                <X className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              )}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <AuthGate
          reason={authReason}
          onRetry={handleAnonymousSignIn}
          onSendLink={handleSendLoginLink}
        />
      </div>
      </MotionConfig>
    );
  }

  if (isLoading || !todayData) {
    if (loadError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="max-w-sm text-center space-y-3">
            <p className="text-sm text-ink2">{loadError}</p>
            <button
              onClick={() => {
                setIsLoading(true);
                loadData();
              }}
              className="btn-primary"
            >
              再试一次
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-ink3 font-sans text-xs">
        <div className="flex items-center gap-2">
          {/* deslop-ignore-next-line 19 — literal 6px status dot */}
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>手记启卷…</span>
        </div>
      </div>
    );
  }

  /** 体重越常度之提示：由 domain 的校验函数判定，只在保存前求助二次确认。 */
  const weightWarningFor = (value: number): string | null => {
    if (!todayData) return null;
    const quality = validateWeightMeasurement(
      value,
      todayData.weight.rollingMean7d,
      todayData.weight.rollingMean7dDays
    );
    if (quality.flag !== 'needs_review') return null;
    return `今录 ${value} 公斤，与近七日均重 ${String(
      quality.detail.rollingMean7d
    )} 公斤相差 ${formatAbs(Number(quality.detail.deltaKg))} 公斤，越常度之限。`;
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen text-ink selection:bg-accentsoft selection:text-ink">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            role="status"
            aria-live="polite"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink text-white text-xs font-medium flex items-center gap-1.5"
          >
            {toast.ack ? (
              <Check className="w-3.5 h-3.5 text-accentbright stroke-[2.5]" />
            ) : (
              <X className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 单页流：刊头 → 今日之事 ↔ 今日之练同行 → 通栏体征 → 营养摄入 ↔ 统计同行（外推收于统计之末） */}
      <main className="w-full max-w-[1160px] mx-auto px-3 sm:px-6 py-6">
        {/* 版框：古书页式外粗内细双线，刊头、正文与页脚同入一框 */}
        <div className="border-2 border-ink p-[3px]">
        <div className="border border-ink/55 px-5 sm:px-8">
        {/* 刊头与序（大字问候 + 干支日期;今日状况归「今日之事」,刊头不重复） */}
        <HeaderGreeting
          displayDate={todayData.displayDate}
          timeGreeting={todayData.timeGreeting}
        />

        {/* 今日之事 ↔ 今日之练同行：待办与今日之练排一行（折缝分栏;移动端纵向相随,
            桌面两格同高同顶,章节横线跨栏同 y） */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_auto_1fr] lg:gap-x-8">
          {/* 折缝：桌面中缝 1px 竖线,自章节头 2px 墨线处起向下（不越过墨线,免得竖线突兀;
              偏移 = pt-10 40 + 眉行 18 + mt-1.5 6 + 题行 39 + pb-3 12 = 115,五头等高契约保证三处同基准）,移动端隐藏 */}
          <div
            aria-hidden="true"
            className="hidden lg:block lg:self-stretch lg:mt-[115px] lg:col-start-2 lg:row-start-1 w-px bg-line"
          />

          <div className="lg:col-start-1 lg:row-start-1">
            <TodayTasks
              todos={todayData.todos}
              tasks={todayData.tasks}
              onToggleTodo={handleToggleTodo}
              onAddTodo={handleAddTodo}
              onUpdateEstimate={handleUpdateTodoEstimate}
              onDeleteTodo={handleDeleteTodo}
            />
          </div>
          <div className="lg:col-start-3 lg:row-start-1">
            <NextWorkoutCard
              nextWorkout={todayData.nextWorkout}
              decision={todayData.training.decision}
              todaySession={todayData.training.todaySession}
              isCompletedToday={todayData.training.todaySession !== null}
              onCompleteWorkout={handleCompleteTodayWorkout}
              onCustomWorkout={() => handleOpenRecord('workout')}
            />
          </div>
        </div>

        {/* 体征通栏：原始事实（体感、眠、今之体重、档案所录）与待核朱批集中一处 */}
        <BodySection
          weight={todayData.weight}
          state={todayData.state}
          sleep={todayData.sleep}
          body={todayData.body}
          goal={todayData.profile.goal}
          goalAdvice={todayData.goalAdvice}
          missingFields={todayData.missingProfileFields}
          dataQuality={todayData.dataQuality}
          onUpdateMetric={handleUpdateMetricQuick}
          onEditWeight={() => handleOpenRecord('body')}
          onEditProfile={() => setProfileSheetOpen(true)}
        />

        {/* 营养摄入 ↔ 统计同行：与第一处配对行同列格同折缝（移动端纵向相随,
            桌面两格同高同顶,列缘与上一行上下对齐） */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_auto_1fr] lg:gap-x-8">
          {/* 折缝：同上,自本行章节头墨线起向下（与第一处折缝同基准同 x）,移动端隐藏 */}
          <div
            aria-hidden="true"
            className="hidden lg:block lg:self-stretch lg:mt-[115px] lg:col-start-2 lg:row-start-1 w-px bg-line"
          />

          <div className="lg:col-start-1 lg:row-start-1">
            {/* 营养摄入：今日之标、两笔账、下一膳与今日所食 */}
            <NutritionSection
              targets={todayData.targets}
              trainingDayTargets={todayData.trainingDayTargets}
              nutrition={todayData.nutrition}
              meals={todayData.todayMeals}
              onDeleteMeal={handleDeleteMeal}
              nextMeal={todayData.nextMeal}
              slotLabel={SLOT_CN[todayData.mealSlot] ?? '今日'}
              goalLabel={GOAL_CN[todayData.profile.goal ?? 'general fitness'] ?? '日常强身'}
              suggestedLoggedToday={
                todayData.todayMeals.filter((meal) => meal.source === 'suggested').length
              }
              onQuickLogSuggested={handleQuickLogSuggestedMeal}
              onAddCustomMeal={() => handleOpenRecord('meal')}
            />
          </div>

          <div className="lg:col-start-3 lg:row-start-1">
            {/* 统计：由此算出的数、趋势与均值、履行合议与情景外推 */}
            <StatsSection
              body={todayData.body}
              weight={todayData.weight}
              sleep={todayData.sleep}
              trainingTarget={todayData.trainingTarget}
              training={todayData.training}
              forecast={todayData.forecast}
            />
          </div>
        </div>

        {/* 页脚：2px 粗线收尾 */}
        <footer className="mt-12 pt-6 pb-4 text-xs text-ink4 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans border-t-2 border-ink">
          <div className="flex items-center gap-1.5">
            <span>个人健康手记</span>
          </div>

          <div className="flex items-center gap-4">
            {repositoryKind === 'supabase' && (
              <button onClick={() => setSyncSheetOpen(true)} className="btn-link">
                <span>同步到我的账号</span>
              </button>
            )}
            {repositoryKind === 'mock' && (
              <button
                onClick={handleResetData}
                className="btn-link"
                title="复为初始演示之数"
              >
                <RotateCcw className="w-3 h-3" />
                <span>复其初</span>
              </button>
            )}
          </div>
        </footer>
        </div>
        </div>
      </main>

      {/* 录入入口全部就地：体征·录新体重 / 今日之练·另择动作 / 营养·别录一品，
          各开本域独立之表；全局记账 FAB 已撤，入口不聚一处 */}

      {/* 录事三表各自独立（共用 SheetShell 之壳），无页签互跳 */}
      <MealSheet
        isOpen={recordSheetOpen && recordTab === 'meal'}
        onClose={() => setRecordSheetOpen(false)}
        onSave={handleSaveMeal}
        mealSlot={todayData.mealSlot}
        todayIntake={{
          mealCount: todayData.nutrition.mealCount,
          // 上屏先取整：浮点尾巴（233.79999999999998）绝不进表头
          caloriesKcal: round1(todayData.nutrition.calories.consumed),
          proteinG: round1(todayData.nutrition.protein.consumed),
        }}
      />
      <WorkoutSheet
        isOpen={recordSheetOpen && recordTab === 'workout'}
        onClose={() => setRecordSheetOpen(false)}
        onSave={handleSaveWorkout}
        defaults={recordDefaults}
      />
      <BodySheet
        isOpen={recordSheetOpen && recordTab === 'body'}
        onClose={() => setRecordSheetOpen(false)}
        onSave={handleSaveBody}
        defaults={recordDefaults}
        weightWarningFor={weightWarningFor}
      />

      {/* 多端同步：登录到我的账号 */}
      <SyncSheet
        isOpen={syncSheetOpen}
        anonymous={repositoryKind === 'supabase' && healthRepository.hasSession()}
        onSync={handleSyncToAccount}
        onClose={() => setSyncSheetOpen(false)}
      />

      {/* 体征档：建档 / 改档 */}
      <ProfileSheet
        isOpen={profileSheetOpen}
        profile={todayData.profile}
        advisedDirection={todayData.goalAdvice.direction}
        adviseConflicting={todayData.goalAdvice.conflicting}
        maxBirthYear={Number(todayData.date.slice(0, 4)) - 10}
        onClose={() => setProfileSheetOpen(false)}
        onSave={handleSaveProfile}
      />
    </div>
    </MotionConfig>
  );
}
