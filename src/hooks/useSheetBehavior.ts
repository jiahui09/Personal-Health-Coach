/**
 * 弹层共用行为：Esc 阖之、点遮罩阖之、开时锁滚动、阖时焦点归位。
 * 三个录事件（录事 / 体征档 / 同步）共用，行为与文案各自保留。
 */
import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface SheetBehavior {
  /** 面板本体：挂 ref 与 role=dialog，开时接收焦点。 */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** 铺在最外层的遮罩属性：点空白处即阖之（点在面板上不算）。 */
  backdropProps: {
    onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  };
}

export function useSheetBehavior(isOpen: boolean, onClose: () => void): SheetBehavior {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return {
    panelRef,
    backdropProps: {
      onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      },
    },
  };
}
