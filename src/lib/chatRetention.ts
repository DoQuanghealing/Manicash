/* ═══ Chat history retention — phần THUẦN (test độc lập, no zustand/localStorage) ═══
 * Tự xóa đoạn chat "qua ngày thứ 8": giữ tin trong vòng keepDays ngày-LỊCH gần nhất
 * (mặc định 7), tin cũ hơn bị dọn. dateKey theo LOCAL (đồng bộ fix timezone e9299b9).
 */

import type { ChatMessage } from '@/types/chat';

export const CHAT_RETENTION_DAYS = 7;

export interface StoredChatMessage extends ChatMessage {
  createdAt: string;
  /** YYYY-MM-DD theo LOCAL. */
  dateKey: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD theo giờ LOCAL của client. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Mốc cắt: dateKey của (hôm nay − keepDays) theo NGÀY-LỊCH local (DST-safe — bỏ qua giờ).
 * Tin có dateKey < mốc này = cũ hơn keepDays ngày → bị dọn.
 */
export function cutoffDateKey(now: Date, keepDays: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - keepDays);
  return localDateKey(d);
}

/** PURE: lọc bỏ tin cũ hơn keepDays ngày-lịch. Trả {kept, removed}. */
export function pruneMessages(
  messages: StoredChatMessage[],
  now: Date,
  keepDays = CHAT_RETENTION_DAYS,
): { kept: StoredChatMessage[]; removed: number } {
  const cutoff = cutoffDateKey(now, keepDays);
  const kept = messages.filter((m) => m.dateKey >= cutoff);
  return { kept, removed: messages.length - kept.length };
}
