#!/usr/bin/env node
/**
 * 云端配置自检（零依赖,只用 fetch）
 *
 * 用法（不需要数据库密码,只需要公开的 URL 与 anon key）：
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> node scripts/verify-supabase.mjs
 *
 * 它检查四件事：
 *   1. 项目 URL 正确、API 网关在线（无 key 访问应被拒）
 *   2. 六张表都已建好且可读（缺表 → 建表脚本没跑）
 *   3. 按标记分册：探针标记 A 写一行后,eq.<A> 见得到、eq.<B> 是空册,用完即删
 *      —— 这正是手记名派生 user_id 的隔离模型（同名同册,不设防）
 *   4. 无标记的行被拒：user_id 为空的 INSERT 必须 401/403（WITH CHECK 生效）
 */

const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const TABLES = ['profiles', 'weight_records', 'daily_states', 'meals', 'workout_sessions', 'todos'];

// 探针用的两个「手记名标记」（与前端 markerUserId 同形的 uuid,随意但固定的值）
const PROBE_A = '11111111-2222-4333-8444-555555555555';
const PROBE_B = '99999999-8888-4777-8666-555555555555';
const PROBE_NAME = '__marker_probe__';

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

// 2. 六张表存在且可读（行数不限：数据按标记分册,能看到行是正常态）
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
    fail(`${table} 读取被拒`, `HTTP ${res.status} —— anon key 不正确,或 RLS 策略仍是旧的 auth.uid() 版本（重跑 schema.sql 的 policy 段）`);
    continue;
  }
  if (res.status !== 200) {
    fail(`${table} 读取异常`, `HTTP ${res.status}`);
    continue;
  }
  const rows = await res.json();
  if (Array.isArray(rows)) pass(`${table} 存在且可读`, `HTTP 200 · ${rows.length} 行`);
  else fail(`${table} 返回体异常`, JSON.stringify(rows).slice(0, 120));
}

// 3. 按标记分册：A 写一行,A 见得到、B 是空册,用完即删
{
  let probeId = null;
  const insert = await fetch(`${url}/rest/v1/meals`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: PROBE_A,
      eaten_on: '1970-01-01',
      category: 'snack',
      name: PROBE_NAME,
      calories_kcal: 0,
      protein_g: 0,
    }),
  }).catch((err) => ({ status: 0, json: async () => ({ message: err.message }) }));

  if (insert.status === 201 || insert.status === 200) {
    const inserted = await insert.json().catch(() => []);
    probeId = Array.isArray(inserted) ? inserted[0]?.id ?? null : null;
    pass('探针写入（带标记 user_id）', `HTTP ${insert.status}${probeId ? ` · id=${probeId}` : ''}`);

    const seenByA = await fetch(`${url}/rest/v1/meals?user_id=eq.${PROBE_A}&name=eq.${PROBE_NAME}&select=id`, { headers: authHeaders });
    const rowsA = await seenByA.json().catch(() => null);
    const seenByB = await fetch(`${url}/rest/v1/meals?user_id=eq.${PROBE_B}&name=eq.${PROBE_NAME}&select=id`, { headers: authHeaders });
    const rowsB = await seenByB.json().catch(() => null);

    if (Array.isArray(rowsA) && rowsA.length === 1) pass('标记 A 见得到自己的行', `eq.<A> → ${rowsA.length} 行`);
    else fail('标记 A 应见 1 行', `实际 ${JSON.stringify(rowsA).slice(0, 120)} —— 检查 user_id 过滤与 policy 段`);

    if (Array.isArray(rowsB) && rowsB.length === 0) pass('标记 B 是空册（分册生效）', `eq.<B> → 0 行`);
    else fail('标记 B 竟见到了 A 的行', '分册失效：立即停用并重跑 schema.sql 的 policy 段');

    const cleanup = await fetch(`${url}/rest/v1/meals?user_id=eq.${PROBE_A}&name=eq.${PROBE_NAME}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (cleanup.ok) pass('探针已清除', `HTTP ${cleanup.status}`);
    else fail('探针清除失败', `HTTP ${cleanup.status} —— 到表里手工删掉 user_id=${PROBE_A} 且 name=${PROBE_NAME} 的行`);
  } else if (insert.status === 401 || insert.status === 403) {
    fail('带标记的写入被拒', `HTTP ${insert.status} —— WITH CHECK/策略未按 schema.sql 更新,或 anon key 不对`);
  } else {
    fail('探针写入返回意外状态', `HTTP ${insert.status}`);
  }
}

// 4. 无标记的行被拒：user_id 为空的 INSERT 必须 401/403（WITH CHECK 生效）
{
  const res = await fetch(`${url}/rest/v1/meals`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: null,
      eaten_on: '1970-01-01',
      category: 'snack',
      name: '__marker_probe_null__',
      calories_kcal: 0,
      protein_g: 0,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    pass('无标记的行被拒（WITH CHECK user_id is not null）', `HTTP ${res.status}`);
  } else if (res.status === 201 || res.status === 200) {
    fail('无标记竟然写入成功', 'RLS 未生效，必须立即排查并重跑 schema.sql 的 policy 段');
  } else {
    fail('无标记写入探测返回意外状态', `HTTP ${res.status}`);
  }
}

console.log(failed === 0 ? '\n云端配置自检通过：可以填环境变量并部署了。' : `\n${failed} 项未通过：先修好再上线。`);
process.exit(failed === 0 ? 0 : 1);
