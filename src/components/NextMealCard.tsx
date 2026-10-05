// Serif for the chapter heading and the meal name; measured numbers stay sans. deslop-ignore-file 07
import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { MealRecommendation } from '../types/health';

interface NextMealCardProps {
  nextMeal: MealRecommendation;
  slotLabel: string;
  goalLabel: string;
  /** 今日已入账的建议膳数（同膳重复照准的提示，避免无意识重复录入）。 */
  suggestedLoggedToday: number;
  onQuickLogSuggested: () => void | Promise<unknown>;
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
  /** 照准进行中：单发闸在 App 亦有,此处先禁按钮,免得连点两下记两笔。 */
  const [logging, setLogging] = useState(false);

  const handleQuickLog = async () => {
    if (logging) return;
    setLogging(true);
    try {
      await onQuickLogSuggested();
    } finally {
      setLogging(false);
    }
  };

  const energy = nextMeal.energyRange
    ? `${nextMeal.energyRange.min}–${nextMeal.energyRange.max}`
    : nextMeal.estimatedCalories;
  const protein = nextMeal.proteinRange
    ? `${nextMeal.proteinRange.min}–${nextMeal.proteinRange.max}`
    : nextMeal.estimatedProtein;

  return (
    <div>
      {/* 组题行：下一膳在「营养摄入」节内为一组,朱批与右注同排 */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="group-head">下一膳</span>
        <span className="flex items-baseline gap-3 text-[12px]">
          {!nextMeal.unavailable && <span className="text-accent">照{goalLabel}</span>}
          <span className="text-ink3">
            {nextMeal.unavailable
              ? '暂无建议'
              : suggestedLoggedToday > 0
              ? `${slotLabel} · 建议已录 ${suggestedLoggedToday} 次`
              : `${slotLabel} · 未入账`}
          </span>
        </span>
      </div>

      <div className="mt-4">
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

        {/* 动作脚注行：左数值组（墨）,右动作组（御批）；无建议时不显 0 千卡、不给照准,
            左列留空位以保动作仍靠右成行 */}
        <div className="section-actions">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {nextMeal.unavailable ? (
              <div aria-hidden />
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <button onClick={onAddCustomMeal} className="btn-link px-2">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>别录一品</span>
            </button>
            {!nextMeal.unavailable && (
              <button
                onClick={() => void handleQuickLog()}
                disabled={logging}
                className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span>照准</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
