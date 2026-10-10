/* ═══ useDialogFocus — hành vi bàn phím chuẩn cho hộp thoại/sheet ═══
 * Escape đóng · focus vào hộp khi mở · Tab/Shift+Tab đi vòng TRONG hộp (bẫy focus) ·
 * đóng xong trả focus về phần tử đã mở (trừ khi skipRestore.current = true).
 */
'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts: { initialFocus?: 'panel' | 'first-input' } = {},
) {
  const skipRestore = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const initial = opts.initialFocus ?? 'panel';

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Cố ý đọc giá trị MỚI NHẤT lúc đóng (người gọi bật cờ ngay trước khi đóng) → giữ chính object ref.
    const skip = skipRestore;
    const panel = panelRef.current;
    if (panel) {
      const target = initial === 'first-input' ? panel.querySelector<HTMLElement>('input,textarea') : null;
      (target ?? panel).focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current.contains(active);
      if (e.shiftKey && (active === first || !inside || active === panelRef.current)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (!skip.current && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [panelRef, initial]);

  return { skipRestore };
}
