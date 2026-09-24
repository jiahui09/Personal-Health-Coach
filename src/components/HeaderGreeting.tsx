import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Calendar } from 'lucide-react';

interface HeaderGreetingProps {
  displayDate: string;
  timeGreeting: string;
  onOpenRecord: () => void;
}

export const HeaderGreeting: React.FC<HeaderGreetingProps> = ({
  displayDate,
  timeGreeting,
  onOpenRecord,
}) => {
  return (
    <header className="pt-8 pb-4 border-b border-[#e9e4dc] transition-all">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-[#7c756b]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]"></span>
            <span>Personal Health Coach</span>
            <span className="text-[#c7bfb3]">·</span>
            <span>Living Journal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight text-[#1c1917] mt-2 font-normal">
            {timeGreeting}
          </h1>

          <p className="text-sm text-[#78716c] font-sans mt-1">
            {displayDate}
          </p>
        </div>

        <button
          onClick={onOpenRecord}
          className="shrink-0 text-xs font-medium text-[#44403c] bg-[#f5f2eb] hover:bg-[#ebe6dc] border border-[#e2dcd1] px-3.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <span className="text-[#15803d] font-bold">+</span>
          <span>记一笔</span>
        </button>
      </div>
    </header>
  );
};
