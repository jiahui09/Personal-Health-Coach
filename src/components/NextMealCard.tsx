import React from 'react';
import { Check, Plus, HelpCircle } from 'lucide-react';
import { MealRecommendation } from '../types/health';

interface NextMealCardProps {
  nextMeal: MealRecommendation;
  onOpenEvidence: () => void;
  onQuickLogSuggested: () => void;
  onAddCustomMeal: () => void;
}

export const NextMealCard: React.FC<NextMealCardProps> = ({
  nextMeal,
  onOpenEvidence,
  onQuickLogSuggested,
  onAddCustomMeal,
}) => {
  return (
    <section className="py-5 border-t border-[#ece7de] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-medium text-[#1c1917]">
          Next Meal
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenEvidence}
            className="text-xs text-[#57534e] hover:text-[#1c1917] flex items-center gap-1 font-sans cursor-pointer py-1.5 px-3 rounded-lg border border-[#ded8cc] bg-white/60 hover:bg-white shadow-2xs transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#15803d]" />
            <span>Why?</span>
          </button>

          <button
            onClick={onAddCustomMeal}
            className="text-xs text-[#78716c] hover:text-[#1c1917] px-2 py-1 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>自选记录</span>
          </button>
        </div>
      </div>

      {/* Hero Action Surface */}
      <div className="rounded-2xl bg-[#fbfaf8] border border-[#e4ded5] p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div>
            <div className="text-lg font-serif font-medium text-[#1c1917]">
              {nextMeal.mealName}
            </div>
            <div className="text-sm text-[#57534e] mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {nextMeal.suggestedItems.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#a8a29e]" />
                  <span>{item}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <div className="sm:text-right">
              <div className="text-base font-serif font-medium text-[#1c1917] tabular-nums">
                ≈ {nextMeal.energyRange ? `${nextMeal.energyRange.min}–${nextMeal.energyRange.max}` : nextMeal.estimatedCalories} <span className="text-xs font-sans text-[#78716c]">kcal</span>
              </div>
              <div className="text-xs text-[#15803d] font-mono mt-0.5">
                ≈ {nextMeal.proteinRange ? `${nextMeal.proteinRange.min}–${nextMeal.proteinRange.max}` : nextMeal.estimatedProtein}g protein
              </div>
            </div>

            <button
              onClick={onQuickLogSuggested}
              className="text-xs font-medium text-[#15803d] bg-[#f0fdf4] hover:bg-[#dcfce7] border border-[#bbf7d0] px-3.5 py-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>按此记录</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
