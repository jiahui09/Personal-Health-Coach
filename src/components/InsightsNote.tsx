import React from 'react';
import { Feather, Heart } from 'lucide-react';

interface InsightsNoteProps {
  note: string;
}

export const InsightsNote: React.FC<InsightsNoteProps> = ({ note }) => {
  return (
    <section className="py-6 border-t border-[#e9e4dc] space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#78716c]">
        <Feather className="w-3.5 h-3.5 text-[#a8a29e]" />
        <span>A small note about you · 身体手记</span>
      </div>

      <div className="p-5 rounded-2xl bg-[#f5f2eb]/60 border border-[#e8e2d8] space-y-2">
        <p className="text-base font-serif italic text-[#292524] leading-relaxed">
          "{note}"
        </p>

        <p className="text-xs text-[#78716c] font-sans pt-1">
          不需要着急追求剧烈的变化。让每天的进食、深蹲和安睡自然发生，身体就会长久地回馈你。
        </p>
      </div>
    </section>
  );
};
