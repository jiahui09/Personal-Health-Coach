// 统计通栏：一切算出来的数（指数、代谢、趋势、均值、履行合议与情景外推）集中于此。
// Serif for the section head; measured numbers stay sans. deslop-ignore-file 07 28
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WeightForecast } from '../types/health';
import type {
  BodySummary,
  SleepSummary,
  TrainingSummary,
  TrainingTarget,
  WeightSummary,
} from '../domain/types';
import { BMI_CATEGORY_CN } from '../services/decisionCopy';
import { formatAbs, formatSigned } from '../domain/format';
import { SLEEP_REFERENCE_HOURS } from '../domain/policy';
import { SectionHead } from './SectionHead';
import { RuleMeter } from './RuleMeter';
import { WeightTrendChart } from './WeightTrendChart';

interface StatsSectionProps {
  body: BodySummary;
  /** 体重全景：变化、斜率、窗口计数与图表序列皆取自它。 */
  weight: WeightSummary;
  sleep: SleepSummary;
  trainingTarget: TrainingTarget;
  training: TrainingSummary;
  forecast: WeightForecast;
}

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

/** 体重方向的朱批词（域内 direction → 御批用语）。 */
const DIRECTION_CN: Record<WeightSummary['direction'], string> = {
  down: '渐降',
  up: '微升',
  flat: '持平',
  insufficient_data: '数据不足',
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className="inkrow-value text-[13px] text-ink">{children}</span>
  </div>
);

/** 图注口径直接来自 domain（有效日数与次数分开说），图表不再自算。 */
const chartLabel = (weight: WeightSummary): string => {
  const earliest = weight.firstInWindow;
  const latest = weight.lastInWindow;
  if (!earliest || !latest) return '体重记录尚少，暂不出图';
  return `近三十日体重趋势：由 ${earliest.weight} 公斤至 ${latest.weight} 公斤，共 ${weight.daysWithRecords} 个有效日（${weight.readingCount} 次记录）`;
};

/** 统计 —— 由此算出（BMI/代谢）→ 趋势与均值 → 履行合议 → 情景外推。 */
export const StatsSection: React.FC<StatsSectionProps> = ({
  body,
  weight,
  sleep,
  trainingTarget,
  training,
  forecast,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const { resistance } = training;
  const earliest = weight.firstInWindow;
  const latestPoint = weight.lastInWindow;
  // 号随斜率实值：方向（up/down/flat）是分类旁批，不能代数值定号——持平时负斜率亦须示「−」
  const trendSign =
    weight.trendKgPerWeek === null
      ? ''
      : weight.trendKgPerWeek > 0
        ? '+'
        : weight.trendKgPerWeek < 0
          ? '−'
          : '';
  const forecastPeriods = [
    { label: '四周', period: forecast.fourWeeks },
    { label: '八周', period: forecast.eightWeeks },
    { label: '十二周', period: forecast.twelveWeeks },
  ];

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="统计"
        verdict={weight.quality.flag === 'needs_review' ? '待核' : DIRECTION_CN[weight.direction]}
      />

      {/* 一、由此算出：未建档不显人体数字（缺档即无本组） */}
      {body.complete && (
        <div className="mt-4">
          <Row label="体重指数">
            {body.bmi === null ? (
              <span className="text-ink3">未录体重</span>
            ) : (
              <>
                <span className="font-semibold">{body.bmi}</span> ·{' '}
                {body.bmiCategory ? BMI_CATEGORY_CN[body.bmiCategory] : '—'}
              </>
            )}
          </Row>
          <Row label="静息代谢">
            {body.rmrKcal === null ? (
              <span className="text-ink3">资料不足</span>
            ) : (
              <>
                <span className="font-semibold">{body.rmrKcal}</span> 千卡
              </>
            )}
          </Row>
          <Row label="总消耗">
            {body.tdeeKcal === null ? (
              <span className="text-ink3">资料不足</span>
            ) : (
              <>
                <span className="font-semibold">{body.tdeeKcal}</span> 千卡
              </>
            )}
          </Row>
          <Row label="每周抗阻">
            <span className="font-semibold">{trainingTarget.resistanceDaysPerWeek}</span> 日
            <span className="hidden sm:inline text-ink3">
              {' '}
              · 每次 {trainingTarget.sessionMinutes.min}–{trainingTarget.sessionMinutes.max} 分
            </span>
          </Row>
        </div>
      )}

      {/* 二、趋势与均值：样本不足即如实写「数据不足」 */}
      <div className="mt-4">
        <Row label="近七日均重">
          {weight.rollingMean7d === null ? (
            '数据不足'
          ) : (
            <>
              <span className="font-semibold">{weight.rollingMean7d}</span> 公斤
            </>
          )}
        </Row>
        <Row label="三十日变化">
          {weight.endpointChangeKg === null ? (
            '不足相较'
          ) : (
            <>
              <span className="font-semibold">{formatSigned(weight.endpointChangeKg)}</span> 公斤
            </>
          )}
        </Row>
        <Row label="回归斜率">
          {weight.trendKgPerWeek === null ? (
            '数据不足'
          ) : (
            <>
              <span className="font-semibold">
                {trendSign}
                {formatAbs(weight.trendKgPerWeek, 2)}
              </span>{' '}
              公斤/周
            </>
          )}
        </Row>
        <Row label="记录">
          {weight.daysWithRecords}/{weight.windowDays} 日 · {weight.readingCount} 次
        </Row>
        <RuleMeter
          className="inkrow-dotted"
          percent={false}
          label="睡均"
          value={sleep.avgHours ?? 0}
          max={SLEEP_REFERENCE_HOURS}
          unit="h"
          nodata={sleep.avgHours === null}
          tone={sleep.meetsReference ? 'accent' : 'ink'}
          suffix={
            sleep.meetsReference === null ? '未录' : sleep.meetsReference ? '合议' : '未合议'
          }
          suffixTone={sleep.meetsReference ? 'accent' : 'muted'}
        />
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
      </div>

      {/* 三、三十日趋势 */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between text-[12px] text-ink3">
          <span className="group-head">三十日趋势</span>
          <span className="tabular-nums">
            {earliest && latestPoint ? `${earliest.weight} → ${latestPoint.weight} 公斤` : '—'}
          </span>
        </div>
        <WeightTrendChart
          series={weight.series.map((point) => ({ date: point.dayKey, weight: point.weight }))}
          summaryLabel={chartLabel(weight)}
        />
      </div>

      {/* 四、情景外推：四周/八周/十二周并置；模型与依据收在「推演所据」 */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <span className="group-head">情景外推</span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            className="btn-link"
          >
            <span>{showDetails ? '掩其推据' : '推演所据'}</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {forecast.withheld ? (
          <p className="mt-3 text-[15px] leading-[1.95] text-ink2">
            今录存疑或数据不足 · 暂不出推演
          </p>
        ) : (
          /* 三档横排会另起轴线,与本节行格冲突——同轴纵列,与余行共用名/中/值三列 */
          <div className="mt-3">
            {forecastPeriods.map(({ label, period }) => (
              <div key={label} className="inkrow inkrow-dotted min-w-0">
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
              {forecast.inputWindowDays} 日
              {forecast.method === 'scenario_trend_projection' && ' · 情景外推'}
            </div>
            <div>前提</div>
            {forecast.assumptions.map((item, i) => (
              <div key={`a${i}-${item}`}>· {item}</div>
            ))}
            <div className="pt-1">局限</div>
            {forecast.limitations.map((item, i) => (
              <div key={`l${i}-${item}`}>· {item}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
