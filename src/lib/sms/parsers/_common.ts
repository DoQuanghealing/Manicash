/* ═══ Shared SMS Parser Helpers ═══
 *
 * Pure helpers — regex extract amount, balance, description, timestamp.
 * Hầu hết bank VN dùng format gần giống nhau, dùng chung helpers tránh duplicate.
 * Bank parser nào cần override → wrap parseStandardSms + post-process.
 */

import type { ParsedTransaction } from './types';

/** Regex extract amount + sign. Bắt cả "+200,000VND", "-200.000 VND", "GD: 200,000VND". */
const AMOUNT_REGEX = /([+-])?\s*([\d.,]+)\s*VND/i;

/** Số dư sau giao dịch — match SD/so du/sodu. */
const BALANCE_REGEX = /(?:SD|so\s*du|sodu)\s*:?\s*([\d.,]+)\s*VND/i;

/** Description — match NDCT/noi dung/ND/CT/Nd, longer-first ordering quan trọng. */
const DESC_REGEX = /(?:NDCT|noi\s*dung|ND|CT|Nd)\s*:?\s*(.+)$/im;

/** Timestamp dạng "25/04/2026 14:30" hoặc "25-04-26 14:30". TZ giả định +07:00 (VN). */
const TIMESTAMP_REGEX = /(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\s+(\d{1,2}):(\d{2})/;

/** SMS không phải transaction — return null sớm. */
const SKIP_PATTERNS: RegExp[] = [
  /\botp\b/i,
  /ma\s*xac\s*thuc/i,
  /password/i,
  /mat\s*khau/i,
  /khuyen\s*mai/i,
  /tri\s*an\s*khach\s*hang/i,
];

/**
 * Parse VN-style amount string. Strip thousand separators (cả `.` và `,`).
 * Assume VND không có decimal — note PENDING nếu cần handle "1.234.567,00".
 */
export function parseAmountString(raw: string): number {
  return parseInt(raw.replace(/[.,]/g, ''), 10) || 0;
}

export function shouldSkip(body: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(body));
}

export function extractAmount(body: string): { sign: '+' | '-' | null; amount: number } | null {
  const m = body.match(AMOUNT_REGEX);
  if (!m) return null;
  const amount = parseAmountString(m[2]);
  if (amount === 0) return null;
  const rawSign = m[1];
  const sign: '+' | '-' | null = rawSign === '+' ? '+' : rawSign === '-' ? '-' : null;
  return { sign, amount };
}

export function extractBalance(body: string): number | null {
  const m = body.match(BALANCE_REGEX);
  if (!m) return null;
  const v = parseAmountString(m[1]);
  return v > 0 ? v : null;
}

export function extractDescription(body: string): string {
  const m = body.match(DESC_REGEX);
  return m ? m[1].trim() : '';
}

export function extractTimestamp(body: string): string | null {
  const m = body.match(TIMESTAMP_REGEX);
  if (!m) return null;
  const dd = m[1];
  const mm = m[2];
  let yy = m[3];
  const hh = m[4];
  const min = m[5];
  if (yy.length === 2) yy = `20${yy}`;
  const iso = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min}:00+07:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Phân loại income/expense — ưu tiên dấu, fallback heuristic keyword. */
export function inferType(body: string, sign: '+' | '-' | null): 'income' | 'expense' {
  if (sign === '+') return 'income';
  if (sign === '-') return 'expense';
  if (/\b(?:nhan|nap|cong|chuyen\s*den|vao\s*tk)\b/i.test(body)) return 'income';
  return 'expense';
}

/**
 * Standard parse — dùng được cho hầu hết VN bank (VCB/TCB/MB/TPB/VPB/ACB/STB).
 * Bank parser nào cần thay đổi gì → wrap function này hoặc viết riêng.
 *
 * Returns null nếu:
 *   - SMS bị skip (OTP/marketing)
 *   - Không extract được amount
 */
export function parseStandardSms(body: string): ParsedTransaction | null {
  if (shouldSkip(body)) return null;
  const amt = extractAmount(body);
  if (!amt) return null;
  return {
    type: inferType(body, amt.sign),
    amount: amt.amount,
    balance: extractBalance(body),
    description: extractDescription(body),
    occurredAt: extractTimestamp(body),
  };
}
