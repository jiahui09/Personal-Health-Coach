// 奏折式章节头:眉行(章序 + 右注) → 题行(26px 衬线) → 全页唯一的 2px 墨线。
// 朱批旁注竖排贴在章节右侧的旁批槽(lg:pr-9 预留 36px),窄屏降级为题下横排朱批。
// deslop-ignore-file 07
import React from 'react';

interface SectionHeadProps {
  /** 章序「其一 / 其二 / 其三」;右栏附目与通栏不带章序 */
  ordinal?: string;
  title: string;
  /** 右注:时段、计数、章节级动作(眉行右端) */
  note?: React.ReactNode;
  /** 朱批旁注,≤8 字,必须取自真实数据 */
  verdict?: string;
}

export const SectionHead: React.FC<SectionHeadProps> = ({ ordinal, title, note, verdict }) => (
  <div className="relative pb-3 border-b-2 border-ink">
    {/* 题下双线：2px 墨 + 1px 细线（与版框同构） */}
    <div aria-hidden="true" className="absolute inset-x-0 -bottom-[3px] border-b border-line" />
    {/* 眉行:固定 18px 定高(居中而非基线对齐,免得衬线序与无衬线右注的字面差 2px),
        保证六个章节头等高 → 跨栏横线同 y */}
    <div className="flex items-center gap-4 h-[18px] leading-[18px]">
      {ordinal && (
        <span className="font-serif text-[13px] font-bold text-ink2 tracking-[0.3em] shrink-0">
          {ordinal}
        </span>
      )}
      {note && <span className="ml-auto shrink-0">{note}</span>}
    </div>

    <div className="mt-1.5">
      <h2 className="font-serif text-[26px] font-bold text-ink tracking-[0.06em]">{title}</h2>
      {verdict && (
        <div className="lg:hidden mt-1 font-serif text-[13px] text-accent tracking-[0.1em] [writing-mode:horizontal-tb]">
          {verdict}
        </div>
      )}
    </div>

    {/* 桌面竖排朱批:绝对定位在旁批槽内,不参与高度计算 */}
    {verdict && (
      <span className="hidden lg:block absolute -right-9 -top-0.5 font-serif text-[13px] text-accent tracking-[0.12em] whitespace-nowrap [writing-mode:vertical-rl] [text-orientation:upright]">
        {verdict}
      </span>
    )}
  </div>
);
