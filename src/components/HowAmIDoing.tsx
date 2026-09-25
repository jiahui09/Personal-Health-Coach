// Inline 1–5 circles on the shared ruled rows; no metric cells. deslop-ignore-file 19 28
import React from 'react';
import { DailyState } from '../types/health';
import type { SleepSummary } from '../domain/types';
import { formatNightDuration } from '../domain/format';

interface HowAmIDoingProps {
  state: DailyState;
  /** 今日与近七日之眠（单一来源解析后的结果）。 */
  sleep: SleepSummary;
  onUpdateMetric: (key: 'energy' | 'soreness', val: number) => void;
}

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';
const VALUE = 'inkrow-value text-[13px] text-ink';

export const HowAmIDoing: React.FC<HowAmIDoingProps> = ({ state, sleep, onUpdateMetric }) => {
  const getEnergyLabel = (val: number) => {
    switch (val) {
      case 5:
        return '甚充沛';
      case 4:
        return '健';
      case 3:
        return '平';
      case 2:
        return '微倦';
      default:
        return '惫';
    }
  };

  const getSorenessLabel = (val: number) => {
    switch (val) {
      case 1:
        return '无恙';
      case 2:
        return '微酸';
      case 3:
        return '酸楚';
      case 4:
        return '酸沉';
      default:
        return '沉痛';
    }
  };

  const night = sleep.today;

  const dots = (value: number, key: 'energy' | 'soreness', label: string) => (
    <span className="inkrow-mid flex gap-1">
      {[1, 2, 3, 4, 5].map((lvl) => (
        <button
          key={lvl}
          type="button"
          onClick={() => onUpdateMetric(key, lvl)}
          /* 热区 24×24（圆点视觉尺寸不变）；焦点环由全局 :focus-visible 提供 */
          className="group w-6 h-6 grid place-items-center cursor-pointer"
          aria-label={`${label}记为 ${lvl}/5`}
          aria-pressed={value === lvl}
        >
          <span
            className={`block w-3 h-3 rounded-full transition-colors duration-150 ${
              lvl <= value ? 'bg-ink' : 'bg-hair group-hover:bg-linehover'
            }`}
          />
        </button>
      ))}
    </span>
  );

  return (
    <div className="mt-5 pt-4 border-t border-line">
      <div className="group-head">今日体感</div>

      <div className="mt-1">
        <div className="inkrow inkrow-dotted">
          <span className={LABEL}>夜眠</span>
          <span className="leader" aria-hidden="true" />
          <span className={VALUE}>
            {night ? formatNightDuration(night.minutes) : '未录'}
            {night?.source === 'interval' && (
              <span className="hidden sm:inline text-ink3 text-[12px]">
                {' '}
                · {night.sleepStart}–{night.wakeTime}
              </span>
            )}
          </span>
        </div>

        <div className="inkrow inkrow-dotted">
          <span className={LABEL}>近七夜</span>
          <span className="leader" aria-hidden="true" />
          <span className={VALUE}>
            {sleep.nights}/{sleep.windowDays} 夜 · 均 {formatNightDuration(sleep.avgMinutes)}
          </span>
        </div>

        {/* 精力越高越好、酸痛越高越差：两套方向各自成行 */}
        <div className="inkrow inkrow-dotted">
          <span className={LABEL}>精力</span>
          {dots(state.energy ?? 0, 'energy', '精力')}
          <span className={VALUE}>
            {state.energy === undefined ? (
              <span className="text-ink3">未录</span>
            ) : (
              <>
                <span className="font-semibold">{state.energy}</span>/5
                <span className="text-accent font-medium ml-1.5">{getEnergyLabel(state.energy)}</span>
              </>
            )}
          </span>
        </div>

        <div className="inkrow inkrow-dotted">
          <span className={LABEL}>酸痛</span>
          {dots(state.soreness ?? 0, 'soreness', '酸痛')}
          <span className={VALUE}>
            {state.soreness === undefined ? (
              <span className="text-ink3">未录</span>
            ) : (
              <>
                <span className="font-semibold">{state.soreness}</span>/5
                <span className="text-accent font-medium ml-1.5">
                  {getSorenessLabel(state.soreness)}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
