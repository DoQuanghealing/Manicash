/* ═══ Handler — LOG_TRANSACTION (deterministic, 0 token) ═══
 * Câu nhập liệu ("mua trứng 30k"). Slot đã được routeIntent() bơm sẵn từ
 * parseMoneyText. Handler chỉ dựng confirm card — việc GHI giao dịch thật vẫn
 * do client thực hiện sau khi user xác nhận (giữ nguyên flow Phase 1 cũ).
 */

import type { ChatIntent, ChatReply, LogTransactionSlots } from '../intent/types';
import { formatVnd } from './format';

const TYPE_LABEL: Record<NonNullable<LogTransactionSlots['type']>, string> = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  transfer: 'Chuyển quỹ',
};

/** Không cần uid/ctx — slot đã sẵn trong intent, việc ghi DB do client làm sau confirm. */
export async function handleLogTransaction(intent: ChatIntent): Promise<ChatReply> {
  const slots = intent.slots as LogTransactionSlots;

  // Không bóc được số tiền -> hỏi lại thay vì đoán.
  if (!slots.amount || !slots.type) {
    return {
      message: 'Mình chưa rõ giao dịch. Ngài thử ghi rõ số tiền và loại, ví dụ "mua trứng 30k" nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  const typeLabel = TYPE_LABEL[slots.type];
  const message = [
    `Xác nhận **${typeLabel}**:`,
    `- Số tiền: **${formatVnd(slots.amount)}**`,
    slots.categoryId ? `- Danh mục: \`${slots.categoryId}\`` : null,
    '',
    'Ngài bấm xác nhận để lưu giao dịch này nhé.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    message,
    ui: {
      kind: 'confirm-transaction',
      payload: {
        type: slots.type,
        amount: slots.amount,
        categoryId: slots.categoryId,
        rawText: intent.rawText,
      },
    },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
