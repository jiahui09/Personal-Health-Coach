# 部署步骤（Cloudflare Pages + Supabase 免费档）

> 结论先说清楚：
> **① 静态版**：零配置、本机 localStorage，推上去就能用。
> **② 云端同步版**（自用推荐）：数据层已实作（零依赖，浏览器直连 Supabase）。
> 三步走：**跑建表 SQL → 打开「匿名登录」→ 在 Pages 填两个环境变量**。
> 之后打开站点点一下「开始使用」即可,不需要邮箱、不受发信限额影响。

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

> **只想要静态版就留空**：留空 = 本机 localStorage（零配置即可用）。
> 填上两项 = 切换到 Supabase 云端同步（见第二节，已实作）。

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

## 一·补二、接自定义域（改名称服务器 + Pages 绑定）

> 顺序建议：**先用 `xxx.pages.dev` 验收通过，再接自定义域**。这一步不改变应用代码，
> 只影响「你用什么网址访问」。

### 0. 需要准备什么（清单）

| # | 需要的东西 | 说明 |
|---|---|---|
| 1 | **一个已注册的域名** | 只有这一项要花钱（约 60–100 元/年）；Cloudflare 的 DNS、CDN、证书、Pages 全部免费且不限流量 |
| 2 | **该域名的注册商登录权限** | 改名称服务器、或加 CNAME，都在**注册商**处操作，不能只在 Cloudflare 面板点 |
| 3 | **一个已部署成功的 Pages 项目** | 也就是先拿到能打开的 `xxx.pages.dev`（自定义域是叠在它之上的门牌） |
| 4 | （若域名在 Cloudflare 托管）项目与域名在**同一个 Cloudflare 账号**下 | 跨账号无法绑定；否则只需把域名 Add a site 到同一账号 |

> 如果域名是从 HugeDomains 之类的停放站买的：确认**已过户完成**即可。
> 注册商的 60 天 Transfer Lock 只限制「转注册商」，**不影响**改名称服务器或加解析记录。

> **备案**：本应用托管在 Cloudflare 的境外节点，**不需要 ICP 备案**；只有把域名指向中国大陆境内服务器时才需要。

### 1. 两条路径，先选一条

| | 路径 A：不动名称服务器（推荐、风险最小） | 路径 B：把 DNS 托管给 Cloudflare |
|---|---|---|
| 适合 | 只用一个**子域**（如 `health.example.com`） | 想用**根域**（`example.com`）或要 CF 的 CDN/防护 |
| 做什么 | 在原 DNS 商加一条 `CNAME → <项目>.pages.dev`，再在 Pages 面板添加该子域 | 先在 CF「Add a site」→ 拿到两台 NS → 去注册商整组替换 → 等激活 → 再在 Pages 添加域名 |
| 注意 | 根域**不能**用 CNAME（除非 DNS 商支持 ALIAS/ANAME 扁平化） | 激活前必须核对 `MX`/`TXT`，并删除 hugedomains 的停放 `A` 记录（见第 2 节） |
| 证书 | Cloudflare 自动签发 | 同左，自动签发并续期 |
| 停机风险 | 几乎为零（原解析不变，只多一条记录） | 极低，但漏了 MX 会立刻断邮箱 |

### 1b. 改名称服务器（在**注册商**处改，不是在 Cloudflare 改）

1. 找到域名注册商：Cloudflare 面板的 `ICANN Lookup` 链接，或直接登录你**购买域名**的那家
   （若域名来自 HugeDomains / 经销商，就登录它的账户 → `DNS` / `Nameservers`）。
2. 把名称服务器**整组替换**为 Cloudflare 分配的两台，例如：

   ```
   添加：mcgrory.ns.cloudflare.com
   添加：violet.ns.cloudflare.com
   删除：domain-for-sale.hugedomainsdns.com
   删除：forsale.hugedomainsdns.com
   ```

   每家分配的两台不同，以你自己的面板显示为准；**必须两台都填、旧的都删**。
3. 保存。生效通常 5 分钟–24 小时（极端 48 小时）；Cloudflare 会发「域名已激活」邮件。
   在此之前的 NS 变更不会导致停机，但两次查询可能拿到不同的解析结果。

### 2. 改 NS 之前/之后，务必核对 Cloudflare 里的 DNS 记录

Cloudflare 在添加域名时会**自动扫描并导入**原有记录，但有两类必须人工确认：

| 记录 | 为什么重要 | 怎么做 |
|---|---|---|
| `MX` / `TXT`（SPF、DKIM、DMARC、验证记录） | 一旦丢失，**该域名的邮箱立刻收不到信** | 核对是否与注册商/DNS 商处的原记录一致；缺了就手工补 |
| `A` / `AAAA` 指向 hugodomains 停放页的 | 会让人访问到「域名出售」页而不是你的手记 | 删掉这些停放记录，交给下一步的 Pages 自定义域自动接管 |

### 3. 在 Pages 项目里绑定

`Workers & Pages → 你的项目 → Custom domains → Set up a custom domain`

| 你要的网址 | 填什么 | Cloudflare 会做什么 |
|---|---|---|
| 子域 `health.example.com` | 填子域 | 自动在 DNS 建 CNAME 指向 `<项目>.pages.dev`，并签发证书 |
| 根域 `example.com` | 填根域 | 用 CNAME 扁平化到 `<项目>.pages.dev`（托管在 Cloudflare 才支持） |

证书签发通常几分钟内完成；完成后访问 `https://你的域名` 应直接出现手记首页。

### 4. 验收清单

```bash
dig +short NS 你的域名            # 应只剩 Cloudflare 的两台
dig +short 你的域名               # 不应再出现 hugedomains 的停放 IP
curl -sI https://你的域名 | head -3   # 200/304,且带 server: cloudflare
curl -sI http://你的域名  | head -3   # 301 跳 https
```

打开页面确认：刊头「个人健康手记」+ 干支日期，首次进入显示「体征档 · 未建档」。

### 5. 已知取舍（如实说明）

- **回滚**：把 NS 改回原注册商的服务器即可（但若域名本身就是从 HugeDomains 买的停放域名，回滚等于回到停放页）。
- **速度**：Cloudflare 免费版在中国大陆没有节点，境内访问通常绕到香港/日本/新加坡，
  延迟高于境内 CDN；个人自用可接受，要更快就得换境内托管。
- **不改 NS 的替代方案**：若你只用子域（如 `health.example.com`），可以**不动名称服务器**，
  直接在原 DNS 商处加一条 CNAME 指向 `<项目>.pages.dev`（Pages 面板同样添加该自定义域，
  证书走 Cloudflare 的 DCV 校验）。这样风险最小。

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

### 4. 页面侧：填环境变量并重新部署

在 Pages 项目 → Settings → Environment variables 加两项（Production 与 Preview 都加）：

| 变量 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key |

改环境变量后**必须重新部署一次**才会生效（Deployments → Retry deployment，或推一个新提交）。

### 4b. 上线前自检（一条命令,不需要数据库密码）

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon public key> \
node scripts/verify-supabase.mjs
```

它依次检查：URL 格式 → 网关在线（无 key 被拒）→ **六张表都存在** → **RLS 生效**（匿名读必须 0 行）
→ 匿名不可写。任何一项 FAIL 都会给出对应处置，全 PASS 才继续部署。

### 5. 首次进入：一键进入 + 建档

1. 打开站点 → **直接进入应用**（首次会闪一下「正在建立本机凭据…」，之后不再出现）。
   应用启动时自己在后台建立本机身份（匿名会话存本机），你不需要点任何登录按钮。
2. 若这一步失败，页面只给一句话和修法（按原因区分：匿名开关没开 / anon key 不对 / 网络不通），
   并附「重试」与「改用邮箱登录」两个出口。
3. 显示「体征档 · 未建档」→ 点「立档」填身高/性别/出生年/活动水平/腰围/目标。
4. 此后所有记录直接落到你的 Supabase 库。
5. 想换设备/怕丢：走「换用邮箱登录」，把匿名身份升级为邮箱账号（Supabase 后台可在用户页绑定邮箱）。

> **匿名身份的取舍（如实说明）**：会话只存在于**那个浏览器**。清空站点数据或换浏览器，
> 就用同一个身份进不去了（数据仍在库里，需要用邮箱登录或后台协助接回）。
> 只在一台设备上用 → 完全够用（而且全程无登录界面）；要跨设备 → 走邮箱登录。
> 另外：应用**绝不会**在身份失效时静默新建一个身份（那会让你看到「数据不见了」的空账），
> 这种情况一定停下来提示你。

### 6. 数据层实现方式（便于排错）

| 关注点 | 现状 |
|---|---|
| 依赖 | **零新增依赖**：`src/services/supabaseRest.ts` 用 `fetch` 直连 Auth 与 PostgREST（因此不需要官方客户端，也不会影响 `npm ci`） |
| 派生计算 | 与本地版**共用同一段** `src/services/todayAssembly.ts`；契约测试断言两条路径产出的 `TodayData` 逐字节相同 |
| 会话 | 存 localStorage（`phc_supabase_session_v1`），到期前 60 秒自动用 refresh token 续期；退出即清除 |
| 演示数据 | 云端**不灌任何演示数据**，首次进入就是「未建档」（本地版才带记录） |
| 「复其初」 | 云端**显式拒绝**（`not_implemented`），因为它是本地演示用的清库动作 |
| 本地数据迁移 | 暂未提供「本机 localStorage 一键导入云端」（本地那份是演示数据，直接重新建档即可） |

### 7. 排错

| 现象 | 原因 | 处置 |
|---|---|---|
| 打开就是登录页，发信后点链接仍回登录页 | Supabase 的 Redirect URLs 没含当前域名 | Authentication → URL Configuration 把站点域名加进 **Redirect URLs** 与 **Site URL** |
| 提示「网络不可达」 | URL 写错或没联网 | 核对 `VITE_SUPABASE_URL` 是否 `https://xxx.supabase.co`（含 https、无尾斜杠） |
| 提示「未登录或会话过期」 | 令牌失效且刷新失败 | 重新走一次邮箱登录 |
| `429 over_email_send_rate_limit` | 内置邮件小时额度用尽（连点更快耗尽） | 等约一小时；或改用「开始使用」一键进入；或配自定义 SMTP |
| 点「开始使用」提示未开启 | Supabase 没开匿名登录 | Authentication → Sign In / Providers → Allow anonymous sign-ins |
| 收不到登录邮件 | Supabase 免费档内置 SMTP 有频率限制（约每小时数封） | 等一会儿再发；长期使用可在 Authentication → SMTP 配自己的发信 |
| 写入报 409 / 冲突 | 同日重复写（如体重同日两条） | 同日体重走的是「更新当日之数」，一般不会冲突；若自定义过 schema 需核对主键 |
| 看到别人的数据 | RLS 没生效 | 立即停止使用并重跑第 2 节越权自测与 `schema.sql` 的 policy 段 |

## 三、两条路径的差异一览

| 维度 | 静态版（MockHealthRepository） | 云端版（SupabaseHealthRepository） |
|---|---|---|
| 数据位置 | 浏览器 localStorage（`phc_*_v3`） | Postgres（RLS 隔离到 `auth.uid()`） |
| 跨设备 | 否 | 是（同一邮箱账号） |
| 登录 | 无 | 邮箱 magic link |
| 计算 | 浏览器 `src/domain/` | 同左（一致） |
| 演示数据 | 首次进入带记录（不含任何人的体征档） | 不灌演示数据；首次进入即「未建档」→ 立档 |
| 需要环境变量 | 否 | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` |
| 迁移 | 读旧形态时自动升级字段（`src/domain/migrate.ts`，只补表单不改数值） | 库表结构即最终形态；本地记录暂不自动导入 |
| 登录 | 无 | 邮箱 magic link（会话存本机并自动续期） |
