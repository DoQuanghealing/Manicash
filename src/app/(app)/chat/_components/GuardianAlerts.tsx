/* ═══ Người Gác — khối nhắc nhở chủ động trong chat ═══
 *
 * Hành vi (PO chốt): khối nhắc nhở không được chiếm màn hình chat.
 *   · Bấm vào một nhắc nhở  → chạy câu hỏi tương ứng RỒI tắt nhắc nhở đó.
 *   · Vuốt ngang (trái/phải) → tắt nhắc nhở đó, không cần bấm đúng nút ×.
 *   · Sau 10 giây không đụng tới → tự thu vào chuông nhỏ kèm số lượng.
 *   · Bấm chuông mở lại → thôi tự thu (đang đọc thì đừng giật đi).
 *
 * Trạng thái "đã tắt" chỉ sống trong phiên: mở lại app mà tình hình tài chính
 * vẫn vậy thì quản gia nhắc lại — đây là cảnh báo tiền bạc, không phải quảng cáo.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { GuardianAlert } from '@/lib/aiMoneyChat/prism/guardian';

/** Vuốt quá ngưỡng này (px) thì coi là muốn tắt. */
const SWIPE_DISMISS_PX = 90;
/** Thời gian hiện trước khi tự thu vào chuông. */
const AUTO_COLLAPSE_MS = 10_000;

interface GuardianAlertsProps {
  alerts: GuardianAlert[];
  butlerName: string;
  /** Gửi câu hỏi gợi ý của nhắc nhở vào luồng chat. */
  onRunQuery: (query: string) => void;
}

export default function GuardianAlerts({ alerts, butlerName, onRunQuery }: GuardianAlertsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const pinnedRef = useRef(false);

  const visible = useMemo(
    () => alerts.filter((a) => !dismissedIds.includes(a.id)),
    [alerts, dismissedIds],
  );

  const dismiss = useCallback((id: string) => {
    setDismissedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  useEffect(() => {
    if (collapsed || pinnedRef.current || visible.length === 0) return;
    const timer = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [collapsed, visible.length]);

  /* ── Vuốt ngang để tắt ───────────────────────────────────────────────
   * Viết bằng pointer event thuần (không dùng gesture của thư viện) để chạy
   * giống nhau trên chuột lẫn cảm ứng và kiểm thử được. Chỉ "khoá" thành cử
   * chỉ vuốt khi ngón tay đi NGANG rõ hơn dọc — kéo dọc vẫn cuộn khung chat. */
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null);
  const gestureRef = useRef<{ id: string; x: number; y: number; pointerId: number; locked: boolean } | null>(null);
  const swipedRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    if (e.button > 0) return; // chỉ chuột trái / chạm
    /* Dọn cờ của lần trước: vuốt tắt xong thì thẻ biến mất nên KHÔNG có sự kiện
     * click theo sau để tự dọn — để sót là lần bấm kế tiếp bị nuốt oan. */
    swipedRef.current = false;
    gestureRef.current = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, locked: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        // Đây là cuộn dọc → nhả tay cho khung chat, và trả thẻ về chỗ cũ.
        gestureRef.current = null;
        setDrag(null);
        return;
      }
      if (Math.abs(dx) < 8) return;
      g.locked = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* trình duyệt không cho capture thì vẫn kéo được, chỉ kém mượt */
      }
    }
    setDrag({ id: g.id, dx });
  }

  function endGesture(dx: number, id: string) {
    if (Math.abs(dx) > 4) {
      /* Có kéo tay = không tính là bấm. Trình duyệt bắn `click` ngay sau
       * `pointerup` trong cùng lượt xử lý input, nên hẹn dọn cờ ở macrotask kế
       * tiếp là vừa đủ chặn đúng lần click đó. KHÔNG để cờ nằm lại: click từ
       * bàn phím (Enter) không có pointerdown đi trước, sẽ bị nuốt oan. */
      swipedRef.current = true;
      setTimeout(() => {
        swipedRef.current = false;
      }, 0);
      if (Math.abs(dx) > SWIPE_DISMISS_PX) dismiss(id);
    }
    gestureRef.current = null;
    setDrag(null);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    endGesture(e.clientX - g.x, g.id);
  }

  function handlePointerCancel() {
    gestureRef.current = null;
    setDrag(null);
  }

  if (visible.length === 0) return null;

  if (collapsed) {
    return (
      <div className="tg-guardian-dock">
        <button
          type="button"
          className="tg-guardian-bell"
          onClick={() => {
            pinnedRef.current = true;
            setCollapsed(false);
          }}
          aria-label={`Xem ${visible.length} nhắc nhở từ ${butlerName}`}
        >
          <Bell size={15} />
          <span className="tg-guardian-bell-count">{visible.length}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="tg-guardian" role="status" aria-label={`Cảnh báo từ ${butlerName}`}>
      <div className="tg-guardian-head">
        <span className="tg-guardian-avatar" aria-hidden>🛡️</span>
        <span className="tg-guardian-title">{butlerName} để ý thấy</span>
        <button
          type="button"
          className="tg-guardian-close"
          onClick={() => setCollapsed(true)}
          aria-label="Thu gọn vào chuông"
        >
          ×
        </button>
      </div>

      {visible.map((a) => {
        const dx = drag?.id === a.id ? drag.dx : 0;
        return (
          <div
            key={a.id}
            className="tg-guardian-swipe"
            style={{
              transform: dx ? `translateX(${dx}px)` : undefined,
              opacity: dx ? Math.max(0.25, 1 - Math.abs(dx) / 260) : 1,
              // Thả tay giữa chừng thì trượt về chỗ cũ; đang kéo thì bám ngón tay.
              transition: dx ? 'none' : 'transform 0.18s ease, opacity 0.18s ease',
            }}
            onPointerDown={(e) => handlePointerDown(e, a.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <button
              type="button"
              className={`tg-guardian-item tg-guardian-${a.severity}`}
              onClick={() => {
                // Vừa vuốt xong thì trình duyệt vẫn bắn click — bỏ qua lần đó.
                if (swipedRef.current) {
                  swipedRef.current = false;
                  return;
                }
                if (a.query) onRunQuery(a.query);
                dismiss(a.id);
              }}
            >
              <span className="tg-guardian-icon" aria-hidden>{a.icon}</span>
              <span className="tg-guardian-body">
                <span className="tg-guardian-item-title">{a.title}</span>
                <span className="tg-guardian-item-msg">{a.message}</span>
              </span>
              {a.query && <span className="tg-guardian-cta" aria-hidden>›</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}
