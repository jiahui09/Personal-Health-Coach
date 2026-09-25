// Serif for the sheet title only. deslop-ignore-file 07 19 22 28
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import type { ActivityLevel, FitnessGoal, UserProfile } from '../types/health';
import { ACTIVITY_CN, DIRECTION_CN } from '../services/decisionCopy';

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

/** 建档 / 改档：只收原始事实（性别、出生年、身高、活动水平、腰围、目标）。 */
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
  const [waistCm, setWaistCm] = useState<number | ''>('');
  const [goal, setGoal] = useState<FitnessGoal>('fat loss');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSex(profile.sex === 'female' ? 'female' : 'male');
    setBirthYear(profile.birthYear ?? '');
    setHeightCm(profile.heightCm ?? '');
    setActivityLevel(profile.activityLevel ?? 'light');
    setWaistCm(profile.waistCm ?? '');
    setGoal(profile.goal ?? 'fat loss');
    setSaved(false);
    setIsSaving(false);
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const valid =
    typeof birthYear === 'number' &&
    birthYear >= 1900 &&
    birthYear <= maxBirthYear &&
    typeof heightCm === 'number' &&
    heightCm >= 100 &&
    heightCm <= 250;

  const chip = (active: boolean) =>
    `py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
      active ? 'bg-ink text-white border-ink' : 'bg-surface border-control text-ink2'
    }`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setIsSaving(true);
    const ok = await onSave({
      sex,
      birthYear: Number(birthYear),
      heightCm: Number(heightCm),
      activityLevel,
      waistCm: typeof waistCm === 'number' && waistCm > 0 ? Number(waistCm) : undefined,
      goal,
      goalSource: 'user',
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full sm:max-w-lg bg-paper rounded-t-lg sm:rounded-lg border border-line shadow-md overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* deslop-ignore-next-line 19 — literal 8px status dot */}
            <span className="w-2 h-2 rounded-full bg-accent" />
            <h3 className="font-serif text-lg font-medium text-ink">体征档</h3>
          </div>
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
              <label className="block text-ink3 mb-1">出生年（派生年龄）</label>
              <input
                type="number"
                min="1900"
                max={maxBirthYear}
                required
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1990"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-ink3 mb-1">身高 (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                required
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="175"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-ink3 mb-1">腰围 (cm，可无)</label>
              <input
                type="number"
                min="40"
                max="200"
                value={waistCm}
                onChange={(e) => setWaistCm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="未录"
                className="w-full bg-surface border border-control rounded-lg px-3 py-2 tabular-nums text-sm text-ink focus:border-accent"
              />
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

          <div className="pt-2">
            <button
              type="submit"
              disabled={!valid || isSaving}
              className="btn-primary w-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
      </motion.div>
    </div>
  );
};
