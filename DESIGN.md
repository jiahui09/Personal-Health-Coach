# Design

## Source of truth
- Status: **Active**
- Last refreshed: 2026-10-08（一周体验优化批「只减不加」：回归斜率符号随实值、`f_meal_slot` 增 21 时界归加餐、警示与缺档文辞收缩；「周一切红 / 超额同朱」两桩反馈经 `RuleMeter` 色路复核证伪归不修。同日此前：体征录入三改——体感去重、立档/改档入口随常量挪位、入口改名「录体征」与表题相配；再此前：2026-10-07 全面验收批——critique 28/40 → 五项优先级问题全修、audit 16/20（dark-glow 证伪）、polish 收尾与 15/15 验收闸；2026-10-05 八点重构与用户三点意见修订）
- Primary product surfaces:
  - 单页主应用 `src/App.tsx`（刊头 → 配对行一（今日之事 ↔ 今日之练，折缝分栏） → 通栏体征 → 配对行二（营养摄入 ↔ 统计，情景外推收于其末） → 页脚，版框内单页流）
  - 建档弹层 `src/components/ProfileSheet.tsx`（立档 / 改档：只收常量——性别·出生年·身高·活动水平·目标·每日训练时间预算；随日而变之数归体征表。**入口随常量**：未建档作「立档」入体征警示框、已建档作「改档」随「档案所录」组题，不与「录体征」并列挤于眉行）
  - 录事三表 `src/components/MealSheet.tsx` / `WorkoutSheet.tsx` / `BodySheet.tsx`（共用壳 `SheetShell.tsx`；录一膳 / 录一练 / 体征，各自独立、按本域内容定宽，无页签无「录一笔」；体征表另收腰围，进食表内嵌食物营养档案库搜选，库不上主页；**体感（精力/酸痛）不入表**——首页点按即调是唯一录入点，表单不重复收亦不回填；餐别由保存时刻时钟判定，表内无此选择）
  - 比选稿 `docs/palette-options.html`（五版色组，当前选中其五）
  - 成稿截图 `.shots/v6-desktop.png`（1440 全页）、`.shots/v6-mobile.png`（390 全页）、`.shots/v6-form-meal.png`（归入行）、`.shots/v6-guard.png`（遮罩拦稿告知句）、`.shots/v6-workout-390.png`（390 录一练一屏）、`.shots/v5-*.png`（上一版三表开启态）、`.shots/v4-*.png` / `.shots/v3-*.png`（更早）、`.shots/za-mobile-*.png`（历史局部）
- Evidence reviewed:
  - `README.md`（§2 功能表、§字体与视觉约定、变更清单 1–25 条、仍待补齐）
  - `src/index.css` `@theme` 令牌与 `@layer components`（btn 三级、`.section-actions`、`.leader`）
  - 全部 `src/components/*.tsx`；`.omx/artifacts/visual-ralph/editorial-journal/`（参考稿 html + 双端截图，已批准基线）
  - 实测几何：`.shots/layout-probe.mjs` @1440/1023/768/640/390（本轮改版后全量 `--check`）
  - **版式契约**：`src/tests/layoutContract.test.ts`（共列网格、三级横线、零方法学文案）＋ `.shots/layout-probe.mjs --check`（条同起同止、值列不折行、章节行数上限）
  - **数据语义契约：`docs/data-semantics.md`**（Raw/Derived/Decision/Presentation 分层、窗口定义、公式表、迁移规则、审计结论）
  - 回归门槛：`src/tests/contrast.test.ts`、`journalContract.test.ts`、`scientificAudit.test.ts`、`domain.test.ts`、`migration.test.ts`、`presentationContract.test.ts`、`layoutContract.test.ts`
  - 用户已决（ask_user_question 记录）：墨线计量条、跨栏行配对＋统一章节头、朱为状态主色、竖排旁批、改御批文案

## Brand
- Personality: **御批奏折**——臣工以墨书事（正文、数据、事实一律墨色），皇帝以朱批裁（裁决、状态、旁注、回执一律朱色）。安静、克制、有权威感；一册可读的手记，不是一块仪表盘。
- Trust signals: 数值入句、每个数字可追到唯一函数（`docs/data-semantics.md`）、证据分级（`evidence_derived` / `evidence_constrained` / `engineering_heuristic`）、决策痕迹留在数据层（`nextMeal.trace` / `nextWorkout.trace`，口径归 README）、`journalContract`/`contrast`/`layoutContract` 三重回归。
- Avoid: KPI 卡、瓦片墙、环形进度、渐变、投影堆砌、backdrop-blur、多强调色并存、现代白话 UI 文案、AI 默认配色（靛紫渐变、语义色块）。

## Product goals
- Goals: 让人一眼看清「现在该吃、该动、身体如何」，且每条建议都可追溯到规则与证据；改版后额外目标是**版面本身可信**——横线对齐、动作不浮空、比例有余光线索。
- Non-goals: 多页面路由、社交/排行榜、生成式内容（LLM = OFF）、后端排版本轮不动；页面上不设决策稽核入口（痕迹留在数据层与 README）。
- Success signals: 两处配对行各两章横线跨栏 y 差 ≤2px（实测 0px）、上下列缘对齐；移动端标题左缘一致（全页同缘）；9 套测试 + tsc + build + e2e + 六档探针全绿；截图复核无浮空/挤行。

## Personas and jobs
- Primary personas: 唯一用户——记录自己健康账目的中文使用者，桌面查、手机记。
- User jobs: ① 今日要做什么、练什么（今日之事 ↔ 今日之练同一配对行，先看裁决再看清单）② 体征如何（体征通栏分两组——「今日之录」今之体重 + 腰围、「档案所录」身高·性别 + 活动水平；右栏睡眠、体感）③ 该吃多少、吃了多少（营养摄入：与统计同行，今日之标、两笔账、下一膳、所食账）④ 是否在正轨（统计：与营养摄入同行，派生数、趋势、合议、情景外推）⑤ 记录就地落笔（入口分归各节：体征·录体征 / 今日之练·另择动作 / 营养·别录一品，入口文字与表题相配；无全局 FAB；三表各开各域独立之表单、共用 `SheetShell` 一壳，餐别不再问用户）。
- Key contexts of use: 桌面 1440 浏览全页；手机 390 单手速记；两者都要求扫读时先看到「裁决」再看到细节。

## Information architecture
- Primary navigation: 无路由；单页纵向流 + 就地三录事表（Meal / Workout / Body 共用壳）。
- Core routes/screens: 刊头（繁体「記」印章 + 时段问候 + 干支日期）→ 配对行一（今日之事/今日之练）→ 通栏体征 → 配对行二（营养摄入/统计）→ 页脚（复其初）；录事入口分归各节就地按钮（无全局 FAB）。
- Content hierarchy:
  - **行动类**（配对行一）：今日之事、今日之练——目录式清单 + 章末动作脚注行。
  - **体征通栏**：只收原始事实——今之体重、档案所录（身高/性别/岁/活动/腰围）、夜眠与近七夜、精力·酸痛 1–5 圆点、数据待核朱批；未建档只显缺项。
  - **营养摄入（配对行二 · 左）**：今日之标（每日热量/蛋白/脂肪/碳水，练日上浮）、两笔账（蛋白质/热量计量条，尚余/已超）、下一膳（组块，`.group-head`）、今日所食（逐条掷还）。
  - **统计（配对行二 · 右）**：一切算出来的数——BMI/RMR/TDEE/每周抗阻（未建档不出人体数字）、近七日均重/三十日变化/回归斜率/记录、睡均与抗阻合议计量条、三十日趋势图（全页唯一图表）、情景外推（组块：四周/八周/十二周 + 推演所据，存疑即暂阙）。
  - 桌面两处配对行（两格同高、章节横线跨栏同 y、上下列缘对齐，探针断言行差与配对）：
    | 行 | 左 | 折缝 | 右 |
    | --- | --- | --- | --- |
    | 一 | 今日之事 | 1px | 今日之练 |
    | 二 | 营养摄入 | 1px | 统计 |
  - 体征为唯一通栏节，夹于两行之间；各节 `lg:pr-9` 留 36px 旁批槽。体征**内部同网格两栏**（`1.45fr | auto | 1fr` + 中缝，与两处配对行同 x 同轴）；左栏**静动两组**——「今日之录」（今之体重 + 腰围，随日而变）与「档案所录」（身高·性别 + 活动水平，建档常量，点线分隔），右栏（夜眠/体感）不设组；**三处折缝均自章节头墨线起、不越黑线**（探针断言）。
  - 移动端单栏次序（README §1 已同步）：今日之事 → 今日之练 → 体征 → 营养摄入 → 统计。

## Data semantics（数据语义，先于视觉）
- 四层：**Raw**（用户/设备记录）→ **Derived**（`src/domain/` 纯函数）→ **Decision**（Derived + `policy.ts`）→ **Presentation**（组件只措辞）。
- 同一事实只有一个权威来源；组件零业务算术、零阈值字面量、零 `new Date()`（`presentationContract.test.ts` 锁定）。
- 窗口不混用：Today / ThisWeek（周一起）/ Last7Days（滚动）/ Last30Days（滚动）；「抗阻 N/目标」用本周，「七日均重 / 睡均 / 近七夜」用近七日。
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
- Tradeoffs: 配对行两格同高（格底以内容较高者为准，格内自然留白受探针 ≤110px 约束）；章节头保留固定 18px 眉行（换取标题左缘一致与跨栏同 y，眉行只载右注）；朱与绛明度接近，故绛只用于「超录/删除」两种极少数场景。

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
- Typography: `Newsreader` + `Noto Serif SC` 只用于章节题（26px/`tracking-.06em`）、大号数字与条目名；`Plus Jakarta Sans` 承担正文（15px / 13px / 12px 地板）与小号数字（`tabular-nums`）；`font-mono` 只给规则 ID 与证据键名。
- Spacing rhythm: 版框 `border-2` + `border/55` 双线；章节顶距 `pt-10`（40px）为唯一档；节内分组只用 `mt-4 / mt-5 / mt-3` 与 `border-t border-linesoft`；桌栏间距 `lg:gap-x-8` + 中缝折线；正文右留 36px 旁批槽（`lg:pr-9`）。
- Shape/radius/elevation: 圆角只有一档 8px（表单与按钮）；圆形只留给点阵与状态点；无卡片、无阴影堆砌、无 backdrop-blur；页面栏目一律直接落在纸面。
- Motion: 仅 `transition-colors 150ms`（控件）与 Toast/弹层的 `motion/react` 进出；**计量条不做动画**（宽度静态，避免仪表感）。
- Imagery/iconography: `lucide-react` 单色图标 13–16px；全页唯一图表为 30 日体重折线（手绘 SVG，朱线 + 朱 10% 填充）；纸面为两层内联 SVG 噪点（纤维 6% + 斑驳 7%）。

## Components
- Existing components to reuse: `SectionHead`、`RuleMeter`、`.btn-primary` / `.btn-link`、`.section-actions`、`.leader`、`WeightTrendChart`、`SheetShell`（三录事表共用壳）、`MealSheet` / `WorkoutSheet` / `BodySheet`、`BodySection` / `NutritionSection` / `StatsSection`、`ProfileSheet`。
- New/changed components:
  - `src/components/SectionHead.tsx`（新）：眉行（右注）→ 题行 → 2px 墨线 + 竖排朱批旁注；全页 5 处章节头（两处配对行 + 体征通栏）唯一出口，章序已撤。
  - `src/components/RuleMeter.tsx`（新）：`label | 3px 条 | 分子/分母/百分比`；`tone: ink | accent | danger`；`max<=0` 时渲染 `—`。
  - `Marginalia` 内联于 `SectionHead`（`verdict` prop）：桌面 `absolute -right-9 -top-0.5` + `[writing-mode:vertical-rl]`，≤768 换行内横排。
  - `.section-actions`（`@layer components`）：章末动作脚注行；窄屏 `flex-col`、sm+ 一行两端。
  - `src/utils/cnCount.ts`：中文计数（刊头与朱批共用，消除重复实现）。
- Variants and states: 计量条三色 tone；旁批有/无；章节头右注有/无；动作脚注左槽可为数值组或提示文字。
- Token/component ownership: 颜色只允许出现在 `index.css`；组件内禁止字面 hex（由 `layoutContract.test.ts` 断言）。

## Accessibility
- Target standard: WCAG 2.1 AA；文本 ≥4.5:1、控件边框 ≥3:1（`contrast.test.ts` 回归锁定）。
- Keyboard/focus behavior: 全局 `:focus-visible` 2px 墨环；弹层开时 **Tab 焦点圈定于面板**（首尾循环）且**遮罩外宿主 `inert`**（回执 toast 除外）——`aria-modal` 名副其实；有稿时点遮罩不阖（告知句引路 Esc/阖之）；所有可点行都是 `<button>` 并带 `aria-pressed`；点击目标 ≥24px（复选框 24 热区 + 18 可视，点阵 `w-6 h-6`，「拟时长」钮 `py-1` 补足 24 高）。
- Contrast/readability: 字号地板 12px、交互文字 13px；朱对纸 5.66、绛对纸 8.82、褐对纸 5.55；`::placeholder` 取 `ink3`（**5.47:1** ≥ 4.5，`opacity:1` 免 UA 淡化）。
- Screen-reader semantics: 朱批旁注是真实文本；计量条本体 `aria-hidden`，语义由可见的「63/110 g · 57%」承载；名录式动作行（动作勾选、膳行掷还）带 `aria-label`；体重图 `aria-label` 带真值单位；回执 Toast `role="status" aria-live="polite"`。
- Reduced motion and sensory considerations: 无自动动画、无计量条动画；Toast 只做 160ms 位移淡入；`MotionConfig reducedMotion="user"` 全局尊重系统减弱动效之选。

## Responsive behavior
- Supported breakpoints/devices: 1440 / 1024 / 768（单栏分界）/ 390。
- Layout adaptations: `lg:` 起启用两处配对行（同 `1.45fr | auto | 1fr` 网格 + 折缝，列缘上下对齐）+ 竖排旁批；通栏体征内部同网格分两栏带中缝；三处折缝自章节头墨线起、不越黑线；通栏其余两栏并置也只在 `lg:` 起；`sm:` 起动作脚注改一行两端；其余单栏按 DOM 次序流下。探针要求五档 `overflow = 0`。
- Touch/hero differences: 移动端动作整行另起、右对齐；点阵与复选框保持 24px 热区；录入入口全部就地（无全局 FAB），页面无底部让位。

## Interaction states
- Loading: 「手记启卷…」+ 6px 朱点（居中纸面）。
- Empty: 无待办 → 朱批「今日无事」；未入账 → 「今日尚未入账一膳 · 由「别录一品」录之」，计量条渲染 `—`；无动作 → 不渲染空脚注行。
- Error: `runMutation` 失败 Toast **不冠**「知道了 ·」，格式「膳食之录未成（code）」；加载失败整页重试态。
- Success: Toast「知道了 · <事实>」+ 朱亮色勾（录膳回执附归宿「膳食已录于册 · 归午膳」）；完成态徽标 `bg-accentsoft / border-accentline / text-accent`；表内 700ms「已录于册」后自动阖表。
- Guard/draft: 表中有稿时点遮罩不阖 → 「表中已有录文——点遮罩不阖；按 Esc 或右上角「阖之」离表，残稿留于本机」；残稿 sessionStorage 随录随存，开表回填并示「已回填上次残稿；照准存上即焚」+「弃此残稿」钮；照准存上即焚。
- Disabled/loading: 提交中按钮禁用示「存中…」防重复照准；空录/越界不靠原生气泡（表单 `novalidate`），走 `hint` 朱字留表（空食 / 空练名 / 负数 / 腰围 40–200 / 眠时 0–1440）。
- Offline/slow network: 本机 mock 仓库即时；云库走同一 `runMutation` 错误通道。

## Content voice
- Tone: 古风行文、第一人称手记体；克制、不推销、不空话。**数字必须带口径**（「7/7 日」「30/30 日 · 30 次」「拟 45 分」「估算」）。
- **不写方法学**：`非首末/不予修改/仅标记/仅指/非健康度/非承诺/做线性回归/原始记录…` 等句子禁止出现在页面（`layoutContract` 锁定），口径写入 README「术语与口径」，模型出处写入「推演所据」面板。
- 判定与其数值同行（`RuleMeter suffix`：`2/2 次 · 100% · 合议`），不再单列「判」行。
- 数据待核的措辞固定为「朱批 · 待核 N 项」＋「今日体重高于/低于近七日其余各日之均重 X 公斤」——集中于体征通栏的 `DataQualityNote`，只标不改，口径归 README「术语与口径」。
- Terminology: 章作「今日之事 / 今日之练」（不带章序），节作「体征 / 营养摄入 / 统计」，膳作「下一膳」，练作「今日之练」，记录作「录之/添录一事」。
- Microcopy rules（御批词表，`layoutContract.test.ts` 锁定关键项）:
  | 场合 | 用词 |
  | --- | --- |
  | 成功回执 | 「知道了 · 膳食已录于册 · 归午膳」（一律冠前缀；失败**不**冠；归宿依保存时刻） |
  | 主确认 | 「照准」（今日之练记账、三录事表提交；异常体重首击作「仍要录之」） |
  | 危险/删除 | 「掷还」（今日之事删条 title） |
  | 达标 | 「合议 · 每周两日抗阻」「合议 · 七时之基 AASM 2015」 |
  | 未达标 | 「未合议 · 尚差 N 日」「未合议 · 不及七时之基 AASM 2015」 |
  | 旁批（≤8 字） | 「已成其一」「照减脂之期」「今常规」「渐降」「待核」「未建档」「抗阻合议」 |
  | 保留不改 | 「毕此一练」「复其初」「录之 / 罢」「览毕」「记此一刻」；文献引文、规则 ID、ASCII 单位 |

## Implementation constraints
- Framework/styling system: React 19 + Vite + Tailwind v4（`@theme` 令牌，非 config 文件）；`lucide-react` 图标；`motion/react` 仅用于进出动画。
- 分层约束：业务算术与阈值只能出现在 `src/domain/`（`policy.ts` 是唯一常量表）；`services/scientificRules.ts` 只保留证据规则并消费 policy；仓库实现只做「读存储 → 迁移 → 调 domain → 组装 TodayData」。
- 数据契约：`TodayData` = 今日原始切片 + 派生指标 + 决策结果；`DailyState.sleep` 为判别联合（区间/手录眠时），字段可缺席表示「未录」。
- Design-token constraints: 颜色只写令牌类；组件源码禁裸 hex；单档 8px 圆角；不引入新依赖、不新增令牌（除非先改 `contrast.test.ts` 并说明对比度）。
- Performance constraints: 单包 542 KB（gzip 171 KB）不回退；无新增网络请求、无图表库。
- Compatibility constraints: 仅现代 evergreen 浏览器；`writing-mode` 降级在 ≤1024 走横排。
- Test/screenshot expectations: 改动前后必跑 `npm test`（9 套）、`npm run lint`、`npm run build`、`.shots/e2e.mjs`、`.shots/qa-states.mjs`、`.shots/accept-check.mjs`（弹层行为 15 断言：焦点圈定 / inert / 遮罩拦稿 / 残稿 / 归膳 / 390 一屏 / 占位对比度）；版式用 `.shots/layout-probe.mjs <url> <width> --check` 断言配对横线同 y、标题左缘、同轴三列全等、章节行数上限、`overflow=0`（@1440/1023/768/640/390）；截图 `.shots/shot.mjs <url> <width> <out.png>` 并人工复核。

## Open questions
- [x] **云端数据路径已实作**（零依赖 fetch 直连；表结构与 RLS 见 `supabase/schema.sql`，逐步启用见 `docs/deploy.md`）。遗留：本机 localStorage → 云端的一次性导入尚未提供。Owner: 实现 / 影响: 老数据迁移。
- [ ] BMI 分不清肌肉与脂肪：已用腰围作第二证据，是否再加体脂率（需设备测量）待定。Owner: 用户 / 影响: 判定精度。
- [ ] `共列网格` 的名列定宽 84px 意味着标签限 5 字以内；若未来出现更长指标名，需要新的网格变体或允许折行。
- [ ] 名录式条目的点线引导在中列伸缩（标题越长点线越短）；是否改为「点线定长 + 标题截断」待定。
- [x] **IA 重构已按批准方案执行**：右栏三行配对取消，改为两处配对行（今日之事 ↔ 今日之练、营养摄入 ↔ 统计，体征居间通栏）；五旧节解散归位，原「右栏次序」问题随之消失。
- [ ] `UserProfile.currentWeight` 仍是「最近测量」缓存，页面已不读；是否彻底移除该字段（需改引擎入参契约）。Owner: 实现 / 影响: 类型。
- [ ] 预测是否落库为 `WeightPrediction` 记录以支持「上期推演 vs 本期实测」误差复验。Owner: 用户 / 影响: 数据模型。
- [ ] 朱兼印章与状态两色同值（`seal === accent`），若嫌印章存在感被稀释，是否给印章加深 1px 绛边。Owner: 用户 / 影响: 刊头。
- [ ] 旁批文案目前由各组件就地拼装（取自真实数据），是否要抽成统一 `verdicts.ts` 词表以便统一口吻。Owner: 实现 / 影响: 可维护性。
- [ ] 计量条是否扩展到「今日之事完成度 x/4」（用户本轮明确**不**选，现为纯文本）。Owner: 用户 / 影响: 计量范围。
- [ ] 版式回归目前是源码契约 + 几何探针，是否再上像素级 diff 基线。Owner: 工程 / 影响: 回归强度。
