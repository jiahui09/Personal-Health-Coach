# Personal Health Coach · Living Journal

一个**安静、温暖、单页**的个人健康伴侣与决策手记：告诉你「下一餐吃什么、下一次怎么动、身体正在如何变化」。

> 核心设计立场：**LLM = OFF**。所有建议都由确定性的 TypeScript 纯函数 `y = f(x)` 计算得出——同样的输入 + 同样的规则版本，永远得到逐位一致、可追溯的输出，没有生成式幻觉，也没有任何外部 AI 接口调用。

---

## 1. 功能性质（它是做什么的）

它不是健身 App，而是一本**「会算账的健康手记」**：你只负责如实记录事实，模型负责计算与给出下一步建议，并把每一条建议的**依据、假设与局限**摊开给你看。

页面按一条自然的单页流组织：

```
刊头 → 其一 今日之事 → 其二 下一膳 → 其三 今日之练 → 身体近况 → 近况 → 体征档 → 情景外推 → 今日体感
```

| 区块 | 功能 |
| --- | --- |
| **刊头与序** | 印章报头与存储标识；「朝安 / 昼安 / 夜安」时段问候 + 干支日期行，一键唤起录事 |
| **其一 今日之事** | 今日待办（增 / 删 / 勾选），行内「添录一事」速记；完成率只由 `status` 决定 |
| **身体近况** | 今之体重、**近三十日有记录日数 / 原始条数**、首末相差（端点变化）与回归斜率**分列**（后者注明「非首末差值」），附三十日趋势折线（**全页唯一图表**）；「今日体感」一句——眠时**由就寝/起身时刻推得**（手录眠时另标来源）、精力 (1–5)、酸痛 (1–5) 入句，分数可随手点按调校 |
| **其二 下一膳** | 基于今日已摄入热量/蛋白质缺口，从餐食模板库中排序推荐，给出**热量区间与蛋白质区间**（而非假装精确的单一整数）；「照准」一键入账，决策痕迹留在数据层（`nextMeal.trace`） |
| **其三 今日之练** | 根据睡眠、精力、酸痛、今日是否已练判定训练状态（REST / RECOVERY / LIGHT / NORMAL），给出**纯徒手**课表（深蹲、俯卧撑、臀桥、平板等）、时长与恢复指引，同样可查看稽核 |
| **近况** | 七日均重（注明近七日几/7 日有记录）与回归斜率、**本周（周一起）**抗阻次数对照 WHO 每周 ≥2 天建议、近七日睡均对照 AASM 7 小时基准（只报达标与否，不报百分比）、今日所食两笔账（**未达「尚余」、超出「已超」**）、四周/八周/十二周**情景外推**（标注模型版本、依据日数，数据存疑即暂阙；点开「推演所据」见前提与局限）——**均写成行文，不做数值卡** |
| **体征档** | 建档 / 改档（性别 / 出生年 / 身高 / 活动水平 / 腰围 / 目标）；由此算出 **体重指数（WHO 分类）、腰围判定（亚太线）、静息代谢（Mifflin-St Jeor）、总消耗（RMR×PAL）**，并据此定 **每日热量、每日蛋白（1.4–2.0 g/kg）、每周抗阻日数**。未建档时只显示缺什么，绝不拿演示数据冒充 |
| **情景外推** | 四周 / 八周 / 十二周情景区间（`scenario_trend_projection`），标注模型版本与依据日数；数据存疑即暂阙 |
| **录事弹层** | 底部弹层，三签：进食 / 习练 / 体征 |
| **决策痕迹（数据层）** | 引擎每次推荐都产出 `trace`（输入快照 / 推导值 / 前提 / 局限）与 `evidenceTraces`（证据出处）；页面不再设稽核弹窗，口径与阈值见本文件「术语与口径」 |
| **复其初** | 页脚一键恢复到初始的三十日模拟数据 |

### 科学性分级（项目最核心的方法论）

每条规则都被强制标注为三类之一，并在 UI 中如实呈现：

| 分类 | 含义 | 例子 |
| --- | --- | --- |
| `evidence_derived` | 文献中的直接公式/方程 | Mifflin-St Jeor (1990) 静息代谢预测 |
| `evidence_constrained` | 综述/指南给出的约束区间 | Morton 2018 蛋白质 1.4–2.0 g/kg/天；WHO 健康饮食；睡眠 ≥7h |
| `engineering_heuristic` | 桥接科学与实践的产品启发式 | 精力/酸痛阈值判定训练状态、餐食打分排序、进阶组次 |

配套的**证据登记表**（`scientificEvidence.ts`）只收录 10 条可核实的核心来源（Mifflin 1990、Morton 2018、Schoenfeld 2018、WHO 2020、ACSM 2026、WHO Healthy Diet 2020、DGA 2025–2030、AASM/SRS 2015、Hall 2011、Helms 2016），每条都写明 `claim`（结论）与 `limitations`（局限），不编造 DOI。

### 关键计算函数

| 函数 | 作用 | 状态 |
| --- | --- | --- |
| `f_RMR` | Mifflin-St Jeor 静息代谢预测（±10% 个体差异声明） | evidence_derived |
| `f_energy_prior` / `f_TDEE` | 活动系数估算的**能量区间**（拒绝伪精确整数） | engineering_heuristic |
| `f_protein` / `f_per_meal_protein` | 全天与单餐蛋白质区间 | evidence_constrained |
| `f_weight_trend` | 7 天滚动均值 + 最近 21 点线性回归趋势 | evidence_constrained |
| `f_weight_forecast` | 4/8/12 周预测区间（带代谢递减阻尼系数，区间而非点估计） | dynamic model |
| `f_diet_quality` | 按 WHO/DGA 约束评估蔬果、全谷物、膳食纤维、食物多样性 | evidence_constrained |
| `f_training_state` | 睡眠/精力/酸痛 → REST/RECOVERY/LIGHT/NORMAL（附「非临床级指标」免责声明） | engineering_heuristic |
| `f_meal` | 候选餐食多维打分：`proteinFit + energyFit − repetitionPenalty` | engineering_heuristic |
| `f_workout` | 按训练状态输出徒手课表（明确标注「无单杠 → 拉力受限」） | engineering_heuristic |
| `f_energy_calibration` | 用「平均摄入 − 体重趋势换算」做长期维持能量经验校准 | engineering_heuristic |
| `f_progression` | ACSM 渐进抗阻原则的工程翻译 | engineering_heuristic |

---

## 2. 技术架构

```
src/
├── App.tsx                    # 单页编排：状态、Toast、弹窗、区块组合
├── components/                # 11 个展示组件（HeaderGreeting / TodayTasks /
│                              #   BodyOverview / HowAmIDoing / NextMealCard /
│                              #   NextWorkoutCard / RecentSection / LifeSection /
│                              #   RecordSheet / 域层摘要 …）
├── services/
│   ├── repository.ts             # ★ 工厂：按 VITE_SUPABASE_* 选择实现，UI 只从这里拿单例
│   ├── healthRepository.ts       # 数据访问接口 + AuthUser + RepositoryError（单一契约）
│   ├── mockHealthRepository.ts   # 默认实现：localStorage 持久化 + 调用决策引擎
│   ├── supabaseHealthRepository.ts# Supabase 桩（每个方法抛 not_implemented，待接通）
│   ├── scientificDecisionEngine.ts# 引擎门面：evaluateFullDecision / verifyDeterminism
│   ├── scientificRules.ts         # ★ 全部纯函数规则（930 行，核心）
│   ├── scientificEvidence.ts      # 证据登记表（10 条，含 claim / limitations）
│   └── scientific/index.ts        # 统一导出
├── data/                      # mockData（30 天体重等演示数据）、foods（食物库+餐食模板）
├── types/health.ts            # 全部领域模型与审计类型（单一类型来源）
├── vite-env.d.ts              # VITE_SUPABASE_* 环境变量类型
└── tests/scientificAudit.test.ts  # 确定性审计测试（9 组）
```

**分层**：`UI (React 19) → HealthRepository (接口) → repository.ts (工厂) → Mock / Supabase 实现 → ScientificDecisionEngine (纯函数)`。换后端只改工厂这一处。

**技术栈**：React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + motion（动效）+ lucide-react（图标）。默认**数据完全保存在浏览器 localStorage**；配置 `VITE_SUPABASE_*` 后改走 Supabase（见第 4 节）。

### 数据接口契约（为 Supabase 免费方案准备）

`HealthRepository`（`services/healthRepository.ts`）27 个方法，除了 CRUD 还显式带上云后端必需的四类能力：

| 能力 | 内容 | 为什么 |
| --- | --- | --- |
| **身份** | `getCurrentUser / signIn / signUp / signOut / onAuthChange`，`AuthUser.id` 即每行数据的 `user_id` | 没有 `user_id` 就没有 RLS，健康数据不能裸奔 |
| **时间窗** | `getMeals/getWorkouts/getWeightHistory/getTodos/getDailyStates(since?)` | 不再全量拉历史；Supabase 上等价于 `where date >= since` |
| **类型化错误** | `RepositoryError{code: network\|auth\|conflict\|not_found\|not_implemented}` + `toRepositoryError()` | App 用 `runMutation()` 统一兜底：失败弹出带 code 的 toast；初次加载失败显示重试页 |
| **可复现时钟** | `HealthContext.now: Date`——引擎只从它读时间 | 同一 `x` 必得同一 `y`，服务端重算与客户端一致（测试 9 覆盖）；ID 也统一为 `crypto.randomUUID()` |

另外两条语义约定：`resetToDefault()` **仅限演示**（后端实现禁止用它删真实数据）；`saveDailyState`/`addWeight` 各自包含两处写入，落到 Postgres 必须是事务或 rpc。

### 术语与口径（为什么这样写）

页面只写事实，口径与原理集中在这里（页面上一切「解释性文字」都已删除）。

- **待核（needs_review）**：只标记，绝不改数。体重：`|今录 − 近七日均重| > max(1.5kg, 均重×2%)`；营养：今日热量 `> 2× 目标`（一键「照准」连点即会触发）。被标记的记录原样保留，可在「近况 · 今日所食」逐条**掷还**；体重不参与训练决策（`decideWorkoutMode` 的入参里没有体重）。
- **端点变化 ≠ 回归斜率**：`三十日变化 = 末个有效日 − 首个有效日`；`回归斜率 = 对近三十日每日代表值做 OLS × 7`。二者数值通常不同，页面上是两行两个字段。
- **每日代表值**：同一天多次测量取**当日最新**一条；因此「记录」显示为 `有效日数/窗口日数 · 原始条数`，条数与日数不可混称。
- **睡眠时长只有一个来源**：`DailyState.sleep` 是判别联合——填了就寝/起身则 `duration = (起身 − 就寝 + 1440) mod 1440`；只记得总时长则用手录眠时。近七日均**只按有记录的夜数平均**并如实报告（如 `1/7 夜`），不伪造完整窗口；睡眠只报「是否达七时之基」，不给百分比（避免读成越多越好的任务）。
- **拟 / 估算 / 实际**：任务行的「拟 45 分」是**计划**；建议课表的「约 20 分 · 估算」是产品估算；只有用户计时才标「实际计时」。三者互不冒充。
- **尚余 / 已超**：`余 = max(目标 − 已录, 0)`、`超 = max(已录 − 目标, 0)`，由同一函数给出，因此不会用「尚余 0」掩盖超额。
- **计划膳 ≠ 实测**：`MealRecommendation` 是计划，「下一膳」标注「未入账」；只有「照准」写入 `MealRecord` 才计入今日所食。
- **情景外推**：`method = scenario_trend_projection`，由 `近30日斜率 × 周数 × 衰减(0.95/0.88/0.80) ± 区间(0.35/0.55/0.75 kg)` 得出，标注模型版本与依据日数；数据存疑或不足时**不出数**。它是情景，不是承诺，也不是目标。
- **证据三级**：`evidence_derived`（由记录严格算出，如七日均重）／`evidence_constrained`（受文献约束的规则，如 Morton 2018 蛋白区间、AASM 七时之基）／`engineering_heuristic`（为产品决策而设的启发式，如「酸痛 ≥4 或 精力 ≤2 → 恢复」）。启发式不伪装成医学结论。

### 数据语义（Raw → Derived → Decision → Presentation）

页面任何数字都只有一条来源，其余全部由纯函数算出；完整审计、公式与窗口定义见 `docs/data-semantics.md`，设计契约见 `DESIGN.md`。

- **原始记录（Raw）**：`WeightRecord`（带 `source`/`time`）、`MealRecord`（带 `source`/`confirmed`）、`WorkoutRecord`（带 `category`/`durationSource`）、`DailyState`（`sleep` 为判别联合：`interval` 或 `duration`，字段可缺席）、`TodoItem`（`status`）、`UserProfile`（**只有原始输入**：性别/出生年/身高/活动水平/腰围/目标——没有年龄、没有当前体重、没有目标热量）。
- **体征派生（Derived + Decision）**：`domain/body.ts`（BMI 与 WHO 分类、腰围亚太判定、Mifflin-St Jeor 静息代谢、RMR×PAL 总消耗）、`domain/composition.ts`（建议方向、每日热量与蛋白、每周抗阻处方、速率区间）；阈值与比例集中在 `domain/policy.ts` 的 `TARGET_POLICY`。
- **派生层 `src/domain/`**：`time.ts`（唯一的今日/本周（周一起）/近七日/近三十日）、`policy.ts`（全部阈值与目标）、`tasks.ts`、`nutrition.ts`、`sleep.ts`、`weight.ts`、`training.ts`、`activity.ts`、`format.ts`、`migrate.ts`。组件内**零业务算术**（由 `src/tests/presentationContract.test.ts` 锁定）。
- **决策层**：`decideWorkoutMode`（输入只有体感/睡眠/今日是否已练，**体重不在入参内**）、`validateWeightMeasurement`（异常只标记待核，绝不改数）、`assessNutritionQuality`、`f_weight_forecast`（`method: scenario_trend_projection` + 模型版本 + 依据日数，存疑即 `withheld`）。
- **窗口不混用**：今日任务/饮食/训练/体重/体感用 Today；抗阻进度与本周训练次数用 **ThisWeek（周一起）**；七日均重与睡均用 **Last7Days（滚动）**；端点变化、回归斜率、记录条数与有效日数用 **Last30Days**。
- **计划 / 预测 / 实测分离**：`MealRecommendation` 是计划，只有「照准」后写入 `MealRecord` 才计入今日所食；预测永远不覆盖实测；任务用时标「拟」并注明未记实际用时。
- **存储迁移**：旧形态（单对象 `DailyState`、`completed: boolean`、`sleepHours/bedtime/wakeup`）在读取时升级，**只补字段与形态，不改任何数值**（`src/tests/migration.test.ts`）。

### 字体与视觉约定（编辑式手记风）

- **三个 Web 字体，各司其职**：`Newsreader` + `Noto Serif SC` 只用于标题、章序与大号数字，`Plus Jakarta Sans` 承担正文、标签与小号数字（统一 `tabular-nums`），`font-mono` 是系统等宽栈、**只用于规则 ID / 证据键名**。
- **标题全中文、古记事体**：章节头统一由 `src/components/SectionHead.tsx` 输出：**眉行（章序＋右注，固定 18px）→ 题行 26px 衬线 → 外粗内细双线（2px 墨 + 1px 细）**，右栏附目与通栏同规格；眉行右端之外，章节右侧另有 36px **旁批槽**，朱色竖排小字写裁决（如「已成其一」「照减脂之期」「抗阻合议」），窄屏降级为题下横排朱批，日期行是干支年 + 中文月日 + 星期（如 `丙午年 · 九月廿五 · 星期五`，由时钟推导，1984 年为甲子），刊头是朱红「记」印章 + 「个人健康手记」报头，刊头与页脚各压一条 2px 墨线。
- **设计令牌集中在 `src/index.css @theme`**：纸色 `--color-paper #f4f0e8`、卡面 `#fffdf8`、线 `#e3dccc`、墨 `#16120e`（次级 `#57534e` / `#6f675e` / `#736b61`，四档对纸底 16.4 : 6.7 : 4.9 : 4.6:1，**全部 ≥4.5:1**）。**既定锚色**：古书纸（纸/面/线全套）与批朱红 `#a63a2b`。功能色取五版比选稿 `docs/palette-options.html` 中选中的**「其五 · 朱墨双色」**（奏折制：墨＝臣工所书，朱＝御批）：唯一强调色 `--color-accent #a63a2b` 朱批（对纸 5.66:1、白字压朱 6.44:1；浅调 `#fbeee9` / `#f2d9d0`、压墨亮色 `#fda4af` 9.85:1），**朱同时承担刊头印章与状态色**；危险色 `--color-danger #7f1d1d` 紫檀绛（8.82:1、白字 10.02:1，与朱拉明度差）、证据次级色 `--color-tier2 #7a5a2e` 褐（5.55:1）、控件边框 `--color-control #877c69`（3.61:1，满足 WCAG 1.4.11）。文字色阈值由 `src/tests/contrast.test.ts` 回归锁定。
- **可读性与无障碍地板（本轮新增约定）**：正文/元信息字号地板 **12px**、交互文字 13px（源码中已无 `text-[11px]`/`text-[11.5px]`，仅规则 ID 等宽行保留 11px）；`:focus-visible` 全局 2px 墨线焦点环，源码**不得**再用 `outline-hidden` 类吃环；所有点击目标 ≥24px（复选框为「24px 热区 + 18px 可视」双层、1–5 分圆点 `w-6 h-6`、图标按钮 `p-1.5`）；带 `onClick` 的行一律用 `<button>` 并带 `aria-pressed`；体重图 `aria-label` 携带真值与单位。
- **动作两级体系，朱只表裁决与状态**：`.btn-primary`（墨实心：照准 / 毕此一练 / 览毕）→ `.btn-link`（文字链：别录一品 / 另择动作 / 添录一事 / 记此一刻 / 复其初 / 推演所据等），类定义在 `src/index.css @layer components`。**朱只用于「已成 / 达标 / 御批 / 图表」**：勾选框、完成徽标、Toast 勾、达标句（合议 · 每周两日抗阻 / 合议 · 七时之基）、状态词（健 / 微酸）、旁批、计量条达标填充与体重折线；章序与一切动作型文字/图标改为墨色。
- **圆角只有一档 8px**（`rounded-lg`），只留表单控件与按钮；`rounded-full` 只留给真正的圆形（状态点、圆点单选）；没有 `backdrop-blur`、没有超大阴影，**页面栏目一律不用卡片容器**。
- **仿真古书纸与版框**：`body` 以 `--color-paper` 为底，叠两层内联 SVG 噪点（纤维纹 6% + 陈化斑驳 7%，不用氛围渐变）做纸张质感；全页内容入「外粗内细」双线版框（`border-2` 外框 + `border/55` 内线），刊头、正文与页脚同框；区块只以墨色粗细线与点线分隔，数值一律入句。
- **全页只留一张图表，其余数字入句**：唯一图表是 30 日体重折线（`TodayData.weightSeries`，手画 SVG，来自真实记录、不造序列）；摄入、趋势、预测区间都写成手记行文，精力与酸痛用两行对齐的 1–5 圆点点按——**没有 KPI 卡、没有瓦片墙、没有环形进度**；比例信息只用**墨线计量条**（`RuleMeter`：3px 直角细线，底轨 `--color-line`，填充墨＝进行中 / 朱＝达标 / 绛＝超录，无圆角阴影渐变动画），百分比与分子分母一律以真实文本入句（蛋白质 63/110 g · 57%、抗阻 2/2 · 100% · 合议、睡均 7.3/7 h）；睡眠只报达标与否、不给百分比。
- **版式**：容器 1100px；桌面双栏**按行配对**（`lg:col-start`/`lg:row-start` 显式落位，三对章节横线跨栏同 y，中缝一条 1px 折缝线）；左＝其一/其二/其三，右＝**身体近况 / 体征档 / 近况**（体征档的位置随建档状态自适应：未建档时它是短提示,与「下一膳」同高）；「情景外推」与「今日体感」为通栏两节。移动端单栏按 DOM 次序（其一 → 其二 → 其三 → 身体近况 → 体征档 → 近况 → 情景外推 → 今日体感）。章节级动作统一收在章末「动作脚注行」（`.section-actions`）。
- **文案全取古风行文，不用现代白话**：时段问候作「朝安 / 昼安 / 夜安。」，主句作「凡四事，已成其一。」；章节作「下一膳 / 今日之练」，动作作「录之 / 罢 / 照准 / 毕此一练 / 览毕」，危险动作作「掷还」，报错作「膳食之录未成（code）」，反馈作「知道了 · 一事已列入今日之册」（成功回执一律冠「知道了 ·」，失败不冠），达标作「合议 / 未合议 · 尚差二日」，页脚只留报头与「复其初」；记录表单标签（餐别 / 所食之物 / 就寝 / 起身 / 精力 / 酸痛 …）同此体例。**保留不改的只有三类**：文献引文与 `claim`/`limitations`（`scientificEvidence.ts`，学术原貌即证据本身）、规则 ID 与 ASCII 单位符号（kcal / kg / AASM / RIR）、食物与练习的中文专名。
- 少量扫描器命中是**刻意保留**的（衬线标题、圆形控件、已完成事项的删除线、规则 ID 的等宽字、图表端点圆点），在源码里用 id 级注释标注原因，例如 `deslop-ignore-file 07 09`；`kill-ai-slop` 扫描器对整个项目目前是 **0 hits**。

### Visual Ralph 参考稿与实现偏差

实现依据已批准的参考稿：`.omx/artifacts/visual-ralph/editorial-journal/reference.html`（截图 `reference-desktop.png` / `reference-mobile.png`），成稿截图在 `.shots/app-desktop.png` / `.shots/app-mobile.png`；本轮可读性/无障碍优化后的复核截图为 `.shots/opt-desktop.png`（1440）与 `.shots/opt-mobile.png`（430，溢出探针 0）；次要证据是像素对比 `compare -metric RMSE` ≈ 0.159、差异像素约 4.9%（差异主要来自真实数据与参考稿占位数据不同、页面高度不同）。

与参考稿的**有意偏差**（原则：不造假数据）：

1. 参考稿右栏是「柱状图 + 状态卡 + 预测瓦片」的数值面板；终稿改为**手记行文**（见下方第 6 条）：既因为演示数据没有逐日睡眠/进食史（画柱子等于造数据），也因为后续要求「去掉滥用 dashboard」。
2. 参考稿餐食旁注写死「今日晚餐」→ 由规则同源的 `f_meal_slot(小时)` 实时输出「早膳 / 午膳 / 晚膳」，与引擎选餐逻辑一致（同一函数也用于「照准」记账的 `category`）。
3. 参考稿生活纪事的示例行（愉悦/劳碌/晨起）→ 真实分类聚合（写码/学习/运动/阅读 + 近期手记）。
4. 参考稿里「九月记录 · 22 次」等占位数字 → 「记录 N 次」按 `weightSeries` 真实长度。
5. 印章圆角跟随全站 8px 单档圆角（参考稿为 4px）。
6. **去 dashboard 化（用户后续要求，优先于参考稿）**：右栏的体重 KPI 卡、三格状态、三条统计行、两条摄入进度条、三块预测瓦片全部改为「数字入句」的手记行文，全页只保留体重折线一张图表；此改动有意偏离参考稿的面板密度，数据契约由 `src/tests/journalContract.test.ts` 锁定。
7. **去卡片、仿真古书纸（用户再后要求）**：页面流全部 `bg-surface` 卡片容器（其一/其二/其三、本周之功、近来手记、案头小记）撤除，正文直接落在带纤维纹与陈化斑驳的纸面上，全页加古书版框；参考稿「以面板承载内容」的整层被放弃，仅留点线与墨线分隔。

---

## 3. 快速开始

```bash
# 安装依赖（bun 或 npm 均可）
bun install          # 或 npm install

# 开发（端口 3000）
bun run dev          # 或 npm run dev

# 类型检查
npm run lint         # tsc --noEmit

# 科学审计测试
npm test             # tsx src/tests/scientificAudit.test.ts

# 生产构建
npm run build
```

> 环境变量只有一组（见 `.env.example`）：`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。**两项都留空 = 本地 localStorage 演示模式**，不需要任何配置即可运行；填上则切换到 Supabase 实现。项目不调用任何大模型接口（LLM = OFF），也没有其他后端地址配置。

---

## 4. 部署方案：Cloudflare Pages + Supabase Free

> **逐步操作见 `docs/deploy.md`，数据库建表脚本见 `supabase/schema.sql`。**
> 两条路径都已可用：
> **静态版**（零配置、本机 localStorage）与 **云端同步版**（Supabase 邮箱 magic link + PostgREST），
> 后者为**零新增依赖**实现（`src/services/supabaseRest.ts` 用 fetch 直连），两条路径共用同一段
> 派生逻辑 `src/services/todayAssembly.ts`，跨路径一致性由 `src/tests/supabaseContract.test.ts` 锁定。

**已定方案**：静态托管 Pages + 数据/鉴权 Supabase 免费档，**不引入任何服务端应用层**。

| 环节 | 结论 | 说明 |
| --- | --- | --- |
| **Cloudflare Pages** | 采用 | 托管 `dist/` 静态产物；build command `npm run build`、output `dist`；项目无路由，不需要 SPA fallback |
| **Supabase Free** | 采用 | 浏览器直连 PostgREST（不经 Worker），8 张表全是个人手记量级；anon key 是公开键，安全边界在 RLS |
| **Cloudflare Workflows** | 不采用 | ① **没有服务端工作负载**：27 个 repository 方法全是请求/响应 CRUD，确定性引擎在浏览器里算，没有队列、没有需要持久化的多步骤流程；② **免费前提存疑**：Workflows 挂在 Workers 上，据信需 Workers Paid（约 $5/月）——接入前请核对 `developers.cloudflare.com/workflows/pricing`，若属实会直接打破"免费" |

**将来真需要后台任务时**（夜间周报聚合、Apple Health 批量导入、备份到 R2）：先用免费的 Supabase 侧方案——`pg_cron` + SQL 函数，或 Supabase Edge Functions；只有当工作负载确实需要跨步骤持久状态、且核验 Workflows 免费可用时再考虑它。

**上线前必须核对三处官方额度（本文所有"据信/待核验"数字均以当时官方页面为准）**：Cloudflare Pages 免费额度、Cloudflare Workflows 计费、Supabase Free 当前限额（数据库容量 / 流量 / 项目数 / Auth 用户数）。本环境无法联网，相关定价页未做实时核验。

### 真正接 Supabase 时的落地待办

1. **SQL migration**：8 张表（对应 `STORAGE_KEYS` 的 8 个 key）+ `user_id uuid` + 每表 RLS 策略 + `(user_id, date)` 唯一约束 + `today_snapshot` 视图（让 `getToday()` 一次取回，而不是 8 次往返）。
2. **实现 `SupabaseHealthRepository`**：先打通读路径 `getToday()`，再补写路径；`saveDailyState`（连带体重）与 `addWeight`（连带 profile）用事务/rpc，`toggleTodo` 用 `set completed = not completed returning *`，`completeTodayWorkout` 用部分唯一索引 + `on conflict do nothing`。
3. **Pages 项目配置**：仓库连接、build/output 如上，在 Pages 后台注入 `VITE_SUPABASE_*`（或用 `.env` 构建）。
4. **保持引擎在客户端**：`getToday()` 拉回原始记录后由浏览器跑 `ScientificDecisionEngine`——这是本方案不需要任何 Worker/Workflow 的根本原因。

---

## 5. 项目评估

### 优点

- **方法论诚实**：三层证据分级 + 每条建议附带输入快照、规则 ID、假设与局限；用区间替代伪精确整数，并主动声明「非临床级指标」。
- **确定性可测试**：规则全部为纯函数，`verifyDeterminism()` 与测试用 JSON 序列化比对验证幂等性。
- **分层干净**：Repository 接口把 UI 与数据源解耦，类型集中在 `types/health.ts`，职责清晰。
- **工程质量**：`tsc --noEmit`、`npm test`（9/9 科学审计 + 手记数据契约 + 新增设计令牌对比度用例）、`vite build` 三者本轮实测全绿；产物约 446 KB JS（gzip 142 KB）+ 27 KB CSS（gzip 6.2 KB）。
- **体验完整**：单页流、Toast 反馈、底部记录弹层、演示数据重置，中文文案统一克制。

### 本轮修复清单（去 AI 味 + 原型 → 工程化）

1. **证据渲染不再写死**（历史）：当时的稽核弹窗把 `trace`、`evidenceTraces`、`ruleId/ruleStatus` 等 props 完整呈现；该弹窗与「缘由」入口已在第 17 条移除，痕迹仍留在数据层。
2. **假日期换成真时钟**：`TODAY_STR`、30 天体重序列、周窗口（最近 7 天）、月基线（最近 30 天）全部由 `new Date()` 推导，新记录会落到界面上的那一天。
3. **统计改为真实聚合**：`weeklyLifeStats` 按分类汇总最近 7 天的 LifeLog（时长 + 次数），日均蛋白质按有记录日平均（无记录返回 0 而不是假的 95g），`displayDate` / 时段问候按本地时间生成。
4. **测试与实现重新对齐**：用例更新到 V3 规则（`RULE_MEAL_CANDIDATE_OPTIMIZATION_03`），并让 `f_meal` 在**今日无餐记录**时如实返回 `confidence: 'low'`——`npm test` 现在 9/9 通过（含新的时钟注入用例）；同时去掉测试输出里的 emoji。
5. **死代码清理**：`InsightsNote.tsx`、`data/evidence.ts`、`f_meal_candidates` 恒真分支、mock 仓库的假 `sleep()` 延迟、`personalNote` 字段、未使用的 `subtleFade` 动画与 `motion`/`Sparkles` 引用。
6. **AI Studio 残留删除**：`metadata.json`、AI Studio 版 `.env.example`（已替换为新的 `VITE_SUPABASE_*` 模板）、`vite.config.ts` 里的平台 HMR 环境变量逻辑；`package.json` 移除 10 个源码从未 import 的依赖（`@google/genai`、`express`、`dotenv`、`recharts` 等），包名从 `react-example` 改为 `personal-health-coach`。
7. **视觉与文案去模板化**：见上文「字体与视觉约定」——单一强调色、单一 8px 圆角、紧实阴影、去掉 mono 小标签与删除线之外的装饰、清掉「身体正在以平缓的节奏自然微调」这类空话；`kill-ai-slop` 扫描器对**全项目 0 hits**（刻意保留项都有带原因的 id 级注释）。
8. **交互修正**：录事弹层每次打开都会回到请求的页签；表单不再预填示例值；「今日训练已完成」改由 `workoutCompletedToday` 判断，而不是拿 `sessionType === 'Rest'` 顶替。
9. **接口层为云后端做好准备**（详见第 4 节）：工厂切换 `repository.ts`、身份方法、`since` 时间窗、`RepositoryError` 类型化错误 + App 统一 `runMutation` 兜底与加载失败重试页、ID 改 `crypto.randomUUID()`、`HealthContext.now` 时钟注入（引擎不再读 `new Date()`）。
10. **UI 重构为编辑式手记风**（本轮）：中文古记事体章节（其一/其二/其三）、干支日期行、「记」印章刊头、桌面双栏独立成流 + 移动端同序、目录式点线条目、印章红/墨绿双色收进 `@theme` 令牌；参考稿与偏差见上文小节。
11. **文案整体改为古风行文**（本轮）：覆盖全部组件标签与按钮、Toast 与报错、记录表单与占位、当时稽核弹窗的结构标签、引擎推荐语与恢复指引、演示数据（待办/随笔/手记条目）；文献引文与规则 ID 按上述三例外保留，`tsc`、9/9 测试、`kill-ai-slop` 0 hits 均复验通过。
12. **去卡片堆砌、仿真古书纸张**（本轮）：撤除页面流全部卡片容器，纸底叠 SVG 纤维/斑驳噪点（无氛围渐变），全页入外粗内细版框；DOM 断言 9/9、两套测试全绿、扫描器 0 hits、截图复核通过。
13. **可读性 · 无障碍 · 按钮一致性优化**（本轮，用户 UI 评审后批准的方案）：
    - **对比度达标**：`ink3` `#8c8378→#6f675e`（3.28→4.89:1）、`ink4` `#a89f92→#736b61`（2.30→4.61:1）、`accent` `#15803d→#147a3a`（4.41→4.77:1）、`tier2` `#b45309→#a54d08`（4.42→5.04:1），新增 `--color-control #8f8574` 给复选框/输入框边框（≥3:1，WCAG 1.4.11）；阈值由新增的 `src/tests/contrast.test.ts` 锁定并接入 `npm test`。
    - **字号地板 12px**：源码内 `text-[11px]` / `text-[11.5px]` 清零（11px 仅留稽核弹窗的证据强度标签已同升 12px、规则 ID 等宽行按 README 体例保留），交互文字统一 13px。
    - **焦点与键盘**：`@layer base` 增加全局 `:focus-visible` 2px 墨环，15 处 `focus:outline-hidden` 全部移除；`本周之功` 分类行与训练动作行由 `<div onClick>` 改为 `<button>` + `aria-pressed`；复选框改「24px 热区 + 18px 可视」、1–5 分圆点改 `w-6 h-6`、图标按钮 `p-1.5`，行内删除按钮补 `focus-visible:opacity-100`。
    - **动作三级体系**：`btn-primary`（墨实心）/ `btn-ghost`（描边）/ `btn-link`（文字链）收进 `@layer components`，原绿色「依此录之」改墨黑；**绿只保留给状态**：勾选框、完成徽标、Toast 勾、达标句、状态词、体重折线与弹层状态点，章序「其一/其二/其三」与动作型文字链改墨。
    - **图表与行文**：体重图补动态 `aria-label`（真值 + 单位 + 次数）、图头补「公斤」、图下新增「最高 · 最低」轻标注；「近况」等手记行文只做排版强化（数字统一 `font-semibold tabular-nums`、分组线与间距统一），**未引入任何指标卡/进度条**（遵循去 dashboard 化决策）。
    - **验证**：`tsc` / `npm test`（含新对比度用例）/ `npm run build` 全绿；`.shots/shot.mjs` 1440 与 430 双档截图溢出探针 0，成稿见 `.shots/opt-desktop.png` / `.shots/opt-mobile.png`；`.shots/e2e.mjs` 录事流程（开层 → 存餐 → Toast → 空手记禁用提交）通过。

14. **奏折化改版：御批朱墨 + 版式重排 + 墨线计量条**（本轮，用户选定「皇帝批阅奏折」方向后批准的方案）：
    - **色组换到「其五 · 朱墨双色」**：`accent` 青竹绿 `#357a5c` → 朱批 `#a63a2b`（印章与状态同源、分工不同位），`danger` → 紫檀绛 `#7f1d1d`、`tier2` → 褐 `#7a5a2e`，浅调随朱重算（`#fbeee9` / `#f2d9d0` / `#fda4af`）；`contrast.test.ts` 全绿。
    - **统一章节头 `SectionHead`**：六处手写标题收敛为一个组件——眉行（章序＋右注，18px 定高）→ 26px 衬线题行 → 2px 墨线，并带**竖排朱批旁注**（`writing-mode: vertical-rl`，≤8 字、必须取自真实数据，窄屏降级为题下横排）。
    - **错位修复**：实测 1440 下三对章节横线原为 0 → 38 → 120px 漂移，行配对显式落位后 **0px**；390 下标题左缘原 88px vs 38px，现**全页一致 38px**；其二的浮空按钮行、其三被按钮挤碎的说明行，统一收进章末 `.section-actions` 动作脚注行（窄屏整行另起）。
    - **墨线计量条**：新增 `RuleMeter`（蛋白质 63/110 g、热量 1020/1950 千卡、本周抗阻 2/2、睡均 7.3/7 h）与生活纪事行内占比条；仍无 KPI 卡、无环形进度、无瓦片墙，比例仍以真实文本入句。
    - **御批文案**：成功回执冠「知道了 ·」、主确认「照准」、危险动作「掷还」、达标句改「合议 / 未合议 · 尚差二日」。
    - **验证**：新增 `src/tests/layoutContract.test.ts`（章节头唯一、组件禁裸 hex、行配对、旁批降级、动作脚注、御批文案契约）接入 `npm test`；四套测试 + `tsc` + `build` + `.shots/e2e.mjs` 全绿；`layout-probe.mjs` @1440/1024/768/390 溢出均为 0、横线同 y；成稿截图 `.shots/za-desktop2.png`、`.shots/za-mobile.png`。
    - **取舍**：右栏桌面次序按三行等高配对重排为「近况 / 生活纪事 / 身体近况＋体感」（移动端次序不变），理由与开放问题记在 `DESIGN.md`。

15. **数据语义系统重建（本轮，Raw → Derived → Decision → Presentation）**：
    - **单一事实来源**：新增 `src/domain/`（time / policy / tasks / nutrition / sleep / weight / training / activity / format / migrate），组件内业务算术清零（`presentationContract.test.ts` 锁定）；`TodayData` 改为「原始切片 + 派生指标 + 决策结果」三层结构。
    - **时间窗口**：唯一的 `DayContext`；「本周」＝周一 00:00 起（原为滚动 7 日），「近七日 / 近三十日」为滚动窗口，二者不再互相冒充；`WEEK_START/MONTH_WINDOW_START` 与各处 `new Date()` 全部移除。
    - **体重**：当日代表值（同日取最新）、`readingCount` 与 `daysWithRecords` 分开、**端点变化 ≠ 回归斜率**、`validateWeightMeasurement` 对偏离近七日均重的记录**只标待核**（例：57kg vs 66.8kg → 待核，预测暂阙），原始数据一字不改。
    - **睡眠**：`DailyState.sleep` 改为判别联合（区间 / 手录眠时），时长由时刻推得（00:55→08:15 = **7h20m**，与旧 `sleepHours 7.3` 的 7h18m 矛盾消失）；近七日均按有记录夜数报告（`1/7 夜有记录`），睡眠不再显示百分比。
    - **训练**：`WorkoutCategory` + `durationSource` 落库，「抗阻 2/2」只数**本周且 category==='resistance'**；`decideWorkoutMode` 纯函数产出 `{mode, reasons[]}`，页面「定为恢复（据：酸痛显著）」与规则句「酸痛 ≥4 或 精力 ≤2（眠不足 6 时亦然）则降为恢复」同源生成，消解「及四分」歧义；建议时长标「估算」，今日实际训练另列。
    - **饮食**：计划膳与实测入账分离（「计划之膳 · 未入今日所食」）；比例/余量/超额同源（`calculateNutritionProgress`），超出显示「已超 788.8 g」而非「尚余 0」；一键「照准」累计条数对外可见，越常度标朱批并提供「核今日所录（N）」逐条掷还。
    - **任务与手帐**：完成率只由 `status` 决定（今日之事 1/4），任务用时标「拟 45 分」不再冒充实际时长；手记与活动共用一张表但派生规则不同（文字计入近来手记条数、时长计入本周之功，可只计时长）。
    - **验证**：新增 `domain.test.ts` / `migration.test.ts` / `presentationContract.test.ts`（共 7 套测试）、`.shots/qa-states.mjs`（种子态与遗留异常态截图 + 文本断言）。旧 localStorage（57kg / 14159 千卡 / 0-4）经迁移后原样保留并被标记，实测页面出现「待核 / 已超 / 不出推演」。

16. **版式修剪：「共列网格 + 三级横线」，页面不再解释自己**（本轮）：
    - **一条中轴**：新增 `.inkrow`（`名 84px | 中列 1fr | 值 152px`，窄屏 `64|1fr|116`）把计量条与点线引导放进同一列——实测 1440/1024/390 下全页轨道的 `left/width/值列 left` **完全相等**（改前同一栏内相差最多 65px / 41px / 82px），值列右对齐且不折行（探针断言）。
    - **三级横线**：L1 `2px 墨`（章节题改为「外粗内细」双线呼应版框、刊头、页脚）／L2 `1px 实线`（章内分组、动作脚注）／L3 `1px 点线`（名录行分隔与引导线）；版式骨架里的 `border-linesoft` 清零，章节题下第一组不再压线（消除三层叠线）。
    - **页面不解释自己**：删去 21 处方法学与免责说明（`（据 30 个有效日做线性回归，非首末差值）`、`记录原样保留，仅标记待核`、`仅指达标比例，非健康度评分`、`情景外推（非承诺）`……），口径与阈值全部移入本文件「术语与口径」；模型出处移入「推演所据」面板。契约测试禁止这些词再回到页面。
    - **信息不减**：判定并入数值同行（`2/2 次 · 100% · 合议`）、体重均重与斜率合一行、「余/超」并入组标题行、待核压缩成一行朱批；章节行数由 11→8（身体近况）、20→11（近况）、10→6（体感）等（探针按章节设上限防反弹）。
    - **验证**：7 套测试 + `tsc` + `build` + e2e + `layout-probe --check` @1440/1024/390 全绿；探针新增「共列网格对齐 / 计量条同起同止 / 值列不折行 / 章节行数上限」四组断言。

17. **去冗：删掉自我说明与重复入口，补平版面留白**（本轮）：
    - **删冗余入口与注释**：刊头的「录一笔」（与右下 FAB 重复）、刊头副题「日省吾身」、页脚「存于本机 / 不假模型 · 规则可稽」、以及「缘由」按钮与其稽核弹窗（`EvidenceModal.tsx` 一并删除，痕迹仍在数据层 `nextMeal.trace` / `nextWorkout.trace`）；随删随清 `.btn-ghost`（动作降为 `.btn-primary` / `.btn-link` 两级）与 `repositoryKind` 导出；记录弹层标题简化为「录一笔」。
    - **补平留白**：左栏「其三」原本比右栏「身体近况 + 今日体感」矮 **258px**，形成一大块空白——现把「今日体感」改为**通栏一节**（四行事实两栏并置），三行配对余量回到 **24 / 14 / 13px**，页面总高略降（2807px）。
    - **顺手清理**：`repositoryKind`、`DecisionTrace`、`RecommendationEvidenceTrace`、`RuleStatus`、`HelpCircle`、`formatNightDuration`、`toPercent` 等随删随清的导入/引用（`tsc --noUnusedLocals` = 0）。
    - **验证**：7 套测试 + `tsc` + `build` + e2e + `layout-probe --check` @1440/1024/390 全绿；探针的对齐断言升级为「**同一轴内** 名/中/值三列全等」，通栏两栏并置也各自成轴。

18. **改造为「锻炼 + 体征 + 饮食」三域，并补齐「你是谁」**（本轮）：
    - **删除手记域**：`LifeLog`/`DailyNote`/`domain/activity.ts`/`LifeSection.tsx` 与「生活纪事 · 本周之功」「近来手记」「案头小记」全部移除，录事弹层由四签收为三签（进食/习练/体征）；生活纪事的分类时长与手记条数一并消失，锻炼次数改由 `WorkoutRecord` 自足统计。
    - **补齐建档**：新增 `UserProfile` 只留原始输入（性别/出生年/身高/活动水平/腰围/目标），年龄由出生年派生、体重只来自记录、目标热量与蛋白由派生得出——`dailyCalorieTarget`/`dailyProteinTarget` 两个常量与 `profile.currentWeight` 一并删除；新增「体征档」一节与「立档/改档」弹层。
    - **体型与处方**：新增 `domain/body.ts`（BMI + WHO 分类、腰围亚太判定、Mifflin-St Jeor、RMR×PAL）与 `domain/composition.ts`（建议方向、每日热量/蛋白、每周抗阻日数、目标速率），阈值集中到 `domain/policy.ts` 的 `TARGET_POLICY`；TDEE 不再用写死的久坐系数 1.15–1.25（旧 `f_energy_prior`/`f_TDEE` 删除），改由活动水平决定。
    - **诚实优先**：未建档时页面显示「未建档」且不出现任何人体数字，`f_meal` 直接返回 `unavailable` 并要求先建档；删除演示档案（种子只给记录），`migrateProfile` 不再与默认档案合并——空档案就是空档案。
    - **验证**：新增 `src/tests/body.test.ts`（BMI 边界 18.5/25/30、PAL、RMR/TDEE、目标与地板、建议相悖、处方、未建档路径），测试增至 **8 套**；e2e 改为「清空档案 → 未建档不显示人体数字 → 立档 → 派生出现 → 记录照常」；探针新增「配对行无大块留白（≤110px）」与「同一轴内三列全等」，1440/1024/390 全 PASS。
    - **部署**：新增 `supabase/schema.sql`（6 表 + 全表 RLS `auth.uid() = user_id` + 索引 + 越权自测）与 `docs/deploy.md`（静态版今天可上线；云端版缺口 1–6 逐条列出）。

19. **云端同步实作（Supabase，零新增依赖）**（本轮）：
    - **抽出共用组装层**：`src/services/todayAssembly.ts` 成为「原始记录 → TodayData」的唯一实现，`MockHealthRepository` 与 `SupabaseHealthRepository` 都只负责取数，两条路径不可能算出不同结果（契约测试断言逐字节相同）。
    - **零依赖直连**：新增 `src/services/supabaseRest.ts`（邮箱 magic link 发送/回跳/hash 换会话/到期前 60 秒自动续期/退出）与 `src/services/supabaseMappers.ts`（6 表行到域模型的映射，能吃 Postgres 的 numeric 字符串与 `HH:MM:SS`），从而**不需要 `@supabase/supabase-js`**，云端 `npm ci` 的确定性不被破坏。
    - **仓库实作**：24 个方法全部落地（含「同日体重走 PATCH 不新增事实」「档案 upsert」「删除同时限定 id 与 user_id」「云端拒绝复其初」）；未登录时一律抛 `RepositoryError('auth')`，**绝不静默返回空数据**。
    - **登录界面**：云端模式未登录时显示邮箱登录页（`src/components/SignIn.tsx`），静态版本不受影响。
    - **验证**：新增 `src/tests/supabaseContract.test.ts`（14 项：映射往返、**跨路径一致性**、magic link 端点与回跳、令牌刷新、错误码映射 401/403/404/409/5xx/断网、未登录抛 auth、写入语义），测试增至 **9 套**；`tsc`（含未用检查）+ `build` + e2e + 三档探针 + 扫描器全绿。
    - **排错**：`docs/deploy.md` 第 2 节给出 Supabase 配置、越权自测、环境变量、首次登录建档流程与 6 类常见故障对照。

20. **自用友好化：一键进入（匿名登录）+ 限流可见**（本轮）：
    - **没有登录页**：云端模式启动时**静默**建立本机身份（匿名登录，`POST /auth/v1/signup`，无邮箱无密码），用户只看得到闪一下「正在建立本机凭据…」；只有失败时才出现一句话提示，且按原因给修法（开关没开 / key 不对 / 网络不通）。邮箱登录退为失败提示里的备选出口。
    - **限流不再是一句 `unknown`**：429 映射为 `RepositoryError('rate_limited')`，页面给出「等约一小时 / 改用一键进入 / 配 SMTP」的可执行建议，并加 60 秒冷却，避免连点把小时额度耗光。
    - **未开启匿名登录时明确指路**：服务端返回 disabled → `not_implemented` + 提示去 Authentication 打开开关。
    - **身份安全规则**：`hasSession()` 区分「从未登录」与「有身份但失效」——前者可静默建立，后者只提示、**绝不静默换新身份**（否则会看到空账以为数据丢了）。
    - **顺带**：第三方登录授权地址与回跳解析就位（`authorizeUrl`，回跳令牌仍由 hash 接住），新增 3 项云端契约用例（匿名登录/未开启提示、授权地址、429 映射），云端用例增至 17 项。

### 仍待补齐（真实项目的下一步）

1. **工程配套**：无 ESLint/格式化、无 CI、无 E2E。
2. **数据持久化**：Supabase 后端仍为空壳（方法均 `throw`），数据只在 localStorage，换设备即丢失，也没有导出/备份入口。
3. **体积**：单包 451 KB（gzip 143 KB），未做代码分割。
4. **视觉回归**：本轮已具备截图级回归——headless chromium 对 `http://localhost:3000` 出 1440/430 两档截图与参考稿比对（`.shots/`），设计令牌对比度已有自动化阈值（`src/tests/contrast.test.ts`），版式现有 `src/tests/layoutContract.test.ts` 源码契约 + `.shots/layout-probe.mjs` 几何探针（章节横线同 y、标题左缘、溢出 0），但**像素级视觉回归仍靠人工看图**。

### 结论

这是一个**架构清晰、方法论克制、且已经把演示成分剥掉的健康手记**：科学证据 vs 工程启发式的边界讲得清楚，数据与日期真实，审计弹窗与引擎输出一致，测试全绿；视觉上经三轮去模板化重做成编辑式手记风（中文古记事体、双栏手排、古书版框与仿真纸纹、单张体重折线），并把与参考稿的差异逐条写明。剩下的是常规工程化工作——Lint/CI/E2E、真实后端与数据同步、体积优化。
