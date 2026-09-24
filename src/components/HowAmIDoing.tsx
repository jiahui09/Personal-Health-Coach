import React from 'react';
import { Moon, Sparkles, Activity } from 'lucide-react';
import { DailyState } from '../types/health';

interface HowAmIDoingProps {
  state: DailyState;
  onUpdateMetric: (key: 'energy' | 'soreness', val: number) => void;
}

export const HowAmIDoing: React.FC<HowAmIDoingProps> = ({
  state,
  onUpdateMetric,
}) => {
  const getEnergyLabel = (val: number) => {
    switch (val) {
      case 5: return '很充沛';
      case 4: return '良好';
      case 3: return '平稳';
      case 2: return '偏累';
      default: return '疲倦';
    }
  };

  const getSorenessLabel = (val: number) => {
    switch (val) {
      case 1: return '无酸痛';
      case 2: return '轻微';
      case 3: return '适度';
      case 4: return '明显';
      default: return '较强';
    }
  };

  const sleepHours = Math.floor(state.sleepHours);
  const sleepMinutes = Math.round((state.sleepHours - sleepHours) * 60);

  return (
    <section className="py-4 border-t border-[#ece7de] space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#78716c]">
          How am I doing? · 今日状态
        </h2>
        <span className="text-[11px] text-[#a8a29e] font-sans">
          轻按圆点可随时调校体感
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Sleep Duration */}
        <div className="py-3 px-3.5 rounded-xl bg-[#f7f5f0] border border-[#e8e2d8] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716c]">
            <span className="flex items-center gap-1.5 font-sans">
              <Moon className="w-3.5 h-3.5 text-[#6366f1]" />
              <span>睡眠时长</span>
            </span>
            <span className="text-[11px] font-mono text-[#a8a29e]">
              {state.sleepBedtime && state.sleepWakeup ? `${state.sleepBedtime} → ${state.sleepWakeup}` : '昨晚'}
            </span>
          </div>
          <div className="text-xl font-serif text-[#1c1917] font-medium pt-0.5 tabular-nums">
            {sleepHours}h {sleepMinutes > 0 ? `${sleepMinutes}m` : ''}
          </div>
          <div className="text-[11px] text-[#15803d] font-sans">
            睡眠平稳，支持白天日常机能
          </div>
        </div>

        {/* Energy 1-5 */}
        <div className="py-3 px-3.5 rounded-xl bg-[#f7f5f0] border border-[#e8e2d8] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716c]">
            <span className="flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
              <span>精力感知</span>
            </span>
            <span className="text-xs text-[#1c1917] font-medium font-sans">
              {getEnergyLabel(state.energy)}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onUpdateMetric('energy', lvl)}
                className="group p-0.5 focus:outline-hidden cursor-pointer"
                title={`精力设为 ${lvl}/5`}
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    lvl <= state.energy
                      ? 'bg-[#d97706]'
                      : 'bg-[#ded8cc] group-hover:bg-[#c9c1b3]'
                  }`}
                />
              </button>
            ))}
            <span className="ml-1 text-xs font-mono text-[#78716c] tabular-nums">
              {state.energy}/5
            </span>
          </div>
          <div className="text-[11px] text-[#78716c] font-sans">
            输入自适应训练负荷的参考依据
          </div>
        </div>

        {/* Soreness 1-5 */}
        <div className="py-3 px-3.5 rounded-xl bg-[#f7f5f0] border border-[#e8e2d8] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716c]">
            <span className="flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-[#78716c]" />
              <span>肌肉酸痛</span>
            </span>
            <span className="text-xs text-[#1c1917] font-medium font-sans">
              {getSorenessLabel(state.soreness)}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onUpdateMetric('soreness', lvl)}
                className="group p-0.5 focus:outline-hidden cursor-pointer"
                title={`酸痛设为 ${lvl}/5`}
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                    lvl <= state.soreness
                      ? 'bg-[#78716c]'
                      : 'bg-[#ded8cc] group-hover:bg-[#c9c1b3]'
                  }`}
                />
              </button>
            ))}
            <span className="ml-1 text-xs font-mono text-[#78716c] tabular-nums">
              {state.soreness}/5
            </span>
          </div>
          <div className="text-[11px] text-[#78716c] font-sans">
            引导身体在自重练习中避开过度酸胀
          </div>
        </div>
      </div>
    </section>
  );
};
