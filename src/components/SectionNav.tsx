// 移动端悬浮目录：单栏版式页面很长，一枚固定小钮点开列各栏章名，点章名即滚到该栏。
// 只在窄屏出现（lg 以上即桌面双栏，页面短、不需要目录），且只做定位，不新增任何功能。
import React, { useEffect, useRef, useState } from 'react';
import { List, X } from 'lucide-react';
import type { PageSection } from '../data/pageSections';

interface SectionNavProps {
  /** 目录条目：与页面锚点一一对应（数据源 data/pageSections.ts） */
  sections: PageSection[];
}

export const SectionNav: React.FC<SectionNavProps> = ({ sections }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 展开期间：点空白或按 Esc 即收起
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const jumpTo = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="fixed right-4 bottom-6 z-40 lg:hidden">
      {open && (
        <nav
          id="section-nav-menu"
          aria-label="章节目录"
          className="absolute right-0 bottom-14 w-44 bg-paper border-2 border-ink rounded-lg p-[3px] shadow-lg"
        >
          <div className="border border-ink/55 bg-surface rounded-md px-1 py-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => jumpTo(section.id)}
                className="w-full text-left px-3 py-2.5 font-serif text-[14px] text-ink rounded hover:bg-surface2 focus-visible:bg-surface2 min-h-[40px]"
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? '收起章节目录' : '展开章节目录'}
        aria-expanded={open}
        aria-controls="section-nav-menu"
        className="ml-auto w-11 h-11 grid place-items-center rounded-lg bg-ink text-white shadow-lg"
      >
        {open ? <X className="w-5 h-5" /> : <List className="w-5 h-5" />}
      </button>
    </div>
  );
};
