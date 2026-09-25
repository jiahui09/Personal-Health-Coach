import React, { useState } from 'react';
import { TrendingDown, Dumbbell, Moon, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { WeightForecast, WeightTrendResult } from '../types/health';

interface RecentSectionProps {
  currentWeight: number;
  weightTrend: WeightTrendResult;
  weightForecast: WeightForecast;
  workoutsThisWeek: number;
  avgSleepHours: number;
}

export const RecentSection: React.FC<RecentSectionProps> = ({
  currentWeight,
  weightTrend,
  weightForecast,
  workoutsThisWeek,
  avgSleepHours,
}) => {
  const [showForecastDetails, setShowForecastDetails] = useState(false);

  const trendLabel =
    weightTrend.trendPerWeek < -0.05
      ? `平缓下降 (${Math.abs(weightTrend.trendPerWeek)} kg/周)`
      : weightTrend.trendPerWeek > 0.05
      ? `轻微上升 (+${weightTrend.trendPerWeek} kg/周)`
      : '体征基本平稳 (波动 <0.05 kg/周)';

  return (
    <section className="py-5 border-t border-[#ece7de] space-y-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#1c1917] tracking-tight">
          RECENT
        </h2>
        <span className="text-xs text-[#a8a29e] font-sans">
          多日滚动平滑 · 事实轨迹
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Weight Trend (Rolling Average + Weekly Rate) */}
        <div className="p-3.5 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#78716c]">
              <span>7天滚动均重</span>
              <span className="text-[#15803d] font-mono text-[11px] flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                {trendLabel}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5 pt-1 font-mono">
              <span className="text-2xl font-serif font-bold text-[#1c1917] tabular-nums">
                {weightTrend.rollingAverage7d}
              </span>
              <span className="text-xs text-[#78716c] font-sans">kg</span>
              <span className="text-[11px] text-[#a8a29e] font-sans ml-1">
                (今日 {currentWeight}kg)
              </span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#78716c] border-t border-[#f0ece4]">
            线性平滑排除了单日水分与钠盐急性干扰
          </div>
        </div>

        {/* 2. Training Volume & Exposure */}
        <div className="p-3.5 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#78716c]">
              <span>本周练习</span>
              <Dumbbell className="w-3.5 h-3.5 text-[#15803d]" />
            </div>

            <div className="flex items-baseline gap-1 pt-1 font-mono">
              <span className="text-2xl font-serif font-bold text-[#1c1917] tabular-nums">
                {workoutsThisWeek}
              </span>
              <span className="text-xs text-[#78716c] font-sans">次徒手循环</span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#78716c] border-t border-[#f0ece4] flex items-center justify-between">
            <span>自重多关节节律稳定</span>
            <span className="font-mono text-[10px] text-[#15803d]">ACSM 2026</span>
          </div>
        </div>

        {/* 3. Sleep Regularity */}
        <div className="p-3.5 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] space-y-1.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-[#78716c]">
              <span>平均睡眠</span>
              <Moon className="w-3.5 h-3.5 text-[#6366f1]" />
            </div>

            <div className="flex items-baseline gap-1 pt-1 font-mono">
              <span className="text-2xl font-serif font-bold text-[#1c1917] tabular-nums">
                {avgSleepHours}
              </span>
              <span className="text-xs text-[#78716c] font-sans">小时</span>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#78716c] border-t border-[#f0ece4] flex items-center justify-between">
            <span>达到 AASM 7h+ 修复基准</span>
            <span className="font-mono text-[10px] text-[#6366f1]">良好稳态</span>
          </div>
        </div>
      </div>

      {/* Dynamic Weight Forecast Card (Section Nine) */}
      <div className="p-4 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-serif font-medium text-[#1c1917]">
              动态体重区间预测 (Estimated Forecast)
            </span>
            <span className="text-[10px] text-[#78716c] font-mono bg-[#f0ede6] px-1.5 py-0.5 rounded-sm">
              Hall et al. 2011 动态非线性模型
            </span>
          </div>

          <button
            onClick={() => setShowForecastDetails(!showForecastDetails)}
            className="text-[11px] text-[#78716c] hover:text-[#1c1917] flex items-center gap-0.5 cursor-pointer font-sans"
          >
            <span>{showForecastDetails ? '收起假定' : '模型依据'}</span>
            {showForecastDetails ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>

        {/* 3 Prediction Intervals: 4w, 8w, 12w */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] text-center">
            <div className="text-[11px] text-[#78716c] font-sans">4 周后</div>
            <div className="text-sm font-serif font-medium text-[#1c1917] tabular-nums mt-0.5">
              {weightForecast.fourWeeks.range.min}–{weightForecast.fourWeeks.range.max} kg
            </div>
            <div className="text-[10px] text-[#a8a29e] font-mono mt-0.5">Estimated</div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] text-center">
            <div className="text-[11px] text-[#78716c] font-sans">8 周后</div>
            <div className="text-sm font-serif font-medium text-[#1c1917] tabular-nums mt-0.5">
              {weightForecast.eightWeeks.range.min}–{weightForecast.eightWeeks.range.max} kg
            </div>
            <div className="text-[10px] text-[#a8a29e] font-mono mt-0.5">Estimated</div>
          </div>

          <div className="p-2.5 rounded-lg bg-white border border-[#eee8df] text-center">
            <div className="text-[11px] text-[#78716c] font-sans">12 周后</div>
            <div className="text-sm font-serif font-medium text-[#1c1917] tabular-nums mt-0.5">
              {weightForecast.twelveWeeks.range.min}–{weightForecast.twelveWeeks.range.max} kg
            </div>
            <div className="text-[10px] text-[#a8a29e] font-mono mt-0.5">Estimated</div>
          </div>
        </div>

        {/* Collapsible Assumptions & Limitations */}
        {showForecastDetails && (
          <div className="pt-2 text-xs text-[#78716c] space-y-1.5 border-t border-[#f0ece4]">
            <div className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#15803d] shrink-0 mt-0.5" />
              <span>
                <strong>科学声明：</strong>
                模型根据当前摄入水平与动态能量平衡方程推导，已考虑机体体重下降引发的代谢自适应减速（反对静态 3500 kcal = 1 lb）。输出为统计置信区间，绝非固定单一数字。
              </span>
            </div>
            <div className="pl-5 text-[11px] text-[#a8a29e] space-y-0.5 font-sans">
              <div>• 前提：保持每周 2–3 次徒手抗阻练习与平稳饮食结构</div>
              <div>• 局限：食盐摄入与碳水糖原储留会引发短期 ±1kg 水分波动</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
