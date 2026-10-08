// Serif for the chapter heading; instruction copy stays in the UI sans.
import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { WorkoutCategory, WorkoutRecommendation, WorkoutRecord } from '../types/health';
import type { WorkoutDecision } from '../domain/types';
import { describeWorkoutDecision } from '../services/decisionCopy';
import { SectionHead } from './SectionHead';

/** 已录训练的类别:一律译作中文,不把英文原词漏给页面。 */
const WORKOUT_CATEGORY_CN: Record<WorkoutCategory, string> = {
  resistance: '抗阻',
  recovery: '恢复',
  cardio: '有氧',
  mobility: '柔韧',
  other: '其他',
};

interface NextWorkoutCardProps {
  nextWorkout: WorkoutRecommendation;
  /** 训练决策（纯函数结果）：状态与原因都取自它。 */
  decision: WorkoutDecision;
  /** 今日已录的实际训练；有则在章节里如实列出。 */
  todaySession: WorkoutRecord | null;
  isCompletedToday: boolean;
  onCompleteWorkout: () => void | Promise<unknown>;
  onCustomWorkout: () => void;
}

export const NextWorkoutCard: React.FC<NextWorkoutCardProps> = ({
  nextWorkout,
  decision,
  todaySession,
  isCompletedToday,
  onCompleteWorkout,
  onCustomWorkout,
}) => {
  const [checkedSets, setCheckedSets] = useState<Record<number, boolean>>({});
  /** 勾销进行中:单发闸在 App 亦有,此处先禁按钮,免得连点两下写两笔。 */
  const [completing, setCompleting] = useState(false);

  // 换了课（或今日已毕又届明日）即清勾:不把上一回的勾带到新的一天
  useEffect(() => {
    setCheckedSets({});
  }, [nextWorkout.title, isCompletedToday]);

  const toggleSetCheck = (index: number) => {
    setCheckedSets((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await onCompleteWorkout();
    } finally {
      setCompleting(false);
    }
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
      {/* 章节题：今日之练（与「今日之事」同排一行,统一章节头 + 朱批旁注） */}
      <SectionHead
        title="今日之练"
        verdict={`今${getTrainingStateLabel()}`}
        note={
          <span className="text-[12px] text-ink3 tabular-nums">
            约 {nextWorkout.durationMinutes} 分 · 估算
          </span>
        }
      />

      <div className="mt-5">
        {/* 判定一句：原因由决策结果生成,阈值与理由见 README「术语与口径」 */}
        <p className="text-[13px] text-ink3">{describeWorkoutDecision(decision)}</p>

        {todaySession && (
          <p className="mt-1.5 text-[12px] text-ink2">
            今日已录 {todaySession.title} · {todaySession.durationMinutes} 分 ·{' '}
            {todaySession.durationSource === 'actual' ? '实际计时' : '估算'} ·{' '}
            {WORKOUT_CATEGORY_CN[todaySession.category]}
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
                    className={`w-[18px] h-[18px] shrink-0 grid place-items-center rounded-lg border transition-colors duration-150 ${
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

        {/* 动作脚注行：左恢复指引,右动作组（另择动作 / 毕此一练） */}
        <div className="section-actions">
          <div className="text-xs text-ink3 leading-relaxed sm:max-w-[46ch]">
            {nextWorkout.recoveryGuidance || '组间歇 45–60 秒，呼吸当匀。'}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={onCustomWorkout} className="btn-link px-2">
              另择动作
            </button>
            {isCompletedToday ? (
              <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent py-1.5 px-3 bg-accentsoft rounded-lg border border-accentline">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>今日之练已毕</span>
              </div>
            ) : nextWorkout.exercises.length > 0 ? (
              /* 无课之日（休憩/恢复且无动作）不给勾销:点了会凭空记一笔与本页不符的训练 */
              <button
                onClick={() => void handleComplete()}
                disabled={completing}
                className="btn-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span>毕此一练</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
