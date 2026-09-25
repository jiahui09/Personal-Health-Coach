# 部署步骤（Cloudflare Pages + Supabase 免费档）

> 结论先说清楚：
> **① 静态演示版现在就能部署**（零配置、本机 localStorage、无需后端）。
> **② 云端同步版还差一步**：`SupabaseHealthRepository` 是**故意保留的 fail-fast 壳**
> （24 个方法全部抛 `not_implemented`，绝不静默返回空数据），需要补实作 + 安装官方客户端。
> 下面两节分别给出可直接照做的步骤，以及第 ② 节的缺口清单。

---

## 零、用 Cloudflare「Connect Git」部署：先做三件事（否则构建会失败）

我已在仓库里替你处理好其中两件，你需要做的就是**提交并推送**：

| # | 事项 | 现状 |
|---|---|---|
| 1 | **提交 `package-lock.json`** | 之前只存在于你本机（未跟踪）。没有它，云端 `npm ci` 直接报错 | 
| 2 | **删除过期的 `bun.lock`** | 它的包名还是旧的 `react-example`；Cloudflare 会按锁文件**优先选 Bun**，等于把你放到一条没验证过的安装路径上。已删 |
| 3 | **固定 Node 版本** | `vite@8` 要求 `^20.19.0 || >=22.12.0`。已加 `.nvmrc = 22.12.0`，Cloudflare 会读它（或在面板设 `NODE_VERSION=22.12.0`） |

```bash
# 关键：这四项必须落在同一个提交里,否则云端要么选错包管理器、要么 lock 与 package.json 对不上
git add package.json package-lock.json .nvmrc docs/deploy.md
git rm --cached bun.lock   # 从版本库移除（该文件其实是改名的 npm 锁,不是 Bun 锁）
git rm --cached wrangler.jsonc   # Pages 路径不需要；若走 Worker 路径见下方路径 B 再放回
git commit -m "fix(deploy): 移除 bun.lock 与 Worker 专用配置,提交与锁一致的 package.json"
git push origin main
```

> **为什么必须一起提交**：Cloudflare 按锁文件选包管理器 —— 只要 `bun.lock` 存在，它就跑
> `bun install --frozen-lockfile` 并**拒绝改写**该文件；而本仓库那份 `bun.lock` 的
> `lockfileVersion` 是 2（npm 格式），Bun 解析直接失败。同理，`package-lock.json` 与
> `package.json` 的依赖表必须完全一致，否则 `npm ci` 也会拒绝安装。

> 顺带提醒：你的 `package.json` 里有 `@opennextjs/cloudflare`（**只用于 Next.js**，本项目是纯 Vite 单页）。
> 它不会让构建失败，但可能让 Cloudflare 的框架探测误判成 Next.js —— 面板里**务必手动把 preset 选成 None 或 Vite**。
> 想彻底清掉：`npm uninstall @opennextjs/cloudflare && git add -u && git commit -m "chore: drop next-only dep"`。

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

### 2. Cloudflare 面板设置（Connect Git）

**路径 A：Workers & Pages → Create → Pages → Connect to Git（推荐）**

| 配置项 | 值 |
|---|---|
| Repository / Branch | `jiahui09/Personal-Health-Coach` / `main` |
| Framework preset | **None**（若下拉里没有 None，选 **Vite**；**不要**选 Next.js） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空（仓库根就是项目根） |
| 环境变量 | `NODE_VERSION` = `22.12.0`；`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` **留空** |

> ⚠️ **两个环境变量现在千万不要填**：一旦填了，应用会切到尚未实作的云库壳，页面会显示
> 「云库（Supabase）既配而后端之法未通」。静态版必须留空。

**路径 B：面板给的是 Worker（新版 UI 有时如此）**

先用 Pages 跑通（本仓库默认不含 wrangler 配置），确实要走 Worker 时再加回 `wrangler.jsonc`：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "personal-health-coach",        // 必须与面板项目名一致
  "compatibility_date": "2026-09-25",
  "assets": { "directory": "./dist", "not_found_handling": "single-page-application" }
}
```

| 配置项 | 值 |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| 环境变量 | `NODE_VERSION` = `22.12.0` |

> 注意：Pages 项目**不要**放这个文件 —— 它会让 Pages 去读 Beta 版 wrangler 配置并打出
> 「does not appear to be valid」的警告（见下方排错）。Pages 的输出目录在面板里设即可。

> 两条路径都不需要 SPA 回退规则以外的任何服务端代码：产物是纯静态 `dist/`。

> 没有后端、没有路由、没有服务端函数：产物是纯静态 `index.html + assets/`，单页应用无子路由，
> 因此**不需要** SPA 回退规则，也不需要 Workers/Pages Functions。

### 3. 部署后自查（首次务必逐条过）

1. 打开域名，刊头出现「个人健康手记」与今日干支日期。
2. 首次进入应为 **体征档 · 未建档**（演示数据只有记录，不含任何人的身高/性别/年龄）。
3. 点「立档」填 性别 / 出生年 / 身高 / 活动水平 /（可选）腰围 / 目标 → 保存后出现
   体重指数、静息代谢、总消耗、每日热量与蛋白、每周抗阻——即「该减该守该增、吃多少、练几次」。
4. 记一笔（进食 / 习练 / 体征）各录一次，刷新后数据仍在（localStorage）。
5. 浏览器控制台无报错；`Network` 里没有指向 `supabase.co` 的请求（静态版不该有）。
6. 说明：静态版数据**只在这台设备的这个浏览器里**，清缓存即丢；要跨设备请走第二节。

### 4. 之后每次部署

- 推送到 `main` → 自动生产部署；推送到其他分支 / PR → 自动预览部署（预览域名可单独验证再合并）。
- 回滚：Cloudflare 面板 → Deployments → 选中上一个成功的部署 → **Rollback**（秒级，无需重新构建）。
- 自定义域：`Custom domains` 里添加；本应用无服务端,无需调整任何回源设置。

---

## 一·补、构建失败排错（按日志报错对号入座）

| 日志 | 根因 | 处置 |
|---|---|---|
| `Installing project dependencies: bun install --frozen-lockfile` 然后 `Unknown lockfile version` | 仓库里还有 `bun.lock`（且它是 npm 格式的锁文件），Cloudflare 按锁文件优先选 Bun | 从版本库删除 `bun.lock`，只保留 `package-lock.json` |
| `npm ci ... can only install packages when your package.json and package-lock.json are in sync` | `package.json` 与锁不在同一个提交里 | 两者一起提交（依赖表必须一致） |
| `Found wrangler.json file ... does not appear to be valid` | Pages 项目里放了 Worker 用的 `wrangler.jsonc` | 删掉它（Pages 的输出目录在面板设置） |
| `You are using Node.js 18.x. Vite requires Node.js version 20.19+ or 22.12+` | 面板没读 `.nvmrc` | 环境变量加 `NODE_VERSION=22.12.0` |
| 页面显示「云库（Supabase）既配而后端之法未通」 | 误填了 `VITE_SUPABASE_*` | 静态版把这两个变量清空后重新部署 |
| 部署成功但白屏 | 输出目录填错（未指向 `dist`） | Build output directory 设为 `dist` |

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
