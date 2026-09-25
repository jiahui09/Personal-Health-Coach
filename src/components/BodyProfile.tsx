// Serif for the section heading and the derived numerals. deslop-ignore-file 07
import React from 'react';
import type { BodySummary, NutritionTargets, TrainingTarget, WeightGoalAdvice } from '../domain/types';
import {
  ACTIVITY_CN,
  BMI_CATEGORY_CN,
  DIRECTION_CN,
  GOAL_CN,
  PROFILE_FIELD_CN,
  SEX_CN,
} from '../services/decisionCopy';
import { SectionHead } from './SectionHead';

interface BodyProfileProps {
  body: BodySummary;
  targets: NutritionTargets | null;
  goalAdvice: WeightGoalAdvice;
  trainingTarget: TrainingTarget;
  goal: string | undefined;
  missingFields: string[];
  onEditProfile: () => void;
}

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="inkrow inkrow-dotted">
    <span className={LABEL}>{label}</span>
    <span className="leader" aria-hidden="true" />
    <span className="inkrow-value text-[13px] text-ink">{children}</span>
  </div>
);

/**
 * 体征档 — 你是谁（原始输入）+ 由此算出（BMI/代谢）+ 据此定数（每日与每周处方）。
 * 未建档时只显示缺什么；建议与自选目标相悖时写在朱批与一行短批里。
 */
export const BodyProfile: React.FC<BodyProfileProps> = ({
  body,
  targets,
  goalAdvice,
  trainingTarget,
  goal,
  missingFields,
  onEditProfile,
}) => {
  const editButton = (
    <button onClick={onEditProfile} className="btn-link">
      {body.complete ? '改档' : '立档'}
    </button>
  );

  if (!body.complete) {
    return (
      <section className="pt-10 lg:pr-9">
        <SectionHead title="体征档" verdict="未建档" note={editButton} />
        <div className="mt-4 border-l-2 border-danger pl-3 py-1">
          <p className="text-[13px] text-ink leading-relaxed">
            尚未建档：缺 {missingFields.map((f) => PROFILE_FIELD_CN[f] ?? f).join('、')}。
          </p>
          <p className="mt-1 text-[12px] text-ink3">
            身高、性别、出生年与活动水平决定代谢与每日目标；未齐备前不显示人体数字。
          </p>
        </div>
      </section>
    );
  }

  const activity = body.activityLevel ? ACTIVITY_CN[body.activityLevel] : null;
  const goalCn = goal ? GOAL_CN[goal] ?? goal : '—';

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="体征档"
        verdict={`建议${DIRECTION_CN[goalAdvice.direction]}`}
        note={
          <span className="flex items-center gap-3 text-[12px] text-ink3">
            <span>目标 {goalCn}</span>
            {editButton}
          </span>
        }
      />

      {/* 原始输入 → 由此算出 → 据此定数：同一张行文表,一路读下来 */}
      <div className="mt-4">
        <Row label="身高 · 性别">
          {body.heightCm} · {body.sex ? SEX_CN[body.sex] : '—'} · {body.ageYears ?? '—'} 岁
        </Row>
        <Row label="活动水平">
          <span title={activity?.hint}>
            {activity ? activity.label : '—'}
            <span className="hidden sm:inline"> · PAL {body.pal}</span>
          </span>
        </Row>
        <Row label="腰围">
          {body.waist ? (
            body.waist.elevated ? (
              <span className="text-danger font-semibold">
                {body.waistCm} 公分 · 越线
              </span>
            ) : (
              <span className="text-ink3">{body.waistCm} 公分 · 未越线</span>
            )
          ) : (
            <span className="text-ink3">未录</span>
          )}
        </Row>
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
        <Row label="每日热量">
          {targets ? (
            <>
              <span className="font-semibold">{targets.caloriesKcal}</span> 千卡
            </>
          ) : (
            <span className="text-ink3">资料不足</span>
          )}
        </Row>
        <Row label="每日蛋白">
          {targets ? (
            <>
              <span className="font-semibold">{targets.proteinG}</span> 克
              <span className="hidden sm:inline text-ink3">
                {' '}
                （{targets.proteinRange.min}–{targets.proteinRange.max}）
              </span>
            </>
          ) : (
            <span className="text-ink3">资料不足</span>
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

      {goalAdvice.conflicting && (
        <p className="mt-3 text-[12px] text-danger leading-relaxed">
          所录体征（指数与腰围）指向{DIRECTION_CN[goalAdvice.direction]}，与所选「{goalCn}」相悖；
          仍按所选计，随时可改档。
        </p>
      )}
    </section>
  );
};
