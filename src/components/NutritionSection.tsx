// 营养摄入通栏：目标 → 两笔账 → 下一膳 → 所食账（计划与实测分列，一账读到底）。
// Serif for the section head and the meal name; meters stay sans. deslop-ignore-file 07 28
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { MealRecord } from '../types/health';
import type { NutritionSummary, NutritionTargets } from '../domain/types';
import { round1, toPercent } from '../domain/format';
import { SectionHead } from './SectionHead';
import { RuleMeter } from './RuleMeter';
import { NextMealCard } from './NextMealCard';

interface NutritionSectionProps {
  /** 体征派生的每日目标；null = 未建档无目标。 */
  targets: NutritionTargets | null;
  /** 练日上浮后的今日之标（非练日缺席，与 targets 同义）。 */
  trainingDayTargets: NutritionTargets | null;
  nutrition: NutritionSummary;
  /** 今日已入账的膳（供核对与逐条掷还）。 */
  meals: MealRecord[];
  onDeleteMeal: (id: string) => void;
  nextMeal: Parameters<typeof NextMealCard>[0]['nextMeal'];
  slotLabel: string;
  goalLabel: string;
  suggestedLoggedToday: number;
  onQuickLogSuggested: () => void | Promise<unknown>;
  onAddCustomMeal: () => void;
}

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className="inkrow-value text-[13px] text-ink">{children}</span>
  </div>
);

/** 营养摄入 —— 定数、两笔账、下一膳与今日所食（履行与计划同栏对照）。 */
export const NutritionSection: React.FC<NutritionSectionProps> = ({
  targets,
  trainingDayTargets,
  nutrition,
  meals,
  onDeleteMeal,
  nextMeal,
  slotLabel,
  goalLabel,
  suggestedLoggedToday,
  onQuickLogSuggested,
  onAddCustomMeal,
}) => {
  /** 今日所食默认摊开：今日所食是本节的账,不该多点一下才看得见（仍可收起）。 */
  const [showMealLog, setShowMealLog] = useState(true);
  const effective = trainingDayTargets ?? targets;
  const nutritionFlagged = nutrition.quality.flag === 'needs_review';

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="营养摄入"
        verdict={nutritionFlagged ? '待核' : undefined}
        note={<span className="text-[12px] text-ink3">依体征与所选目标计</span>}
      />

      {/* 一、今日之标：练日上浮者即今日之数（未建档无标不出行） */}
      {effective && (
        <div className="mt-4">
          <Row label="每日热量">
            <span className="font-semibold">{effective.caloriesKcal}</span> 千卡
            {trainingDayTargets && <span className="text-ink3"> · 练日</span>}
          </Row>
          <Row label="每日蛋白">
            <span className="font-semibold">{effective.proteinG}</span> 克
            <span className="hidden sm:inline text-ink3">
              {' '}
              （{effective.proteinRange.min}–{effective.proteinRange.max}）
            </span>
            {trainingDayTargets && <span className="text-ink3"> · 练日</span>}
          </Row>
          <Row label="每日脂肪">
            <span className="font-semibold">{effective.fatG}</span> 克
            <span className="hidden sm:inline text-ink3">
              {' '}
              （{effective.fatRange.min}–{effective.fatRange.max}）
            </span>
          </Row>
          <Row label="每日碳水">
            <span className="font-semibold">{effective.carbG}</span> 克
          </Row>
        </div>
      )}

      {/* 二、两笔账：尚余/已超逐项直说,不以「尚余 0」遮羞 */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <span className="group-head">两笔账</span>
          <span className="text-[13px] tabular-nums">
            {nutrition.calories.status === 'no_target' ? (
              <span className="text-ink3">
                已录 <span className="font-semibold text-ink">{round1(nutrition.protein.consumed)}</span> g ·{' '}
                <span className="font-semibold text-ink">{round1(nutrition.calories.consumed)}</span> 千卡
              </span>
            ) : nutrition.protein.status === 'over' || nutrition.calories.status === 'over' ? (
              <span className="text-danger font-semibold">
                已超
                {nutrition.protein.status === 'over' && <> {round1(nutrition.protein.over)} g</>}
                {nutrition.protein.status === 'over' && nutrition.calories.status === 'over' && ' ·'}
                {nutrition.calories.status === 'over' && <> {round1(nutrition.calories.over)} 千卡</>}
              </span>
            ) : (
              <>
                <span className="text-ink3">尚余</span>{' '}
                <span className="font-semibold text-ink">{round1(nutrition.protein.remaining)}</span> g ·{' '}
                <span className="font-semibold text-ink">{round1(nutrition.calories.remaining)}</span> 千卡
              </>
            )}
          </span>
        </div>

        <div className="mt-1">
          <RuleMeter
            className="inkrow-dotted"
            label="蛋白质"
            value={nutrition.protein.consumed}
            max={nutrition.protein.target}
            unit="g"
            tone={
              nutrition.protein.status === 'over'
                ? 'danger'
                : nutrition.protein.status === 'met'
                ? 'accent'
                : 'ink'
            }
          />
          <RuleMeter
            className="inkrow-dotted"
            label="热量"
            value={nutrition.calories.consumed}
            max={nutrition.calories.target}
            unit="千卡"
            tone={
              nutrition.calories.status === 'over'
                ? 'danger'
                : nutrition.calories.status === 'met'
                ? 'accent'
                : 'ink'
            }
          />
        </div>

        {nutritionFlagged && (
          <p className="mt-2 text-[12px] text-danger">
            越常度 {toPercent(nutrition.calories.ratio)}% · 可逐条掷还
          </p>
        )}
      </div>

      {/* 三、下一膳：计划之膳（未入账），照准即落账 */}
      <div className="mt-5 pt-4 border-t border-line">
        <NextMealCard
          nextMeal={nextMeal}
          slotLabel={slotLabel}
          goalLabel={goalLabel}
          suggestedLoggedToday={suggestedLoggedToday}
          onQuickLogSuggested={onQuickLogSuggested}
          onAddCustomMeal={onAddCustomMeal}
        />
      </div>

      {/* 四、今日所食：逐条核对与掷还 */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <button
            onClick={() => setShowMealLog(!showMealLog)}
            aria-expanded={showMealLog}
            className="btn-link"
          >
            <span className="group-head">今日所食 · {nutrition.mealCount} 膳</span>
            {showMealLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showMealLog && meals.length > 0 && (
          <div className="mt-2 border-t border-line">
            {meals.map((meal) => (
              <div key={meal.id} className="inklist-row inklist-dotted text-[12px]">
                <span className="text-ink3 tabular-nums shrink-0">{meal.time}</span>
                <span className="text-ink truncate">{meal.name || meal.foods.join('、')}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-ink3 tabular-nums">
                    {meal.estimatedCalories} 千卡 · {meal.estimatedProtein} g
                  </span>
                  <button
                    onClick={() => onDeleteMeal(meal.id)}
                    className="p-1.5 -m-1 text-ink4 hover:text-danger transition-colors cursor-pointer"
                    title="掷还"
                    aria-label={`掷还 ${meal.name || meal.foods.join('、')}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {showMealLog && meals.length === 0 && (
          <p className="mt-2 border-t border-line pt-2 text-[12px] text-ink3">
            今日尚未入账一膳 · 由「记一笔」录之
          </p>
        )}
      </div>
    </section>
  );
};
