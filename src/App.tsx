/**
 * Personal Health Coach · Living Journal (V3)
 *
 * Single-page personal workbench:
 * Flow: Greeting -> TODAY -> BODY -> NEXT MEAL -> NEXT WORKOUT -> RECENT -> LIFE
 *
 * LLM STATUS = OFF
 * Deterministic pure functions: y = f(x)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, RotateCcw } from 'lucide-react';
import { HeaderGreeting } from './components/HeaderGreeting';
import { TodayTasks } from './components/TodayTasks';
import { BodyOverview } from './components/BodyOverview';
import { HowAmIDoing } from './components/HowAmIDoing';
import { NextMealCard } from './components/NextMealCard';
import { NextWorkoutCard } from './components/NextWorkoutCard';
import { RecentSection } from './components/RecentSection';
import { RecordSheet, RecordTab } from './components/RecordSheet';
import { DataQualityNote } from './components/DataQualityNote';
import { BodyProfile } from './components/BodyProfile';
import { ForecastBand } from './components/ForecastBand';
import { ProfileSheet } from './components/ProfileSheet';
import { formatAbs } from './domain/format';
import { validateWeightMeasurement } from './domain/weight';
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /** 御批回执:成功之报冠以「知道了 ·」,失败之报不冠 */
  const showToast = (msg: string, ack = true) => {
    setToastMessage(ack ? `知道了 · ${msg}` : msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  /**
   * Error boundary for repository mutations. A transport / auth / conflict
   * failure surfaces as a typed toast and reports false, so callers (notably
   * the record sheet) never play success feedback for a save that did not land.
   */
  const runMutation = async (action: () => Promise<void>, failureMessage: string): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error(`[App] ${failureMessage}:`, error);
      showToast(`${failureMessage}（${error.code}）`, false);
      return false;
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
  useEffect(() => {
    const unsubscribe = healthRepository.onAuthChange((user) => {
      if (user) {
        setIsLoading(true);
        void loadData();
      } else if (repositoryKind === 'supabase') {
        setTodayData(null);
        setAuthStage('setup');
      }
    });
    return unsubscribe;
  }, [loadData]);

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
      setIsLoading(true);
      await healthRepository.signIn(email, password);
      await loadData();
      showToast('已同步到你的账号');
      return true;
    } catch (err) {
      const error = toRepositoryError(err);
      console.error('[App] 同步未成:', error);
      setIsLoading(false);
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
      showToast('膳食已录于册');
    }, '膳食之录未成');

  const handleQuickLogSuggestedMeal = () => {
    if (!todayData) return;
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
    }, '建议之膳录之未成');
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
    }, '训练勾销未成');

  /** 建档 / 改档：只写原始输入，派生目标由 domain 重算。 */
  const handleSaveProfile = (patch: Partial<UserProfile>) =>
    runMutation(async () => {
      await healthRepository.updateProfile(patch);
      await loadData();
      showToast('体征档已录');
    }, '体征档之录未成');

  // Actions: Body & State
  const handleSaveDailyState = (input: CreateDailyStateInput) =>
    runMutation(async () => {
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
    }, '掷还未成');

  // Actions: Todos
  const handleToggleTodo = (id: string) =>
    runMutation(async () => {
      await healthRepository.toggleTodo(id);
      await loadData();
    }, '此事勾选未成');

  const handleAddTodo = (title: string, estimatedMinutes: number = 20) =>
    runMutation(async () => {
      await healthRepository.addTodo({ title, estimatedMinutes });
      await loadData();
      showToast('此事已列入今日之册');
    }, '添事未成');

  const handleDeleteTodo = (id: string) =>
    runMutation(async () => {
      await healthRepository.deleteTodo(id);
      await loadData();
    }, '去事未成');

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
      <div className="min-h-screen text-ink selection:bg-accentsoft selection:text-ink">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink text-white text-xs font-medium shadow-md flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-accentbright stroke-[2.5]" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <AuthGate
          reason={authReason}
          onRetry={handleAnonymousSignIn}
          onSendLink={handleSendLoginLink}
        />
      </div>
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

  /**
   * 右栏次序随建档状态自适应：
   *   未建档 → 体征档只是一行提示,与「下一膳」同高；
   *   已建档 → 体征档含 BMI/代谢/目标,与「今日之练」同高。
   * 两态下配对高差都在探针阈值内（≤110px）。
   */
  const profileComplete = todayData.profileStatus === 'complete';
  const profileCellClass = profileComplete
    ? 'lg:col-start-3 lg:row-start-3'
    : 'lg:col-start-3 lg:row-start-2';
  const recentCellClass = profileComplete
    ? 'lg:col-start-3 lg:row-start-2'
    : 'lg:col-start-3 lg:row-start-3';

  /** 表单默认值取「今日既有记录」；今日未录即留空，不预填假数。 */
  const recordDefaults = {
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
  };

  return (
    <div className="min-h-screen text-ink selection:bg-accentsoft selection:text-ink pb-32">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink text-white text-xs font-medium shadow-md flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-accentbright stroke-[2.5]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 单页流：刊头 → 左栏其一其二其三 → 右栏体征档/近况/身体近况 → 通栏今日体感 */}
      <main className="w-full max-w-[1160px] mx-auto px-3 sm:px-6 py-6">
        {/* 版框：古书页式外粗内细双线，刊头、正文与页脚同入一框 */}
        <div className="border-2 border-ink p-[3px]">
        <div className="border border-ink/55 px-5 sm:px-8">
        {/* 刊头与序 */}
        <HeaderGreeting
          displayDate={todayData.displayDate}
          timeGreeting={todayData.timeGreeting}
          tasks={todayData.tasks}
        />

        {/* 数据待核：朱批只标记，不改数 */}
        <DataQualityNote
          flags={todayData.dataQuality.flags}
          reviewCount={todayData.dataQuality.reviewCount}
        />

        {/* 奏折版式：左章目（其一其二其三）/ 右附目按行配对,三对章节横线跨栏同 y;
            右栏次序按等高重排为 近况 / 生活纪事 / 身体近况+体感,DOM 次序仍按移动端既有顺序
            （其一→其二→其三→身体近况→近况→生活纪事）,桌面位置全部由 lg:col/row-start 显式指定 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_auto_1fr] lg:gap-x-8 items-start">
          {/* 折缝：桌面中缝 1px 竖线,移动端隐藏 */}
          <div
            aria-hidden="true"
            className="hidden lg:block lg:self-stretch lg:col-start-2 lg:row-start-1 lg:row-span-3 w-px bg-line"
          />

          {/* 左章目（DOM 次序 = 移动端次序;桌面显式落位） */}
          <div className="lg:col-start-1 lg:row-start-1">
            <TodayTasks
              todos={todayData.todos}
              tasks={todayData.tasks}
              onToggleTodo={handleToggleTodo}
              onAddTodo={handleAddTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          </div>
          <div className="lg:col-start-1 lg:row-start-2">
            <NextMealCard
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
          <div className="lg:col-start-1 lg:row-start-3">
            <NextWorkoutCard
              nextWorkout={todayData.nextWorkout}
              decision={todayData.training.decision}
              todaySession={todayData.training.todaySession}
              isCompletedToday={todayData.training.todaySession !== null}
              onCompleteWorkout={handleCompleteTodayWorkout}
              onCustomWorkout={() => handleOpenRecord('workout')}
            />
          </div>

          {/* 右附目（DOM 次序 = 移动端次序;桌面落位由 row-start 重排以求三行等高） */}
          <div className="lg:col-start-3 lg:row-start-1">
            <BodyOverview weight={todayData.weight} onEditWeight={() => handleOpenRecord('body')} />
          </div>

          {/* 右附目：体征档（位置随建档状态自适应,见 profileCellClass） */}
          <div className={profileCellClass}>
            <BodyProfile
              body={todayData.body}
              targets={todayData.targets}
              goalAdvice={todayData.goalAdvice}
              trainingTarget={todayData.trainingTarget}
              goal={todayData.profile.goal}
              missingFields={todayData.missingProfileFields}
              onEditProfile={() => setProfileSheetOpen(true)}
            />
          </div>

          {/* 右附目：近况（位置随建档状态自适应） */}
          <div className={recentCellClass}>
            <RecentSection
              weight={todayData.weight}
              nutrition={todayData.nutrition}
              sleep={todayData.sleep}
              training={todayData.training}
              meals={todayData.todayMeals}
              onDeleteMeal={handleDeleteMeal}
            />
          </div>

        </div>

        {/* 情景外推：通栏一节（长程推演放在数据之后） */}
        <ForecastBand forecast={todayData.forecast} />

        {/* 今日体感：通栏一节（横贯版心） */}
        <HowAmIDoing
          state={todayData.state}
          sleep={todayData.sleep}
          onUpdateMetric={handleUpdateMetricQuick}
        />

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

      {/* 记一笔：右下墨色圆角块 */}
      <div className="fixed bottom-6 right-6 sm:right-8 z-40">
        <button onClick={() => handleOpenRecord('meal')} className="btn-primary shadow-md">
          <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
          <span>记一笔</span>
        </button>
      </div>

      {/* Quick Record Bottom Sheet */}
      <RecordSheet
        isOpen={recordSheetOpen}
        initialTab={recordTab}
        onClose={() => setRecordSheetOpen(false)}
        onSaveMeal={handleSaveMeal}
        onSaveWorkout={handleSaveWorkout}
        onSaveDailyState={handleSaveDailyState}
        todayIntake={{
          mealCount: todayData.nutrition.mealCount,
          caloriesKcal: todayData.nutrition.calories.consumed,
          proteinG: todayData.nutrition.protein.consumed,
        }}
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
  );
}
