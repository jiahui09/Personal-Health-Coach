// Serif for the wordmark and the single primary action. deslop-ignore-file 07
import React, { useState } from 'react';
import { Mail, Check } from 'lucide-react';

interface SignInProps {
  /** 发送登录邮件；返回 false 表示失败（错误信息由 App 弹出）。 */
  onSendLink: (email: string) => Promise<boolean>;
}

/**
 * 云端模式的登录页：邮箱 magic link（无密码）。
 * 未配置 Supabase 时不会出现在页面上（静态本地版没有登录概念）。
 */
export const SignIn: React.FC<SignInProps> = ({ onSendLink }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const ok = await onSendLink(email.trim());
    setBusy(false);
    if (ok) setSent(true);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3.5 pb-4 border-b-2 border-ink">
          <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-seal text-white font-serif text-lg font-bold select-none">
            记
          </span>
          <div className="font-serif text-[17px] font-bold text-ink tracking-[0.08em]">
            个人健康手记
          </div>
        </div>

        {sent ? (
          <div className="mt-6 space-y-2">
            <p className="text-[15px] text-ink leading-relaxed">
              登录链接已发至 <span className="font-semibold">{email}</span>。
            </p>
            <p className="text-[12px] text-ink3 leading-relaxed">
              在**同一浏览器**打开邮件里的链接即可进入；链接有时效，过期后重新发送即可。
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="block text-[13px] text-ink3" htmlFor="signin-email">
              邮箱（用于换取登录链接，无密码）
            </label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-ink3 shrink-0" />
              <input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={!valid || busy}
              className="btn-primary w-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <span>发送中…</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>发登录链接</span>
                </>
              )}
            </button>
            <p className="text-[12px] text-ink3 leading-relaxed">
              数据存于你的 Supabase 账号（行级安全按登录身份隔离），本机不再保留副本。
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
