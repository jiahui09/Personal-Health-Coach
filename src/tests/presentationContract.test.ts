/**
 * Presentation contract（展示层契约）
 *
 * 目的：让「同一事实只有一个权威来源」成为可执行的约束——
 *   1. 展示层不得做业务算术（比例、均值、窗口、斜率一律来自 domain/）
 *   2. 业务阈值只能出现在 domain/policy.ts
 *   3. 展示层不得自行读时钟
 *   4. 御批词表与「计划 vs 实测」「尚余 vs 已超」的措辞必须在场
 *
 * 豁免：RuleMeter（通用比例渲染）与 WeightTrendChart（SVG 几何）——二者只做
 * 图形换算，不产生任何业务数字。
 */

import { readFileSync } from 'node:fs';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const comp = (file: string): string => readFileSync(`src/components/${file}`, 'utf8');
const src = (path: string): string => readFileSync(path, 'utf8');

const FORBIDDEN_MATH = ['Math.max(', 'Math.min(', 'Math.round(', 'Math.abs(', 'Math.floor(', '/ 60', '* 60'];
const FORBIDDEN_WINDOWS = ['slice(-7)', 'slice(-21)', 'getDay()', 'setDate(', 'new Date('];

// --- 1. 展示层零业务算术 ------------------------------------------------
const presentationFiles: [string, string][] = [
  ['App.tsx', src('src/App.tsx')],
  ['TodayTasks.tsx', comp('TodayTasks.tsx')],
  ['HeaderGreeting.tsx', comp('HeaderGreeting.tsx')],
  ['BodyOverview.tsx', comp('BodyOverview.tsx')],
  ['HowAmIDoing.tsx', comp('HowAmIDoing.tsx')],
  ['RecentSection.tsx', comp('RecentSection.tsx')],
  ['DataQualityNote.tsx', comp('DataQualityNote.tsx')],
  ['BodyProfile.tsx', comp('BodyProfile.tsx')],
  ['ForecastBand.tsx', comp('ForecastBand.tsx')],
  ['ProfileSheet.tsx', comp('ProfileSheet.tsx')],
  ['NextMealCard.tsx', comp('NextMealCard.tsx')],
  ['NextWorkoutCard.tsx', comp('NextWorkoutCard.tsx')],
];

for (const [name, text] of presentationFiles) {
  for (const pattern of FORBIDDEN_MATH) {
    assert(!text.includes(pattern), `${name} 不得自行做业务算术（发现 ${pattern}）`);
  }
  for (const pattern of FORBIDDEN_WINDOWS) {
    assert(!text.includes(pattern), `${name} 不得自行判定窗口/时钟（发现 ${pattern}）`);
  }
}

// 阈值不得散落在展示层
for (const [name, text] of presentationFiles) {
  for (const pattern of ['>= 2', '>= 7', '> 2)', '< 6', '=== 3']) {
    assert(!text.includes(pattern), `${name} 不得写业务阈值（发现 ${pattern}）`);
  }
}

// --- 2. 阈值只在 policy，规则只引用 policy -------------------------------
const policy = src('src/domain/policy.ts');
for (const key of ['TRAINING_POLICY', 'SLEEP_POLICY', 'WEIGHT_POLICY', 'NUTRITION_POLICY', 'TARGET_POLICY']) {
  assert(policy.includes(key), `policy.ts 必须集中声明 ${key}`);
}
assert(src('src/domain/training.ts').includes('policy.highSorenessMin'), '训练阈值取自 policy');
assert(src('src/domain/weight.ts').includes('policy.anomalyAbsKg'), '体重异常阈值取自 policy');
assert(src('src/domain/sleep.ts').includes('policy.targetMinutes'), '睡眠参考取自 policy');
assert(typeof src('src/domain/time.ts').includes === 'function' && src('src/domain/time.ts').includes('weekStartKeyOf'), '周一起算的唯一实现');

// --- 3. 派生公式只此一份 ------------------------------------------------
const requiredFormulas: [string, string][] = [
  ['src/domain/tasks.ts', 'calculateTaskProgress'],
  ['src/domain/nutrition.ts', 'calculateNutritionProgress'],
  ['src/domain/sleep.ts', 'sleepSummary'],
  ['src/domain/body.ts', 'bmiCategory'],
  ['src/domain/body.ts', 'mifflinStJeor'],
  ['src/domain/body.ts', 'totalDailyEnergy'],
  ['src/domain/composition.ts', 'adviseWeightGoal'],
  ['src/domain/composition.ts', 'deriveNutritionTargets'],
  ['src/domain/composition.ts', 'decideTrainingTarget'],
  ['src/domain/weight.ts', 'endpointChangeKg'],
  ['src/domain/weight.ts', 'regressionSlopePerDay'],
  ['src/domain/weight.ts', 'validateWeightMeasurement'],
  ['src/domain/training.ts', 'decideWorkoutMode'],
  ['src/domain/training.ts', 'resistanceProgress'],
];
for (const [file, symbol] of requiredFormulas) {
  assert(src(file).includes(symbol), `${file} 必须提供 ${symbol}`);
}

// 承载统计的组件必须从 domain 取数（计划卡展示的是引擎推荐，不在此列）
const statisticsComponents = [
  'App.tsx',
  'TodayTasks.tsx',
  'HeaderGreeting.tsx',
  'BodyOverview.tsx',
  'HowAmIDoing.tsx',
  'RecentSection.tsx',
  'DataQualityNote.tsx',
];
for (const name of statisticsComponents) {
  const text = presentationFiles.find(([file]) => file === name)![1];
  assert(
    text.includes("from '../domain") || text.includes('domain/'),
    `${name} 必须从 domain/ 取派生结果`
  );
}

// --- 4. 单源：任务完成率与体重不得被组件二次统计 -------------------------
const app = src('src/App.tsx');
assert(!app.includes('todos.filter((t) => t.completed)'), 'App 不得自行统计任务完成数');
assert(app.includes('tasks={todayData.tasks}'), '刊头与其一共用同一份 TaskProgress');
assert(comp('HeaderGreeting.tsx').includes('tasks.completed'), '刊头完成数来自 TaskProgress');
assert(!comp('BodyOverview.tsx').includes('readingCount={'), '条数不得由页面长度冒充');
assert(app.includes('weight={todayData.weight}'), '身体近况消费 WeightSummary');

// --- 5. 计划 / 预测 / 实测分离 ------------------------------------------
assert(comp('NextMealCard.tsx').includes('未入账'), '下一膳必须声明其为计划、未入账');
assert(comp('NextWorkoutCard.tsx').includes('估算'), '建议时长必须标注为估算');
assert(comp('NextWorkoutCard.tsx').includes('describeWorkoutDecision'), '训练判定原因由决策结果生成');
assert(comp('ForecastBand.tsx').includes('情景外推'), '预测必须标为情景外推');
assert(comp('ForecastBand.tsx').includes('forecast.withheld'), '数据存疑时预测须可暂阙');
assert(comp('ForecastBand.tsx').includes('modelVersion'), '预测必须展示模型出处');

// --- 6. 御批词表与关键措辞 ----------------------------------------------
assert(app.includes('知道了 · '), '成功回执冠「知道了 ·」');
assert(comp('RecordSheet.tsx').includes('照准'), '主确认作「照准」');
assert(comp('TodayTasks.tsx').includes('掷还'), '删条作「掷还」');
assert(comp('RecentSection.tsx').includes('掷还'), '误录之膳可掷还');
assert(comp('RecentSection.tsx').includes('已超'), '超额必须显示「已超」而非「尚余 0」');
assert(comp('RecentSection.tsx').includes('尚余'), '未达目标显示「尚余」');
assert(comp('RecentSection.tsx').includes('未合议'), '未达标写作「未合议」');
assert(comp('BodyOverview.tsx').includes('数据不足'), '样本不足时显示「数据不足」');
assert(comp('TodayTasks.tsx').includes('拟 '), '任务用时标为「拟」（计划，非实际）');
assert(comp('RecordSheet.tsx').includes('实际计时'), '训练时长来源必须可选实际/估算');

// --- 7. 假兜底不得复活 --------------------------------------------------
assert(!src('src/services/scientificRules.ts').includes('rollingAverage7d: 68.4'), '不得用硬编码体重冒充统计');
assert(src('src/services/scientificRules.ts').includes('weightIsPlaceholder'), '缺体重时必须显式标注占位值');
assert(src('src/domain/weight.ts').includes("flag: 'insufficient'"), '无数据必须给出数据不足');

console.log('ALL PRESENTATION CONTRACT TESTS PASSED.');
