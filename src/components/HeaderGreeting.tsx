// Masthead (seal + wordmark) and the display greeting. deslop-ignore-file 07 08 33
import React from 'react';
import { cnCount } from '../utils/cnCount';
import type { TaskProgress } from '../domain/types';

interface HeaderGreetingProps {
  displayDate: string;
  timeGreeting: string;
  /** 与「其一 今日之事」同源：domain/calculateTaskProgress 的结果。 */
  tasks: TaskProgress;
  storageLabel: string;
  onOpenRecord: () => void;
}


export const HeaderGreeting: React.FC<HeaderGreetingProps> = ({
  displayDate,
  timeGreeting,
  tasks,
  storageLabel,
  onOpenRecord,
}) => {
  return (
    <header>
      {/* 刊头：印章 + 报头 + 录一笔 */}
      <div className="flex items-center gap-3.5 pt-7 pb-4 border-b-2 border-ink">
        <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-seal text-white font-serif text-lg font-bold select-none">
          记
        </span>

        <div>
          <div className="font-serif text-[17px] font-bold text-ink leading-tight tracking-[0.08em]">
            个人健康手记
          </div>
          <div className="text-[12px] font-semibold text-ink3 tracking-[0.2em] mt-1">
            日省吾身
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden sm:block text-[12px] font-semibold text-ink3 tracking-[0.14em]">
            {storageLabel}
          </span>
          <button onClick={onOpenRecord} className="btn-primary">
            录一笔
          </button>
        </div>
      </div>

      {/* 序：大字问候 + 干支日期 */}
      <div className="pt-10 pb-8 border-b border-line">
        <h1 className="font-serif font-bold text-ink text-[46px] sm:text-[68px] leading-[1.04] tracking-[0.02em]">
          {timeGreeting}
        </h1>
        <div className="mt-4 font-serif text-[16px] text-ink2 tracking-[0.28em]">{displayDate}</div>
        <div className="mt-2 text-[13.5px] text-ink3">
          {tasks.total === 0
            ? '今日未列事。'
            : `凡${cnCount(tasks.total)}事，已成其${cnCount(tasks.completed)}。`}
          {tasks.skipped > 0 && (
            <span className="text-ink4"> （另略过 {tasks.skipped} 事）</span>
          )}
        </div>
      </div>
    </header>
  );
};
