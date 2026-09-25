# 部署步骤（Cloudflare Pages + Supabase 免费档）

> 结论先说清楚：
> **① 静态演示版现在就能部署**（零配置、本机 localStorage、无需后端）。
> **② 云端同步版还差一步**：`SupabaseHealthRepository` 是**故意保留的 fail-fast 壳**
> （24 个方法全部抛 `not_implemented`，绝不静默返回空数据），需要补实作 + 安装官方客户端。
> 下面两节分别给出可直接照做的步骤，以及第 ② 节的缺口清单。

---

## 一、静态版部署（今天就能上，推荐先跑这一步）

### 1. 本地验证（部署前必做）

```bash
npm ci                 # 或 npm install
npm test               # 8 套测试：audit / journal / contrast / domain / body / migration / presentation / layout
npx tsc --noEmit       # 类型
npm run build          # 产物在 dist/
```

预期：8 行 `ALL ... PASSED`、`tsc` 无输出、`dist/` 生成为静态文件（≈470 KB / gzip ≈150 KB）。

### 2. Cloudflare Pages

| 配置项 | 值 |
|---|---|
| 连接方式 | 连接 Git 仓库（推荐）或 `wrangler pages deploy dist` 直传 |
| Framework preset | **None**（或 Vite，二者皆可） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node 版本 | 18 或 20（环境变量 `NODE_VERSION=20`） |
| 环境变量 | **留空即可**（静态版不需要任何变量） |

> 没有后端、没有路由、没有服务端函数：产物是纯静态 `index.html + assets/`，单页应用无子路由，
> 因此**不需要** SPA 回退规则，也不需要 Workers/Pages Functions。

### 3. 部署后自查

1. 打开域名，刊头出现「个人健康手记」与今日干支日期。
2. 首次进入应为 **体征档 · 未建档**（演示数据只有记录，不含任何人的身高/性别/年龄）。
3. 点「立档」填 性别 / 出生年 / 身高 / 活动水平 /（可选）腰围 / 目标 → 保存后出现
   体重指数、静息代谢、总消耗、每日热量与蛋白、每周抗阻——即「该减该守该增、吃多少、练几次」。
4. 记一笔（进食 / 习练 / 体征）各录一次，刷新后数据仍在（localStorage）。
5. 说明：静态版数据**只在这台设备的这个浏览器里**，清缓存即丢；要跨设备请走第二节。

---

## 二、云端同步版（Supabase 免费档）

### 1. 建库

1. Supabase 新建项目（免费档即可）。
2. **SQL Editor → New query**：粘贴并执行本仓库的 `supabase/schema.sql`（一次到位）。
   它建 6 张表：`profiles / weight_records / daily_states / meals / workout_sessions / todos`，
   并对每张表开启 RLS + 只允许 `auth.uid() = user_id`。
3. **Authentication → Providers → Email**：开启；把 **Confirm email** 与
   **Site URL / Redirect URLs** 设为你的 Pages 域名（magic link 会跳回该域名）。
4. **Project Settings → API**：复制 `Project URL` 与 `anon public key`。

### 2. RLS 越权自测（上线前必做，5 分钟）

```bash
# 用 A 账号（含其 access_token）写一条体重记录后，用 B 账号的 token 读：
curl "$PROJECT_URL/rest/v1/weight_records?select=*" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $B_ACCESS_TOKEN"
# 期望返回 []。若返回 A 的数据 → RLS 未生效，停止部署并检查 schema.sql 的 policy 段。
```

### 3. Pages 环境变量

| 变量 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key（**公开键**，安全边界在 RLS，不在这个 key） |

页面里的错误提示已为此准备好：若两项填了但客户端未装/未实作，界面会明确显示
「云库（Supabase）既配而后端之法未通」，**不会**给出一个看起来正常的空应用。

### 4. 还差什么才能开云端版（缺口清单）

| # | 缺口 | 具体做法 |
|---|---|---|
| 1 | 官方客户端 | 在能联网的机器上 `npm i @supabase/supabase-js`（本机沙箱把 npm 缓存设为只读，未能安装；**代码里目前没有任何 supabase 依赖，也没有半成品调用**） |
| 2 | 实作 `SupabaseHealthRepository` | 替换 `src/services/supabaseHealthRepository.ts` 的 24 个 `this.fail(...)`；行到域模型的映射见 `supabase/schema.sql` 的列名（snake_case 对 `src/types/health.ts`） |
| 3 | 认证界面 | 邮箱 magic link 登录/登出（`signInWithOtp` / `onAuthStateChange`），未登录时显示登录页 |
| 4 | 计算位置 | **不需要搬到服务端**：统计全部由 `src/domain/` 纯函数在浏览器现算（免费档无 server tier，这正好与现有架构一致） |
| 5 | 旧数据 | 可选择一次性把本机 localStorage 的记录导入云端（按 `user_id` upsert）；演示种子只在无云配置时使用，云端**永不自灌演示数据** |
| 6 | 免费档注意 | 500 MB 库 / 5 GB 带宽 / 50k MAU；单用户数据量极小。写放大来自误触「照准」连点——已由数据质量标记（`needs_review`）+ 逐条「掷还」+ 同日体重去重兜住 |

> 也就是说：**第一节今天可上线**；第二节在补完上表 1–3 之后即可上线，数据库侧（表/RLS/索引）已经齐备。

---

## 三、两条路径的差异一览

| 维度 | 静态版（MockHealthRepository） | 云端版（SupabaseHealthRepository） |
|---|---|---|
| 数据位置 | 浏览器 localStorage（`phc_*_v3`） | Postgres（RLS 隔离到 `auth.uid()`） |
| 跨设备 | 否 | 是（同一邮箱账号） |
| 登录 | 无 | 邮箱 magic link |
| 计算 | 浏览器 `src/domain/` | 同左（一致） |
| 演示数据 | 首次进入带记录（不含任何人的体征档） | 不灌演示数据；首次进入即「未建档」→ 立档 |
| 需要环境变量 | 否 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| 迁移 | 读旧形态时自动升级字段（`src/domain/migrate.ts`，只补表单不改数值） | 同左（本地→云端需第 4 节可选导入） |
