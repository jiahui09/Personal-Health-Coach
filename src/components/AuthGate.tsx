// 账号门（云端模式的唯一入口）：新用户注册、老用户登录，进去才有数据。
// 全屏单卡：报头 + 两式切换 + 邮箱密码表单；错误码对症成一句可执行的话。
import React, { useEffect, useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { clearMagicLinkHash, readAuthErrorFromHash } from '../services/supabaseRest';

export type AuthMode = 'signin' | 'signup';

interface AuthGateProps {
  /** 登录 / 注册（mode 决定走哪个端点）；false = 失败，错误码由 App 存进 reason。 */
  onAuth: (email: string, password: string, mode: AuthMode) => Promise<boolean>;
  /** 上次失败的仓库错误码；null = 无。 */
  reason: string | null;
}

/** 对症文案：不同错误码的根因与处置完全不同，未知码兜底如实报码。 */
const REASON_COPY: Record<string, string> = {
  email_taken: '该邮箱已注册 · 改用上面的「登录」',
  auth: '邮箱或密码不正确',
  network: '连不上 Supabase · 检查网络后重试',
  rate_limited: '注册确认邮件已达小时限额 · 约一小时后再试',
  not_implemented: '后端未开通：核对 VITE_SUPABASE_*，或在 Supabase 打开邮箱注册（Email provider）',
};

export const AuthGate: React.FC<AuthGateProps> = ({ onAuth, reason }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);

  // 登录链接回跳带出的错误（历史会话遗留）也如实展示
  useEffect(() => {
    const error = readAuthErrorFromHash();
    if (error) {
      setHashError(error);
      clearMagicLinkHash();
    }
  }, []);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;
  const errorCopy = reason ? (REASON_COPY[reason] ?? `未成（${reason}）`) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    await onAuth(email.trim(), password, mode);
    setBusy(false);
  };

  const tabClass = (active: boolean): string =>
    active
      ? 'px-3 py-2 rounded-md bg-ink text-white text-[13px] font-semibold'
      : 'px-3 py-2 rounded-md text-ink2 text-[13px] hover:bg-surface2';

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3.5 pb-4 border-b-2 border-ink">
          <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-seal text-white font-serif text-lg font-bold select-none">
            記
          </span>
          <div className="font-serif text-[17px] font-bold text-ink tracking-[0.08em]">
            个人健康手记
          </div>
        </div>

        <p className="mt-5 text-[13px] text-ink leading-relaxed">
          新用户先注册，老用户登录——记录存于你的账号，换设备也见得到。
        </p>

        {errorCopy && (
          <p role="alert" className="mt-3 text-[13px] text-danger leading-relaxed flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
            <span>{errorCopy}</span>
          </p>
        )}
        {hashError && (
          <p role="alert" className="mt-3 text-[12px] text-danger leading-relaxed">
            登录链接无效或已过期（{hashError}）。
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-1 p-1 border border-control rounded-lg">
          <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')} className={tabClass(mode === 'signin')}>
            登录
          </button>
          <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')} className={tabClass(mode === 'signup')}>
            注册新账号
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3">
          <label className="block">
            <span className="sr-only">邮箱</span>
            <input
              type="email"
              required
              aria-label="邮箱"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="sr-only">密码</span>
            <input
              type="password"
              required
              aria-label="密码"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 6 位）"
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent"
            />
          </label>

          <button
            type="submit"
            disabled={!valid || busy}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span>{mode === 'signin' ? '登录中…' : '创建中…'}</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{mode === 'signin' ? '登录并开卷' : '注册并开卷'}</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-[12px] text-ink4 leading-relaxed">
          {mode === 'signin'
            ? '还没有账号？点上面的「注册新账号」。'
            : '注册即开一份只属于你的手记；已在 Supabase 后台预建的账号直接用「登录」。'}
        </p>
      </div>
    </div>
  );
};
