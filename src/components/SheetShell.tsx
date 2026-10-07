// 录事三表共用之壳：墨线版框、章节题式题头、照准提交脚注、亮勾阖之。
// INPUT / Group / chipClass 与录事类型同源共出，三表不再各自持一份。
// deslop-ignore-file 07 22 28
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import type { BodyweightExercise } from '../types/health';
import { useSheetBehavior } from '../hooks/useSheetBehavior';

/** 录事三域：入口在各节就地按钮，此处仅作 App 路由到表的判别。 */
export type RecordTab = 'meal' | 'workout' | 'body';

export interface RecordDefaults {
  weight?: number;
  sleepStart?: string;
  wakeTime?: string;
  sleepMinutes?: number;
  /** 今日已有的随笔（有则预填，不被空提交抹掉）。 */
  note?: string;
  /** 档中现有腰围（预填显示；未改动即不重写档）。 */
  waistCm?: number;
  /** 今日之荐（训练规划器所排；有则习练表按此预填）。 */
  workoutTitle?: string;
  workoutExercises?: BodyweightExercise[];
  workoutDuration?: number;
}

/** 表单控件共用一笔（16px 防 iOS 聚焦缩放；焦点墨线由全局提供）。 */
export const INPUT =
  'w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent';

/** 组题：与主页 .group-head 同款，配点线分段，不设卡片底（须在模块作用域,免得每次渲染重挂输入）。 */
export const Group: React.FC<{ title: string; children: React.ReactNode; first?: boolean }> = ({
  title,
  children,
  first,
}) => (
  <div className={first ? '' : 'pt-3.5 mt-1 border-t border-dotted border-linehover'}>
    <span className="group-head">{title}</span>
    <div className="mt-2">{children}</div>
  </div>
);

/** 签片（chip）按钮：墨底为选中，无底色为未选。 */
export const chipClass = (active: boolean) =>
  `py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
    active ? 'bg-ink text-white border-ink' : 'bg-surface border-control text-ink2'
  }`;

interface SheetShellProps {
  isOpen: boolean;
  /** 题头文字（御批体例：录一膳 / 录一练 / 录体征）。 */
  title: string;
  /** 题头 id（供 aria-labelledby，各表唯一）。 */
  titleId: string;
  /** 桌面宽度档；以「常规内容一屏放下、无需下拉」为准。 */
  widthClass?: string;
  onClose: () => void;
  /** 本表提交：存上返回 true（壳亮勾 700ms 后阖之）；未存上返回 false（壳保持开启，提示已由 App 弹出）。 */
  onSubmit: () => Promise<boolean>;
  /** 本表提示句（空录之戒、折算不出等），显示于提交脚注之上。 */
  hint?: string | null;
  /** 主确认文案；越常体重二次确认时为「仍要录之」。 */
  submitLabel?: string;
  /** 残稿之键（sessionStorage 命名空间）；配 getDraft 即随录随存，配 applyDraft 即开时回填。 */
  draftKey?: string;
  /** 取本表全量状态（JSON 可序列化）；由各表自己认得自己的字段。 */
  getDraft?: () => Record<string, unknown>;
  /** 开时以残稿覆各表默认值（本 effect 后于各表开合 effect 行）。 */
  applyDraft?: (draft: Record<string, unknown>) => void;
  /** 弃稿：各表重跑开合默认值，残稿之键由壳负责清除。 */
  onDiscardDraft?: () => void;
  children: React.ReactNode;
}

/** 录事弹层之壳：Esc/遮罩阖之、开时锁背景滚动、阖时焦点归位皆由 useSheetBehavior 统一。 */
export const SheetShell: React.FC<SheetShellProps> = ({
  isOpen,
  title,
  titleId,
  widthClass = 'sm:max-w-lg',
  onClose,
  onSubmit,
  hint,
  submitLabel = '照准',
  draftKey,
  getDraft,
  applyDraft,
  onDiscardDraft,
  children,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  /** 遮罩拦下后的告知（表中有稿时点遮罩不阖）。 */
  const [guardNotice, setGuardNotice] = useState(false);
  /** 开表时回填过残稿与否（显示「弃此残稿」）。 */
  const [hadDraft, setHadDraft] = useState(false);
  /** 只要动过一指（改字段、点签片）即为有稿：遮罩不再准许阖之。 */
  const dirtyRef = useRef(false);
  /** 取稿函数走 ref：React 批处理后才落新值，落笔一拍后再取，读到的才是这回输入。 */
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;
  /** 待落之稿的计时器：焚稿/弃稿时须把还没跑的 persist 一并撤掉，免得反写。 */
  const persistTimerRef = useRef<number | null>(null);

  const { panelRef, backdropProps } = useSheetBehavior(isOpen, onClose, {
    allowBackdropClose: () => !dirtyRef.current,
    onBackdropBlocked: () => setGuardNotice(true),
  });

  // 每回开启回到未提交态（表内容的回填由各表自己的开合 effect 负责），
  // 并在各表落好默认值之后覆以本机残稿——误触遮罩/按 Esc 离表，稿不丢。
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      setIsSavedFeedback(false);
      setGuardNotice(false);
      dirtyRef.current = false;
      setHadDraft(false);
      if (draftKey && applyDraft) {
        // 回填延一拍：本壳是各表的子组件，本 effect 先于各表「开合落默认值」之 effect 执行，
        // 即刻回填会被随后的默认值一把抹掉；待各表落定，再以残稿覆之。
        window.setTimeout(() => {
          try {
            const raw = sessionStorage.getItem(draftKey);
            if (raw) {
              const parsed: unknown = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                applyDraft(parsed as Record<string, unknown>);
                setHadDraft(true);
              }
            }
          } catch {
            // 残稿坏了就当没有：不拦开表
          }
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** 随录随存：任一字段变更/签片点选即落本机（提交成功后由壳焚稿）。 */
  const persistDraft = () => {
    const getKey = getDraftRef.current;
    if (!draftKey || !getKey) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(getKey()));
    } catch {
      // 存不下就只丢残稿能力，不搅扰录入
    }
  };

  const markDirty = () => {
    dirtyRef.current = true;
    setGuardNotice(false);
    // 本事件内状态尚未刷进渲染树：延一拍（下次宏任务）取稿，读到的才是这回输入之值
    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(persistDraft, 0);
  };

  if (!isOpen) return null;

  const runSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSavedFeedback) return;
    setIsSubmitting(true);
    try {
      const saved = await onSubmit();
      if (saved) {
        // 存上即焚残稿：下回开表回到各表默认值，不带旧账。
        // 先撤待落之 persist（照准那点也会 markDirty），免得焚后反写。
        if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
        if (draftKey) {
          try {
            sessionStorage.removeItem(draftKey);
          } catch {
            /* 无碍 */
          }
        }
        setHadDraft(false);
        setIsSavedFeedback(true);
        setTimeout(() => {
          setIsSavedFeedback(false);
          onClose();
        }, 700);
      }
    } catch (err) {
      // Handlers own their error toasts; this guard only stops a rejected
      // handler from running the success animation.
      console.error('Failed to save record:', err);
    } finally {
      setIsSubmitting(false);
    }
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
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        /* 版框：与主页同源的外粗内细墨线,不用阴影；max-h 仅作极端兜底，常规内容一屏放下 */
        className={`w-full ${widthClass} bg-paper rounded-t-lg sm:rounded-lg border-2 border-ink p-[3px] overflow-hidden flex flex-col max-h-[95vh]`}
      >
        <div className="flex flex-col min-h-0 flex-1 border border-ink/55 rounded-[5px] overflow-hidden">
          {/* Header：章节题式 2px 墨线收口 */}
          <div className="px-4 sm:px-5 py-3.5 border-b-2 border-ink flex items-center justify-between">
            <h3 id={titleId} className="font-serif text-lg font-medium text-ink">
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label="阖之"
              className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={runSubmit}
            /* novalidate：原生英文校验气泡与御批语域相斥，空录之戒由各表 hint 自校验 */
            noValidate
            onChange={markDirty}
            onInput={markDirty}
            onClick={(e) => {
              // 签片是 button，不发 change——点进表的任何一指皆记为有稿；
              // 「弃此残稿」除外（免得先清稿又被本 handler 写回）
              if ((e.target as HTMLElement).closest('[data-draft-discard]')) return;
              if ((e.target as HTMLElement).closest('button')) markDirty();
            }}
            className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px] font-sans"
          >
            {children}

            {/* Action Button */}
            <div className="pt-2">
              {guardNotice && (
                <p role="status" className="mb-2 text-[12px] text-ink2 leading-relaxed">
                  表中已有录文——点遮罩不阖；按 Esc 或右上角「阖之」离表，残稿留于本机。
                </p>
              )}
              {hadDraft && (
                <div className="mb-2 flex items-center justify-between gap-2 text-[12px] text-ink3">
                  <span>已回填上次残稿；照准存上即焚。</span>
                  <button
                    type="button"
                    data-draft-discard
                    className="btn-link shrink-0"
                    onClick={() => {
                      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
                      if (draftKey) {
                        try {
                          sessionStorage.removeItem(draftKey);
                        } catch {
                          /* 无碍 */
                        }
                      }
                      setHadDraft(false);
                      dirtyRef.current = false;
                      onDiscardDraft?.();
                    }}
                  >
                    弃此残稿
                  </button>
                </div>
              )}
              {hint && (
                <p role="status" className="mb-2 text-[12px] text-danger">
                  {hint}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-accentbright" />
                    <span>已录于册</span>
                  </>
                ) : isSubmitting ? (
                  <span>存中…</span>
                ) : (
                  <span>{submitLabel}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
