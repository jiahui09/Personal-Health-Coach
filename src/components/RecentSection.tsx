// Serif for the section heading only; facts read as ruled journal rows. deslop-ignore-file 07
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { MealRecord } from '../types/health';
import type {
  NutritionSummary,
  SleepSummary,
  TrainingSummary,
  WeightSummary,
} from '../domain/types';
import { formatAbs, round1, toPercent } from '../domain/format';
import { SLEEP_REFERENCE_HOURS } from '../domain/policy';
import { SectionHead } from './SectionHead';
import { RuleMeter } from './RuleMeter';
import { cnCount } from '../utils/cnCount';

interface RecentSectionProps {
  /** 全部为 domain 派生结果；组件只负责措辞与排版。 */
  weight: WeightSummary;
  nutrition: NutritionSummary;
  sleep: SleepSummary;
  training: TrainingSummary;
  /** 今日已入账的膳（供核对与逐条掷还）。 */
  meals: MealRecord[];
  onDeleteMeal: (id: string) => void;
}

const VALUE = 'inkrow-value text-[13px] text-ink';
const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

/** 单纯事实行：名 …… 值（点线引导落在中列,与计量条同轴） */
const FactRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className={VALUE}>{children}</span>
  </div>
);

export const RecentSection: React.FC<RecentSectionProps> = ({
  weight,
  nutrition,
  sleep,
  training,
  meals,
  onDeleteMeal,
}) => {
  const [showMealLog, setShowMealLog] = useState(false);

  const { resistance } = training;
  const weightFlagged = weight.quality.flag === 'needs_review';
  const nutritionFlagged = nutrition.quality.flag === 'needs_review';
  const trendAbs = weight.trendKgPerWeek === null ? null : formatAbs(weight.trendKgPerWeek, 2);
  const trendSign =
    weight.direction === 'up' ? '+' : weight.direction === 'down' ? '−' : '';

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="近况"
        verdict={resistance.met ? '抗阻合议' : `尚差${cnCount(resistance.remaining)}日`}
        note={<span className="text-xs text-ink3 tracking-[0.1em]">近七日</span>}
      />

      {/* 一、近七日实测：体重、训练、睡眠同入一张行文表 */}
      <div className="mt-4">
        <FactRow label="体重">
          {weight.rollingMean7d === null ? (
            '数据不足'
          ) : (
            <>
              <span className="hidden sm:inline">均 </span>
              <span className="font-semibold">{weight.rollingMean7d}</span>
              <span className="hidden sm:inline"> 公斤</span> ·{' '}
              <span className="font-semibold">
                {trendAbs === null ? '—' : `${trendSign}${trendAbs}`}
              </span>
              /周
            </>
          )}
        </FactRow>

        <RuleMeter
          className="inkrow-dotted"
          label="抗阻"
          value={resistance.completed}
          max={resistance.target}
          unit="次"
          tone={resistance.met ? 'accent' : 'ink'}
          suffix={resistance.met ? '合议' : '未合议'}
          suffixTone={resistance.met ? 'accent' : 'muted'}
        />

        <RuleMeter
          className="inkrow-dotted"
          percent={false}
          label="睡均"
          value={sleep.avgHours ?? 0}
          max={SLEEP_REFERENCE_HOURS}
          unit="h"
          tone={sleep.meetsReference ? 'accent' : 'ink'}
          suffix={
            sleep.meetsReference === null ? '未录' : sleep.meetsReference ? '合议' : '未合议'
          }
          suffixTone={sleep.meetsReference ? 'accent' : 'muted'}
        />
      </div>

      {/* 二、今日所食：目标来自体征档派生值 */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <button onClick={() => setShowMealLog(!showMealLog)} className="btn-link">
            <span className="group-head">今日所食 · {nutrition.mealCount} 膳</span>
            {showMealLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <span className="text-[13px] tabular-nums">
            {nutrition.protein.status === 'over' || nutrition.calories.status === 'over' ? (
              <span className="text-danger font-semibold">
                已超 {round1(nutrition.protein.over)} g · {round1(nutrition.calories.over)} 千卡
              </span>
            ) : (
              <>
                <span className="text-ink3">尚余</span>{' '}
                <span className="font-semibold text-ink">
                  {round1(nutrition.protein.remaining)}
                </span>{' '}
                g ·{' '}
                <span className="font-semibold text-ink">
                  {round1(nutrition.calories.remaining)}
                </span>{' '}
                千卡
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
                    className="p-1 text-ink4 hover:text-danger transition-colors cursor-pointer"
                    title="掷还"
                    aria-label={`掷还 ${meal.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {weightFlagged && (
        <p className="mt-3 text-[12px] text-danger">
          体重待核 · 较近七日均重低 {formatAbs(Number(weight.quality.detail.deltaKg))} 公斤
        </p>
      )}
    </section>
  );
};
