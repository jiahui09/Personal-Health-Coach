/**
 * 单页流的章节目录——移动端悬浮目录的唯一数据源。
 *
 * id 与 App.tsx 中各节的锚点一一对应；label 取该节章节题（刊首除外，
 * 刊头无 SectionHead）。对应关系由 src/tests/mobileNav.test.ts 锁定。
 */
export interface PageSection {
  /** 目标锚点 id（App 中与之同名的元素） */
  id: string;
  /** 目录显示之名 */
  label: string;
}

export const PAGE_SECTIONS: PageSection[] = [
  { id: 'sec-head', label: '刊首' },
  { id: 'sec-today', label: '今日之事' },
  { id: 'sec-training', label: '今日之练' },
  { id: 'sec-body', label: '体征' },
  { id: 'sec-nutrition', label: '营养摄入' },
  { id: 'sec-stats', label: '统计' },
];
