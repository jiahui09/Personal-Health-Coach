// 1–5 五点圆选（共用控件）：今日体感与录一笔体征页同一控件、同一词表。 deslop-ignore-file 19 28
import React from 'react';

/** 精力词表（1 惫 → 5 甚充沛）：页面与录入共用，不得各写一套。 */
export const ENERGY_CN: Record<number, string> = {
  1: '惫',
  2: '微倦',
  3: '平',
  4: '健',
  5: '甚充沛',
};

/** 酸痛词表（1 无恙 → 5 沉痛）：方向与精力相反，各自成表。 */
export const SORENESS_CN: Record<number, string> = {
  1: '无恙',
  2: '微酸',
  3: '酸楚',
  4: '酸沉',
  5: '沉痛',
};

export const energyWord = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : ENERGY_CN[value] ?? '';

export const sorenessWord = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : SORENESS_CN[value] ?? '';

interface DotScaleProps {
  /** 当前值；null = 未录（五点皆空）。 */
  value: number | null;
  onChange: (level: number) => void;
  /** 供 aria-label 用的名词，如「精力」「酸痛」。 */
  label: string;
  /** 网格位（如 inkrow-mid）；本体恒为 flex 一行五点。 */
  className?: string;
}

/**
 * 五个 24×24 热区的圆点量表：填点表示水平（≤ 当前值填墨），
 * 语义由 aria-pressed 携带，焦点环由全局 :focus-visible 提供。
 */
export const DotScale: React.FC<DotScaleProps> = ({ value, onChange, label, className }) => (
  <span className={`flex gap-1 ${className ?? ''}`}>
    {[1, 2, 3, 4, 5].map((lvl) => (
      <button
        key={lvl}
        type="button"
        onClick={() => onChange(lvl)}
        aria-label={`${label}记为 ${lvl}/5`}
        aria-pressed={value === lvl}
        className="group w-6 h-6 shrink-0 grid place-items-center cursor-pointer"
      >
        <span
          className={`block w-3 h-3 rounded-full transition-colors duration-150 ${
            lvl <= (value ?? 0) ? 'bg-ink' : 'bg-hair group-hover:bg-linehover'
          }`}
        />
      </button>
    ))}
  </span>
);
