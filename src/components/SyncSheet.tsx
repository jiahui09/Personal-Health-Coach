// Serif for the sheet title only; bottom sheet rounds only its top edge on mobile.
// deslop-ignore-file 07 22
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, AlertTriangle } from 'lucide-react';

interface SyncSheetProps {
  isOpen: boolean;
  /** 用邮箱+密码登录到同一账号；返回 false 表示失败（错误由 App 弹出）。 */
  onSync: (email: string, password: string) => Promise<boolean>;
  /** 当前这台设备是否还没登录账号（只在本机身份下提示合并风险）。 */
  anonymous: boolean;
  onClose: () => void;
}

/**
 * 多端同步：把本机身份换成一个固定账号（邮箱+密码）。
 * 在每台设备上登一次，之后各设备共享同一份数据；不发邮件、不受发信限额。
 */
export const SyncSheet: React.FC<SyncSheetProps> = ({
  isOpen,
  onSync,
  anonymous,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="w-full sm:max-w-md bg-paper rounded-t-lg sm:rounded-lg border border-line shadow-md overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* deslop-ignore-next-line 19 — literal 6px status dot */}
            <span className="w-2 h-2 rounded-full bg-accent" />
            <h3 className="font-serif text-lg font-medium text-ink">同步到我的账号</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="阖之"
            className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            setBusy(true);
            const ok = await onSync(email.trim(), password);
            setBusy(false);
            if (ok) onClose();
          }}
          className="p-4 sm:p-5 space-y-3.5 text-[13px] font-sans"
        >
          <p className="text-[12px] text-ink3 leading-relaxed">
            在每台设备上登一次这个账号，各设备就共享同一份记录；登录状态自动续期，日常不用反复登。
          </p>

          {anonymous && (
            <p className="flex items-start gap-1.5 text-[12px] text-danger leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                这台设备目前是本机身份：登录后它将改用账号身份，**本机身份名下已录的内容不会自动合并**
                （新账号是空的属正常）。建议先登录，再开始记录。
              </span>
            </p>
          )}

          <div>
            <label className="block text-ink3 mb-1" htmlFor="sync-email">
              邮箱
            </label>
            <input
              id="sync-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-ink3 mb-1" htmlFor="sync-password">
              密码（≥6 位）
            </label>
            <input
              id="sync-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-sm text-ink focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={!valid || busy}
            className="btn-primary w-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span>登录中…</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>登录并同步</span>
              </>
            )}
          </button>

          <p className="text-[12px] text-ink4 leading-relaxed">
            账号在 Supabase 后台建一次即可：Authentication → Users → Add user（勾选 Auto Confirm）。
          </p>
        </form>
      </motion.div>
    </div>
  );
};
