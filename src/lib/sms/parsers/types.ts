/* ═══ Bank SMS Parser Types ═══
 * Interface cho mỗi bank parser. Pure function — body string → ParsedTransaction | null.
 */

import type { BankCode } from '@/types/webhook';

/** Output của bank parser khi parse thành công SMS. */
export interface ParsedTransaction {
  type: 'income' | 'expense';
  amount: number;
  /** Số dư sau giao dịch — null nếu SMS không có field này. */
  balance: number | null;
  /** Nội dung giao dịch raw (merchant name, mô tả, ref code). */
  description: string;
  /** ISO timestamp khi giao dịch xảy ra (theo SMS) — null nếu không parse được. */
  occurredAt: string | null;
}

/**
 * Bank SMS parser — pure function, không side effect.
 *
 * Mỗi bank implement file riêng (vd `vietcombank.ts`) export 1 BankSMSParser.
 * Registry ở `parsers/index.ts` map sender → parser.
 *
 * `parse(body)` trả `null` khi:
 *   - SMS không phải transaction (balance check, OTP, marketing).
 *   - Format không khớp (sender đúng nhưng SMS body lạ).
 *
 * Caller (API route) sẽ map null → response status 'ignored' hoặc 'unparseable'.
 */
export interface BankSMSParser {
  bank: BankCode;
  parse: (body: string) => ParsedTransaction | null;
}
