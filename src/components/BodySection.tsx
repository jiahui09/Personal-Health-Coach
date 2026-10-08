// 体征通栏：只收原始事实（体感、睡眠、今之体重、档案所录），派生统计一律归「统计」节。
// Serif for the section head; facts read as ruled journal rows. deslop-ignore-file 07
import React from 'react';
import { DailyState } from '../types/health';
import type { BodySummary, SleepSummary, WeightSummary, WeightGoalAdvice } from '../domain/types';
import { formatNightDuration } from '../domain/format';
import {
  ACTIVITY_CN,
  DIRECTION_CN,
  GOAL_CN,
  PROFILE_FIELD_CN,
  SEX_CN,
} from '../services/decisionCopy';
import type { DataQuality } from '../domain/types';
import { SectionHead } from './SectionHead';
import { DataQualityNote } from './DataQualityNote';
import { DotScale, energyWord, sorenessWord } from './DotScale';

interface BodySectionProps {
  /** 体重事实（最新值与质量标记取自 WeightSummary；派生趋势不在本节）。 */
  weight: WeightSummary;
  state: DailyState;
  /** 今日与近七夜之眠（原始记录与窗口计数）。 */
  sleep: SleepSummary;
  body: BodySummary;
  goal: string | undefined;
  goalAdvice: WeightGoalAdvice;
  missingFields: string[];
  dataQuality: { flags: DataQuality[]; reviewCount: number };
  onUpdateMetric: (key: 'energy' | 'soreness', val: number) => void;
  onEditWeight: () => void;
  onEditProfile: () => void;
}

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';
const VALUE = 'inkrow-value text-[13px] text-ink';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className={VALUE}>{children}</span>
  </div>
);

/** 体征 —— 你是谁、今日身体如何（全部为录下即有的原始事实）。 */
export const BodySection: React.FC<BodySectionProps> = ({
  weight,
  state,
  sleep,
  body,
  goal,
  goalAdvice,
  missingFields,
  dataQuality,
  onUpdateMetric,
  onEditWeight,
  onEditProfile,
}) => {
  const night = sleep.today;
  const activity = body.activityLevel ? ACTIVITY_CN[body.activityLevel] : null;

  return (
    <section className="pt-10">
      {/* 头与通栏说明留旁批槽（lg:pr-9）；下方两列格改用配对行同网格，列缘与折缝上下对齐 */}
      <div className="lg:pr-9">
        <SectionHead
          title="体征"
          verdict={!body.complete ? '未建档' : weight.quality.flag === 'needs_review' ? '待核' : undefined}
          note={
            <span className="flex items-center gap-3 text-[12px] text-ink3">
              {goal && <span>目标 {GOAL_CN[goal] ?? goal}</span>}
              {/* 入口与表题相配：开的是「录体征」（体重/腰围/眠/随笔），非单录体重 */}
              <button onClick={onEditWeight} className="btn-link">
                录体征
              </button>
            </span>
          }
        />

        {/* 数据待核朱批：只标记不改数（体重、所录、睡眠的核验集中于此） */}
        <DataQualityNote flags={dataQuality.flags} reviewCount={dataQuality.reviewCount} />

        {!body.complete && (
          <div className="mt-4 border-l-2 border-danger pl-3 py-1">
            <p className="text-[13px] text-ink leading-relaxed">
              尚未建档：缺 {missingFields.map((f) => PROFILE_FIELD_CN[f] ?? f).join('、')}。
            </p>
            <p className="mt-1 text-[12px] text-ink3">
              立档后：热量蛋白有标、下一膳有荐；未齐备前不显示人体数字。
            </p>
            {/* 立档贴未建档之告（常量入口随常量之缺），不与「录体征」并列挤于眉行 */}
            <p className="mt-1.5">
              <button onClick={onEditProfile} className="btn-link text-[12px]">
                立档
              </button>
            </p>
          </div>
        )}
      </div>

      {/* 左：体重与档案所录；右：眠与体感（精力/酸痛可就地点评）。
          网格与折缝同两处配对行（1.45fr|auto|1fr），折缝自本节墨线之下的行区起，
          格内 lg:pr-9 让两列行值右缘与上下两栏逐像素对齐 */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.45fr_auto_1fr] lg:gap-x-8">
        <div className="lg:col-start-1 lg:row-start-1 lg:pr-9">
          {/* 静动两组：随日而变之数在上、常量于档在下，组题分隔不混排 */}
          {body.complete && (
            <div className="mb-1.5">
              <span className="group-head">今日之录</span>
            </div>
          )}
          <Row label="今之体重">
            <span className="font-semibold">{weight.latest ?? '—'}</span> 公斤
          </Row>

          {/* 腰围随录随更（会变之数）：有值即显；越线判定需性别，未建档只显裸值 */}
          {(body.complete || body.waistCm !== null) && (
            <Row label="腰围">
              {body.waist ? (
                body.waist.elevated ? (
                  <span className="text-danger font-semibold">
                    {body.waistCm} 公分 · 越线
                  </span>
                ) : (
                  <span className="text-ink3">{body.waistCm} 公分 · 未越线</span>
                )
              ) : body.waistCm !== null ? (
                <span className="text-ink3">{body.waistCm} 公分</span>
              ) : (
                <span className="text-ink3">未录</span>
              )}
            </Row>
          )}

          {body.complete && (
            <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
              {/* 改档贴「档案所录」常量组（动数入口在上、常量入口随常量，互不并列） */}
              <div className="flex items-baseline justify-between">
                <span className="group-head">档案所录</span>
                <button onClick={onEditProfile} className="btn-link text-[12px]">
                  改档
                </button>
              </div>
              <div className="mt-1">
                <Row label="身高 · 性别">
                  {body.heightCm} · {body.sex ? SEX_CN[body.sex] : '—'} · {body.ageYears ?? '—'} 岁
                </Row>
                <Row label="活动水平">
                  <span title={activity?.hint}>
                    {activity ? activity.label : '—'}
                    <span className="hidden sm:inline"> · PAL {body.pal}</span>
                  </span>
                </Row>
              </div>
            </div>
          )}
        </div>

        {/* 中缝：行区 1px 灰线，列格与上下配对行同 x（仅 lg；自墨线之下的行区起，不越线） */}
        <div
          aria-hidden="true"
          className="hidden lg:block lg:self-stretch lg:col-start-2 lg:row-start-1 w-px bg-line"
        />

        <div className="lg:col-start-3 lg:row-start-1 lg:pr-9">
          <Row label="夜眠">
            {night ? formatNightDuration(night.minutes) : '未录'}
            {night?.source === 'interval' && (
              <span className="hidden sm:inline text-ink3 text-[12px]">
                {' '}
                · {night.sleepStart}–{night.wakeTime}
              </span>
            )}
          </Row>

          <Row label="近七夜">
            {sleep.nights}/{sleep.windowDays} 夜 · 均 {formatNightDuration(sleep.avgMinutes)}
          </Row>

          {/* 精力越高越好、酸痛越高越差：两套方向各自成行 */}
          <div className="inkrow inkrow-dotted">
            <span className={LABEL}>精力</span>
            <DotScale
              className="inkrow-mid"
              value={state.energy ?? null}
              onChange={(lvl) => onUpdateMetric('energy', lvl)}
              label="精力"
            />
            <span className={VALUE}>
              {state.energy === undefined ? (
                <span className="text-ink3">未录</span>
              ) : (
                <>
                  <span className="font-semibold">{state.energy}</span>/5
                  <span className="text-accent font-medium ml-1.5">
                    {energyWord(state.energy)}
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="inkrow inkrow-dotted">
            <span className={LABEL}>酸痛</span>
            <DotScale
              className="inkrow-mid"
              value={state.soreness ?? null}
              onChange={(lvl) => onUpdateMetric('soreness', lvl)}
              label="酸痛"
            />
            <span className={VALUE}>
              {state.soreness === undefined ? (
                <span className="text-ink3">未录</span>
              ) : (
                <>
                  <span className="font-semibold">{state.soreness}</span>/5
                  <span className="text-accent font-medium ml-1.5">
                    {sorenessWord(state.soreness)}
                  </span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {body.complete && goalAdvice.conflicting && (
        <p className="mt-3 text-[12px] text-danger leading-relaxed">
          所录体征（指数与腰围）指向{DIRECTION_CN[goalAdvice.direction]}，与所选
          「{goal ? GOAL_CN[goal] ?? goal : '—'}」相悖；仍按所选计，随时可改档。
        </p>
      )}
    </section>
  );
};
