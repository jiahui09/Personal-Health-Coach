# 数据语义审计 · 个人健康手记

> 本文件是本仓库「哪个数字由谁算出来」的权威说明。改页面之前先读它；改完域层公式必须同步更新它。
> 术语：**Raw**（用户/设备实际记录）→ **Derived**（由 Raw 派生）→ **Decision**（Derived + Policy）→ **Presentation**（文案）。

- 审计日期：2026-09-25
- 审计方式：只读代码与运行时行为（未据页面文字臆测存储结构）；几何/文本以 headless chromium 实测为准
- 相关文件：`src/domain/`（派生与决策）、`src/types/health.ts`（数据契约）、`src/services/mockHealthRepository.ts`（唯一的聚合点）、`DESIGN.md`（设计契约）

---

## 1. 结论摘要

修订前页面存在 16 类数据语义缺陷，其中 4 类会直接误导用户：

1. **一条异常体重（57kg）驱动了全部体重结论**：7 日均重 66.8、斜率 1.22kg/周、四周后 52–52.7 全部由它外推，且页面没有任何提示。
2. **今日睡眠被当成七日平均**：`recentStats.avgSleepHours = dailyState.sleepHours`，而 `DailyState` 只有今天一条，根本不存在历史。
3. **「本周」实际是滚动 7 日**：`WEEK_START = daysAgo(6)`；且抗阻统计没有 `category` 字段，所有运动都算抗阻。
4. **「尚余 0」掩盖了 726% 的超额**：`Math.max(target - consumed, 0)` 把超出信息抹掉。

修订后：所有数字由 `src/domain/` 的纯函数派生，异常只标记不改数，计划/预测/实测三者分离。

---

## 2. 页面数字来源对照（修订前 → 根因 → 修订后）

| 页面数字 | 修订前来源 | 根因 | 修订后 |
|---|---|---|---|
| 今之体重 57 | `latestWeightRecord`，无校验 | 缺质量校验，异常值直接进趋势/预测 | `weightSummary().latest`（当日代表值）+ `validateWeightMeasurement()` 标记待核 |
| 已录 30 次 | `weightSeries.length`（`slice(-30)`） | 截断上限冒充记录数 | `readingCount`（原始条数）与 `daysWithRecords`（有效日数）分列 |
| 三十日轻 12.3 公斤 | `current - 窗口内首条` | 端点差与趋势混称「渐降」 | `endpointChangeKg`（首末差）独立字段；文案注明非趋势 |
| 七日均重 66.8 | `weightHistory.slice(-7)` 取均值 | 7 条**记录**当 7 **日**；history 未排序 | `rollingMean7d`：近 7 个**自然日**的每日代表值均值，并报告 `rollingMean7dDays` |
| 平缓下行 1.22 kg/周 | 21 点 OLS × 7 | 窗口按点数；含异常点 | `trendKgPerWeek`：近 30 日有效日回归 × 7，报告 `trendDays` |
| 四周后 52–52.7 | `current + slope*4*0.95 ± 0.35` | 伪精确、无出处、无门槛 | `WeightForecast` 带 `modelVersion`/`method`/`basedOnDays`/`withheld`；异常即暂阙 |
| 近七日睡均 7h18m | `dailyState.sleepHours` | 今日一条冒充七日平均 | `sleepSummary().avgMinutes`，按有记录夜数平均并报告 `nights/windowDays` |
| 7h18m vs 00:55→08:15 | `sleepHours` 与 `sleepBedtime/sleepWakeup` 三字段独立 | 表单只写 `sleepHours`，时刻永远停在旧值 | `DailyState.sleep` 判别联合，时长由时刻推得（**7h20m**） |
| 抗阻 2/2 · 100% | 滚动 7 日内全部 completed | 无 `category`；「本周」定义错误 | `resistanceProgress()`：`ThisWeek` + `category === 'resistance'` |
| 899/110g · 14159/1950kcal | 今日 `MealRecord` 直接累加 | 一键「照准」无上限无去重无提示 | 同源 `calculateNutritionProgress`；越常度标朱批并可逐条掷还 |
| 尚余 0g / 0kcal | `Math.max(target-consumed, 0)` | 超出信息被抹掉 | `remaining` 与 `over` 并列，超出显示「已超 788.8 g」 |
| 10.8 时 | 各分类先四舍五入到 0.1 时再求和 | 先圆整后求和 | —（生活纪事域已在三域改造中删除,页面不再出分类时长） |
| 近七日 5 条 | `this.lifeLogs.length` | 完全未按日期过滤 | —（`journalSummary` 已随生活纪事域删除,页面不再出手记条数） |
| 0/4 | App 与 TodayTasks 各算一次 | 同一事实两处派生 | `calculateTaskProgress()` 全站唯一入口 |
| 45 分 | `todo.estimatedMinutes` | 计划用时按实际时长样式呈现 | 标「拟 45 分」，并注明未记实际用时 |
| 今日之练 12 分钟 | 推荐函数的 `durationMinutes` | 估算当实际 | `WorkoutRecommendation.durationSource = 'estimated'`；今日实际训练另列 |
| 及四分，则降为恢复 | 硬编码文案 | 「四分」指哪一项不可判 | `decideWorkoutMode` + policy 生成「酸痛 ≥4 或 精力 ≤2 则降为恢复；眠不足 6 或精力、酸痛居中则降为轻量」（体感未录且眠足 → 常规并如实标注,未录不放行短眠） |
| 渐降 / 抗阻合议 | `monthDelta<0` / `workoutsThisWeek>=2` | 组件内比较 | `WeightSummary.direction` / `ResistanceProgress.met` |

---

## 3. 数据源分层清单

### Raw（只增不改的事实）

| `UserProfile` | `sex, birthYear, heightCm, activityLevel, waistCm?, goal` | **只有原始输入**：年龄由出生年派生、体重只来自记录、目标热量/蛋白由派生得出。这些是**不随时间变化的固定之数**：录一次即随手记名绑定（云端 `profiles.user_id` / 本机同一档），未建档时首屏出「立档」之请、建档后入口自去 |
| 类型 | 关键字段 | 说明 |
|---|---|---|
| `WeightRecord` | `date, time?, weight, source` | 同日可多条；`date` 是唯一窗口字段 |
| `MealRecord` | `date, time, category, estimatedCalories, estimatedProtein, source, confirmed` | 实际摄入；计划膳不在此表 |
| `WorkoutRecord` | `date, durationMinutes, durationSource, category, completed` | 类别是结构化事实 |
| `DailyState` | `date, sleep?, energy?, soreness?, notes?` | 字段可缺席（未录 ≠ 默认值） |
| `TodoItem` | `date, title, estimatedMinutes, status` | `estimatedMinutes` 是计划 |
| `UserProfile` | `goal, dailyCalorieTarget, dailyProteinTarget, …` | `currentWeight` 仅作引擎入参缓存，页面不读 |

### Derived（`src/domain/`，纯函数，无 React/无时钟/无 IO）
`TaskProgress`、`WeightSummary`（含 `DailyWeightPoint[]`）、`NutritionSummary`、`SleepSummary`、`TrainingSummary.resistance`、`BodySummary`（BMI/腰围判定/RMR/TDEE）、`NutritionTargets`（每日热量与蛋白）。

### Decision（Derived + Policy）
`WorkoutDecision{mode, reasons[]}`、`DataQuality{flag, reasons[], detail, comparison}`、`WeightForecast{method, modelVersion, basedOnDays, withheld}`、`WeightGoalAdvice{direction, reasons[], conflicting}`（建议减/守/增）、`TrainingTarget{resistanceDaysPerWeek, sessionMinutes}`。

### Presentation
组件与 `src/services/decisionCopy.ts`（`WORKOUT_REASON_CN`、`describeTrainingPolicy`、`describeWorkoutDecision`）、`src/utils/calendar.ts`（干支/星期/时段问候）。

---

## 4. 数据关系（Entity → Entity）

```
DayContext(now)
  +-- Task[]              -> TaskProgress
  +-- ActivityLog[]       -> ActivitySummary（本周：分钟/次数/占比）
  |                       -> JournalEntry[]（有文字）-> JournalSummary
  +-- MealLog[]           -> NutritionSummary（比例/余量/超额/质量）
  +-- BodyWeightRecord[]  -> WeightSummary（最新/条数/日数/端点/斜率/质量）
  +-- DailyState[]        -> SleepSummary（今日 + 近七日均）
  |                       -> Wellbeing(energy/soreness)
  +-- WorkoutSession[]    -> ResistanceProgress（本周抗阻/目标）
                          -> TrainingSummary

DailyWellbeing + SleepSummary + WorkoutSession[] -> decideWorkoutMode -> WorkoutDecision
WeightSummary + Policy                           -> validateWeightMeasurement -> DataQuality
WeightSummary + Policy                           -> f_weight_forecast -> WeightForecast(情景外推)
MealRecommendation（计划）-- 不自动进入 --> MealLog（只有「照准」才写入）
```

---

## 5. 时间窗口规范（`src/domain/time.ts`）

| 窗口 | 定义 | 用于 |
|---|---|---|
| Today | `[今天 00:00, 明天 00:00)`（本地日键） | 今日任务、今日饮食、今日训练、今之体重、今日体感、今日睡眠 |
| ThisWeek | 周一 00:00 → 周日 23:59:59.999（ISO 周） | 抗阻 N/目标、本周已完成次数与训练量（`f_training_volume` 同窗） |
| Last7Days | 滚动七日（今天 + 前六日） | 七日均重、近七日睡均、异常偏离参照 |
| Last30Days | 滚动三十日（今天 + 前廿九日） | 端点变化、回归斜率、记录条数与有效日数 |

**规则**：一切窗口判定走 `isInWeek / isInLast7 / isInLast30`；组件不得自行加减天数或读时钟；文案的「本周」「近七日」由 `WINDOW_CN` / summary 的 `windowLabel` 提供，不能互换。

---

## 6. 计算公式

| 指标 | 公式 | 位置 |
|---|---|---|
| 任务完成率 | `completed / total`，`total = count(status !== 'skipped')`，`completed = count(status === 'done')` | `domain/tasks.ts` |
| 当日代表值 | 同一 `date` 取 `time` 最大的一条（缺 `time` 视为唯一） | `domain/weight.ts` |
| 近七日均重 | `Σ(每日代表值) / 有记录日数`（近 7 自然日内） | `domain/weight.ts` |
| 三十日端点变化 | `lastDailyRep.weight − firstDailyRep.weight`（近 30 日内首末**有效日**） | `domain/weight.ts` |
| 三十日趋势 | `OLS(dailyReps, x = 距首日天数) × 7` → kg/周 | `domain/weight.ts` |
| 偏离度 | `latest − 留一基线`；基线 = 近 7 日均值**剔除自身**后的其余各日均值（`(Σ−latest)/(n−1)`，n<2 回落至均值，免得自己稀释自己的异常）；`|偏离| > max(1.5kg, 基线×2%)` → `needs_review` | `domain/weight.ts` |
| 营养比例 | `consumed / target`（`target ≤ 0` → 比例 0） | `domain/nutrition.ts` |
| 营养余量 | `max(target − consumed, 0)` | 同上 |
| 营养超额 | `max(consumed − target, 0)` | 同上 |
| 营养状态 | `target ≤ 0` → `no_target`（未立目标：不判达标、不判超额）；否则 `over / under / met` | 同上 |
| 睡眠时长（区间） | `(wakeMinutes − startMinutes + 1440) mod 1440`；两刻相同推得 0 分 → 不计为一夜 | `domain/sleep.ts` |
| 睡眠均值 | `Σ(夜时长) / 有记录夜数` | `domain/sleep.ts` |
| 抗阻完成率 | `count(ThisWeek ∧ completed ∧ category==='resistance') / decideTrainingTarget({direction, goal, activityLevel}).resistanceDaysPerWeek`（个性化 2–4 日；`policy.weeklyResistanceTarget` 为缺省下限） | `domain/training.ts` |
| 情景区间 | `latest + trendKgPerWeek × weeks × damping[weeks] ± spread[weeks]`；质量不达标 → `withheld` | `services/scientificRules.ts` |

---

## 7. 政策与阈值（`src/domain/policy.ts` 唯一出处）

| 政策 | 值 | 出处 |
|---|---|---|
| `TRAINING_POLICY.lowEnergyMax` | 2 | 工程启发式 |
| `TRAINING_POLICY.highSorenessMin` | 4 | 工程启发式 |
| `TRAINING_POLICY.shortSleepHours` | 6 | 工程启发式 |
| `TRAINING_POLICY.weeklyResistanceTarget` | 2 | WHO 2020（每周 ≥2 日抗阻）；实际处方由 `decideTrainingTarget` 依目标与活动水平给 2–4 日 |
| `SLEEP_POLICY.targetMinutes` | 420 | AASM 2015（每晚 ≥7 时） |
| `WEIGHT_POLICY.rollingAvgDays / trendWindowDays` | 7 / 30 | 工程设定 |
| `WEIGHT_POLICY.anomalyAbsKg / anomalyRatio` | 1.5kg / 2% | 工程启发式 |
| `WEIGHT_POLICY.minDaysForTrend` | 3 | 工程设定（不足即「数据不足」） |
| `WEIGHT_POLICY.directionThresholdKgPerWeek` | 0.2 | 工程启发式（日重与水钠波动的噪声带,以内读作「持平」） |
| `NUTRITION_POLICY.overRatioReview` | 2.0 | 工程启发式（越 2 倍即提示核对） |

训练决策顺序（`decideWorkoutMode`，纯函数）：
1. 今日已练 → `rest`（原因 `workout_completed_today`）
2. 精力与酸痛**皆未录** → 眠不足 6 时：`light`（原因 `short_sleep` + `no_wellbeing_record`——短眠是客观事实，不因未录体感被放行成常规课）；眠足：`normal`（原因 `no_wellbeing_record`，**不猜**）
3. `soreness ≥ 4` 或 `energy ≤ 2` → `recovery`
4. 眠 < 6 时 / `energy === 3` / `soreness === 3` → `light`
5. 其余 → `normal`（原因 `ready`）

**体重不在该函数入参内**：异常体重不可能影响训练决策。

---

## 8. 存储迁移规则（`src/domain/migrate.ts`，只升级形态、不改数值）

| 旧形态 | 新形态 |
|---|---|
| `DailyState` 单对象 | `DailyState[]`（按 `date` upsert，保留历史才能算近七日均） |
| `sleepHours` + `sleepBedtime` + `sleepWakeup` | `sleep` 判别联合：有就寝/起身 → `interval`；只有眠时 → `duration(minutes = round(hours×60))`；皆无 → 不写 |
| `TodoItem.completed: boolean` | `status: 'done' \| 'todo'`（`skipped` 保留） |
| `WorkoutRecord` 无类别 | `category = 'resistance'`（存量皆为徒手循环）、`durationSource = 'estimated'`（时长系手填估算） |
| `MealRecord` 无来源 | `source = 'manual'`、`confirmed = true` |
| `LifeLog.content: string` | `content?: string`（允许只计时长） |
| `WeightRecord` 无来源 | `source = 'manual'` |

迁移是窄范围、带注释、测试覆盖的兼容兜底（`src/tests/migration.test.ts`）：空数组仍视为「用户删空」，不会重新播种。

---

## 9. 验证证据

| 门槛 | 结果 |
|---|---|
| `npm test`（12 套） | scientificAudit / journalContract / contrast / domain / body / migration / supabaseContract(17) / refreshPolicy / presentationContract / accountGate / mobileNav / layoutContract 全通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过（537 KB / gzip 170 KB） |
| 浏览器端到端（收尾前最后跑） | 未建档不出人体数字 → 立档后 BMI/代谢/目标出现 → 食物库搜选回填（明细克数与 `estimatedFatG` 落库）→ 体征由时刻推得 7h20m、异常体重二次确认后**原样保存**并标待核 → 页面无方法学文案、同轴计量列全等 |
| 版式几何探针 @1440/1023/768/640/390 | 全 PASS（配对行横线同 y、诸头左缘一致、同轴三列全等、溢出 0） |
| 账号门冒烟 7/7 | 云端无标记必落「手记名」门（单输入、无密码无邮箱无标签）：无「同步到我的账号 / 继续上次合并 / 匿名」、无标记不出正文；写假 URL 下提交 → 就地 `role=alert`「连不上 Supabase」，输入不丢、不放行，且告警出现时输入框与按钮**零偏移**（告警收在按钮之下、卡片顶部锚定）；本机（mock）模式不出账号门 |
| 零偏移探针 3/3（本机）| 录体征表睡眠两式互切、录事表空名之戒出现、任务勾选等状态切换：标题/预览/提交按钮的包围盒逐一复测，坐标全等（见版式几何探针行的同款 CDP 量法） |
| 首用立档与水墨按钮探针 19/19 | 未建档首屏即见「立档」之请（无须滚动、文案明示固定数据录一次随手记名长存,入口不止一处）→ 点「立档」落墨后档案表照常开 → 存毕首屏之请自去、人体数字出现；页内动作（照准/毕此一练/录之）= 纸底**无描边**轻按钮非实墨块;柔光随指针（--mx/--my）、墨迹自落点铺满按钮（offset 尺寸 ≥ 按钮、噪点滤镜、动画毕自除）、键盘激活同有落墨且不误触业务、控制台记「墨已落纸」 |
| 遗留态检查 | 注入遗留异常态（57kg / 33 条建议膳 / 旧 `sleepHours`）后：页面出现「待核 · 已超 · 不出推演」，今之体重仍为 **57**（未被改写） |
| 云端录入失败根因（本机 PostgreSQL 18 实证） | 老 `schema.sql` 双错：① 六表 `user_id` 外键引 `auth.users`——手记名标记不在其表,立档等一切写入撞 **23503**；② `alter table if not exists` 非法,`training_minutes_budget` / `meals.fat_g` / `meals.items` **从未建成**（立档再撞 400） | `schema.sql` 去外键 + 幂等补丁段（drop constraint if exists）+ 修正 ALTER：老库迁移与全新库重跑均 **0 ERROR**,立档 upsert 合并为 1 行、五条写入路径全绿；`verify-supabase.mjs` 新增「写入路径」探针（写进 → 读出 → 删净,失败即给出重跑全文的处置） |
| 云端写路径端到端探针 16/16（PostgREST 仿真层,`cloud-mode vite + .shots/cloud-write.mjs`） | 账号门开册后读路径全带 `user_id=eq.<标记>`（12 条落账）→ 立档 upsert 齐 `on_conflict=user_id` + `merge-duplicates` + `application/json` + apikey/Bearer,回执行含生成 id 与 `training_minutes_budget` → 录之一事 insert 落库、回执「此事已列入今日之册」→ 注入老外键 409 → 失败 toast **对症**「添事未成 · 云库结构未更新 · 到 SQL Editor 全文重跑 supabase/schema.sql 后重试」,表不收、字不丢、未落库 → 恢复后重录即成;全程无未预期 console 错、仿真层零 5xx |

---

## 10. 数据路径（本地与云端）

- 唯一组装点：`src/services/todayAssembly.ts` 的 `assembleToday(snapshot, now)` —— 输入是六种原始记录，输出是整个 `TodayData`。
- 本地：`MockHealthRepository` 读 localStorage 后调用它；云端：`SupabaseHealthRepository` 取 PostgREST 行、经 `supabaseMappers` 映射为域模型后调用**同一个**函数。
- 因此两条路径的统计口径不可能分叉；`src/tests/supabaseContract.test.ts` 用同一批记录分别走两条路径，断言产出逐字节相同。
- 云端身份：**手记名即账号**（`src/services/accountMarker.ts` 确定性派生 `user_id`，同名同册）；标记存本机 `phc_account_v1`，无令牌、无续期、无 GoTrue、无密码与邮件验证。无标记时数据方法抛 `auth`，页面停在账号门而不是空数据。
- 身份与归属：每行数据都有 `user_id` 归属标记，策略只强制「行必须带标记」（`using (true) with check (user_id is not null)`）；**没有标记就没有归属**，所以云端无标记时只显示账号门（`src/components/AccountGate.tsx`），写下手记名之后才读写。如实说明：隔离只到「标记」这一层、不设防（见 `docs/deploy.md` §2）。
- 多端同步的时效：切回页面/窗口重获焦点自动重取，判定在 `src/services/refreshPolicy.ts` 的纯函数 `shouldAutoRefresh` 里——页面可见、无阻塞（弹层、未落定的写入、首屏载入）、距上次超过 15 秒三者齐备才发请求；**没有轮询、没有 Realtime 订阅**。

## 11. 版面与文案纪律（与数据层的分工）

- 页面只呈现**事实 + 一句短批**：方法学、阈值理由、模型出处一律不进正文（README「术语与口径」与「推演所据」面板承接）；刊头不重复「录一笔」、页脚不写「存于本机 / 不假模型」之类自我说明，决策痕迹留在数据层。
- 所有统计行走 `.inkrow` 共列网格（名｜中列｜值），计量条与点线引导同列 → 全页同起同止；`.inklist-row` 只保证首尾对齐。
- 线条三级：L1 2px 墨（章节题双线/刊头/页脚）、L2 1px 实线（分组、动作脚注）、L3 1px 点线（名录行、引导线）。
- 可执行门槛：`src/tests/layoutContract.test.ts`（禁方法学文案、禁 linesoft 骨架、双线章节题、配对行与章节行数上限）；几何探针与浏览器脚本已随收尾整理移出仓库。

## 12. 遗留与开放问题

- `UserProfile.currentWeight` 仍是「最近一次测量」的缓存（供引擎入参）；页面显示已全部改读 `WeightSummary.latest`，但字段本身尚未移除。
- 预测尚未落库为 `WeightPrediction` 记录，因此「上周推演 vs 本周实测」的误差复验（spec §9）只做了纯函数与出处标注，未做持久化复盘。
- 阈值目前全部是工程启发式（除 WHO/AASM 两项），`evidenceStatus` 已在决策结果中标注，尚未在页面上逐条展示证据等级。
- 账号与同步的**明确不做**：JSON 导出/备份、Realtime/轮询、旧本机（匿名）记录的抓取与合并、静态（mock）模式的多端同步——静态模式只存本机 localStorage，页脚仍是「复其初」。**也不做密码、邮件验证与一切 GoTrue 会话**：账号只是归属标记（本轮决策「简化账号系统」）。
- 本机存储选项与「登录时询问后合并」已删除：云端只认该手记名下数据，不再抓取 / 搬运旧的本机记录。
