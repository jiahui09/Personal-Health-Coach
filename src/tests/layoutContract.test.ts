/**
 * Layout & imperial-style contract (behavior lock, expected RED before the rebuild)
 *
 * The rebuild has three goals that must not silently regress later:
 *   1. one section-head component (six hand-rolled copies caused the 26px/2px vs
 *      23px/1px split and the 88px vs 38px mobile title indent),
 *   2. explicit cross-column row pairing (the two independent column flows drifted
 *      0 -> 38 -> 120px at 1440w),
 *   3. token-only colour + the 御批 copy layer (墨=正文, 朱=御批).
 *
 * These assertions read source files the same way contrast.test.ts reads index.css:
 * cheap, deterministic, no DOM harness needed.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '..');
const compDir = resolve(srcDir, 'components');

const read = (p: string) => readFileSync(p, 'utf8');
const { existsSync } = await import('node:fs');
const componentFiles = readdirSync(compDir).filter((f) => f.endsWith('.tsx'));
const comp = (f: string) => read(resolve(compDir, f));
/** 仓库根（用于校验文档承接了口径说明）。 */
const root = resolve(srcDir, '..');
/** 只看会渲染出去的文案：去掉块注释与行注释（注释里允许解释为什么这样做）。 */
const copyOf = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const app = read(resolve(srcDir, 'App.tsx'));
const css = read(resolve(srcDir, 'index.css'));

// --- 1. one section head, everywhere else no <h2 ------------------------------
const headingFiles = componentFiles.filter((f) => comp(f).includes('<h2'));
assert(
  headingFiles.length === 1 && headingFiles[0] === 'SectionHead.tsx',
  `every <h2 lives in SectionHead.tsx (found in: ${headingFiles.join(', ') || 'none'})`
);

const SECTIONED = [
  'TodayTasks.tsx',
  'NextMealCard.tsx',
  'NextWorkoutCard.tsx',
  'BodyOverview.tsx',
  'RecentSection.tsx',
  'HowAmIDoing.tsx',
  'BodyProfile.tsx',
  'ForecastBand.tsx',
];
for (const f of SECTIONED) {
  const src = comp(f);
  assert(src.includes('SectionHead'), `${f} renders its heading through SectionHead`);
  assert(src.includes('lg:pr-9'), `${f} reserves the vertical-marginalia gutter (lg:pr-9)`);
}

const head = comp('SectionHead.tsx');
assert(head.includes('border-b-2 border-ink'), 'SectionHead owns the single 2px ink rule');
assert(head.includes('text-[26px]'), 'SectionHead owns the single heading size');
assert(head.includes('vertical-rl'), 'SectionHead carries the vertical 御批 marginalia');
assert(head.includes('writing-mode:horizontal-tb'), 'marginalia degrades to inline below lg');
assert(head.includes('text-accent'), 'marginalia reads from the accent token, never a literal');

// --- 2. tokens only: no literal hex in components ------------------------------
for (const f of componentFiles) {
  const hits = comp(f).match(/#[0-9a-fA-F]{6}\b/g);
  assert(hits === null, `${f} uses design tokens, not literal hex (${(hits || []).join(', ')})`);
}

// --- 3. row pairing in App (cross-column rules must share y) --------------------
const rowStarts = app.match(/lg:row-start-\d/g) ?? [];
assert(rowStarts.length >= 6, `App places six cells into paired rows (found ${rowStarts.length} placements)`);
assert(app.includes('lg:col-start-1'), 'left column is explicitly placed');
assert(/lg:col-start-\d/.test(app.replace(/lg:col-start-1/g, '')), 'right column is explicitly placed');

// --- 4. one action-footnote block for section-level actions ---------------------
assert(css.includes('.section-actions'), 'index.css defines the shared action-footnote block');
for (const f of ['NextMealCard.tsx', 'NextWorkoutCard.tsx']) {
  assert(comp(f).includes('section-actions'), `${f} puts its actions in the footnote row`);
}
for (const f of ['NextMealCard.tsx', 'NextWorkoutCard.tsx']) {
  assert(
    !comp(f).includes('justify-end gap-2.5 mb-1'),
    `${f} has no floating top-right action row`
  );
}

// --- 5. rule meters: accessible text carries the ratio, bar is decoration --------
const meter = comp('RuleMeter.tsx');
assert(meter.includes('aria-hidden'), 'RuleMeter hides the decorative bar from AT');
assert(meter.includes('tabular-nums'), 'RuleMeter shows the ratio as real tabular text');
assert(meter.includes('inkrow-meter'), 'RuleMeter 走共列网格的计量条单元格');
assert(
  /\.inkrow-meter\s*\{[^}]*var\(--color-line\)/.test(css),
  '计量条底轨取 --color-line（唯一出处）'
);
for (const cls of ['bg-ink', 'bg-accent', 'bg-danger']) {
  assert(meter.includes(cls), `RuleMeter fill tone ${cls} comes from tokens`);
}
assert(comp('RecentSection.tsx').includes('RuleMeter'), '近况 carries the intake/goal meters');

// --- 6. 御批 copy layer ----------------------------------------------------------
assert(app.includes('知道了 · '), 'success toasts are acknowledged with 知道了 ·');
assert(comp('NextMealCard.tsx').includes('照准'), 'meal confirmation is 照准');
assert(comp('RecordSheet.tsx').includes('照准'), 'sheet confirmation is 照准');
assert(comp('TodayTasks.tsx').includes('掷还'), 'destructive action is 掷还');
assert(comp('RecentSection.tsx').includes('合议'), 'goal verdicts read 合议 / 未合议');

// --- 7. tokens still exist for the 朱墨 palette ----------------------------------
for (const name of ['accent', 'accentsoft', 'accentline', 'accentbright', 'seal', 'danger', 'tier2', 'control']) {
  assert(new RegExp(`--color-${name}:\\s*#[0-9a-fA-F]{6}`).test(css), `token --color-${name} present`);
}

// --- 8. 行文共列网格 · 三级横线 · 零解释文案（本轮版式契约） ------------------
assert(/\.inkrow\s*\{[^}]*grid-template-columns/.test(css), '共列网格 .inkrow 存在（三列定宽）');
assert(/\.inkrow-value\s*\{[^}]*text-align:\s*right/.test(css), '值列右对齐');
assert(/\.inkrow-meter\s*\{[^}]*height:\s*3px/.test(css), '计量条只由 .inkrow-meter 出（3px）');
assert(/\.inklist-row\s*\{[^}]*grid-template-columns/.test(css), '名录式条目 .inklist-row 存在');
assert(/\.group-head\s*\{/.test(css), '组标题 .group-head 存在');

// 计量条不得由组件自写 3px 轨道（除 RuleMeter 与生活纪事行内条）
for (const f of ['TodayTasks.tsx', 'BodyOverview.tsx', 'RecentSection.tsx', 'NextWorkoutCard.tsx']) {
  assert(!comp(f).includes('h-[3px]'), `${f} 不得自写 3px 轨道`);
}

// 三级横线：版式骨架不再用 linesoft（表单控件底仍可）
const skeleton = ['TodayTasks.tsx', 'BodyOverview.tsx', 'HowAmIDoing.tsx', 'RecentSection.tsx', 'NextWorkoutCard.tsx', 'NextMealCard.tsx', 'WeightTrendChart.tsx'];
for (const f of skeleton) {
  assert(!comp(f).includes('border-linesoft'), `${f} 只用 L2 实线 / L3 点线,不用 linesoft`);
}

// 章节题下外粗内细双线（呼应版框）
const sectionHead = comp('SectionHead.tsx');
assert(sectionHead.includes('border-b-2 border-ink'), '章节题 2px 墨线仍在');
assert(sectionHead.includes('border-b border-line'), '章节题下补 1px 细线（外粗内细）');

// 解释性文案归 README：页面组件不得出现方法学说明
const FORBIDDEN_COPY = [
  '非首末', '不予修改', '仅标记', '仅指', '非健康度', '非承诺', '先补记录', '做线性回归', '原始记录',
  // 自我说明类：刊头/页脚/按钮里的多余注释（第 17 条删除,不得回流）
  '存于本机', '不假模型', '日省吾身', '缘由',
];
for (const f of [...skeleton, 'DataQualityNote.tsx']) {
  const copy = copyOf(comp(f));
  for (const phrase of FORBIDDEN_COPY) {
    assert(!copy.includes(phrase), `${f} 不得写方法学说明（${phrase}）→ 归 README`);
  }
}
for (const phrase of FORBIDDEN_COPY) {
  assert(!copyOf(app).includes(phrase), `App 不得写方法学说明（${phrase}）→ 归 README`);
}
assert(read(resolve(root, 'README.md')).includes('术语与口径'), 'README 承接被删除的口径说明');

// --- 9. 刊头/入口不留冗余（第 17 条） ------------------------------------------
const header = comp('HeaderGreeting.tsx');
assert(!header.includes('<button'), '刊头不放动作按钮（录一笔只在右下 FAB 一处）');
assert(!copyOf(header).includes('日省吾身'), '刊头不写副题式自我说明');
assert(!existsSync(resolve(compDir, 'EvidenceModal.tsx')), '稽核弹窗已删除（无入口的组件不留死代码）');
for (const f of componentFiles) {
  assert(!comp(f).includes('EvidenceModal'), `${f} 不得再引用已删除的稽核弹窗`);
}
assert(!css.includes('.btn-ghost'), '无使用者的 .btn-ghost 已清除（动作两级）');

console.log('ALL LAYOUT CONTRACT TESTS PASSED.');
