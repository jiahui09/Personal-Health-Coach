import React, { useState } from 'react';
import { Compass, Clock, Code, BookOpen, Dumbbell, Sparkles, Plus } from 'lucide-react';
import { LifeLog, WeeklyLifeStat } from '../types/health';

interface LifeSectionProps {
  weeklyStats: WeeklyLifeStat[];
  recentLogs: LifeLog[];
  onOpenAddLog: () => void;
}

export const LifeSection: React.FC<LifeSectionProps> = ({
  weeklyStats,
  recentLogs,
  onOpenAddLog,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Coding':
        return <Code className="w-3.5 h-3.5 text-[#2563eb]" />;
      case 'Learning':
        return <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />;
      case 'Exercise':
        return <Dumbbell className="w-3.5 h-3.5 text-[#15803d]" />;
      case 'Reading':
        return <BookOpen className="w-3.5 h-3.5 text-[#9333ea]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#78716c]" />;
    }
  };

  const filteredLogs = selectedCategory
    ? recentLogs.filter((l) => l.category === selectedCategory)
    : recentLogs;

  return (
    <section className="py-6 border-t border-[#ece7de] space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#1c1917] tracking-tight">
            LIFE
          </h2>
          <span className="text-xs font-mono text-[#a8a29e]">
            人生轨迹 · 事实统计
          </span>
        </div>

        <button
          onClick={onOpenAddLog}
          className="text-xs text-[#78716c] hover:text-[#1c1917] font-sans flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3 text-[#15803d]" />
          <span>记录时刻</span>
        </button>
      </div>

      {/* This Week Factual Breakdown (No scores, no value judgments) */}
      <div className="p-4 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] space-y-3">
        <div className="flex items-center justify-between text-xs text-[#78716c]">
          <span>This week · 本周投入</span>
          <span className="font-mono text-[11px] text-[#a8a29e]">纯事实记录</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {weeklyStats.map((item) => (
            <div
              key={item.category}
              onClick={() =>
                setSelectedCategory(selectedCategory === item.category ? null : item.category)
              }
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                selectedCategory === item.category
                  ? 'bg-white border-[#15803d] shadow-2xs'
                  : 'bg-white/60 border-[#eee8df] hover:border-[#dfd8cc]'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-sans text-[#78716c] flex items-center gap-1.5">
                  {getCategoryIcon(item.category)}
                  <span>{item.category}</span>
                </span>
              </div>

              <div className="text-lg font-serif font-medium text-[#1c1917] tabular-nums mt-1">
                {item.sessions ? `${item.sessions} 次` : `${item.hours}h`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent moments (Chronological logs from life_logs) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#78716c] px-1">
          <span>Recent moments · 近期手记</span>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-[11px] text-[#15803d] hover:underline cursor-pointer"
            >
              显示全部
            </button>
          )}
        </div>

        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-[#fbfaf8] border border-[#e8e2d8] hover:border-[#ded8cc] transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
                  <span className="font-serif font-medium text-[#1c1917] text-sm">
                    {log.title}
                  </span>
                </span>

                <span className="text-[11px] font-mono text-[#a8a29e]">
                  {log.date}
                </span>
              </div>

              <p className="text-xs text-[#57534e] font-sans leading-relaxed pl-3.5">
                {log.content}
              </p>

              <div className="flex items-center gap-2 pl-3.5 pt-1 text-[11px] font-mono text-[#a8a29e]">
                <span>{log.category}</span>
                {log.durationMinutes > 0 && (
                  <>
                    <span>·</span>
                    <span>{Math.round(log.durationMinutes / 6) / 10}h</span>
                  </>
                )}
                {log.project && (
                  <>
                    <span>·</span>
                    <span className="text-[#78716c]">{log.project}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
