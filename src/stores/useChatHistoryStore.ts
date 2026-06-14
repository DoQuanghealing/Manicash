/* ═══ Chat History Store (Phase I) ═══
 * Lưu lịch sử chat Lord Diamond theo NGÀY (localStorage, mirror useActionAuditStore).
 * Tự xóa đoạn chat "qua ngày thứ 8" — giữ trọn các ngày trong vòng 7 ngày-lịch gần
 * nhất, đoạn cũ hơn (8+ ngày) bị dọn. dateKey theo LOCAL (đồng bộ fix timezone e9299b9,
 * KHÔNG dùng UTC). Báo khách hàng khi vừa dọn (lastCleaned).
 */
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage } from '@/types/chat';
import { localDateKey, pruneMessages, type StoredChatMessage } from '@/lib/chatRetention';

const MAX_MESSAGES = 500;
export const CHAT_HISTORY_STORAGE_KEY = 'manicash.chat-history.v1';

interface ChatHistoryState {
  messages: StoredChatMessage[];
  /** Thông tin lần dọn gần nhất (để hiện banner "đã dọn lịch sử cũ"). */
  lastCleaned: { removed: number; at: string } | null;
  /** Thêm tin vào lịch sử (đóng dấu createdAt + dateKey local). Bỏ tin welcome. */
  addMessages: (msgs: ChatMessage[], nowMs?: number) => void;
  /** Dọn tin cũ hơn 7 ngày. Trả số tin đã dọn + set lastCleaned. */
  prune: (nowMs?: number) => number;
  /** Xóa toàn bộ (logout/đổi tài khoản — chống rò rỉ chéo trên cùng trình duyệt). */
  clearAll: () => void;
}

export const useChatHistoryStore = create<ChatHistoryState>()(
  persist(
    (set, get) => ({
      messages: [],
      lastCleaned: null,

      addMessages: (msgs, nowMs) => {
        const now = nowMs !== undefined ? new Date(nowMs) : new Date();
        const dateKey = localDateKey(now);
        const stamped: StoredChatMessage[] = msgs
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({
            ...m,
            createdAt: m.createdAt ?? now.toISOString(),
            dateKey,
          }));
        if (stamped.length === 0) return;
        const merged = [...get().messages, ...stamped];
        set({ messages: merged.length > MAX_MESSAGES ? merged.slice(-MAX_MESSAGES) : merged });
      },

      prune: (nowMs) => {
        const now = nowMs !== undefined ? new Date(nowMs) : new Date();
        const { kept, removed } = pruneMessages(get().messages, now);
        if (removed > 0) {
          set({ messages: kept, lastCleaned: { removed, at: now.toISOString() } });
        }
        return removed;
      },

      clearAll: () => set({ messages: [], lastCleaned: null }),
    }),
    {
      name: CHAT_HISTORY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({ messages: s.messages, lastCleaned: s.lastCleaned }),
    },
  ),
);
