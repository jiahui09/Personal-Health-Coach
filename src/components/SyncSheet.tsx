// Serif for the sheet title only; bottom sheet rounds only its top edge on mobile.
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Check, AlertTriangle, UserPlus, LogIn } from 'lucide-react';
import { useSheetBehavior } from '../hooks/useSheetBehavior';
import { MERGE_TABLES, type MergeCounts, type MergeTable } from '../services/accountMerge';

/** 表名的页面称谓（数据层只给稳定表名,文案由展示层定）。 */
const TABLE_CN: Record<MergeTable, string> = {
  profiles: '体征档',
  weight_records: '体重',
  daily_states: '每日体征',
  meals: '膳食',
  workout_sessions: '训练',
  todos: '待办',
};

export type SyncMode = 'signin' | 'signup';

interface SyncSheetProps {
  isOpen: boolean;
  /** 登录或注册（mode 决定走哪个端点）；返回 false 表示失败（错误由 App 弹出）。 */
  onSync: (email: string, password: string, mode: SyncMode) => Promise<boolean>;
  /**
   * 步骤二：本机身份名下待询问的记录清单；null = 不需要询问（回到表单步）。
   * requireDecision=true 是登录后的当场询问（必须二选一,不许关表）；
   * false 是异常中断后的「继续上次合并」（可以先关掉,下次再续）。
   */
  merge: { counts: MergeCounts; requireDecision: boolean } | null;
  /** 就合并与否作出选择；true = 已处理完毕,由 App 关表；false = 失败,留在本步可重试。 */
  onMerge: (doMerge: boolean) => Promise<boolean>;
  /** 当前这台设备是否还没登录账号（只在本机身份下提示换身份的影响）。 */
  anonymous: boolean;
  onClose: () => void;
}

/**
 * 账号入口：邮箱+密码的登录 / 注册，以及登录后的「本机记录是否并入账号」询问。
 * 在每台设备上登一次，之后各设备共享同一份数据；不发邮件、不受发信限额。
 */
export const SyncSheet: React.FC<SyncSheetProps> = ({
  isOpen,
  onSync,
  merge,
  onMerge,
  anonymous,
  onClose,
}) => {
  const [mode, setMode] = useState<SyncMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);

  // 询问步必须二选一：Esc/遮罩/关闭一律不放行,免得误关让本机记录失联
  const requestClose = () => {
    if (merge?.requireDecision) return;
    onClose();
  };

  // Esc 阖之、点遮罩阖之、开时锁背景滚动、阖时焦点归位（三弹层共用）
  const { panelRef, backdropProps } = useSheetBehavior(isOpen, requestClose);

  // 每回开启都是干净表单：不带走上一回输了没登上的账号
  useEffect(() => {
    if (!isOpen) return;
    setEmail('');
    setPassword('');
    setBusy(false);
    setMergeBusy(false);
    setMode('signin');
  }, [isOpen]);

  if (!isOpen) return null;

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 6;
  const showMerge = merge !== null;
  const mergeRows = MERGE_TABLES.filter((table) => merge && merge.counts[table] > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      {...backdropProps}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-sheet-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        /* 版框：与主页同源的外粗内细墨线,不用阴影 */
        className="w-full sm:max-w-md bg-paper rounded-t-lg sm:rounded-lg border-2 border-ink p-[3px] overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex flex-col min-h-0 flex-1 border border-ink/55 rounded-[5px] overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b-2 border-ink flex items-center justify-between">
          <h3 id="sync-sheet-title" className="font-serif text-lg font-medium text-ink">
            {showMerge ? (merge?.requireDecision ? '本机之录 · 并入账号' : '继续上次合并') : '同步到我的账号'}
          </h3>
          {(!showMerge || !merge?.requireDecision) && (
            <button
              onClick={onClose}
              aria-label="阖之"
              className="p-1 rounded-lg text-ink3 hover:text-ink hover:bg-linesoft transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ---------------- 步骤二：询问后合并 ---------------- */}
        {showMerge && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-[13px] font-sans">
            <p className="text-[12px] text-ink3 leading-relaxed">
              这台设备的本机身份下还留着已录的记录。并入你的账号后，各设备都看得到；
              账号里已有的同一条记录不覆盖、不重复。
            </p>

            <ul className="border border-control rounded-lg divide-y divide-linesoft">
              {mergeRows.map((table) => (
                <li key={table} className="flex items-center justify-between px-3 py-2">
                  <span className="text-ink2">{TABLE_CN[table]}</span>
                  <span className="text-ink font-medium">{merge?.counts[table] ?? 0} 条</span>
                </li>
              ))}
              {mergeRows.length === 0 && (
                <li className="px-3 py-2 text-ink3">本机身份下没有记录</li>
              )}
            </ul>

            <button
              type="button"
              disabled={mergeBusy}
              onClick={() => {
                if (mergeBusy) return;
                setMergeBusy(true);
                void onMerge(true).then((done) => {
                  setMergeBusy(false);
                  if (!done) return; // 失败留在本步,可再试或改选「只要账号数据」
                });
              }}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mergeBusy ? <span>并入中…</span> : <span>一并并入账号</span>}
            </button>

            <button
              type="button"
              disabled={mergeBusy}
              onClick={() => {
                if (mergeBusy) return;
                setMergeBusy(true);
                void onMerge(false).then(() => setMergeBusy(false));
              }}
              className="btn-link w-full disabled:opacity-50"
            >
              <span>{merge?.requireDecision ? '只要账号数据' : '暂不并入'}</span>
            </button>
          </div>
        )}

        {/* ---------------- 步骤一：登录 / 注册 ---------------- */}
        {!showMerge && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            setBusy(true);
            await onSync(email.trim(), password, mode);
            setBusy(false);
          }}
          className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-[13px] font-sans"
        >
          <div className="flex border border-control rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('signin')}
              aria-pressed={mode === 'signin'}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors cursor-pointer ${
                mode === 'signin' ? 'bg-ink text-paper' : 'bg-surface text-ink2 hover:bg-linesoft'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>登录</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              aria-pressed={mode === 'signup'}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors cursor-pointer ${
                mode === 'signup' ? 'bg-ink text-paper' : 'bg-surface text-ink2 hover:bg-linesoft'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>注册新账号</span>
            </button>
          </div>

          <p className="text-[12px] text-ink3 leading-relaxed">
            {mode === 'signin'
              ? '在每台设备上登一次这个账号，各设备就共享同一份记录；登录状态自动续期，日常不用反复登。'
              : '设一个邮箱与密码即成账号：之后在任何设备用同一组邮箱密码登录，记录都在。'}
          </p>

          {anonymous && (
            <p className="flex items-start gap-1.5 text-[12px] text-danger leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                这台设备目前是本机身份：登录后改用账号身份。本机已录的内容会在下一步问你是否并入，
                不会静默丢掉。
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
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent"
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
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent"
            />
          </div>

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
                <span>{mode === 'signin' ? '登录并同步' : '创建账号并同步'}</span>
              </>
            )}
          </button>

          <p className="text-[12px] text-ink4 leading-relaxed">
            也可以在 Supabase 后台预建账号：Authentication → Users → Add user（勾选 Auto Confirm）。
          </p>
        </form>
        )}
        </div>
      </motion.div>
    </div>
  );
};
