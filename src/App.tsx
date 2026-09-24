/**
 * Personal Health Coach
 * Lean, evidence-grounded, single-page health diary and decision companion.
 * Flow: Today -> Body -> How am I doing? -> Next Meal -> Next Workout -> Insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, RotateCcw } from 'lucide-react';
import { HeaderGreeting } from './components/HeaderGreeting';
import { BodyOverview } from './components/BodyOverview';
import { HowAmIDoing } from './components/HowAmIDoing';
import { NextMealCard } from './components/NextMealCard';
import { NextWorkoutCard } from './components/NextWorkoutCard';
import { InsightsNote } from './components/InsightsNote';
import { EvidenceModal } from './components/EvidenceModal';
import { RecordSheet, RecordTab } from './components/RecordSheet';
import { healthRepository } from './services/mockHealthRepository';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  DecisionTrace,
  RecommendationEvidenceTrace,
  RuleStatus,
  TodayData,
} from './types/health';

export default function App() {
  const [todayData, setTodayData] = useState<TodayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [recordTab, setRecordTab] = useState<RecordTab>('meal');

  // Evidence trace modal state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [activeEvidenceTopic, setActiveEvidenceTopic] = useState<{
    title: string;
    type: 'meal' | 'workout';
    recommendationSummary: string;
    userContextSummary: string;
    evidenceTraces: RecommendationEvidenceTrace[];
    trace?: DecisionTrace;
    ruleStatus?: RuleStatus;
    ruleId?: string;
    ruleName?: string;
    equipmentNote?: string;
    translationNote?: string;
  } | null>(null);

  // Subtle toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const loadData = useCallback(async () => {
    try {
      const today = await healthRepository.getToday();
      setTodayData(today);
    } catch (err) {
      console.error('Failed to load health diary:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Quick Record
  const handleOpenRecord = (tab: RecordTab = 'meal') => {
    setRecordTab(tab);
    setRecordSheetOpen(true);
  };

  // Actions
  const handleSaveMeal = async (input: CreateMealInput) => {
    await healthRepository.addMeal(input);
    await loadData();
    showToast('饮食已记入今日手记 ✓');
  };

  const handleSaveWorkout = async (input: CreateWorkoutInput) => {
    await healthRepository.addWorkout(input);
    await loadData();
    showToast('徒手训练已完成并记录 ✓');
  };

  const handleCompleteTodayWorkout = async () => {
    await healthRepository.completeTodayWorkout();
    await loadData();
    showToast('今日徒手锻炼已达成 ✓');
  };

  const handleSaveDailyState = async (input: CreateDailyStateInput) => {
    await healthRepository.saveDailyState(input);
    await loadData();
    showToast('身体感觉已更新 ✓');
  };

  const handleUpdateMetricQuick = async (key: 'energy' | 'soreness', val: number) => {
    if (!todayData) return;
    await healthRepository.saveDailyState({
      energy: key === 'energy' ? val : todayData.state.energy,
      soreness: key === 'soreness' ? val : todayData.state.soreness,
      sleepHours: todayData.state.sleepHours,
    });
    await loadData();
    showToast(key === 'energy' ? `精力调至 ${val}/5` : `酸痛标记为 ${val}/5`);
  };

  const handleQuickLogSuggestedMeal = async () => {
    if (!todayData) return;
    const { nextMeal } = todayData;
    await healthRepository.addMeal({
      category: 'dinner',
      name: nextMeal.mealName,
      foods: nextMeal.suggestedItems,
      estimatedCalories: nextMeal.estimatedCalories,
      estimatedProtein: nextMeal.estimatedProtein,
    });
    await loadData();
    showToast('已将建议晚餐记入今日饮食 ✓');
  };

  // Evidence modal triggers
  const handleOpenMealEvidence = () => {
    if (!todayData) return;
    setActiveEvidenceTopic({
      title: 'Next Meal 科学决策审计',
      type: 'meal',
      recommendationSummary: `${todayData.nextMeal.mealName} (≈${todayData.nextMeal.energyRange ? `${todayData.nextMeal.energyRange.min}–${todayData.nextMeal.energyRange.max}` : todayData.nextMeal.estimatedCalories} kcal, ≈${todayData.nextMeal.proteinRange ? `${todayData.nextMeal.proteinRange.min}–${todayData.nextMeal.proteinRange.max}` : todayData.nextMeal.estimatedProtein}g P)`,
      userContextSummary: `当前已记录蛋白质：${todayData.nutritionSummary.consumedProtein}g / 目标范围基准 ${todayData.nutritionSummary.targetProtein}g，已记录热量：${todayData.nutritionSummary.consumedCalories} / ${todayData.nutritionSummary.targetCalories} kcal，目标偏向 ${todayData.profile.goal}`,
      evidenceTraces: todayData.nextMeal.evidenceTraces,
      trace: todayData.nextMeal.trace,
      ruleStatus: todayData.nextMeal.ruleStatus,
      ruleId: todayData.nextMeal.ruleId,
      ruleName: todayData.nextMeal.ruleName,
    });
    setEvidenceModalOpen(true);
  };

  const handleOpenWorkoutEvidence = () => {
    if (!todayData) return;
    setActiveEvidenceTopic({
      title: 'Next Workout 科学决策审计',
      type: 'workout',
      recommendationSummary: `${todayData.nextWorkout.title} (${todayData.nextWorkout.sessionType})`,
      userContextSummary: `主观精力感知：${todayData.state.energy}/5，肌肉酸痛：${todayData.state.soreness}/5，昨夜睡眠：${todayData.state.sleepHours}h，训练决策状态：${todayData.nextWorkout.trainingState}`,
      evidenceTraces: todayData.nextWorkout.evidenceTraces,
      trace: todayData.nextWorkout.trace,
      ruleStatus: todayData.nextWorkout.ruleStatus,
      ruleId: todayData.nextWorkout.ruleId,
      ruleName: todayData.nextWorkout.ruleName,
      equipmentNote: '居家无器械条件下推力、下肢与核心全面覆盖；垂直与水平拉力 (Pull) 动作受限。',
      translationNote: todayData.nextWorkout.engineeringTranslationNote,
    });
    setEvidenceModalOpen(true);
  };

  const handleResetData = async () => {
    if (window.confirm('确认重置手记为最初的 30 天平稳模拟数据？')) {
      await healthRepository.resetToDefault();
      await loadData();
      showToast('手记已恢复为初始数据');
    }
  };

  if (isLoading || !todayData) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center text-[#78716c] font-sans text-xs">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-ping" />
          <span>翻开私人健康手记...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#24272c] selection:bg-[#e4ded5] selection:text-[#191b1f] pb-32">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1917] text-white text-xs font-medium shadow-md flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-[#4ade80] stroke-[2.5]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Single-Page Natural Flow (Strictly ordered: Today -> Body -> How am I doing? -> Next Meal -> Next Workout -> Insights) */}
      <main className="w-full max-w-xl mx-auto px-5 sm:px-6">
        {/* 1. Today */}
        <HeaderGreeting
          displayDate={todayData.displayDate}
          timeGreeting={todayData.timeGreeting}
          onOpenRecord={() => handleOpenRecord('meal')}
        />

        {/* 2. Body */}
        <BodyOverview
          currentWeight={todayData.weight.current}
          monthDelta={todayData.weight.monthDelta}
          onEditWeight={() => handleOpenRecord('body')}
        />

        {/* 3. How am I doing? */}
        <HowAmIDoing
          state={todayData.state}
          onUpdateMetric={handleUpdateMetricQuick}
        />

        {/* 4. Next Meal (Protagonist 1) */}
        <NextMealCard
          nextMeal={todayData.nextMeal}
          onOpenEvidence={handleOpenMealEvidence}
          onQuickLogSuggested={handleQuickLogSuggestedMeal}
          onAddCustomMeal={() => handleOpenRecord('meal')}
        />

        {/* 5. Next Workout (Protagonist 2 · Bodyweight only) */}
        <NextWorkoutCard
          nextWorkout={todayData.nextWorkout}
          isCompletedToday={todayData.nextWorkout.sessionType === 'Rest'}
          onCompleteWorkout={handleCompleteTodayWorkout}
          onOpenEvidence={handleOpenWorkoutEvidence}
          onCustomWorkout={() => handleOpenRecord('workout')}
        />

        {/* 6. Insights */}
        <InsightsNote note={todayData.personalNote} />

        {/* Minimal Quiet Footer */}
        <footer className="pt-8 pb-4 text-xs text-[#a8a29e] flex flex-col sm:flex-row items-center justify-between gap-3 font-sans border-t border-[#e9e4dc]">
          <div className="flex items-center gap-1.5">
            <span>Personal Health Coach</span>
            <span>·</span>
            <span>Evidence-Grounded & Supabase Ready</span>
          </div>

          <button
            onClick={handleResetData}
            className="flex items-center gap-1 text-[#78716c] hover:text-[#1c1917] transition-colors cursor-pointer py-1"
            title="重置为初始演示数据"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重置演示数据</span>
          </button>
        </footer>
      </main>

      {/* Floating Action Button for Natural Thumb Zone: "+ Record" */}
      <div className="fixed bottom-6 right-6 sm:right-8 z-40">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => handleOpenRecord('meal')}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#1c1917] hover:bg-[#2d2824] text-white font-medium text-xs shadow-xl transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ 记一笔</span>
        </motion.button>
      </div>

      {/* Quick Record Bottom Sheet (10-20s minimal journal) */}
      <RecordSheet
        isOpen={recordSheetOpen}
        initialTab={recordTab}
        onClose={() => setRecordSheetOpen(false)}
        onSaveMeal={handleSaveMeal}
        onSaveWorkout={handleSaveWorkout}
        onSaveDailyState={handleSaveDailyState}
      />

      {/* Evidence Trace Modal (Grounded in WHO, ACSM, Dietary Guidelines) */}
      {activeEvidenceTopic && (
        <EvidenceModal
          isOpen={evidenceModalOpen}
          onClose={() => setEvidenceModalOpen(false)}
          title={activeEvidenceTopic.title}
          type={activeEvidenceTopic.type}
          recommendationSummary={activeEvidenceTopic.recommendationSummary}
          userContextSummary={activeEvidenceTopic.userContextSummary}
          evidenceTraces={activeEvidenceTopic.evidenceTraces}
          trace={activeEvidenceTopic.trace}
          ruleStatus={activeEvidenceTopic.ruleStatus}
          ruleId={activeEvidenceTopic.ruleId}
          ruleName={activeEvidenceTopic.ruleName}
          equipmentNote={activeEvidenceTopic.equipmentNote}
          translationNote={activeEvidenceTopic.translationNote}
        />
      )}
    </div>
  );
}
