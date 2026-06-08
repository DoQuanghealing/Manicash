/* ═══ Handler — QUERY_BILL_STATUS (deterministic, 0 token) ═══
 * "tiền điện đóng chưa" -> bóc slot loại bill (điện/nước/internet/thuê nhà...)
 * rồi đối chiếu snapshot trả lời tường minh trạng thái paid/due/overdue.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, SnapshotBill } from '../aggregation/types';
import { normalize } from '../intent/intentClassifier';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';

/** Từ khóa loại bill -> các keyword (đã fold dấu) để match tên bill. */
const BILL_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: 'điện', keywords: ['dien'] },
  { label: 'nước', keywords: ['nuoc'] },
  { label: 'internet', keywords: ['internet', 'wifi', 'mang'] },
  { label: 'thuê nhà', keywords: ['thue nha', 'tien nha', 'nha tro', 'thue'] },
  { label: 'điện thoại', keywords: ['dien thoai', 'phone', 'sim'] },
  { label: 'truyền hình', keywords: ['truyen hinh', 'tv', 'cap'] },
];

const STATUS_LABEL: Record<SnapshotBill['status'], string> = {
  paid: 'ĐÃ ĐÓNG rồi',
  due: 'CHƯA ĐÓNG',
  overdue: 'QUÁ HẠN chưa đóng',
};

/** Bóc loại bill người dùng hỏi từ câu (đã normalize). Trả null nếu hỏi chung. */
function extractBillSlot(normalizedText: string): { label: string; keywords: string[] } | null {
  for (const entry of BILL_KEYWORDS) {
    if (entry.keywords.some((kw) => normalizedText.includes(kw))) return entry;
  }
  return null;
}

function describeBill(bill: SnapshotBill): string {
  return `Hóa đơn ${bill.name} ${formatVnd(bill.amount)} tháng này ngài **${STATUS_LABEL[bill.status]}**.`;
}

export async function handleQueryBill(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const bills = snap.bills.items;

  // Không có dữ liệu bill nào.
  if (bills.length === 0) {
    const warn = snap.meta.warnings[0];
    return {
      message: warn
        ? `Hiện chưa có dữ liệu hóa đơn để đối chiếu.\n\n_${warn}_`
        : 'Ngài chưa thiết lập hóa đơn cố định nào tháng này.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  const slot = extractBillSlot(intent.normalizedText);

  // Hỏi cụ thể 1 loại bill.
  if (slot) {
    const matched = bills.filter((b) => {
      const foldedName = normalize(b.name);
      return slot.keywords.some((kw) => foldedName.includes(kw));
    });

    if (matched.length === 0) {
      return {
        message: `Mình không tìm thấy hóa đơn **${slot.label}** trong danh sách của ngài tháng này.`,
        ui: { kind: 'none' },
        meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
      };
    }

    return {
      message: matched.map(describeBill).join('\n'),
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // Hỏi chung -> tóm tắt toàn bộ.
  const unpaid = bills.filter((b) => b.status !== 'paid');
  const lines = ['Tình trạng hóa đơn tháng này:', ...bills.map((b) => `- ${describeBill(b)}`)];
  if (unpaid.length > 0) {
    lines.push('', `Tổng còn phải đóng: **${formatVnd(snap.bills.totalDue)}** (${unpaid.length} hóa đơn).`);
  } else {
    lines.push('', 'Ngài đã đóng hết hóa đơn tháng này. Tuyệt vời.');
  }

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
