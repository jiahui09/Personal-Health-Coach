import React, { useState } from 'react';
import { Check, HelpCircle } from 'lucide-react';
import { WorkoutRecommendation } from '../types/health';

interface NextWorkoutCardProps {
  nextWorkout: WorkoutRecommendation;
  isCompletedToday: boolean;
  onCompleteWorkout: () => void;
  onOpenEvidence: () => void;
  onCustomWorkout: () => void;
}

export const NextWorkoutCard: React.FC<NextWorkoutCardProps> = ({
  nextWorkout,
  isCompletedToday,
  onCompleteWorkout,
  onOpenEvidence,
  onCustomWorkout,
}) => {
  const [checkedSets, setCheckedSets] = useState<Record<number, boolean>>({});

  const toggleSetCheck = (index: number) => {
    setCheckedSets((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getTrainingStateLabel = () => {
    switch (nextWorkout.trainingState) {
      case 'LIGHT':
        return 'Light';
      case 'RECOVERY':
        return 'Recovery';
      case 'REST':
        return 'Rest';
      case 'NORMAL':
      default:
        return 'Normal';
    }
  };

  return (
    <section className="py-5 border-t border-[#ece7de] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-2xl font-serif font-medium text-[#1c1917]">
            Next Workout
          </h2>
          <span className="text-xs font-mono text-[#78716c]">
            {nextWorkout.durationMinutes} min · {getTrainingStateLabel()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEvidence}
            className="text-xs text-[#57534e] hover:text-[#1c1917] flex items-center gap-1 font-sans cursor-pointer py-1.5 px-3 rounded-lg border border-[#ded8cc] bg-white/60 hover:bg-white shadow-2xs transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Why?</span>
          </button>

          <button
            onClick={onCustomWorkout}
            className="text-xs text-[#78716c] hover:text-[#1c1917] font-sans cursor-pointer py-1 px-2 transition-colors"
          >
            自选动作
          </button>
        </div>
      </div>

      {/* Hero Action Surface */}
      <div className="rounded-2xl bg-[#fbfaf8] border border-[#e4ded5] p-5 space-y-4 shadow-2xs">
        {/* Curated Exercise List */}
        <div className="space-y-2">
          {nextWorkout.exercises.map((ex, idx) => {
            const isChecked = checkedSets[idx] || isCompletedToday;
            return (
              <div
                key={idx}
                onClick={() => toggleSetCheck(idx)}
                className={`p-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                  isChecked
                    ? 'bg-[#f4f8f4] border-[#bbf7d0] text-[#1c1917]'
                    : 'bg-white border-[#e8e2d8] hover:border-[#ded8cc]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                      isChecked
                        ? 'bg-[#15803d] border-[#15803d] text-white'
                        : 'border-[#d6cebf] bg-white hover:border-[#a8a29e]'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className={`text-xs font-medium ${isChecked ? 'text-[#1c1917]' : 'text-[#292524]'}`}>
                    {ex.name}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-medium text-[#1c1917]">
                    {ex.sets} 组 × {ex.repsOrDuration}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Footer */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#f0ebe3]">
          <div className="text-[11px] text-[#78716c]">
            {nextWorkout.recoveryGuidance || '组间休息 45–60 秒，保持呼吸平稳。'}
          </div>

          {!isCompletedToday ? (
            <button
              onClick={onCompleteWorkout}
              className="px-4 py-2 rounded-xl bg-[#1c1917] hover:bg-[#2e2a26] text-white font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>完成本次训练</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#15803d] font-medium py-1 px-3 bg-[#f0fdf4] rounded-lg border border-[#bbf7d0]">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>今日训练已完成</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
