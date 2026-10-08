/**
 * 移动端章节目录契约（mobileNav）
 *
 * 1. 目录条目与页面锚点一一对应——唯一数据源 data/pageSections.ts，组件与页面都不另写一份
 * 2. 目录只在窄屏出现（lg:hidden）且固定悬浮，开合与定位对读屏可读
 * 3. 章名取自各节在场的章节题，不自造词
 * 4. 展示纪律：与 presentationContract 同一套禁令（零业务算术、零时钟、零阈值）
 * 5. 已纳入 presentationContract 白名单，此后自动继承它的全部禁令
 */

import { readFileSync, readdirSync } from 'node:fs';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const app = readFileSync('src/App.tsx', 'utf8');
const nav = readFileSync('src/components/SectionNav.tsx', 'utf8');
const data = readFileSync('src/data/pageSections.ts', 'utf8');
const presentation = readFileSync('src/tests/presentationContract.test.ts', 'utf8');

// --- 1. 锚点与数据源一一对应 ---
const ids = [...data.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
const labels = [...data.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
assert(ids.length === 6, `目录共 6 条（刊首 + 五节），实为 ${ids.length}`);
assert(labels.length === ids.length, `每条都有章名（${labels.length}/${ids.length}）`);
for (const id of ids) {
  assert(app.includes(`id="${id}"`), `App 中存在锚点 id="${id}"`);
}
assert(
  app.includes("import { PAGE_SECTIONS } from './data/pageSections'"),
  'App 从唯一数据源取目录'
);
assert(
  app.includes('<SectionNav sections={PAGE_SECTIONS} />'),
  'App 渲染 SectionNav 并传入同一份数据'
);

// --- 2. 只在窄屏出现 + 悬浮 + 可开合可读屏 ---
assert(nav.includes('lg:hidden'), '目录只在窄屏出现（lg:hidden）');
assert(nav.includes('fixed right-4 bottom-6'), '目录钮固定悬浮于右下');
assert(nav.includes('aria-expanded'), '开合状态对读屏可见');
assert(nav.includes('aria-controls="section-nav-menu"'), '钮与菜单 id 对应');
assert(nav.includes('id="section-nav-menu"'), '菜单有稳定 id');
assert(nav.includes('aria-label'), '目录有可读名称');
assert(nav.includes('scrollIntoView'), '点章名滚到对应栏');
assert(nav.includes("prefers-reduced-motion"), '尊重系统「减弱动态」');
assert(nav.includes('Escape'), 'Esc 可收起');

// --- 3. 章名取自在场章节题 ---
const titles = new Set<string>(['刊首']); // 刊头无 SectionHead，以「刊首」代之
for (const file of readdirSync('src/components')) {
  const text = readFileSync(`src/components/${file}`, 'utf8');
  for (const m of text.matchAll(/title="([^"]+)"/g)) titles.add(m[1]);
}
for (const label of labels) {
  assert(titles.has(label), `章名「${label}」取自页面在场的章节题`);
}

// --- 4. 展示纪律（与 presentationContract 同套禁令） ---
const forbidden = [
  'Math.round(',
  'Math.max(',
  'Math.min(',
  'new Date(',
  'slice(-7)',
  'getDay()',
  '>= 2',
  '=== 3',
];
for (const pattern of forbidden) {
  assert(!nav.includes(pattern), `SectionNav 不得出现 ${pattern}`);
}

// --- 5. 已纳入 presentationContract 白名单 ---
assert(
  presentation.includes("['SectionNav.tsx', comp('SectionNav.tsx')]"),
  'presentationContract 白名单已纳入 SectionNav（此后继承其全部禁令）'
);

console.log('ALL MOBILE NAV TESTS PASSED. (5 groups)');
