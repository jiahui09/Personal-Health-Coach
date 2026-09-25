#!/usr/bin/env node
/**
 * 云端配置自检（零依赖,只用 fetch）
 *
 * 用法（不需要数据库密码,只需要公开的 URL 与 anon key）：
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> node scripts/verify-supabase.mjs
 *
 * 它检查四件事：
 *   1. 项目 URL 正确、API 网关在线（无 key 访问应被拒）
 *   2. 六张表都已建好（缺表 → 建表脚本没跑）
 *   3. RLS 生效：用 anon key（匿名身份）读六张表必须返回 0 行
 *      —— 若返回了数据,说明策略没生效,必须立刻停用并重跑 schema.sql 的 policy 段
 *   4. 匿名不可写：匿名 INSERT 必须被拒（401/403）
 */

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const TABLES = ['profiles', 'weight_records', 'daily_states', 'meals', 'workout_sessions', 'todos'];

let failed = 0;
const pass = (label, detail = '') => console.log(`PASS  ${label}${detail ? '  → ' + detail : ''}`);
const fail = (label, detail = '') => {
  failed += 1;
  console.log(`FAIL  ${label}${detail ? '  → ' + detail : ''}`);
};

if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
  fail('SUPABASE_URL 格式', `应为 https://<ref>.supabase.co，当前 = ${url || '(未设置)'}`);
  process.exit(1);
}
pass('SUPABASE_URL 格式', url);
if (!key) {
  fail('SUPABASE_ANON_KEY 未设置', '从 Supabase → Settings → API 复制 anon public key');
  process.exit(1);
}

const authHeaders = { apikey: key, Authorization: `Bearer ${key}` };

// 1. 网关在线：无 key 必须被拒
{
  const res = await fetch(`${url}/rest/v1/meals?select=id&limit=1`);
  if (res.status === 401 || res.status === 403) pass('API 网关在线（无 key 被拒）', `HTTP ${res.status}`);
  else fail('API 网关应拒绝无 key 请求', `HTTP ${res.status}`);
}

// 2 + 3. 表存在 + RLS 生效
for (const table of TABLES) {
  let res;
  try {
    res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: authHeaders });
  } catch (err) {
    fail(`${table} 请求失败`, err.message);
    continue;
  }
  if (res.status === 404) {
    fail(`${table} 表不存在`, '先在 Supabase SQL Editor 跑 supabase/schema.sql');
    continue;
  }
  if (res.status === 401 || res.status === 403) {
    fail(`${table} 读取被拒`, `HTTP ${res.status} —— anon key 不正确或未启用`);
    continue;
  }
  if (res.status !== 200) {
    fail(`${table} 读取异常`, `HTTP ${res.status}`);
    continue;
  }
  const rows = await res.json();
  if (Array.isArray(rows) && rows.length === 0) {
    pass(`${table} 存在且 RLS 让匿名看不到任何行`, 'HTTP 200 · 0 行');
  } else if (Array.isArray(rows) && rows.length > 0) {
    fail(`${table} RLS 未生效：匿名读到了 ${rows.length} 行`, '立即停用并重跑 schema.sql 的 policy 段');
  } else {
    fail(`${table} 返回体异常`, JSON.stringify(rows).slice(0, 120));
  }
}

// 4. 匿名不可写
{
  const res = await fetch(`${url}/rest/v1/meals`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: '00000000-0000-0000-0000-000000000000',
      eaten_on: '1970-01-01',
      category: 'snack',
      name: '__rls_probe__',
      calories_kcal: 0,
      protein_g: 0,
    }),
  });
  if (res.status === 401 || res.status === 403 || res.status === 409) {
    pass('匿名不可写入（RLS with check 生效）', `HTTP ${res.status}`);
  } else if (res.status === 201 || res.status === 200) {
    fail('匿名竟然写入成功', 'RLS 未生效，必须立即排查');
  } else {
    fail('写入探测返回意外状态', `HTTP ${res.status}`);
  }
}

console.log(failed === 0 ? '\n云端配置自检通过：可以填环境变量并部署了。' : `\n${failed} 项未通过：先修好再上线。`);
process.exit(failed === 0 ? 0 : 1);
