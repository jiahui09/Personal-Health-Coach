/**
 * 数据待核朱批 —— 只标记，不改数。
 *
 * 异常（今日体重偏离近七日、今日所录越常度、记录不足）在这里集中呈现，
 * 具体阈值与判定都来自 domain 的 DataQuality，本组件只负责措辞。
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { DataQuality, DataQualityReason } from '../domain/types';
import { formatAbs, toPercent } from '../domain/format';

const REASON_CN: Record<
  DataQualityReason,
  (detail: Record<string, number>, comparison?: 'above' | 'below') => string
> = {
  weight_deviates_from_rolling_mean: (d, comparison) =>
    `今日体重${comparison === 'above' ? '高于' : '低于'}近七日均重 ${formatAbs(
      d.deltaKg
    )} 公斤（越 ${d.thresholdKg} 公斤之限）`,
  insufficient_weight_days: (d) => `体重记录仅 ${d.days ?? 0} 日，暂不足出趋势`,
  nutrition_over_plausible_range: (d) =>
    d.ratio !== undefined
      ? `今日所录热量已及目标之 ${toPercent(d.ratio)}%`
      : `今日所录热量偏低（${d.consumedKcal ?? 0} 千卡）`,
  insufficient_sleep_nights: () => '近七日尚无睡眠记录',
};

interface DataQualityNoteProps {
  flags: DataQuality[];
  reviewCount: number;
}

export const DataQualityNote: React.FC<DataQualityNoteProps> = ({ flags, reviewCount }) => {
  const notable = flags.filter((flag) => flag.flag !== 'normal' && flag.reasons.length > 0);
  if (notable.length === 0) return null;

  return (
    <div className="mt-4 border-l-2 border-danger pl-3 py-1">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-danger tracking-[0.14em]">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>
          {reviewCount > 0 ? `朱批 · 待核 ${reviewCount} 项` : '朱批 · 记录尚少'}
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 text-[13px] text-ink2 leading-relaxed">
        {notable.map((flag) => (
          <li key={flag.reasons.join('-')}>
            · {flag.reasons.map((reason) => REASON_CN[reason](flag.detail, flag.comparison)).join('；')}
          </li>
        ))}
      </ul>
    </div>
  );
};
