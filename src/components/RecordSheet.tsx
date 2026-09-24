import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Utensils, Dumbbell, Activity } from 'lucide-react';
import {
  CreateDailyStateInput,
  CreateMealInput,
  CreateWorkoutInput,
  MealCategory,
} from '../types/health';

export type RecordTab = 'meal' | 'workout' | 'body';

interface RecordSheetProps {
  isOpen: boolean;
  initialTab?: RecordTab;
  onClose: () => void;
  onSaveMeal: (input: CreateMealInput) => Promise<void>;
  onSaveWorkout: (input: CreateWorkoutInput) => Promise<void>;
  onSaveDailyState: (input: CreateDailyStateInput) => Promise<void>;
}

export const RecordSheet: React.FC<RecordSheetProps> = ({
  isOpen,
  initialTab = 'meal',
  onClose,
  onSaveMeal,
  onSaveWorkout,
  onSaveDailyState,
}) => {
  const [tab, setTab] = useState<RecordTab>(initialTab);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Meal Form States
  const [mealCategory, setMealCategory] = useState<MealCategory>('dinner');
  const [foodText, setFoodText] = useState('鸡胸肉、糙米饭、水煮西兰花');
  const [mealCalories, setMealCalories] = useState(480);
  const [mealProtein, setMealProtein] = useState(38);

  // Bodyweight Workout Form States
  const [workoutTitle, setWorkoutTitle] = useState('徒手基础练习');
  const [squatReps, setSquatReps] = useState('3 × 12');
  const [pushupReps, setPushupReps] = useState('3 × 10');
  const [lungeReps, setLungeReps] = useState('3 × 8 / 侧');
  const [plankTime, setPlankTime] = useState('3 × 30 秒');
  const [workoutDuration, setWorkoutDuration] = useState(20);

  // Body & State & Sleep Form States
  const [weight, setWeight] = useState(68.4);
  const [sleepHours, setSleepHours] = useState(7.3);
  const [energy, setEnergy] = useState(4);
  const [soreness, setSoreness] = useState(2);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (tab === 'meal') {
        const foodsArray = foodText
          .split(/[,，、\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        await onSaveMeal({
          category: mealCategory,
          name: foodText,
          foods: foodsArray.length > 0 ? foodsArray : [foodText],
          estimatedCalories: Number(mealCalories),
          estimatedProtein: Number(mealProtein),
        });
      } else if (tab === 'workout') {
        await onSaveWorkout({
          title: workoutTitle,
          durationMinutes: Number(workoutDuration),
          exercises: [
            { name: '徒手深蹲 (Squat)', sets: 3, repsOrDuration: squatReps },
            { name: '标准俯卧撑 (Push-up)', sets: 3, repsOrDuration: pushupReps },
            { name: '后退箭步蹲 (Reverse Lunge)', sets: 3, repsOrDuration: lungeReps },
            { name: '平板支撑 (Plank)', sets: 3, repsOrDuration: plankTime },
          ],
          perceivedDifficulty: 'moderate',
          completed: true,
        });
      } else if (tab === 'body') {
        await onSaveDailyState({
          weight: Number(weight),
          sleepHours: Number(sleepHours),
          energy,
          soreness,
          notes,
        });
      }

      setIsSavedFeedback(true);
      setTimeout(() => {
        setIsSavedFeedback(false);
        onClose();
      }, 650);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#1c1917]/40 backdrop-blur-2xs cursor-pointer"
        />

        {/* Bottom Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-lg bg-[#faf8f5] border-t sm:border border-[#ded8cc] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Mobile Drag Handle */}
          <div className="w-10 h-1 bg-[#d6cfc4] rounded-full mx-auto mb-4 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#e9e4dc]">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#78716c]">
                Quick Journal · 快速记手记
              </div>
              <h3 className="text-xl font-serif font-medium text-[#1c1917]">
                10秒记下生活细节
              </h3>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#eeeae2] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-3 gap-1 my-4 p-1 bg-[#ede8df] rounded-xl text-xs font-sans font-medium">
            <button
              type="button"
              onClick={() => setTab('meal')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'meal'
                  ? 'bg-white text-[#1c1917] shadow-2xs font-semibold'
                  : 'text-[#78716c] hover:text-[#1c1917]'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>饮食</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('workout')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'workout'
                  ? 'bg-white text-[#1c1917] shadow-2xs font-semibold'
                  : 'text-[#78716c] hover:text-[#1c1917]'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              <span>徒手训练</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('body')}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'body'
                  ? 'bg-white text-[#1c1917] shadow-2xs font-semibold'
                  : 'text-[#78716c] hover:text-[#1c1917]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>身体/状态</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. MEAL */}
            {tab === 'meal' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#78716c] mb-1 font-medium">用餐时段</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'breakfast', label: '早餐' },
                      { id: 'lunch', label: '午餐' },
                      { id: 'dinner', label: '晚餐' },
                      { id: 'snack', label: '加餐' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setMealCategory(cat.id as MealCategory)}
                        className={`py-1.5 rounded-lg text-center font-medium transition-colors cursor-pointer ${
                          mealCategory === cat.id
                            ? 'bg-[#1c1917] text-white'
                            : 'bg-[#f0ebe3] text-[#78716c] hover:bg-[#e6e0d5]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[#78716c] mb-1 font-medium">食物内容 (自由文本)</label>
                  <textarea
                    rows={2}
                    value={foodText}
                    onChange={(e) => setFoodText(e.target.value)}
                    placeholder="例如：燕麦奶、香蕉、水煮蛋"
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#78716c] mb-1">估算热量 (kcal)</label>
                    <input
                      type="number"
                      value={mealCalories}
                      onChange={(e) => setMealCalories(Number(e.target.value))}
                      className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-[#1c1917] font-mono focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[#78716c] mb-1">估算蛋白质 (g)</label>
                    <input
                      type="number"
                      value={mealProtein}
                      onChange={(e) => setMealProtein(Number(e.target.value))}
                      className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-[#15803d] font-mono focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. WORKOUT */}
            {tab === 'workout' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#78716c] mb-1 font-medium">徒手动作 (严格自重无器械)</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ded8cc]">
                      <span className="font-medium text-[#1c1917]">深蹲 (Squat)</span>
                      <input
                        type="text"
                        value={squatReps}
                        onChange={(e) => setSquatReps(e.target.value)}
                        className="w-24 text-right font-mono text-[#15803d] focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ded8cc]">
                      <span className="font-medium text-[#1c1917]">俯卧撑 (Push-up)</span>
                      <input
                        type="text"
                        value={pushupReps}
                        onChange={(e) => setPushupReps(e.target.value)}
                        className="w-24 text-right font-mono text-[#15803d] focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ded8cc]">
                      <span className="font-medium text-[#1c1917]">箭步蹲 (Lunge)</span>
                      <input
                        type="text"
                        value={lungeReps}
                        onChange={(e) => setLungeReps(e.target.value)}
                        className="w-24 text-right font-mono text-[#15803d] focus:outline-hidden"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#ded8cc]">
                      <span className="font-medium text-[#1c1917]">平板支撑 (Plank)</span>
                      <input
                        type="text"
                        value={plankTime}
                        onChange={(e) => setPlankTime(e.target.value)}
                        className="w-24 text-right font-mono text-[#15803d] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[#78716c] mb-1 font-medium">练习时长 (分钟)</label>
                  <input
                    type="number"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-[#1c1917] font-mono focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* 3. BODY / STATE / SLEEP */}
            {tab === 'body' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#78716c] mb-1 font-medium">晨起体重 (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-base font-serif font-bold text-[#1c1917] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[#78716c] mb-1 font-medium">昨晚睡眠 (小时)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                      className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-base font-serif font-bold text-[#1c1917] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#ded8cc] space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1c1917]">精力状态 (Energy)</span>
                      <span className="font-mono text-[#78716c]">{energy}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setEnergy(lvl)}
                          className={`py-1 rounded-md text-center font-mono cursor-pointer ${
                            energy === lvl
                              ? 'bg-[#1c1917] text-white font-medium'
                              : 'bg-[#f5f2eb] text-[#78716c]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#1c1917]">肌肉酸痛 (Soreness)</span>
                      <span className="font-mono text-[#78716c]">{soreness}/5</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSoreness(lvl)}
                          className={`py-1 rounded-md text-center font-mono cursor-pointer ${
                            soreness === lvl
                              ? 'bg-[#78716c] text-white font-medium'
                              : 'bg-[#f5f2eb] text-[#78716c]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[#78716c] mb-1">手记备注</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="今日感触（可选）"
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-[#1c1917] text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isSavedFeedback}
                className="w-full h-11 rounded-xl bg-[#1c1917] hover:bg-[#332f2b] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                {isSavedFeedback ? (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1 text-[#4ade80]"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Saved ✓</span>
                  </motion.span>
                ) : (
                  <span>保存这笔记录</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
