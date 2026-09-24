import React from 'react';
import { Edit3 } from 'lucide-react';

interface BodyOverviewProps {
  currentWeight: number;
  monthDelta: number;
  onEditWeight: () => void;
}

export const BodyOverview: React.FC<BodyOverviewProps> = ({
  currentWeight,
  monthDelta,
  onEditWeight,
}) => {
  return (
    <section className="py-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-[#78716c]">
          Body · 体重基准
        </span>
        <button
          onClick={onEditWeight}
          className="text-xs text-[#78716c] hover:text-[#1c1917] flex items-center gap-1 font-sans cursor-pointer"
        >
          <Edit3 className="w-3 h-3" />
          <span>更新体重</span>
        </button>
      </div>

      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-[#1c1917] tabular-nums">
          {currentWeight}
        </span>
        <span className="text-base text-[#78716c] font-sans">kg</span>
      </div>

      <div className="text-xs text-[#78716c] flex items-center gap-2">
        <span>
          相比这个月初{' '}
          <strong className="font-medium text-[#15803d]">
            {monthDelta <= 0 ? `轻了 ${Math.abs(monthDelta)} kg` : `重了 ${monthDelta} kg`}
          </strong>
        </span>
        <span className="text-[#d6cfc4]">·</span>
        <span className="text-[#a8a29e]">身体正在以平缓的节奏自然微调</span>
      </div>
    </section>
  );
};
