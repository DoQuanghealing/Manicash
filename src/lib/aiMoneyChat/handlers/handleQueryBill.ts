/* ═══ Handler — Bills (deterministic, 0 token) ═══
 * Gộp 3 ý định bill, tự phân nhánh theo intent.type + slot:
 *   QUERY_BILL_STATUS    -> "tiền điện đóng chưa" / "còn bill nào chưa đóng"
 *   QUERY_UPCOMING_BILLS -> "7 ngày tới có bill nào"
 *   QUERY_BILL_COVERAGE  -> "quỹ bill có đủ trả bill không"
 *
 * Upcoming + coverage dùng Money Brain billMetrics. Status giữ logic snapshot
 * tổng hợp (đã tính sẵn paid/due/overdue) để không phá test cũ.
 */

import { getFinanceSnapshot } from '../aggregation/snapshotBuilder';
import type { ChatHandlerContext, SnapshotBill } from '../aggregation/types';
import { normalize } from '../intent/intentClassifier';
import { extractSlots } from '../intent/slotExtractor';
import type { ChatIntent, ChatReply } from '../intent/types';
import { formatVnd } from './format';
import { buildMoneySnapshot, deterministicReply, NEED_SYNC_MESSAGE } from './engineContext';
import { bulletList } from '../response/formatMoney';
import {
  getUpcomingBills,
  getTotalUnpaidBills,
  getBillFundGap,
} from '@/lib/moneyBrain/billMetrics';

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

function extractBillSlot(normalizedText: string): { label: string; keywords: string[] } | null {
  for (const entry of BILL_KEYWORDS) {
    if (entry.keywords.some((kw) => normalizedText.includes(kw))) return entry;
  }
  return null;
}

function describeBill(bill: SnapshotBill): string {
  return `Hóa đơn ${bill.name} ${formatVnd(bill.amount)} tháng này ngài **${STATUS_LABEL[bill.status]}**.`;
}

/** True nếu câu hỏi về việc quỹ bill có đủ trả bill không. */
function isCoverageQuery(intent: ChatIntent, text: string): boolean {
  if (intent.type === 'QUERY_BILL_COVERAGE') return true;
  if (text.includes('quy bill')) return true;
  return /du .*tra|du de tra|co du tra|tra du/.test(text) && text.includes('bill');
}

/** True nếu câu hỏi về bill sắp đến hạn. */
function isUpcomingQuery(intent: ChatIntent, text: string, days: number | undefined): boolean {
  if (intent.type === 'QUERY_UPCOMING_BILLS') return true;
  if (days !== undefined) return true;
  return /\bsap\b|\bden han\b|ngay toi|tuan toi|sap dong|sap toi/.test(text);
}

export async function handleQueryBill(
  uid: string,
  intent: ChatIntent,
  ctx: ChatHandlerContext = {},
): Promise<ChatReply> {
  const slots = extractSlots(intent.rawText);
  const text = intent.normalizedText;
  const money = buildMoneySnapshot(ctx);

  // ─── Coverage: quỹ bill có đủ trả bill chưa đóng không ───
  if (isCoverageQuery(intent, text)) {
    if (!money) return deterministicReply(NEED_SYNC_MESSAGE, intent);
    const unpaid = getTotalUnpaidBills(money);
    const billFund = money.wallets.billFund;
    if (unpaid <= 0) {
      return deterministicReply(
        `Ngài đã đóng hết bill tháng này. Quỹ bill hiện có **${formatVnd(billFund)}**.`,
        intent,
      );
    }
    const gap = getBillFundGap(money);
    if (gap > 0) {
      return deterministicReply(
        [
          `Quỹ bill hiện có **${formatVnd(billFund)}**.`,
          `Bill chưa đóng là **${formatVnd(unpaid)}**.`,
          '',
          `Ngài còn thiếu **${formatVnd(gap)}** để khóa đủ bill tháng này.`,
        ].join('\n'),
        intent,
      );
    }
    return deterministicReply(
      [
        'Quỹ bill đã đủ trả toàn bộ bill chưa đóng tháng này.',
        `Sau khi trả bill, quỹ bill còn dư **${formatVnd(billFund - unpaid)}**.`,
      ].join('\n'),
      intent,
    );
  }

  // ─── Upcoming: bill trong N ngày tới ───
  if (isUpcomingQuery(intent, text, slots.days)) {
    if (!money) return deterministicReply(NEED_SYNC_MESSAGE, intent);
    const days = slots.days ?? 7;
    const upcoming = getUpcomingBills(money, days);
    if (upcoming.length === 0) {
      return deterministicReply(`Trong ${days} ngày tới ngài không có bill nào cần xử lý.`, intent);
    }
    const total = upcoming.reduce((s, b) => s + b.amount, 0);
    const lines = [
      `Trong ${days} ngày tới ngài có **${upcoming.length}** bill cần xử lý, tổng **${formatVnd(total)}**:`,
      bulletList(upcoming.map((b) => `${b.name} — ${formatVnd(b.amount)} — hạn ngày ${b.dueDay}`)),
    ];
    return deterministicReply(lines.join('\n'), intent);
  }

  // ─── Status: dùng snapshot tổng hợp (đã tính paid/due/overdue) ───
  const snap = await getFinanceSnapshot(uid, { clientSnapshot: ctx.clientSnapshot });
  const bills = snap.bills.items;

  if (bills.length === 0) {
    const warn = snap.meta.warnings[0];
    return deterministicReply(
      warn
        ? `Hiện chưa có dữ liệu hóa đơn để đối chiếu.\n\n_${warn}_`
        : 'Ngài chưa thiết lập hóa đơn cố định nào tháng này.',
      intent,
    );
  }

  const slot = extractBillSlot(text);

  if (slot) {
    const matched = bills.filter((b) => {
      const foldedName = normalize(b.name);
      return slot.keywords.some((kw) => foldedName.includes(kw));
    });
    if (matched.length === 0) {
      return deterministicReply(
        `Mình không tìm thấy hóa đơn **${slot.label}** trong danh sách của ngài tháng này.`,
        intent,
      );
    }
    return deterministicReply(matched.map(describeBill).join('\n'), intent);
  }

  const unpaid = bills.filter((b) => b.status !== 'paid');
  const lines = ['Tình trạng hóa đơn tháng này:', ...bills.map((b) => `- ${describeBill(b)}`)];
  if (unpaid.length > 0) {
    lines.push('', `Tổng còn phải đóng: **${formatVnd(snap.bills.totalDue)}** (${unpaid.length} hóa đơn).`);
  } else {
    lines.push('', 'Ngài đã đóng hết hóa đơn tháng này. Tuyệt vời.');
  }

  return deterministicReply(lines.join('\n'), intent);
}
