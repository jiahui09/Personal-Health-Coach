// Serif for the section heading only; numbers stay sans.
// 三列 = 四周/八周/十二周这三档期限,数量由产品语义决定。
// deslop-ignore-file 07 28
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WeightForecast } from '../types/health';
import { SectionHead } from './SectionHead';

interface ForecastBandProps {
  forecast: WeightForecast;
}

/**
 * 情景外推 — 通栏一节：四周/八周/十二周并置。
 * 它是情景（TDEE 与代谢适应下的外推），不是承诺、也不是目标；
 * 模型版本与依据日数收在「推演所据」面板里。
 */
export const ForecastBand: React.FC<ForecastBandProps> = ({ forecast }) => {
  const [showDetails, setShowDetails] = useState(false);
  const periods = [
    { label: '四周', period: forecast.fourWeeks },
    { label: '八周', period: forecast.eightWeeks },
    { label: '十二周', period: forecast.twelveWeeks },
  ];

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="情景外推"
        note={
          <button onClick={() => setShowDetails(!showDetails)} className="btn-link">
            <span>{showDetails ? '掩其推据' : '推演所据'}</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        }
      />

      {forecast.withheld ? (
        <p className="mt-4 text-[15px] leading-[1.95] text-ink2">
          今录存疑或数据不足 · 暂不出推演
        </p>
      ) : (
        <div className="mt-4 grid gap-x-8 sm:grid-cols-3">
          {periods.map(({ label, period }) => (
            <div key={label} className="inkrow inkrow-dotted sm:!py-0">
              <span className="text-[12px] text-ink3 tracking-[0.1em] truncate">{label}</span>
              <span className="leader" aria-hidden="true" />
              <span className="inkrow-value text-[13px] text-ink">
                <span className="font-semibold">
                  {period.range.min}–{period.range.max}
                </span>{' '}
                公斤
              </span>
            </div>
          ))}
        </div>
      )}

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-line text-[12px] text-ink3 space-y-1">
          <div className="tabular-nums">
            模型 {forecast.modelVersion} · 据近三十日 {forecast.basedOnDays}/
            {forecast.inputWindowDays} 日 ·{' '}
            {forecast.method === 'scenario_trend_projection' ? '情景外推（非承诺）' : ''}
          </div>
          <div>前提</div>
          {forecast.assumptions.map((item) => (
            <div key={item}>· {item}</div>
          ))}
          <div className="pt-1">局限</div>
          {forecast.limitations.map((item) => (
            <div key={item}>· {item}</div>
          ))}
        </div>
      )}
    </section>
  );
};
