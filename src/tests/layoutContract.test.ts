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

// 自治章节（自带章节头 + 旁批槽）：两处配对行（今日之事/今日之练、营养摄入/统计）+ 体征通栏;
// NextMealCard 嵌在营养摄入节内为组块,由组题 .group-head 承担,不占章节头。
const SECTIONED = [
  'TodayTasks.tsx',
  'NextWorkoutCard.tsx',
  'BodySection.tsx',
  'NutritionSection.tsx',
  'StatsSection.tsx',
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
// 新 IA（经批准的重构）：两处配对行——今日之事↔今日之练、营养摄入↔统计
// (每处 = 折缝 + 两格 = 3 处落位,共 6 处),体征为唯一通栏纵列;
// 配对等高改由 probe 的行顶/行差断言把守。
const rowStarts = app.match(/lg:row-start-\d/g) ?? [];
assert(rowStarts.length >= 6, `App places both paired rows explicitly (found ${rowStarts.length} placements)`);
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
assert(comp('NutritionSection.tsx').includes('RuleMeter'), '营养摄入 carries the two intake meters');

// --- 6. 御批 copy layer ----------------------------------------------------------
assert(app.includes('知道了 · '), 'success toasts are acknowledged with 知道了 ·');
assert(comp('NextMealCard.tsx').includes('照准'), 'meal confirmation is 照准');
assert(comp('SheetShell.tsx').includes('照准'), 'sheet confirmation is 照准');
assert(comp('TodayTasks.tsx').includes('掷还'), 'destructive action is 掷还');
assert(comp('StatsSection.tsx').includes('合议'), '履行合议 reads 合议 / 未合议（统计节）');

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
for (const f of ['TodayTasks.tsx', 'BodySection.tsx', 'NutritionSection.tsx', 'StatsSection.tsx', 'NextWorkoutCard.tsx']) {
  assert(!comp(f).includes('h-[3px]'), `${f} 不得自写 3px 轨道`);
}

// 三级横线：版式骨架不再用 linesoft（表单控件底仍可）
const skeleton = ['TodayTasks.tsx', 'BodySection.tsx', 'NutritionSection.tsx', 'StatsSection.tsx', 'NextWorkoutCard.tsx', 'NextMealCard.tsx', 'WeightTrendChart.tsx'];
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
assert(!header.includes('<button'), '刊头不放动作按钮（录入入口分归各节就地按钮：录体征/另择动作/别录一品）');
assert(!copyOf(header).includes('日省吾身'), '刊头不写副题式自我说明');
assert(!app.includes('记一笔'), '全局 FAB「记一笔」已撤：录入入口分归各节就地按钮（录体征/另择动作/别录一品）');
assert(!app.includes('pb-32'), '页面不再为 FAB 预留底部让位');
assert(!existsSync(resolve(compDir, 'EvidenceModal.tsx')), '稽核弹窗已删除（无入口的组件不留死代码）');
for (const f of componentFiles) {
  assert(!comp(f).includes('EvidenceModal'), `${f} 不得再引用已删除的稽核弹窗`);
}
assert(!css.includes('.btn-ghost'), '无使用者的 .btn-ghost 已清除（动作两级）');

// --- 10. 表单静动分离 · 无用选择不复辟 ---------------------------------------
assert(
  !copyOf(comp('ProfileSheet.tsx')).includes('腰围'),
  '档案表只收常量：会变之数不得混入立档/改档表'
);
assert(comp('BodySheet.tsx').includes('腰围'), '会变之数（腰围）归体征表，与常量分表');
assert(
  !copyOf(comp('BodySheet.tsx')).includes('精力') && !copyOf(comp('BodySheet.tsx')).includes('酸痛'),
  '体感不重复录入：精力/酸痛首页点按即调，体征表不收'
);
assert(
  copyOf(comp('BodySection.tsx')).includes('录体征') && !copyOf(comp('BodySection.tsx')).includes('录新体重'),
  '入口与表题相配：体征入口作「录体征」（表内是体重/腰围/眠，非单录体重）'
);
const bodyNote = /note=\{([\s\S]*?)\n\s{8,}\}/.exec(comp('BodySection.tsx'))?.[1] ?? '';
assert(
  bodyNote.includes('录体征') && !bodyNote.includes('立档') && !bodyNote.includes('改档'),
  '眉行只留录入入口；立档随未建档警示、改档随「档案所录」，不与录体征并列挤于一处'
);
assert(
  !copyOf(comp('MealSheet.tsx')).includes('餐别'),
  '餐别选择已撤（其值由保存时刻的时钟判定），不得复辟为用户选择'
);
assert(!copyOf(comp('MealSheet.tsx')).includes('录一笔'), '三表各有其题（录一膳/录一练/录体征），不共用旧总题');
for (const f of ['MealSheet.tsx', 'WorkoutSheet.tsx', 'BodySheet.tsx']) {
  assert(comp(f).includes('SheetShell'), `${f} 共用同一壳（版框/题头/照准脚注单源）`);
}

// --- 11. 零偏移：标签/状态切换不得移动既有组件 ------------------------------
// 录事壳：提示/草稿/遮罩告知一律收在「照准」按钮之下——出现与否,按钮与上方表单一拍不动
const shell = comp('SheetShell.tsx');
const shellSubmit = shell.indexOf('type="submit"');
for (const marker of ['guardNotice && (', 'hadDraft && (', '{hint && (']) {
  const at = shell.indexOf(marker);
  assert(at > shellSubmit, `录事壳：${marker} 收在提交按钮之下（出现不移动按钮）`);
}
// 体征表：睡眠两式叠放于同一格,容器高恒等于较高者——切式时下方预览与按钮一拍不动
const bodySheet = comp('BodySheet.tsx');
assert(
  (bodySheet.match(/col-start-1 row-start-1/g) ?? []).length >= 2,
  '体征表：睡眠两式叠放同一格（未选中者 invisible 仍占位,切式零偏移）'
);
assert(bodySheet.includes('零偏移'), '体征表以零偏移为契约（注释留痕）');

// --- 12. 动作轻重与水墨交互（页内动作不抢戏;交互只动 transform/opacity,零偏移） ---
// 首用立档：固定数据（身高/性别/出生年等）录一次、随手记名长存——
// 入口必须在首屏且随「未建档」而生、建档即自去,不藏在体征节的警示里。
assert(app.includes('first-run-profile'), '首用立档入口置于首屏（未建档才出现）');
assert(
  app.includes('!todayData.body.complete && ('),
  '立档之请以未建档为条件（建档后入口自去,不再打扰）'
);
assert(app.includes('随手记名长存'), '立档文案明示：固定数据录一次即随手记名长存');
// 页内动作（照准/毕此一练/录之/再试一次）一律描边轻按钮,注意力归内容;
// 实墨主按钮只留弹层内的郑重确认。
for (const f of ['NextMealCard.tsx', 'NextWorkoutCard.tsx', 'TodayTasks.tsx']) {
  assert(comp(f).includes('btn-quiet'), `${f} 页内动作用描边轻按钮,不抢戏`);
  assert(!comp(f).includes('btn-primary'), `${f} 不复用实墨主按钮`);
}
for (const f of ['SheetShell.tsx', 'ProfileSheet.tsx', 'AccountGate.tsx']) {
  assert(comp(f).includes('<InkButton'), `${f} 的郑重确认走水墨按钮（光影/轻沉/落墨）`);
}
// 水墨交互层：墨迹生成于落点、半径铺满按钮;只动 transform/opacity 与绝对定位 → 零偏移。
const inkBtn = comp('InkButton.tsx');
assert(inkBtn.includes("className = 'ink-ripple'"), 'InkButton 落点生成墨迹层');
assert(inkBtn.includes('spreadRadius'), '墨迹半径按落点算到最远角,保证铺满按钮');
assert(inkBtn.includes('墨已落纸'), '松开落墨即业务接入点之记（逻辑仍在 click）');
assert(css.includes('.ink-ripple') && css.includes('position: absolute'), '墨迹绝对定位内嵌按钮,不入版面流');
assert(css.includes('animation: ink-spread'), '涟漪走 CSS animation（离主线程）');
assert(/@keyframes[\s\S]*?transform: translate\(-50%, -50%\)/.test(css), '涟漪只动 transform/opacity');
assert(css.includes('prefers-reduced-motion'), '水墨交互带减弱动效档（留反馈,去位移）');
assert(css.includes('@media (hover: none) and (pointer: coarse)'), '触屏不显跟随柔光（其余环境照常随指针）');
assert(css.includes('.btn-quiet'), '描边轻按钮成级（与实墨主按钮同组度量）');

console.log('ALL LAYOUT CONTRACT TESTS PASSED.');
