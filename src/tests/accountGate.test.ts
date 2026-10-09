/**
 * 账号门契约（accountGate）—— 本轮决策：账号只是归属标记,不是防线。
 * 前后端分离,数据不值钱：没有 GoTrue、没有密码与邮件验证、没有会话令牌——
 * 手记名确定性派生 user_id（同名即同库），页面只按标记过滤读写。
 *
 *   1. 服务层无 GoTrue：接口/实现/传输层都没有密码、邮件、令牌与 /auth/v1 端点
 *   2. 标记纯函数：确定性、归一化（大小写/空白）、UUID 形、校验边界
 *   3. 账号门：单输入零标签,告警收在按钮之下且卡片顶部锚定（零偏移）
 *   4. 页面接线与页脚：无标记一律到门；退出只清本机
 */

import { existsSync, readFileSync } from 'node:fs';
import { accountNameError, displayName, markerUserId, normalizeAccountName } from '../services/accountMarker';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let checks = 0;
function ok(message: string): void {
  checks += 1;
  console.log(`   ✓ ${message}`);
}

const src = (path: string): string => readFileSync(path, 'utf8');
const app = src('src/App.tsx');
const gate = src('src/components/AccountGate.tsx');
const iface = src('src/services/healthRepository.ts');
const presentation = src('src/tests/presentationContract.test.ts');

// --- 1. 服务层无 GoTrue（账号只作标记） ---
assert(!iface.includes('signIn(') && !iface.includes('signUp('), '接口无密码登录/注册');
assert(!iface.includes('signInWithProvider'), '接口无第三方登录');
assert(!iface.includes('hasSession') && !iface.includes('onAuthChange'), '接口无会话概念（hasAccount / onAccountChange）');
assert(iface.includes('enterByName'), '接口有「按名打开手记」');
for (const file of ['src/services/supabaseRest.ts', 'src/services/supabaseHealthRepository.ts', 'src/services/mockHealthRepository.ts']) {
  const code = src(file);
  assert(!code.includes('/auth/v1'), `${file} 不再打 GoTrue 端点`);
  assert(!code.includes('grant_type'), `${file} 无令牌授予/刷新`);
  assert(!/sendMagicLink|completeMagicLink|signInWithPassword|signUpWithPassword/.test(code), `${file} 无 magic link/密码登录函数`);
  assert(!code.includes('type="password"') && !code.includes("autoComplete: 'password"), `${file} 无密码字段`);
}
assert(!src('src/services/supabaseRest.ts').includes('phc_supabase_session_v1'), '会话存储键已删（只有归属标记）');
assert(!existsSync('src/services/accountMerge.ts') && !existsSync('src/components/SyncSheet.tsx'), '旧合并/同步弹层仍不在仓库');
assert(!gate.includes('signInAnonymously'), '账号门无匿名入口');

// --- 2. 标记纯函数 ---
assert(markerUserId('甲') === markerUserId('甲'), '确定性：同名必同标记');
assert(markerUserId('甲') !== markerUserId('乙'), '异名必异标记');
assert(markerUserId('My手记') === markerUserId('  my手记  '), '归一化：大小写与首尾空白不改标记');
assert(markerUserId('a  b') === markerUserId('a b'), '内部多余空白折叠后同标记');
assert(markerUserId('甲') === markerUserId(' 甲'), '首尾空白不改标记');
assert(normalizeAccountName(' A  b ') === 'a b' && displayName(' A  b ') === 'A b', '归一化小写、显示保大小写');
assert(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(markerUserId('甲')),
  '标记呈 UUID 形（可落 uuid 列）'
);
assert(accountNameError('手记') === null, '正常名字通过校验');
assert(accountNameError('   ') !== null && accountNameError('') !== null, '空名给出对症提示');
assert(accountNameError('长'.repeat(33)) !== null, '超 32 字给出对症提示');
ok('标记纯函数：确定性、归一化、UUID 形、校验边界');

// --- 3. 账号门：单输入、零偏移 ---
assert(!gate.includes('type="password"'), '账号门不收密码');
assert(!gate.includes('注册新账号') && !gate.includes("'signin'") && !gate.includes("'signup'"), '登录/注册两式已废（单一手记名）');
assert(!gate.includes('email') && !gate.includes('邮箱'), '账号门不收邮箱、不发邮件');
assert(gate.includes('role="alert"'), '错误码对读屏是 alert');
assert((gate.match(/type="text"/g) ?? []).length === 1, '单一文本输入（手记名）');
// 零偏移：告警在提交按钮之后出现（只向下生长）；卡片顶部锚定,不随告警增高而整体上移
const submitAt = gate.indexOf('type="submit"');
const alertAt = gate.indexOf('role="alert"');
assert(submitAt > 0 && alertAt > submitAt, '告警收在提交按钮之下（出现不移动上方组件）');
assert(!/min-h-screen[^\n]*items-center/.test(gate) && gate.includes('self-start'), '卡片顶部锚定（不垂直居中,增高只向下）');
for (const code of ['auth', 'network', 'rate_limited', 'not_implemented']) {
  assert(gate.includes(code), `错误码 ${code} 有对症文案`);
}
ok('账号门：单输入零标签,告警在按钮之下,顶部锚定');

// --- 4. 页面接线与页脚 ---
assert(app.includes("setAuthStage('gate');"), '无标记一律落到账号门（gate）');
assert(app.includes('healthRepository.hasAccount()'), '启动先看有无归属标记');
assert(app.includes('<AccountGate reason={authReason} onEnter={handleEnter} />'), 'gate 分支渲染账号门并传 onEnter');
assert(!app.includes('handleAuth') && !app.includes('AuthUser') && !app.includes('setAuthUser'), '旧登录态命名已清干净');
assert(app.includes('enterByName'), '页面经 enterByName 打开手记');
assert(app.includes('退出'), '云端页脚保留「退出」');
assert(app.includes('复其初'), '本机演示模式的「复其初」不受影响');

// --- 账号门仍在展示纪律白名单内（此后自动继承 presentationContract 的全部禁令） ---
assert(presentation.includes("['AccountGate.tsx', comp('AccountGate.tsx')]"), 'presentationContract 已含 AccountGate');

console.log(`ALL ACCOUNT GATE TESTS PASSED. (4 groups, ${checks} runtime checks)`);
