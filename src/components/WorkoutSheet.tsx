// 习练表：录一练。录事三表之一（另有 MealSheet / BodySheet），壳与组题由 SheetShell 共出。
// 今日之荐在此可改可录；抗阻统计只认类别字段，不靠标题文字。
// deslop-ignore-file 07 22 28
import React, { useEffect, useRef, useState } from 'react';
import type { BodyweightExercise, CreateWorkoutInput, WorkoutCategory } from '../types/health';
import { hydrateExercise } from '../domain/trainingPlan';
import { Group, INPUT, RecordDefaults, SheetShell, chipClass } from './SheetShell';

const WORKOUT_CATEGORY_CN: Record<WorkoutCategory, string> = {
  resistance: '抗阻',
  recovery: '恢复',
  cardio: '有氧',
  mobility: '柔韧',
  other: '其他',
};

/** 无荐时的默认课表（动作名与库对齐，部位随库补位）。 */
function fallbackWorkoutRows(): BodyweightExercise[] {
  return [
    hydrateExercise('徒手深蹲', 3, '12 次'),
    hydrateExercise('标准俯卧撑', 3, '8–10 次'),
    hydrateExercise('交替后箭步蹲', 3, '每侧 8 次'),
    hydrateExercise('平板支撑', 3, '30 秒'),
  ];
}

interface WorkoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Save handler resolves false when the write failed; App already toasted the reason. */
  onSave: (input: CreateWorkoutInput) => Promise<boolean>;
  /** 今日既有之录与今日之荐；有则开时预填。 */
  defaults?: RecordDefaults;
}

export const WorkoutSheet: React.FC<WorkoutSheetProps> = ({ isOpen, onClose, onSave, defaults }) => {
  const [workoutTitle, setWorkoutTitle] = useState('徒手基础习练');
  const [workoutCategory, setWorkoutCategory] = useState<WorkoutCategory>('resistance');
  const [workoutRows, setWorkoutRows] = useState<BodyweightExercise[]>(() => fallbackWorkoutRows());
  const [workoutDuration, setWorkoutDuration] = useState<number | ''>(20);
  const [durationSource, setDurationSource] = useState<'actual' | 'estimated'>('estimated');
  /** 空录之戒（novalidate 后自校验，不吐原生气泡）。 */
  const [hint, setHint] = useState<string | null>(null);

  // defaults 走 ref 取最新值：依赖项只认开合，页面别处重渲染不会清掉正填之稿
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  // 开时依今日之荐预填；休整无荐则回默认课表（残稿由 SheetShell 在本 effect 之后覆以回填）
  const resetToDefaults = () => {
    const d = defaultsRef.current;
    setWorkoutTitle(d?.workoutTitle ?? '徒手基础习练');
    setWorkoutCategory('resistance');
    setWorkoutRows(
      d?.workoutExercises && d.workoutExercises.length > 0
        ? d.workoutExercises.map((ex) => ({ ...ex }))
        : fallbackWorkoutRows()
    );
    setWorkoutDuration(d?.workoutDuration ?? 20);
    setDurationSource('estimated');
    setHint(null);
  };
  useEffect(() => {
    if (!isOpen) return;
    resetToDefaults();
  }, [isOpen]);

  const submit = async (): Promise<boolean> => {
    setHint(null);
    // 空录之戒：练名是这一录的名目，无名不发
    if (workoutTitle.trim() === '') {
      setHint('未填练名——给此练一个名目，再照准。');
      return false;
    }
    // 时长自校验：负数不合常度（上限已去，超常之长录而不拦）
    if (workoutDuration !== '') {
      const n = Number(workoutDuration);
      if (!Number.isFinite(n) || n < 0) {
        setHint('时长须为零以上之数——核对后再照准。');
        return false;
      }
    }
    return onSave({
      title: workoutTitle,
      category: workoutCategory,
      durationMinutes: Number(workoutDuration) || 0,
      durationSource,
      exercises: workoutRows.filter((row) => row.name.trim() !== ''),
      perceivedDifficulty: 'moderate',
      completed: true,
    });
  };

  return (
    <SheetShell
      isOpen={isOpen}
      title="录一练"
      titleId="workout-sheet-title"
      widthClass="sm:max-w-lg"
      onClose={onClose}
      onSubmit={submit}
      hint={hint}
      draftKey="phc_draft_workout"
      getDraft={() => ({ workoutTitle, workoutCategory, workoutRows, workoutDuration, durationSource })}
      applyDraft={(d) => {
        if (typeof d.workoutTitle === 'string') setWorkoutTitle(d.workoutTitle);
        if (typeof d.workoutCategory === 'string') setWorkoutCategory(d.workoutCategory as WorkoutCategory);
        if (Array.isArray(d.workoutRows)) {
          setWorkoutRows(
            d.workoutRows
              .filter((r): r is { name: string } => !!r && typeof r === 'object' && typeof (r as { name?: unknown }).name === 'string')
              .map((r) => r as BodyweightExercise)
          );
        }
        setWorkoutDuration(typeof d.workoutDuration === 'number' ? d.workoutDuration : 20);
        if (d.durationSource === 'actual' || d.durationSource === 'estimated') setDurationSource(d.durationSource);
        setHint(null);
      }}
      onDiscardDraft={resetToDefaults}
    >
      <div className="space-y-2">
        <Group title="练名（徒手之习）" first>
          <input
            id="rs-workout-title"
            type="text"
            required
            value={workoutTitle}
            onChange={(e) => setWorkoutTitle(e.target.value)}
            className={INPUT}
            placeholder="徒手自重循环"
          />
        </Group>

        {/* 类别是结构化事实：抗阻统计只认它，不靠标题文字 */}
        <Group title="类别（抗阻统计据此计）">
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(WORKOUT_CATEGORY_CN) as WorkoutCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setWorkoutCategory(cat)}
                className={chipClass(workoutCategory === cat)}
              >
                {WORKOUT_CATEGORY_CN[cat]}
              </button>
            ))}
          </div>
        </Group>

        <Group title="习练动作（依今日之荐，可改）">
          <div className="space-y-1.5">
            {workoutRows.length === 0 && (
              <p className="text-[12px] text-ink3">今日无荐（休整之日）——可自行添录，或不录。</p>
            )}
            {workoutRows.map((row, idx) => (
              <div key={`${row.name}-${idx}`} className="grid grid-cols-[1fr_58px_1fr] gap-2 items-center">
                <span className="text-[13px] text-ink leading-tight">
                  {row.name}
                  {row.muscleGroups && row.muscleGroups.length > 0 ? (
                    <span className="text-ink3"> · {row.muscleGroups.join('/')}</span>
                  ) : null}
                </span>
                <input
                  type="number"
                  min={1}
                  aria-label={`${row.name} 组数`}
                  value={row.sets}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setWorkoutRows((rows) =>
                      rows.map((r, i) =>
                        i === idx ? { ...r, sets: Number.isFinite(n) && n > 0 ? n : 1 } : r
                      )
                    );
                  }}
                  className={`${INPUT} tabular-nums`}
                />
                <input
                  type="text"
                  aria-label={`${row.name} 次数或时长`}
                  value={row.repsOrDuration}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWorkoutRows((rows) => rows.map((r, i) => (i === idx ? { ...r, repsOrDuration: v } : r)));
                  }}
                  className={INPUT}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-ink3">
            组数与次数可改；部位随动作入库，台账据以轮转下一练。
          </p>
        </Group>

        <Group title="时长">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rs-duration" className="block text-ink3 mb-1">时长（分钟）</label>
              <input
                id="rs-duration"
                type="number"
                min="0"
                value={workoutDuration}
                onChange={(e) => setWorkoutDuration(e.target.value === '' ? '' : Number(e.target.value))}
                className={`${INPUT} tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-ink3 mb-1">时长来源</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDurationSource('actual')}
                  className={chipClass(durationSource === 'actual')}
                >
                  实际计时
                </button>
                <button
                  type="button"
                  onClick={() => setDurationSource('estimated')}
                  className={chipClass(durationSource === 'estimated')}
                >
                  约算
                </button>
              </div>
            </div>
          </div>
        </Group>
      </div>
    </SheetShell>
  );
};
