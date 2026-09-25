// Serif for the chapter heading and the meal name; measured numbers stay sans. deslop-ignore-file 07
import React from 'react';
import { Check, Plus } from 'lucide-react';
import { MealRecommendation } from '../types/health';
import { SectionHead } from './SectionHead';

interface NextMealCardProps {
  nextMeal: MealRecommendation;
  slotLabel: string;
  goalLabel: string;
  /** 今日已入账的建议膳数（同膳重复照准的提示，避免无意识重复录入）。 */
  suggestedLoggedToday: number;
  onQuickLogSuggested: () => void;
  onAddCustomMeal: () => void;
}

export const NextMealCard: React.FC<NextMealCardProps> = ({
  nextMeal,
  slotLabel,
  goalLabel,
  suggestedLoggedToday,
  onQuickLogSuggested,
  onAddCustomMeal,
}) => {
  const energy = nextMeal.energyRange
    ? `${nextMeal.energyRange.min}–${nextMeal.energyRange.max}`
    : nextMeal.estimatedCalories;
  const protein = nextMeal.proteinRange
    ? `${nextMeal.proteinRange.min}–${nextMeal.proteinRange.max}`
    : nextMeal.estimatedProtein;

  return (
    <section className="pt-10 lg:pr-9">
      {/* 章节题：其二 · 下一膳（统一章节头 + 朱批旁注「照…之期」） */}
      <SectionHead
        ordinal="其二"
        title="下一膳"
        verdict={`照${goalLabel}`}
        note={
          <span className="text-[12px] text-ink3">{slotLabel} · 未入账</span>
        }
      />

      <div className="mt-5">
        {nextMeal.unavailable ? (
          <p className="text-[15px] leading-[1.95] text-ink2">{nextMeal.reason}</p>
        ) : (
          <>
        <div className="font-serif text-[27px] sm:text-[31px] font-bold text-ink leading-[1.35]">
          {nextMeal.mealName}
        </div>

        <div className="mt-2.5 text-[14.5px] text-ink2 tracking-wide">
          {nextMeal.suggestedItems.join('／')}
        </div>

        <p className="mt-3.5 text-[14.5px] text-ink2 leading-[1.85] max-w-[54ch]">
          {nextMeal.reason}
        </p>
        {suggestedLoggedToday > 0 && (
          <p className="mt-2 text-[12px] text-danger">
            今日已照准 {suggestedLoggedToday} 次 · 请核是否重复
          </p>
        )}
          </>
        )}

        {/* 动作脚注行：左数值组（墨）,右动作组（御批）；窄屏整行另起,不再浮在菜名上方 */}
        <div className="section-actions">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="font-serif text-[26px] sm:text-[28px] font-bold text-ink leading-none tabular-nums whitespace-nowrap">
                {energy}
              </div>
              <div className="text-[12px] text-ink3 tracking-[0.14em] mt-2">千卡</div>
            </div>
            <div>
              <div className="font-serif text-[26px] sm:text-[28px] font-bold text-ink leading-none tabular-nums whitespace-nowrap">
                {protein}g
              </div>
              <div className="text-[12px] text-ink3 tracking-[0.14em] mt-2">蛋白质</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button onClick={onAddCustomMeal} className="btn-link px-2">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>别录一品</span>
            </button>
            <button onClick={onQuickLogSuggested} className="btn-primary whitespace-nowrap">
              <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
              <span>照准</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
