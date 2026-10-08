/**
 * 账号门契约（authGate）—— 本轮决策：清掉「仅存本机」的存储选项，
 * 云端强制注册 / 登录，登录之后才读写；旧的「本机 → 账号」合并随之删除。
 *
 *   1. 不留匿名入口：接口、实现、页面都没有 signInAnonymously / 匿名一键进入
 *   2. 不留本机合并：accountMerge.ts 与 SyncSheet.tsx 不在仓库里，App 不再引用
 *   3. 无会话一律到账号门：启动即 gate，注册 / 登录两式齐备、错误码对症
 *   4. 页脚不再有「同步到我的账号 / 继续上次合并」这类本机身份入口
 */

import { existsSync, readFileSync } from 'node:fs';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const src = (path: string): string => readFileSync(path, 'utf8');
const app = src('src/App.tsx');
const authGate = src('src/components/AuthGate.tsx');
const iface = src('src/services/healthRepository.ts');
const presentation = src('src/tests/presentationContract.test.ts');

// --- 1. 无匿名入口 ---
assert(!iface.includes('signInAnonymously'), '接口不再有匿名登录');
assert(!app.includes('signInAnonymously'), '页面不再走匿名登录');
assert(!authGate.includes('匿名'), '账号门不提匿名');
for (const file of ['src/services/mockHealthRepository.ts', 'src/services/supabaseHealthRepository.ts', 'src/services/supabaseRest.ts']) {
  assert(!src(file).includes('signInAnonymously'), `${file} 不再实现匿名登录`);
}

// --- 2. 本机合并已删净 ---
assert(!existsSync('src/services/accountMerge.ts'), 'accountMerge.ts 已删除');
assert(!existsSync('src/components/SyncSheet.tsx'), 'SyncSheet.tsx 已删除');
assert(!existsSync('src/tests/mergePlan.test.ts'), 'mergePlan.test.ts 已删除');
for (const file of ['src/App.tsx', 'src/services/supabaseHealthRepository.ts']) {
  assert(!src(file).includes('accountMerge'), `${file} 不再引用合并服务`);
}
assert(!app.includes('SyncSheet') && !app.includes('mergeAsk'), 'App 无合并弹层与状态');

// --- 3. 无会话一律到账号门 ---
assert(app.includes("setAuthStage('gate');"), '启动/退出后落到账号门（gate）');
assert(app.includes('healthRepository.hasSession()'), '启动先看有无会话');
assert(app.includes('<AuthGate reason={authReason} onAuth={handleAuth} />'), 'gate 分支渲染账号门并传 onAuth');
assert(!app.includes("'entering'"), '不再有「正在建立本机凭据」静默进入态');
assert(!app.includes('正在建立本机凭据'), '启动不再建本机身份');

// 账号门：两式 + 表单 + 对症错误
assert(authGate.includes("'signin'") && authGate.includes("'signup'"), '登录 / 注册两式并存');
assert(authGate.includes('注册新账号'), '注册入口明示「注册新账号」');
assert(authGate.includes('type="password"'), '账号门收密码（不再发登录链接）');
assert(authGate.includes('aria-pressed'), '两式切换是可读的分段控件');
assert(authGate.includes('role="alert"'), '错误码对读屏是 alert');
for (const code of ['email_taken', 'auth', 'network', 'rate_limited']) {
  assert(authGate.includes(code), `错误码 ${code} 有对症文案`);
}
assert(!authGate.includes('发登录链接'), '不再发送 magic link');
assert(!authGate.includes('删掉 Pages'), '不再提供「彻底不要云端」的旁路');

// --- 4. 页脚 ---
assert(app.includes('退出'), '云端页脚保留「退出」');
assert(!app.includes('同步到我的账号'), '页脚无本机身份同步入口');
assert(!app.includes('继续上次合并'), '页脚无合并续跑入口');
assert(app.includes('复其初'), '本机演示模式的「复其初」不受影响（本轮只清云端）');

// --- 账号门仍在展示纪律白名单内（此后自动继承 presentationContract 的全部禁令） ---
assert(presentation.includes("['AuthGate.tsx', comp('AuthGate.tsx')]"), 'presentationContract 已含 AuthGate');

console.log('ALL AUTH GATE TESTS PASSED. (4 groups)');
