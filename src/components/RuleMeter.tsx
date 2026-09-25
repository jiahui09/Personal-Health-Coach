// 墨线计量条:三列共列网格(名 | 条 | 值),条只用令牌色填充。
// 比例由真实文本承载,条 aria-hidden,只作余光线索;对齐由 .inkrow 结构保证。
// deslop-ignore-file 07
import React from 'react';

type MeterTone = 'ink' | 'accent' | 'danger';

const FILL: Record<MeterTone, string> = {
  ink: 'bg-ink',
  accent: 'bg-accent',
  danger: 'bg-danger',
};

interface RuleMeterProps {
  /** 是否显示百分比；睡眠均值等「参考目标」场景可关掉，避免读成完成率。 */
  percent?: boolean;
  /** 二字至五字，如 抗阻 / 睡均 / 蛋白质 / 热量。 */
  label: string;
  value: number;
  max: number;
  unit?: string;
  /** ink=进行中 accent=达标 danger=超录(朱与绛拉明度差,见 index.css) */
  tone?: MeterTone;
  /** 判定后缀（如「合议 / 未合议」），与数值同一行。 */
  suffix?: string;
  suffixTone?: 'accent' | 'muted';
  className?: string;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const RuleMeter: React.FC<RuleMeterProps> = ({
  percent = true,
  label,
  value,
  max,
  unit = '',
  tone = 'ink',
  suffix,
  suffixTone = 'muted',
  className = '',
}) => {
  // 无基准则不画条:只留名与破折号,不留空盒子
  if (!(max > 0)) {
    return (
      <div className={`inkrow ${className}`}>
        <span className="text-[12px] text-ink3 tracking-[0.1em] truncate">{label}</span>
        <span aria-hidden="true" />
        <span className="inkrow-value text-[12px] text-ink3 tabular-nums">—</span>
      </div>
    );
  }
  const ratio = Math.max(0, value) / max;
  const pct = Math.round(ratio * 100);
  const width = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className={`inkrow ${className}`}>
      <span className="text-[12px] text-ink3 tracking-[0.1em] truncate">{label}</span>
      <span className="inkrow-meter inkrow-mid" aria-hidden="true">
        <i className={FILL[tone]} style={{ width: `${width}%` }} />
      </span>
      <span className="inkrow-value text-[12px] text-ink3 tabular-nums">
        <span className="text-ink font-semibold">{round1(value)}</span>/{round1(max)}
        {unit && ` ${unit}`}
        {percent && (
          <span className="hidden sm:inline">
            {' · '}
            <span className={pct >= 100 ? 'text-accent font-semibold' : undefined}>{pct}%</span>
          </span>
        )}
        {suffix && (
          <>
            {' · '}
            <span
              className={
                suffixTone === 'accent' ? 'text-accent font-medium' : 'text-ink3 font-normal'
              }
            >
              {suffix}
            </span>
          </>
        )}
      </span>
    </div>
  );
};
