// 体征表：录体征。录事三表之一（另有 MealSheet / WorkoutSheet），壳与组题由 SheetShell 共出。
// 只收会变之数（体重、腰围、眠、随笔）；常量（身高、出生年等）归立档表，两处不得混收。
// 体感（精力/酸痛）不在本表重复录入——首页「今日体感」点按即调，同源同词表。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CreateDailyStateInput, SleepEntry } from '../types/health';
import { intervalMinutes } from '../domain/sleep';
import { formatNightDuration } from '../domain/format';
import { Group, INPUT, RecordDefaults, SheetShell } from './SheetShell';

interface BodySheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Save handler resolves false when the write failed; App already toasted the reason. waistCm 仅在填了且与档中不同时重写档。 */
  onSave: (input: CreateDailyStateInput, waistCm?: number) => Promise<boolean>;
  /** 今日既有之录；缺省即「未录」，绝不预填假数。 */
  defaults?: RecordDefaults;
  /** 体重偏离近七日均重时的提示句；返回 null 表示在常度之内。 */
  weightWarningFor?: (value: number) => string | null;
}

export const BodySheet: React.FC<BodySheetProps> = ({ isOpen, onClose, onSave, defaults, weightWarningFor }) => {
  // 今日之重与越常二次确认
  const [weight, setWeight] = useState<number | ''>('');
  const [weightAck, setWeightAck] = useState(false);
  // 腰围（会变之数，最新值覆盖档中所存；留空即不改档）
  const [waistCm, setWaistCm] = useState<number | ''>('');
  // 睡眠：时刻优先，时长由时刻推得；只记得总时长才切手录
  const [sleepMode, setSleepMode] = useState<'interval' | 'duration'>('interval');
  const [sleepStart, setSleepStart] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [sleepMinutes, setSleepMinutes] = useState<number | ''>('');
  const [stateNotes, setStateNotes] = useState('');
  /** 空录之戒：一无所有时给一句提示,不发空请求。 */
  const [hint, setHint] = useState<string | null>(null);

  // defaults 走 ref 取最新值：依赖项只认开合，页面别处重渲染不会清掉正填之稿
  const defaultsRef = useRef(defaults);
  useEffect(() => {
    defaultsRef.current = defaults;
  }, [defaults]);

  // 开时预填今日既有之录，未录即空白（残稿由 SheetShell 在本 effect 之后覆以回填）
  const resetToDefaults = () => {
    const d = defaultsRef.current;
    setWeight(d?.weight ?? '');
    setWeightAck(false);
    setWaistCm(d?.waistCm ?? '');
    setSleepStart(d?.sleepStart ?? '');
    setWakeTime(d?.wakeTime ?? '');
    setSleepMinutes(d?.sleepMinutes ?? '');
    setSleepMode(d?.sleepStart && d?.wakeTime ? 'interval' : d?.sleepMinutes ? 'duration' : 'interval');
    setStateNotes(d?.note ?? '');
    setHint(null);
  };
  useEffect(() => {
    if (!isOpen) return;
    resetToDefaults();
  }, [isOpen]);

  const sleepIntervalPreview = useMemo(() => {
    if (sleepMode !== 'interval' || !sleepStart || !wakeTime) return null;
    return intervalMinutes(sleepStart, wakeTime);
  }, [sleepMode, sleepStart, wakeTime]);
  /** 两刻相同推得零分钟：不作为眠录提交，改以一句提示请用户核对。 */
  const sleepIntervalValid = sleepIntervalPreview !== null && sleepIntervalPreview > 0;

  const weightWarning = typeof weight === 'number' && weightWarningFor ? weightWarningFor(weight) : null;
  /** 越常体重的二次确认：只提示，绝不替用户改数。 */
  const weightNeedsAck = weightWarning !== null && !weightAck;

  const submit = async (): Promise<boolean> => {
    if (weightNeedsAck) {
      setWeightAck(true);
      return false;
    }

    // 数目自校验（novalidate 后走 hint 通道，不吐原生英文气泡；不合常度者不静默放行）
    if (weight !== '' && (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0)) {
      setHint('体重须为零以上之数——核对后再照准。');
      return false;
    }
    if (typeof waistCm === 'number' && waistCm > 0 && (waistCm < 40 || waistCm > 200)) {
      setHint(`腰围 ${waistCm} 公分不合常度（40–200）——核对后再照准。`);
      return false;
    }
    if (sleepMode === 'duration' && sleepMinutes !== '' && (typeof sleepMinutes !== 'number' || !Number.isFinite(sleepMinutes) || sleepMinutes < 0 || sleepMinutes > 1440)) {
      setHint('眠时须在 0–1440 分之间——核对后再照准。');
      return false;
    }
    if (sleepMode === 'interval' && sleepIntervalPreview !== null && !sleepIntervalValid) {
      setHint('就寝与起身同刻，推不出眠时——核对两刻再照准。');
      return false;
    }

    // 空录之戒：一无所有就不发请求（腰围填了也算一录）
    const hasAny =
      typeof weight === 'number' ||
      (typeof waistCm === 'number' && waistCm > 0) ||
      sleepIntervalValid ||
      (sleepMode === 'duration' && typeof sleepMinutes === 'number' && sleepMinutes > 0) ||
      stateNotes.trim() !== '';
    if (!hasAny) {
      setHint('此页尚无一录可入——填得一项再照准。');
      return false;
    }

    setHint(null);
    let sleep: SleepEntry | undefined;
    if (sleepMode === 'interval' && sleepIntervalValid) {
      sleep = { kind: 'interval', sleepStart, wakeTime };
    } else if (sleepMode === 'duration' && typeof sleepMinutes === 'number' && sleepMinutes > 0) {
      sleep = { kind: 'duration', minutes: sleepMinutes };
    }

    const saved = await onSave(
      {
        // 未填则不写：不把默认值当记录。体感（精力/酸痛）不在本表——不传即保首页所点之值
        weight: typeof weight === 'number' && weight > 0 ? weight : undefined,
        sleep,
        notes: stateNotes,
      },
      typeof waistCm === 'number' && waistCm > 0 ? waistCm : undefined
    );
    if (!saved) setWeightAck(false);
    return saved;
  };

  return (
    <SheetShell
      isOpen={isOpen}
      title="录体征"
      titleId="body-sheet-title"
      widthClass="sm:max-w-md"
      onClose={onClose}
      onSubmit={submit}
      hint={hint}
      submitLabel={weightNeedsAck ? '仍要录之' : '照准'}
      draftKey="phc_draft_body"
      getDraft={() => ({ weight, waistCm, sleepMode, sleepStart, wakeTime, sleepMinutes, stateNotes })}
      applyDraft={(d) => {
        setWeight(typeof d.weight === 'number' ? d.weight : '');
        setWaistCm(typeof d.waistCm === 'number' ? d.waistCm : '');
        if (d.sleepMode === 'interval' || d.sleepMode === 'duration') setSleepMode(d.sleepMode);
        if (typeof d.sleepStart === 'string') setSleepStart(d.sleepStart);
        if (typeof d.wakeTime === 'string') setWakeTime(d.wakeTime);
        setSleepMinutes(typeof d.sleepMinutes === 'number' ? d.sleepMinutes : '');
        if (typeof d.stateNotes === 'string') setStateNotes(d.stateNotes);
        setWeightAck(false);
        setHint(null);
      }}
      onDiscardDraft={resetToDefaults}
    >
      <div className="space-y-3.5">
        <Group title="今日之重 (kg)" first>
          <input
            id="rs-weight"
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value === '' ? '' : Number(e.target.value));
              setWeightAck(false);
              setHint(null);
            }}
            placeholder="未录"
            className={`${INPUT} tabular-nums`}
          />
          {weightWarning && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-danger leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {weightWarning}
                {weightAck ? ' —— 既已确认，仍照原数录入。' : ' —— 再点一次「照准」即照原数录入。'}
              </span>
            </p>
          )}
        </Group>

        {/* 会变之数与档案分列两表：腰围在此随录随更（档中最新值覆盖），档案只收常量 */}
        <Group title="腰围 (cm，可无)">
          <input
            id="rs-waist"
            type="number"
            min="40"
            max="200"
            value={waistCm}
            onChange={(e) => {
              setWaistCm(e.target.value === '' ? '' : Number(e.target.value));
              setHint(null);
            }}
            placeholder="留空即不改档中所存"
            className={`${INPUT} tabular-nums`}
          />
          <p className="mt-1.5 text-[12px] text-ink3">会变之数——量得新值照录，旧值自更。</p>
        </Group>

        {/* 睡眠：时刻优先，时长由时刻推得；只记得总时长才切手录 */}
        <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
          <div className="flex items-center justify-between">
            <span className="group-head">昨夜之眠</span>
            <button
              type="button"
              onClick={() => setSleepMode(sleepMode === 'interval' ? 'duration' : 'interval')}
              className="btn-link text-[12px]"
            >
              {sleepMode === 'interval' ? '改用手录眠时' : '改用就寝/起身时刻'}
            </button>
          </div>

          <div className="mt-2 space-y-2.5">
            {/* 两式叠放于同一格：容器高恒等于较高者——切式时下方预览与「照准」一拍不动（零偏移）。
                未选中的一面用 invisible 而非条件卸载：仍占位,状态也不丢。 */}
            <div className="grid">
              <div
                className={`col-start-1 row-start-1 ${sleepMode === 'interval' ? '' : 'invisible'}`}
                aria-hidden={sleepMode !== 'interval'}
              >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rs-sleep-start" className="block text-ink3 mb-1 text-[12px]">就寝</label>
                  <input
                    id="rs-sleep-start"
                    type="time"
                    value={sleepStart}
                    onChange={(e) => {
                      setSleepStart(e.target.value);
                      setHint(null);
                    }}
                    className={`${INPUT} tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="rs-wake-time" className="block text-ink3 mb-1 text-[12px]">起身</label>
                  <input
                    id="rs-wake-time"
                    type="time"
                    value={wakeTime}
                    onChange={(e) => {
                      setWakeTime(e.target.value);
                      setHint(null);
                    }}
                    className={`${INPUT} tabular-nums`}
                  />
                </div>
              </div>
              </div>
              <div
                className={`col-start-1 row-start-1 ${sleepMode === 'duration' ? '' : 'invisible'}`}
                aria-hidden={sleepMode !== 'duration'}
              >
                <label htmlFor="rs-sleep-minutes" className="block text-ink3 mb-1 text-[12px]">手录眠时（分钟）</label>
                <input
                  id="rs-sleep-minutes"
                  type="number"
                  min="0"
                  max="840"
                  value={sleepMinutes}
                  onChange={(e) => {
                    setSleepMinutes(e.target.value === '' ? '' : Number(e.target.value));
                    setHint(null);
                  }}
                  className={`${INPUT} tabular-nums`}
                />
              </div>
            </div>

            <p className="text-[12px] text-ink3 tabular-nums">
              {sleepMode === 'interval'
                ? sleepIntervalPreview === null
                  ? '填齐就寝与起身时刻，方得时长。'
                  : sleepIntervalValid
                  ? `时长由时刻推得：${formatNightDuration(sleepIntervalPreview)}`
                  : '两刻相同推得零分——请核就寝与起身时刻。'
                : typeof sleepMinutes === 'number' && sleepMinutes > 0
                ? `手录眠时：${formatNightDuration(sleepMinutes)}`
                : '未填则今日之眠记为未录。'}
            </p>
          </div>
        </div>

        {/* 体感（精力/酸痛）不在此录——首页「今日体感」点按即调，表单不重复收 */}

        <div className="pt-3.5 mt-1 border-t border-dotted border-linehover">
          <label htmlFor="rs-notes" className="group-head">随笔（可无）</label>
          <input
            id="rs-notes"
            type="text"
            value={stateNotes}
            onChange={(e) => {
              setStateNotes(e.target.value);
              setHint(null);
            }}
            className={`${INPUT} mt-2`}
            placeholder="昨夜之眠、晨起之神……"
          />
        </div>
      </div>
    </SheetShell>
  );
};
