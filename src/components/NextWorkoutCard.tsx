// Serif for the chapter heading; instruction copy stays in the UI sans. deslop-ignore-file 07
import React, { useState } from 'react';
import { Check, HelpCircle } from 'lucide-react';
import { WorkoutRecommendation, WorkoutRecord } from '../types/health';
import type { WorkoutDecision } from '../domain/types';
import { describeWorkoutDecision } from '../services/decisionCopy';
import { SectionHead } from './SectionHead';

interface NextWorkoutCardProps {
  nextWorkout: WorkoutRecommendation;
  /** 训练决策（纯函数结果）：状态与原因都取自它。 */
  decision: WorkoutDecision;
  /** 今日已录的实际训练；有则在章节里如实列出。 */
  todaySession: WorkoutRecord | null;
  isCompletedToday: boolean;
  onCompleteWorkout: () => void;
  onOpenEvidence: () => void;
  onCustomWorkout: () => void;
}

export const NextWorkoutCard: React.FC<NextWorkoutCardProps> = ({
  nextWorkout,
  decision,
  todaySession,
  isCompletedToday,
  onCompleteWorkout,
  onOpenEvidence,
  onCustomWorkout,
}) => {
  const [checkedSets, setCheckedSets] = useState<Record<number, boolean>>({});

  const toggleSetCheck = (index: number) => {
    setCheckedSets((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getTrainingStateLabel = () => {
    switch (nextWorkout.trainingState) {
      case 'LIGHT': return '轻量';
      case 'RECOVERY': return '恢复';
      case 'REST': return '休憩';
      case 'NORMAL':
      default: return '常规';
    }
  };

  return (
    <section className="pt-10 lg:pr-9">
      {/* 章节题：其三 · 今日之练（统一章节头 + 朱批旁注「今日常规」） */}
      <SectionHead
        ordinal="其三"
        title="今日之练"
        verdict={`今${getTrainingStateLabel()}`}
        note={
          <span className="text-[12px] text-ink3 tabular-nums">
            约 {nextWorkout.durationMinutes} 分 · 估算
          </span>
        }
      />

      <div className="mt-5">
        {/* 判定一句（原因由决策结果生成）；详细理由与阈值入「缘由」弹窗 */}
        <p className="text-[13px] text-ink3">{describeWorkoutDecision(decision)}</p>

        {todaySession && (
          <p className="mt-1.5 text-[12px] text-ink2">
            今日已录 {todaySession.title} · {todaySession.durationMinutes} 分 ·{' '}
            {todaySession.durationSource === 'actual' ? '实际计时' : '估算'} ·{' '}
            {todaySession.category === 'resistance' ? '抗阻' : todaySession.category}
          </p>
        )}

        {/* 动作清单：目录式行 */}
        {nextWorkout.exercises.length > 0 ? (
          <div className="mt-4">
            {nextWorkout.exercises.map((ex, idx) => {
              const isChecked = checkedSets[idx] || isCompletedToday;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleSetCheck(idx)}
                  aria-pressed={isChecked}
                  aria-label={`${isChecked ? '记为未成' : '记为已成'}：${ex.name}`}
                  className={`inklist-row inklist-dotted w-full text-left cursor-pointer transition-colors duration-150`}
                >
                  <span
                    className={`w-[18px] h-[18px] shrink-0 grid place-items-center rounded-sm border transition-colors duration-150 ${
                      isChecked ? 'bg-accent border-accent text-white' : 'border-control bg-surface'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className="text-[15px] text-ink">{ex.name}</span>
                  <span className="text-[13px] font-semibold text-ink2 tabular-nums shrink-0">
                    {ex.sets} 组 × {ex.repsOrDuration}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-ink2 mt-4">今日无练事。</p>
        )}

        {/* 动作脚注行：左恢复指引,右动作组（缘由 / 另择动作 / 毕此一练） */}
        <div className="section-actions">
          <div className="text-xs text-ink3 leading-relaxed sm:max-w-[46ch]">
            {nextWorkout.recoveryGuidance || '组间歇 45–60 秒，呼吸当匀。'}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={onOpenEvidence} className="btn-ghost">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span>缘由</span>
            </button>
            <button onClick={onCustomWorkout} className="btn-link px-2">
              另择动作
            </button>
            {!isCompletedToday ? (
              <button onClick={onCompleteWorkout} className="btn-primary whitespace-nowrap">
                <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span>毕此一练</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent py-1.5 px-3 bg-accentsoft rounded-lg border border-accentline">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>今日之练已毕</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
