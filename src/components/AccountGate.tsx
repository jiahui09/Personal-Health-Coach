// 账号门（云端模式的唯一入口）：手记名即账号,首次写下即开册,换设备同名再见。
// 没有注册/登录之分,也就没有标签切换——单输入单按钮,整门零偏移：
// 一切提示与告警都收在按钮之下,出现时上方组件纹丝不动。
import React, { useState } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { accountNameError } from '../services/accountMarker';
import { InkButton } from './InkButton';

interface AccountGateProps {
  /** 打开手记（写归属标记 + 取数）；失败时 App 把仓库错误码存进 reason,由本门对症提示。 */
  onEnter: (name: string) => Promise<void>;
  /** 上次失败的仓库错误码；null = 无。 */
  reason: string | null;
}

/** 对症文案：不同错误码的根因与处置完全不同，未知码兜底如实报码。 */
const REASON_COPY: Record<string, string> = {
  auth: '标记未获放行：在 Supabase 重跑 supabase/schema.sql 的策略段（见部署文档 §2）',
  network: '连不上 Supabase · 检查网络后重试',
  rate_limited: '请求过于频繁 · 稍后重试',
  not_implemented: '后端未开通：核对 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY',
};

export const AccountGate: React.FC<AccountGateProps> = ({ onEnter, reason }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorCopy = localError ?? (reason ? (REASON_COPY[reason] ?? `未成（${reason}）`) : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = accountNameError(name);
    if (invalid) {
      setLocalError(invalid);
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await onEnter(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    // 卡片顶部锚定（不垂直居中）：告警出现在按钮下方时,卡片只向下生长,
    // 报头、输入与按钮的坐标一拍不变 —— 零偏移的几何保证。
    <div className="min-h-screen bg-paper flex justify-center px-6 pt-16 pb-16 sm:pt-24">
      <div className="w-full max-w-sm self-start">
        <div className="flex items-center gap-3.5 pb-4 border-b-2 border-ink">
          <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-seal text-white font-serif text-lg font-bold select-none">
            記
          </span>
          <div className="font-serif text-[17px] font-bold text-ink tracking-[0.08em]">
            个人健康手记
          </div>
        </div>

        <p className="mt-5 text-[13px] text-ink leading-relaxed">
          写下手记名即可进入——首次写下即开新册；换设备输同一个名字,见到的是同一册。
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-4">
          <label className="block">
            <span className="sr-only">手记名</span>
            <input
              type="text"
              required
              maxLength={32}
              aria-label="手记名"
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setLocalError(null);
              }}
              placeholder="手记名（例：我的手记）"
              className="w-full bg-surface border border-control rounded-lg px-3 py-2 text-[16px] text-ink focus:border-accent"
            />
          </label>

          <InkButton
            type="submit"
            disabled={busy}
            className="btn-primary w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span>开卷中…</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>打开手记</span>
              </>
            )}
          </InkButton>

          {/* 提示与告警一律收在按钮之下：出现时上方组件纹丝不动（零偏移） */}
          <p className="mt-3 text-[12px] text-ink4 leading-relaxed">
            手记名只是归属标记：不设密码、不发邮件；知其名者见其册,勿用旁人之名。
          </p>
          {errorCopy && (
            <p
              role="alert"
              className="mt-1.5 text-[13px] text-danger leading-relaxed flex items-start gap-1.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{errorCopy}</span>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
