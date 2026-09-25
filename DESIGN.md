# Design

## Source of truth
- Status: **Active**
- Last refreshed: 2026-09-25（数据语义重建）
- Primary product surfaces:
  - 单页主应用 `src/App.tsx`（刊头 → 双栏正文 → 通栏近来手记 → 页脚，版框内单页流）
  - 录事弹层 `src/components/RecordSheet.tsx`（四签：进食 / 习练 / 体征 / 手记）
  - 决策稽核弹窗 `src/components/EvidenceModal.tsx`（缘由）
  - 比选稿 `docs/palette-options.html`（五版色组，当前选中其五）
  - 成稿截图 `.shots/za-desktop2.png`（1440）、`.shots/za-mobile.png`（390）、`.shots/za-mobile-*.png`（局部）
- Evidence reviewed:
  - `README.md`（§2 功能表、§字体与视觉约定、变更清单 1–14 条、仍待补齐）
  - `src/index.css` `@theme` 令牌与 `@layer components`（btn 三级、`.section-actions`、`.leader`）
  - 全部 `src/components/*.tsx`；`.omx/artifacts/visual-ralph/editorial-journal/`（参考稿 html + 双端截图，已批准基线）
  - 实测几何：`.shots/layout-probe.mjs` @1440/1024/768/390（本轮改版前后各量一次）
  - **版式契约**：`src/tests/layoutContract.test.ts`（共列网格、三级横线、零方法学文案）＋ `.shots/layout-probe.mjs --check`（条同起同止、值列不折行、章节行数上限）
  - **数据语义契约：`docs/data-semantics.md`**（Raw/Derived/Decision/Presentation 分层、窗口定义、公式表、迁移规则、审计结论）
  - 回归门槛：`src/tests/contrast.test.ts`、`journalContract.test.ts`、`scientificAudit.test.ts`、`domain.test.ts`、`migration.test.ts`、`presentationContract.test.ts`、`layoutContract.test.ts`
  - 用户已决（ask_user_question 记录）：墨线计量条、跨栏行配对＋统一章节头、朱为状态主色、竖排旁批、改御批文案

## Brand
- Personality: **御批奏折**——臣工以墨书事（正文、数据、事实一律墨色），皇帝以朱批裁（裁决、状态、旁注、回执一律朱色）。安静、克制、有权威感；一册可读的手记，不是一块仪表盘。
- Trust signals: 「不假模型 · 规则可稽」页脚、数值入句、证据分级（`evidence_derived` / `evidence_constrained` / `engineering_heuristic`）、「缘由」把输入快照与局限摊开、`journalContract`/`contrast`/`layoutContract` 三重回归。
- Avoid: KPI 卡、瓦片墙、环形进度、渐变、投影堆砌、backdrop-blur、多强调色并存、现代白话 UI 文案、AI 默认配色（靛紫渐变、语义色块）。

## Product goals
- Goals: 让人一眼看清「现在该吃、该动、身体如何」，且每条建议都可追溯到规则与证据；改版后额外目标是**版面本身可信**——横线对齐、动作不浮空、比例有余光线索。
- Non-goals: 多页面路由、社交/排行榜、生成式内容（LLM = OFF）、后端排版本轮不动、录事弹层与稽核弹窗内部排版不在本轮范围。
- Success signals: 三对章节横线跨栏 y 差 ≤2px（实测 0px）；移动端标题左缘一致（实测 38px 全页一致）；四套测试 + tsc + build + e2e 全绿；截图复核无浮空/挤行。

## Personas and jobs
- Primary personas: 唯一用户——记录自己健康账目的中文使用者，桌面查、手机记。
- User jobs: ① 今日要做什么（其一）② 下一餐/下一次练什么及为什么（其二/其三 + 缘由）③ 身体与本周是否在正轨（近况、身体近况、生活纪事）④ 随手记一笔（录一笔 / FAB）。
- Key contexts of use: 桌面 1440 浏览全页；手机 390 单手速记；两者都要求扫读时先看到「裁决」再看到细节。

## Information architecture
- Primary navigation: 无路由；单页纵向流 + 弹层（录事、稽核）。
- Core routes/screens: 刊头（印章 + 时段问候 + 干支日期 + 录一笔）→ 正文双栏 → 近来手记（通栏）→ 页脚（复其初）。
- Content hierarchy:
  - **行动类**（左栏章目）：其一 今日之事、其二 下一膳、其三 今日之练——目录式清单 + 章末动作脚注行。
  - **计量类**（比例）：蛋白质 / 热量 / 本周抗阻 / 睡均 / 生活纪事时长占比——墨线计量条 + 颜色分级。
  - **状态类**（可感知）：身体近况（含唯一图表）、今日体感（1–5 点阵两行）。
  - **记述类**（叙述）：近况三条实测句、案头小记、近来手记、体重区间推演。
  - 桌面行配对（右栏次序为等高配对重排，**与移动端次序不同**）：
    | 行 | 左（章目） | 右（附目） | 实测高度差 |
    | --- | --- | --- | --- |
    | 一 | 其一 今日之事 | 近况（计量＋记述） | 86px 内 |
    | 二 | 其二 下一膳 | 生活纪事 · 本周之功 | 56px 内 |
    | 三 | 其三 今日之练 | 身体近况 ＋ 今日体感 | 88px 内 |
  - 移动端单栏次序（README §1 已同步）：其一 → 其二 → 其三 → 身体近况 → 近况 → 生活纪事 → 近来手记。

## Data semantics（数据语义，先于视觉）
- 四层：**Raw**（用户/设备记录）→ **Derived**（`src/domain/` 纯函数）→ **Decision**（Derived + `policy.ts`）→ **Presentation**（组件只措辞）。
- 同一事实只有一个权威来源；组件零业务算术、零阈值字面量、零 `new Date()`（`presentationContract.test.ts` 锁定）。
- 窗口不混用：Today / ThisWeek（周一起）/ Last7Days（滚动）/ Last30Days（滚动）；「本周之功」与「抗阻 N/目标」用本周，「七日均重 / 睡均 / 近来手记」用近七日。
- 计划 ≠ 实测：`MealRecommendation` 未「照准」不入今日所食；建议时长标「估算」；任务用时标「拟」。
- 预测 ≠ 实测：预测为「情景外推」（带模型版本与依据日数），数据存疑即暂阙，永不写入实测。
- 异常只标记不改数：`needs_review` + 朱批 + 可掷还；训练决策入参不含体重。
- 详见 `docs/data-semantics.md`。

## Design principles
- Principle 0 — **版面即目录**：一切统计走同一套共列网格（名｜中列｜值），中列承计量条或点线引导 → 全页只有一根中轴；线条只有三级（2px 墨 / 1px 实 / 1px 点）。
- Principle 0.5 — **页面不解释自己**：方法学、阈值、口径一律写进 README「术语与口径」与「推演所据」面板；页面只留事实与一句短批。
- Principle 0 — **先定语义再排版**：任何数字在落笔之前必须能指名「哪个函数算的、哪个窗口、属于 Raw/Derived/Decision 哪一层」。算不出来的，宁显示「数据不足」。
- Principle 1 — **墨书朱批**：内容归墨、裁决归朱。同一语义在全页只有一个颜色。
- Principle 2 — **信息按性质选形态**：比例 → 计量条；可执行 → 目录清单 + 动作脚注；可感知 → 入句 + 单图 + 点阵；叙述 → 行文。不为「好看」给事实加容器。
- Principle 3 — **对齐即可信**：章节头一律出自一个组件，横线必须跨栏同 y；章节级动作一律落在章末脚注行，不浮空。
- Principle 4 — **数值一律入句**，计量条只是句子的余光注脚；百分比永远是真实文本（可选中、可朗读）。
- Tradeoffs: 行配对会带来单元格留白（本轮用右栏次序重排压到 ≤100px）；眉行式章节头比行内章序高约 6px/节（换取标题左缘一致）；朱与绛明度接近，故绛只用于「超录/删除」两种极少数场景。

## Visual language
- Color（`src/index.css @theme`，全部由 `contrast.test.ts` 锁定）:
  | 令牌 | 值 | 角色 | 对比度 |
  | --- | --- | --- | --- |
  | `paper` / `surface` / `line` | `#f4f0e8` / `#fffdf8` / `#e3dccc` | 纸、卡面、细线 | 既定锚色 |
  | `ink` 四档 | `#16120e` / `#57534e` / `#6f675e` / `#736b61` | 正文墨阶 | 16.4 / 6.7 / 4.9 / 4.6 |
  | `accent`（朱批） | `#a63a2b` | 状态、达标、勾选、旁批、折线、计量条达标填充 | 对纸 5.66、白字 6.44 |
  | `accentsoft` / `accentline` / `accentbright` | `#fbeee9` / `#f2d9d0` / `#fda4af` | 选中底、选中边、压墨亮色 | 亮色对墨 9.85 |
  | `seal` | `#a63a2b` | 刊头印章（与 accent 同源） | — |
  | `danger`（紫檀绛） | `#7f1d1d` | 超录、删除、报错 | 对纸 8.82、白字 10.02 |
  | `tier2`（褐） | `#7a5a2e` | 证据次级 | 对纸 5.55 |
  | `control` | `#877c69` | 控件边框 | 对纸 3.61（≥3） |
- Typography: `Newsreader` + `Noto Serif SC` 只用于章节题（26px/`tracking-.06em`）、章序（13px/`tracking-.3em`）、大号数字与条目名；`Plus Jakarta Sans` 承担正文（15px / 13px / 12px 地板）与小号数字（`tabular-nums`）；`font-mono` 只给规则 ID 与证据键名。
- Spacing rhythm: 版框 `border-2` + `border/55` 双线；章节顶距 `pt-10`（40px）为唯一档；节内分组只用 `mt-4 / mt-5 / mt-3` 与 `border-t border-linesoft`；桌栏间距 `lg:gap-x-8` + 中缝折线；正文右留 36px 旁批槽（`lg:pr-9`）。
- Shape/radius/elevation: 圆角只有一档 8px（表单与按钮）；圆形只留给点阵与状态点；无卡片、无阴影堆砌、无 backdrop-blur；页面栏目一律直接落在纸面。
- Motion: 仅 `transition-colors 150ms`（控件）与 Toast/弹层的 `motion/react` 进出；**计量条不做动画**（宽度静态，避免仪表感）。
- Imagery/iconography: `lucide-react` 单色图标 13–16px；全页唯一图表为 30 日体重折线（手绘 SVG，朱线 + 朱 10% 填充）；纸面为两层内联 SVG 噪点（纤维 6% + 斑驳 7%）。

## Components
- Existing components to reuse: `SectionHead`、`RuleMeter`、`.btn-primary` / `.btn-ghost` / `.btn-link`、`.section-actions`、`.leader`、`WeightTrendChart`、`EvidenceModal`、`RecordSheet`。
- New/changed components:
  - `src/components/SectionHead.tsx`（新）：眉行（章序 + 右注）→ 题行 → 2px 墨线 + 竖排朱批旁注；全页 6 处章节头唯一出口。
  - `src/components/RuleMeter.tsx`（新）：`label | 3px 条 | 分子/分母/百分比`；`tone: ink | accent | danger`；`max<=0` 时渲染 `—`。
  - `Marginalia` 内联于 `SectionHead`（`verdict` prop）：桌面 `absolute -right-9 -top-0.5` + `[writing-mode:vertical-rl]`，≤768 换行内横排。
  - `.section-actions`（`@layer components`）：章末动作脚注行；窄屏 `flex-col`、sm+ 一行两端。
  - `src/utils/cnCount.ts`：中文计数（刊头与朱批共用，消除重复实现）。
- Variants and states: 计量条三色 tone；旁批有/无；章节头有/无章序；动作脚注左槽可为数值组或提示文字。
- Token/component ownership: 颜色只允许出现在 `index.css`；组件内禁止字面 hex（由 `layoutContract.test.ts` 断言）。

## Accessibility
- Target standard: WCAG 2.1 AA；文本 ≥4.5:1、控件边框 ≥3:1（`contrast.test.ts` 回归锁定）。
- Keyboard/focus behavior: 全局 `:focus-visible` 2px 墨环；所有可点行都是 `<button>` 并带 `aria-pressed`；点击目标 ≥24px（复选框 24 热区 + 18 可视，点阵 `w-6 h-6`）。
- Contrast/readability: 字号地板 12px、交互文字 13px；朱对纸 5.66、绛对纸 8.82、褐对纸 5.55。
- Screen-reader semantics: 朱批旁注是真实文本；计量条本体 `aria-hidden`，语义由可见的「63/110 g · 57%」承载；生活纪事行带 `aria-label`（含占比）；体重图 `aria-label` 带真值单位。
- Reduced motion and sensory considerations: 无自动动画、无计量条动画；Toast 只做 160ms 位移淡入。

## Responsive behavior
- Supported breakpoints/devices: 1440 / 1024 / 768（单栏分界）/ 390。
- Layout adaptations: `lg:` 起启用双栏行配对 + 折缝 + 竖排旁批；`sm:` 起动作脚注改一行两端；其余单栏按原次序流下。探针要求四档 `overflow = 0`。
- Touch/hero differences: 移动端动作整行另起、右对齐；点阵与复选框保持 24px 热区；FAB「记一笔」常驻，页面 `pb-32` 让位。

## Interaction states
- Loading: 「手记启卷…」+ 6px 朱点（居中纸面）。
- Empty: 无待办 → 朱批「今日无事」；本周无纪事 → 「本周尚无纪事。」，计量条渲染 `—`；无动作 → 不渲染空脚注行。
- Error: `runMutation` 失败 Toast **不冠**「知道了 ·」，格式「膳食之录未成（code）」；加载失败整页重试态。
- Success: Toast「知道了 · <事实>」+ 朱亮色勾；完成态徽标 `bg-accentsoft / border-accentline / text-accent`。
- Disabled: 提交按钮随表单校验禁用（e2e 锁定「空手记不可提交」）。
- Offline/slow network: 本机 mock 仓库即时；云库走同一 `runMutation` 错误通道。

## Content voice
- Tone: 古风行文、第一人称手记体；克制、不推销、不空话。**数字必须带口径**（「7/7 日」「30/30 日 · 30 次」「拟 45 分」「估算」）。
- **不写方法学**：`非首末/不予修改/仅标记/仅指/非健康度/非承诺/做线性回归/原始记录…` 等句子禁止出现在页面（`layoutContract` 锁定），口径写入 README「术语与口径」，模型出处写入「推演所据」面板。
- 判定与其数值同行（`RuleMeter suffix`：`2/2 次 · 100% · 合议`），不再单列「判」行。
- 数据待核的措辞固定为「朱批 · 待核 N 项」＋「高于/低于近七日均重 X 公斤」＋「原始记录不予修改，仅标记待核」。
- Terminology: 章作「其一/其二/其三」，膳作「下一膳」，练作「今日之练」，记录作「录之/添录一事」。
- Microcopy rules（御批词表，`layoutContract.test.ts` 锁定关键项）:
  | 场合 | 用词 |
  | --- | --- |
  | 成功回执 | 「知道了 · 膳食已录于册」（一律冠前缀；失败**不**冠） |
  | 主确认 | 「照准」（其二记账、录事弹层提交） |
  | 危险/删除 | 「掷还」（今日之事删条 title） |
  | 达标 | 「合议 · 每周两日抗阻」「合议 · 七时之基 AASM 2015」 |
  | 未达标 | 「未合议 · 尚差 N 日」「未合议 · 不及七时之基 AASM 2015」 |
  | 旁批（≤8 字） | 「已成其一」「照减脂之期」「今日常规」「渐降」「抗阻合议」「本周 9.8 时」「近七日 4 条」 |
  | 保留不改 | 「毕此一练」「复其初」「录之 / 罢」「览毕」「记此一刻」；文献引文、规则 ID、ASCII 单位 |

## Implementation constraints
- Framework/styling system: React 19 + Vite + Tailwind v4（`@theme` 令牌，非 config 文件）；`lucide-react` 图标；`motion/react` 仅用于进出动画。
- 分层约束：业务算术与阈值只能出现在 `src/domain/`（`policy.ts` 是唯一常量表）；`services/scientificRules.ts` 只保留证据规则并消费 policy；仓库实现只做「读存储 → 迁移 → 调 domain → 组装 TodayData」。
- 数据契约：`TodayData` = 今日原始切片 + 派生指标 + 决策结果；`DailyState.sleep` 为判别联合（区间/手录眠时），字段可缺席表示「未录」。
- Design-token constraints: 颜色只写令牌类；组件源码禁裸 hex；单档 8px 圆角；不引入新依赖、不新增令牌（除非先改 `contrast.test.ts` 并说明对比度）。
- Performance constraints: 单包 451 KB（gzip 143 KB）不回退；无新增网络请求、无图表库。
- Compatibility constraints: 仅现代 evergreen 浏览器；`writing-mode` 降级在 ≤1024 走横排。
- Test/screenshot expectations: 改动前后必跑 `npm test`（四套）、`npm run lint`、`npm run build`、`.shots/e2e.mjs`；版式用 `.shots/layout-probe.mjs <url> <width>` 断言横线同 y、标题左缘、`overflow=0`；截图 `.shots/shot.mjs <url> <width> <out.png>` 并人工复核。

## Open questions
- [ ] `共列网格` 的名列定宽 84px 意味着标签限 5 字以内；若未来出现更长指标名，需要新的网格变体或允许折行。
- [ ] 名录式条目的点线引导在中列伸缩（标题越长点线越短）；是否改为「点线定长 + 标题截断」待定。
- [ ] 右栏桌面次序（近况 / 生活纪事 / 身体近况）是**等高配对的产物**，语义上「身体近况」落到了末行；若用户希望恢复「身体近况」居首，则需接受行二留白 ≈300px 或给其二增内容。Owner: 用户 / 影响: IA 与截图。
- [ ] `UserProfile.currentWeight` 仍是「最近测量」缓存，页面已不读；是否彻底移除该字段（需改引擎入参契约）。Owner: 实现 / 影响: 类型。
- [ ] 预测是否落库为 `WeightPrediction` 记录以支持「上期推演 vs 本期实测」误差复验。Owner: 用户 / 影响: 数据模型。
- [ ] 手记与活动是否拆表（现共用 `LifeLog`，以 `content` 有无区分）。Owner: 用户 / 影响: 迁移成本。
- [ ] 朱兼印章与状态两色同值（`seal === accent`），若嫌印章存在感被稀释，是否给印章加深 1px 绛边。Owner: 用户 / 影响: 刊头。
- [ ] 旁批文案目前由各组件就地拼装（取自真实数据），是否要抽成统一 `verdicts.ts` 词表以便统一口吻。Owner: 实现 / 影响: 可维护性。
- [ ] 计量条是否扩展到「其一完成度 x/4」（用户本轮明确**不**选，现为纯文本）。Owner: 用户 / 影响: 计量范围。
- [ ] 版式回归目前是源码契约 + 几何探针，是否再上像素级 diff 基线。Owner: 工程 / 影响: 回归强度。
