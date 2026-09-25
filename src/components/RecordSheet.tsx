import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Utensils, Dumbbell, Activity, Feather } from 'lucide-react';
import {
  CreateDailyStateInput,
  CreateLifeLogInput,
  CreateMealInput,
  CreateWorkoutInput,
  LifeCategory,
  MealCategory,
} from '../types/health';

export type RecordTab = 'meal' | 'workout' | 'body' | 'note';

interface RecordSheetProps {
  isOpen: boolean;
  initialTab?: RecordTab;
  onClose: () => void;
  onSaveMeal: (input: CreateMealInput) => Promise<void>;
  onSaveWorkout: (input: CreateWorkoutInput) => Promise<void>;
  onSaveDailyState: (input: CreateDailyStateInput) => Promise<void>;
  onSaveNote?: (content: string, tags: string[]) => Promise<void>;
  onSaveLifeLog?: (input: CreateLifeLogInput) => Promise<void>;
}

export const RecordSheet: React.FC<RecordSheetProps> = ({
  isOpen,
  initialTab = 'meal',
  onClose,
  onSaveMeal,
  onSaveWorkout,
  onSaveDailyState,
  onSaveNote,
  onSaveLifeLog,
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
  const [stateNotes, setStateNotes] = useState('');

  // Note & Life Log Form States
  const [noteContent, setNoteContent] = useState('');
  const [lifeCategory, setLifeCategory] = useState<LifeCategory>('Coding');
  const [lifeDuration, setLifeDuration] = useState(60);
  const [lifeProject, setLifeProject] = useState('');

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
          notes: stateNotes,
        });
      } else if (tab === 'note') {
        if (noteContent.trim()) {
          if (onSaveNote) {
            await onSaveNote(noteContent.trim(), ['#living-journal']);
          }
          if (onSaveLifeLog && lifeDuration > 0) {
            await onSaveLifeLog({
              title: noteContent.slice(0, 24),
              content: noteContent.trim(),
              category: lifeCategory,
              durationMinutes: Number(lifeDuration),
              project: lifeProject.trim() || undefined,
            });
          }
        }
      }

      setIsSavedFeedback(true);
      setTimeout(() => {
        setIsSavedFeedback(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save record:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full sm:max-w-lg bg-[#faf8f5] rounded-t-3xl sm:rounded-2xl border border-[#ded8cc] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#ece7de] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#15803d]" />
            <h3 className="font-serif text-lg font-medium text-[#1c1917]">
              私人手账 · 记一笔
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#78716c] hover:text-[#1c1917] hover:bg-[#ece7de] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-4 p-1.5 mx-4 sm:mx-5 mt-4 bg-[#ede8df] rounded-xl text-xs font-sans">
          <button
            type="button"
            onClick={() => setTab('meal')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'meal'
                ? 'bg-white text-[#1c1917] font-medium shadow-xs'
                : 'text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>进食</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('workout')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'workout'
                ? 'bg-white text-[#1c1917] font-medium shadow-xs'
                : 'text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>训练</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('body')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'body'
                ? 'bg-white text-[#1c1917] font-medium shadow-xs'
                : 'text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>体征</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('note')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'note'
                ? 'bg-white text-[#1c1917] font-medium shadow-xs'
                : 'text-[#78716c] hover:text-[#1c1917]'
            }`}
          >
            <Feather className="w-3.5 h-3.5" />
            <span>手记</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {tab === 'meal' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[#78716c] mb-1">餐别</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as MealCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMealCategory(cat)}
                      className={`py-1.5 rounded-lg border text-center capitalize transition-colors cursor-pointer ${
                        mealCategory === cat
                          ? 'bg-[#1c1917] text-white border-[#1c1917]'
                          : 'bg-white border-[#e0d9cd] text-[#57534e]'
                      }`}
                    >
                      {cat === 'breakfast'
                        ? '早餐'
                        : cat === 'lunch'
                        ? '午餐'
                        : cat === 'dinner'
                        ? '晚餐'
                        : '加餐'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">摄入食物（逗号分隔）</label>
                <input
                  type="text"
                  required
                  value={foodText}
                  onChange={(e) => setFoodText(e.target.value)}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  placeholder="例如：去皮鸡腿肉、糙米饭、清炒西兰花"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#78716c] mb-1">估计热量 (kcal)</label>
                  <input
                    type="number"
                    min="50"
                    max="2000"
                    value={mealCalories}
                    onChange={(e) => setMealCalories(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>
                <div>
                  <label className="block text-[#78716c] mb-1">估计蛋白质 (g)</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    value={mealProtein}
                    onChange={(e) => setMealProtein(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'workout' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[#78716c] mb-1">练习标题 (纯徒手动作)</label>
                <input
                  type="text"
                  required
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  placeholder="徒手自重循环"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] space-y-1">
                  <div className="text-[#78716c]">深蹲组次</div>
                  <input
                    type="text"
                    value={squatReps}
                    onChange={(e) => setSquatReps(e.target.value)}
                    className="w-full bg-[#fbfaf8] border border-[#e2dcd1] rounded px-2 py-1 font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] space-y-1">
                  <div className="text-[#78716c]">俯卧撑组次</div>
                  <input
                    type="text"
                    value={pushupReps}
                    onChange={(e) => setPushupReps(e.target.value)}
                    className="w-full bg-[#fbfaf8] border border-[#e2dcd1] rounded px-2 py-1 font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] space-y-1">
                  <div className="text-[#78716c]">箭步蹲组次</div>
                  <input
                    type="text"
                    value={lungeReps}
                    onChange={(e) => setLungeReps(e.target.value)}
                    className="w-full bg-[#fbfaf8] border border-[#e2dcd1] rounded px-2 py-1 font-mono text-xs"
                  />
                </div>

                <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] space-y-1">
                  <div className="text-[#78716c]">平板支撑时间</div>
                  <input
                    type="text"
                    value={plankTime}
                    onChange={(e) => setPlankTime(e.target.value)}
                    className="w-full bg-[#fbfaf8] border border-[#e2dcd1] rounded px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">持续时长 (分钟)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={workoutDuration}
                  onChange={(e) => setWorkoutDuration(Number(e.target.value))}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                />
              </div>
            </div>
          )}

          {tab === 'body' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#78716c] mb-1">今日体重 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>

                <div>
                  <label className="block text-[#78716c] mb-1">睡眠时长 (小时)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="3"
                    max="14"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">精力感知 (1=疲倦, 5=充沛): {energy}/5</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEnergy(lvl)}
                      className={`flex-1 py-1.5 rounded-lg border text-center font-mono cursor-pointer ${
                        energy === lvl
                          ? 'bg-[#d97706] text-white border-[#d97706]'
                          : 'bg-white border-[#e0d9cd] text-[#57534e]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">肌肉酸痛 (1=无, 5=较强): {soreness}/5</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSoreness(lvl)}
                      className={`flex-1 py-1.5 rounded-lg border text-center font-mono cursor-pointer ${
                        soreness === lvl
                          ? 'bg-[#78716c] text-white border-[#78716c]'
                          : 'bg-white border-[#e0d9cd] text-[#57534e]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">随笔备注 (可选)</label>
                <input
                  type="text"
                  value={stateNotes}
                  onChange={(e) => setStateNotes(e.target.value)}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  placeholder="昨夜入睡感受，晨起精神等..."
                />
              </div>
            </div>
          )}

          {tab === 'note' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[#78716c] mb-1">手记内容 / 瞬间记录</label>
                <textarea
                  rows={3}
                  required
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl p-3 text-sm text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  placeholder="例如：今天终于把这个项目的核心模型想清楚了。记录事实，模型计算，给出下一步..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#78716c] mb-1">生活领域分类</label>
                  <select
                    value={lifeCategory}
                    onChange={(e) => setLifeCategory(e.target.value as LifeCategory)}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 text-xs text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  >
                    <option value="Coding">Coding (编码与架构)</option>
                    <option value="Learning">Learning (研读与探索)</option>
                    <option value="Exercise">Exercise (身体与运动)</option>
                    <option value="Reading">Reading (阅读与文献)</option>
                    <option value="Life">Life (日常生活)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#78716c] mb-1">投入时长 (分钟)</label>
                  <input
                    type="number"
                    min="0"
                    max="600"
                    value={lifeDuration}
                    onChange={(e) => setLifeDuration(Number(e.target.value))}
                    className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-2 font-mono text-xs text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#78716c] mb-1">所属项目 / 议题 (可选)</label>
                <input
                  type="text"
                  value={lifeProject}
                  onChange={(e) => setLifeProject(e.target.value)}
                  className="w-full bg-white border border-[#ded8cc] rounded-xl px-3 py-1.5 text-xs text-[#1c1917] focus:outline-hidden focus:border-[#15803d]"
                  placeholder="如：Personal Health Coach, Metabolic Research..."
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-[#1c1917] hover:bg-[#2d2824] text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSavedFeedback ? (
                <>
                  <Check className="w-4 h-4 text-[#4ade80]" />
                  <span>已保存入手账</span>
                </>
              ) : (
                <span>确认存入手账</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
