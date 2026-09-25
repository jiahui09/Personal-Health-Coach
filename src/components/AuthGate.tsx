// Serif for the wordmark; the rest is one actionable line. deslop-ignore-file 07
import React, { useEffect, useState } from 'react';
import { Mail, Check, AlertTriangle } from 'lucide-react';
import { clearMagicLinkHash, readAuthErrorFromHash } from '../services/supabaseRest';

interface AuthGateProps {
  /** 静默进入失败的原因（仓库错误码），用于给出对症的提示。 */
  reason: string | null;
  /** 重试静默进入（匿名身份）。 */
  onRetry: () => Promise<boolean>;
  /** 邮箱登录（仅在需要换设备/恢复数据时用）。 */
  onSendLink: (email: string) => Promise<boolean>;
}

/** 对症的处置建议：不同错误码的根因与修法完全不同。 */
const REASON_HINT: Record<string, string> = {
  not_implemented:
    'Supabase 里这个开关没打开：Authentication → Sign In / Providers → Allow anonymous sign-ins。',
  auth:
    'Pages 里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 不正确（anon key 需从 Settings → API 复制）。',
  network: '连不上 Supabase：检查网络，或核对 VITE_SUPABASE_URL 是否写成 https://xxx.supabase.co。',
  rate_limited: '发信已达小时限额；改用上面的「重试」（匿名进入不消耗邮件额度）。',
};

const COOLDOWN_SECONDS = 60;

/**
 * 只在「静默进入失败」时才会出现，不是常规登录页。
 * 自用场景下正常路径是一路直进：应用启动时自己建立本机身份，用户看不到这一步。
 */
export const AuthGate: React.FC<AuthGateProps> = ({ reason, onRetry, onSendLink }) => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const error = readAuthErrorFromHash();
    if (error) {
      setLinkError(error);
      clearMagicLinkHash();
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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

        <p className="mt-5 flex items-start gap-1.5 text-[13px] text-ink leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
          <span>云端身份未建立：数据暂时无法保存。</span>
        </p>

        {linkError && (
          <p className="mt-3 text-[12px] text-danger leading-relaxed">
            登录链接无效或已过期（{linkError}）。
          </p>
        )}

        {!showEmail ? (
          <div className="mt-4 space-y-3">
            <p className="text-[12px] text-ink3 leading-relaxed">
              {REASON_HINT[reason ?? ''] ??
                '请检查 Pages 的环境变量与 Supabase 的匿名登录开关。'}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onRetry();
                setBusy(false);
              }}
              className="btn-primary w-full shadow-md disabled:opacity-50"
            >
              {busy ? <span>重试中…</span> : <span>重试</span>}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="btn-link w-full justify-center py-1.5"
            >
              <span>改用邮箱登录</span>
            </button>
            <p className="text-[12px] text-ink4 leading-relaxed">
              也可以彻底不要云端：删掉 Pages 里的 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，
              数据就存在本机浏览器里，无需任何身份。
            </p>
          </div>
        ) : sent ? (
          <p className="mt-4 text-[13px] text-ink leading-relaxed">
            登录链接已发至 <span className="font-semibold">{email}</span>：在同一浏览器打开即可。
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!valid || cooldown > 0) return;
              setBusy(true);
              const ok = await onSendLink(email.trim());
              setBusy(false);
              if (ok) setSent(true);
              setCooldown(COOLDOWN_SECONDS);
            }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-ink3 shrink-0" />
              <input
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
              disabled={!valid || busy || cooldown > 0}
              className="btn-primary w-full shadow-md disabled:opacity-50"
            >
              {busy ? (
                <span>发送中…</span>
              ) : cooldown > 0 ? (
                <span className="tabular-nums">{cooldown} 秒后可再发</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>发登录链接</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(false)}
              className="btn-link w-full justify-center py-1.5"
            >
              <span>返回</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
