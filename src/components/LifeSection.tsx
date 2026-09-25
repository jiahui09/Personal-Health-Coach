// Serif for the section headings and journal entry titles. deslop-ignore-file 07
import React from 'react';
import { Plus } from 'lucide-react';
import type { ActivitySummary, JournalSummary } from '../domain/types';
import { minutesToHours, toPercent } from '../domain/format';
import { SectionHead } from './SectionHead';

const CATEGORY_CN: Record<string, string> = {
  Coding: '写码',
  Learning: '研学',
  Exercise: '习练',
  Reading: '披阅',
  Life: '日常',
};

const LABEL = 'text-[12px] text-ink3 tracking-[0.1em] truncate';

interface LifeWeekStatsProps {
  /** 本周（周一起）活动统计，全部由 domain 派生。 */
  activity: ActivitySummary;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

/**
 * 本周之功 — 右栏区块：分类时长一览（与「近况」共用同一套共列网格,条因此对齐）。
 * 与通栏的 LifeEntries 同属「生活纪事」，拆开放是为了让桌面双栏等高。
 */
export const LifeWeekStats: React.FC<LifeWeekStatsProps> = ({
  activity,
  selectedCategory,
  onSelectCategory,
}) => {
  const totalHours = minutesToHours(activity.totalMinutes);

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="生活纪事"
        verdict={activity.totalMinutes > 0 ? `本周${totalHours}时` : '本周未录'}
        note={<span className="text-[12px] text-ink3 tracking-[0.1em]">周一起算</span>}
      />

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[12px] text-ink3">
          <span className="group-head">本周之功</span>
          <span>占本周</span>
        </div>

        {activity.byCategory.length === 0 ? (
          <p className="text-xs text-ink3 py-3">本周尚无纪事。</p>
        ) : (
          activity.byCategory.map((item) => {
            const isSelected = selectedCategory === item.category;
            const pct = toPercent(item.share);
            return (
              <button
                type="button"
                key={item.category}
                onClick={() => onSelectCategory(isSelected ? null : item.category)}
                aria-pressed={isSelected}
                aria-label={`${CATEGORY_CN[item.category] ?? item.category} ${
                  minutesToHours(item.minutes)
                } 时 · ${item.sessions} 次，占本周 ${pct}%`}
                className={`inkrow inkrow-dotted w-full text-left cursor-pointer transition-colors duration-150 ${
                  isSelected ? 'bg-accentsoft' : 'hover:bg-surface2'
                }`}
              >
                <span className={LABEL}>{CATEGORY_CN[item.category] ?? item.category}</span>
                <span className="inkrow-meter inkrow-mid" aria-hidden="true">
                  <i className={isSelected ? 'bg-accent' : 'bg-ink'} style={{ width: `${pct}%` }} />
                </span>
                <span className="inkrow-value text-[13px] text-ink">
                  <span className="font-semibold">{minutesToHours(item.minutes)}</span> 时 ·{' '}
                  <span className="text-ink3">{item.sessions} 次</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};

interface LifeEntriesProps {
  /** 近七日手记（只数有文字的行）。 */
  journal: JournalSummary;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onOpenAddLog: () => void;
}

/** 近来手记 — 通栏区块：名录式条目，可按分类筛选。 */
export const LifeEntries: React.FC<LifeEntriesProps> = ({
  journal,
  selectedCategory,
  onSelectCategory,
  onOpenAddLog,
}) => {
  const filteredLogs = selectedCategory
    ? journal.entries.filter((log) => log.category === selectedCategory)
    : journal.entries;

  return (
    <section className="pt-10 lg:pr-9">
      <SectionHead
        title="近来手记"
        verdict={`${journal.windowLabel} ${journal.count} 条`}
        note={
          <div className="flex items-center gap-4 text-xs text-ink3">
            {selectedCategory && (
              <button onClick={() => onSelectCategory(null)} className="btn-link">
                尽览
              </button>
            )}
            <button onClick={onOpenAddLog} className="btn-link">
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>记此一刻</span>
            </button>
          </div>
        }
      />

      {filteredLogs.length === 0 ? (
        <p className="text-xs text-ink3 mt-4">尚无纪事。</p>
      ) : (
        <div className="mt-4">
          {filteredLogs.map((log, idx) => (
            <div
              key={log.id}
              className={`py-3.5 ${idx > 0 ? 'border-t border-dotted border-linehover' : ''}`}
            >
              <div className="inklist-row inklist-dotted !py-0">
                <span className="font-serif text-[17px] font-bold text-ink truncate">
                  {log.title}
                </span>
                <span className="leader" aria-hidden="true" />
                <span className="text-[12px] text-ink3 tabular-nums shrink-0">{log.date}</span>
              </div>

              <div className="mt-1 text-[12px] text-ink3 flex items-center gap-2">
                <span>{CATEGORY_CN[log.category] ?? log.category}</span>
                {log.durationMinutes > 0 && (
                  <>
                    <span>·</span>
                    <span className="tabular-nums">{minutesToHours(log.durationMinutes)} 时</span>
                  </>
                )}
                {log.project && (
                  <>
                    <span>·</span>
                    <span>{log.project}</span>
                  </>
                )}
              </div>

              {log.content && (
                <p className="text-[13px] text-ink2 leading-relaxed mt-1.5">{log.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
