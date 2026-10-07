/**
 * 弹层共用行为：Esc 阖之、点遮罩阖之、开时锁滚动、阖时焦点归位、
 * Tab 焦点圈定于面板（首尾循环）、面板外宿主 inert（aria-modal 才名副其实）。
 * 三个录事件（录事 / 体征档 / 同步）共用，行为与文案各自保留。
 */
import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface SheetBehavior {
  /** 面板本体：挂 ref 与 role=dialog，开时接收焦点。 */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** 铺在最外层的遮罩属性：点空白处即阖之（点在面板上不算；可被 allowBackdropClose 拦下）。 */
  backdropProps: {
    onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  };
}

export interface SheetBehaviorOptions {
  /** 点遮罩是否准许阖之；返回 false 即拦下并回呼 onBackdropBlocked（表中有未存之稿时用）。 */
  allowBackdropClose?: () => boolean;
  onBackdropBlocked?: () => void;
}

/** 焦点圈定的候选序：可交互且未禁用者，隐藏节点不计。 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useSheetBehavior(
  isOpen: boolean,
  onClose: () => void,
  options: SheetBehaviorOptions = {}
): SheetBehavior {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const allowRef = useRef(options.allowBackdropClose);
  allowRef.current = options.allowBackdropClose;
  const blockedRef = useRef(options.onBackdropBlocked);
  blockedRef.current = options.onBackdropBlocked;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // 焦点圈定：Tab / Shift+Tab 在面板首尾循环，逃不出版框
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (n) => n.getClientRects().length > 0
      );
      const active = document.activeElement;
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      if (!panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? nodes[nodes.length - 1] : nodes[0]).focus();
        return;
      }
      if (e.shiftKey && active === nodes[0]) {
        e.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!e.shiftKey && active === nodes[nodes.length - 1]) {
        e.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 背景 inert：遮罩之外的一切（含 <main>）对键鼠与读屏一并不可达；
    // 回执 toast（role=status）除外——它须在模态期间仍被读出。
    const inertized: HTMLElement[] = [];
    const backdrop = panelRef.current?.parentElement;
    const host = backdrop?.parentElement;
    if (backdrop && host) {
      for (const child of Array.from(host.children)) {
        const el = child as HTMLElement;
        if (el === backdrop || el.getAttribute('role') === 'status') continue;
        el.setAttribute('inert', '');
        inertized.push(el);
      }
    }

    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      for (const el of inertized) el.removeAttribute('inert');
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return {
    panelRef,
    backdropProps: {
      onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (allowRef.current && !allowRef.current()) {
          blockedRef.current?.();
          return;
        }
        onCloseRef.current();
      },
    },
  };
}
