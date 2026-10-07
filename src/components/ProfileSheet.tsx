// Serif for the sheet title only. deslop-ignore-file 07 19 22 28
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import type { ActivityLevel, FitnessGoal, UserProfile } from '../types/health';
import { ACTIVITY_CN, DIRECTION_CN } from '../services/decisionCopy';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import { TRAINING_POLICY } from '../domain/policy';
import { chipClass } from './SheetShell';

interface ProfileSheetProps {
  isOpen: boolean;
  profile: UserProfile;
  /** 应用建议的方向（用于「采纳建议」）。 */
  advisedDirection: 'lose' | 'maintain' | 'gain';
  adviseConflicting: boolean;
  /** 出生年上限（由页面按时钟算出后传入,组件不自行读时钟）。 */
  maxBirthYear: number;
  onClose: () => void;
  onSave: (patch: Partial<UserProfile>) => Promise<boolean>;
}

const GOALS: FitnessGoal[] = ['fat loss', 'maintain', 'muscle gain', 'general fitness'];
const GOAL_SHORT: Record<FitnessGoal, string> = {
  'fat loss': '减脂',
  maintain: '维持',
  'muscle gain': '增肌',
  'general fitness': '强身',
};

/** 建档 / 改档：只收常量（性别、出生年、身高、活动水平、目标、训练预算）；随日而变之数归体征表。 */
export const ProfileSheet: React.FC<ProfileSheetProps> = ({
  isOpen,
  profile,
  advisedDirection,
  adviseConflicting,
  maxBirthYear,
  onClose,
  onSave,
}) => {
  const [sex, setSex] = useState<'female' | 'male'>('male');
  const [birthYear, setBirthYear] = useState<number | ''>('');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<FitnessGoal>('fat loss');
  const [trainingMinutes, setTrainingMinutes] = useState<number | ''>(TRAINING_POLICY.planner.budgetDefaultMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Esc 阖之、点遮罩阖之、开时锁背景滚动、阖时焦点归位（三弹层共用）
  const { panelRef, backdropProps } = useSheetBehavior(isOpen, onClose);

  // 开时照最近一次存盘的档回填；profile 走 ref,别处数据刷新不中断正在填写的内容
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!isOpen) return;
    const p = profileRef.current;
    setSex(p.sex === 'female' ? 'female' : 'male');
    setBirthYear(p.birthYear ?? '');
    setHeightCm(p.heightCm ?? '');
    setActivityLevel(p.activityLevel ?? 'light');
    setGoal(p.goal ?? 'fat loss');
    setTrainingMinutes(p.trainingMinutesBudget ?? TRAINING_POLICY.planner.budgetDefaultMinutes);
    setSaved(false);
    setIsSaving(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const birthInvalid =
    typeof birthYear !== 'number' || birthYear < 1900 || birthYear > maxBirthYear;
  const heightInvalid = typeof heightCm !== 'number' || heightCm < 100 || heightCm > 250;
  const valid = !birthInvalid && !heightInvalid;

  const chip = chipClass;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setIsSaving(true);
    const ok = await onSave({
      sex,
      birthYear: Number(birthYear),
      heightCm: Number(heightCm),
      activityLevel,
      goal,
      goalSource: 'user',
      trainingMinutesBudget: trainingMinutes === '' ? undefined : trainingMinutes,
    });
    setIsSaving(false);
    if (!ok) return;
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      {...backdropProps}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-sheet-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        /* 版框：与主页同源的外粗内细墨线,不用阴影 */
        className="w-full sm:max-w-lg bg-paper rounded-t-lg sm:rounded-lg border-2 border-ink p-[3px] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex flex-col min-h-0 flex-1 border border-ink/55 rounded-[5px] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b-2 border-ink flex items-center justify-between">
          <h3 id="profile-sheet-title" className="font-serif text-lg font-medium text-ink">体征档</h3>
          <button
            onClick={onClose}
            aria-label="阖之"
            className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px] font-sans"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink3 mb-1">性别（RMR 公式需要）</label>
              <div className="grid grid-cols-2 gap-2">
                {(['male', 'female'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSex(value)}
                    className={chip(sex === value)}
                  >
                    {value === 'male' ? '男' : '女'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="ps-birth-year" className="block text-ink3 mb-1">出生年（派生年龄）</label>
              <input
                id="ps-birth-year"
                type="number"
                min="1900"
                max={maxBirthYear}
                required
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1990"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-[16px] text-ink focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ps-height" className="block text-ink3 mb-1">身高 (cm)</label>
              <input
                id="ps-height"
                type="number"
                min="100"
                max="250"
                required
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="175"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-[16px] text-ink focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="ps-train-budget" className="block text-ink3 mb-1">
                每日训练时间预算（分钟，排课按此装箱）
              </label>
              <input
                id="ps-train-budget"
                type="number"
                min={TRAINING_POLICY.planner.budgetMinMinutes}
                max={TRAINING_POLICY.planner.budgetMaxMinutes}
                value={trainingMinutes}
                onChange={(e) => setTrainingMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="30"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-[16px] text-ink focus:border-accent"
              />
              <p className="mt-1 text-[12px] text-ink3">
                未填按 {TRAINING_POLICY.planner.budgetDefaultMinutes} 分计；允许 {TRAINING_POLICY.planner.budgetMinMinutes}–{TRAINING_POLICY.planner.budgetMaxMinutes} 分。
              </p>
            </div>
          </div>

          <div>
            <label className="block text-ink3 mb-1">活动水平（决定总消耗）</label>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(ACTIVITY_CN) as ActivityLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActivityLevel(level)}
                  title={ACTIVITY_CN[level].hint}
                  className={chip(activityLevel === level)}
                >
                  {ACTIVITY_CN[level].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-ink3 tabular-nums">
              {ACTIVITY_CN[activityLevel].hint}
            </p>
          </div>

          <div>
            <label className="block text-ink3 mb-1">目标</label>
            <div className="grid grid-cols-4 gap-2">
              {GOALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGoal(value)}
                  className={chip(goal === value)}
                >
                  {GOAL_SHORT[value]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[12px] text-ink3">
              应用建议：{DIRECTION_CN[advisedDirection]}
              {adviseConflicting && ' —— 与你的选择不同，仍按你的选择计'}
            </p>
          </div>

          {/* 照准为何不可点：就地给出缺项，不叫用户猜 */}
          {!valid && (
            <p className="text-[12px] text-danger leading-relaxed">
              {birthInvalid && `出生年须在 1900–${maxBirthYear} 之间；`}
              {heightInvalid && '身高须在 100–250 之间。'}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={!valid || isSaving}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-accentbright" />
                  <span>已录于册</span>
                </>
              ) : (
                <span>照准</span>
              )}
            </button>
          </div>
        </form>
        </div>
      </motion.div>
    </div>
  );
};
