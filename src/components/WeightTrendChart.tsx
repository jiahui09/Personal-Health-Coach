// Flat SVG trend line; the terminal dot is a data point, not an icon. deslop-ignore-file 24
import React from 'react';

interface WeightTrendChartProps {
  series: { date: string; weight: number }[];
  /** 无障碍与图下注脚的整句，由 domain 派生结果拼好传入（图表不再自算首末与日数）。 */
  summaryLabel?: string;
}

/** 30-day weight line: flat SVG, no chart library, values straight from the records. */
export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({ series, summaryLabel }) => {
  if (series.length < 2) {
    return (
      <p className="text-xs text-ink3 py-4 mt-2">
        再录一次体重，此间自成趋势线。
      </p>
    );
  }

  const W = 560;
  const H = 140;
  const PAD = 10;
  const weights = series.map((s) => s.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const span = max - min || 1;

  const points = series.map((s, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - PAD - ((s.weight - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].split(',');

  const label = (idx: number) => series[idx].date.slice(5);
  const first = series[0].weight;
  const lastWeight = series[series.length - 1].weight;
  /* 图表无坐标轴：aria 与图下轻标注补足最高/最低/单位（句子的口径由 domain 给定） */
  const ariaLabel =
    summaryLabel ??
    `近三十日体重趋势:由 ${first} 公斤至 ${lastWeight} 公斤,最高 ${max} 公斤、最低 ${min} 公斤`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={ariaLabel}
      >
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--color-line)" strokeWidth="1" />
        <path d={`M ${points.join(' L ')} L ${W},${H} L 0,${H} Z`} fill="var(--color-accent)" fillOpacity="0.10" />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last[0]} cy={last[1]} r="4" fill="var(--color-accent)" />
      </svg>

      <div className="flex justify-between text-[12px] text-ink3 tabular-nums mt-1.5">
        <span>{label(0)}</span>
        <span>{label(Math.floor(series.length / 2))}</span>
        <span>{label(series.length - 1)}</span>
      </div>
      <div className="text-[12px] text-ink3 tabular-nums mt-1">
        最高 {max} · 最低 {min} 公斤
      </div>
    </div>
  );
};
