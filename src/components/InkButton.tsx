// 水墨按钮：光影跟随（悬停柔光随指针）、按下轻沉、落点起墨（涟漪自落点铺满按钮,噪点滤镜让边缘自然）。
// 交互层只用 transform/opacity 与绝对定位内嵌墨层——不改任何布局尺寸 → 状态切换零偏移。
// 松开后 click 触发既有业务逻辑（onSubmit/onClick）;此处只管落墨。
import React, { useRef } from 'react';

export type InkButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** 落点到四角的最大距离 = 铺满按钮所需半径（按钮几何,非业务算术）。 */
const spreadRadius = (x: number, y: number, w: number, h: number): number =>
  Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

export const InkButton: React.FC<InkButtonProps> = ({
  className = '',
  children,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onKeyUp,
  ...rest
}) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  /** 本次按下的落点（按钮内坐标）;键盘激活无落点 → 取按钮中心。 */
  const dropRef = useRef<{ x: number; y: number } | null>(null);

  const localPoint = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top, w: rect.width, h: rect.height };
  };

  /** 在落点生成一次墨迹：半径取到最远角,保证铺满按钮;动画结束自除。 */
  const dropInk = (x: number, y: number, w: number, h: number) => {
    const el = ref.current;
    if (!el) return;
    const radius = spreadRadius(x, y, w, h);
    const ink = document.createElement('span');
    ink.className = 'ink-ripple';
    ink.style.left = `${x}px`;
    ink.style.top = `${y}px`;
    ink.style.width = `${radius * 2}px`;
    ink.style.height = `${radius * 2}px`;
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
    el.appendChild(ink);
    // 墨已落纸：业务逻辑在 onClick/onSubmit（松开触发）,此处只记这一落。
    console.debug('墨已落纸');
  };

  return (
    <button
      ref={ref}
      className={`ink-btn ${className}`}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        const p = localPoint(e.clientX, e.clientY);
        if (p) {
          ref.current?.style.setProperty('--mx', `${p.x}px`);
          ref.current?.style.setProperty('--my', `${p.y}px`);
        }
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const p = localPoint(e.clientX, e.clientY);
        dropRef.current = p ? { x: p.x, y: p.y } : null;
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        const drop = dropRef.current;
        dropRef.current = null;
        const rect = ref.current?.getBoundingClientRect();
        if (drop && rect) dropInk(drop.x, drop.y, rect.width, rect.height);
      }}
      onKeyUp={(e) => {
        onKeyUp?.(e);
        // 键盘激活（回车/空格）无落点 → 落墨于按钮中心
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const rect = ref.current?.getBoundingClientRect();
        if (rect) dropInk(rect.width / 2, rect.height / 2, rect.width, rect.height);
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
