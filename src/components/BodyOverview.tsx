// Serif section head only; the weight facts read as ruled journal rows. deslop-ignore-file 07
import React from 'react';
import type { WeightSummary } from '../domain/types';
import { formatAbs, formatSigned } from '../domain/format';
import { WeightTrendChart } from './WeightTrendChart';
import { SectionHead } from './SectionHead';

interface BodyOverviewProps {
  /** 体重全景：最新值、条数、有效日数、端点变化、回归斜率、数据质量。 */
  weight: WeightSummary;
  onEditWeight: () => void;
}

const DIRECTION_CN: Record<WeightSummary['direction'], string> = {
  down: '渐降',
  up: '微升',
  flat: '持平',
  insufficient_data: '数据不足',
};

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className="inkrow-value text-[13px] text-ink">{children}</span>
  </div>
);

export const BodyOverview: React.FC<BodyOverviewProps> = ({ weight, onEditWeight }) => {
  const earliest = weight.firstInWindow;
  const latestPoint = weight.lastInWindow;
  const trendSign = weight.direction === 'up' ? '+' : weight.direction === 'down' ? '−' : '';

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="身体近况"
        verdict={weight.quality.flag === 'needs_review' ? '待核' : DIRECTION_CN[weight.direction]}
        note={
          <button onClick={onEditWeight} className="btn-link">
            录新体重
          </button>
        }
      />

      {/* 行文表：条数与有效日数分开，端点变化与回归斜率分列 */}
      <div className="mt-4">
        <Row label="今之体重">
          <span className="font-semibold">{weight.latest ?? '—'}</span> 公斤
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
      </div>

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
    </section>
  );
};

/** 图注口径直接来自 domain（有效日数与次数分开说），图表不再自算。 */
const chartLabel = (weight: WeightSummary): string => {
  const earliest = weight.firstInWindow;
  const latest = weight.lastInWindow;
  if (!earliest || !latest) return '体重记录尚少，暂不出图';
  return `近三十日体重趋势：由 ${earliest.weight} 公斤至 ${latest.weight} 公斤，共 ${weight.daysWithRecords} 个有效日（${weight.readingCount} 次记录）`;
};
