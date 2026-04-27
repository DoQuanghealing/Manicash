/* ═══ Parser Registry — Sender → Bank → Parser dispatch ═══
 *
 * Single entry point cho API route: parseSms(sender, body).
 * Match-first-win với regex case-insensitive trên sender ID raw từ điện thoại.
 */

import type { BankCode } from '@/types/webhook';
import type { BankSMSParser, ParsedTransaction } from './types';
import { vietcombankParser } from './vietcombank';
import { techcombankParser } from './techcombank';
import { mbbankParser } from './mbbank';
import { tpbankParser } from './tpbank';
import { vpbankParser } from './vpbank';
import { acbParser } from './acb';
import { sacombankParser } from './sacombank';

interface SenderRule {
  pattern: RegExp;
  bank: BankCode;
}

/**
 * Sender ID regex → BankCode mapping. Order matters — first match wins.
 * Mỗi bank có nhiều biến thể sender (vd "VCB" hoặc "Vietcombank").
 */
const SENDER_PATTERNS: SenderRule[] = [
  { pattern: /^VCB|VietcomBank|Vietcombank/i, bank: 'vietcombank' },
  { pattern: /^TCB|Techcombank|TCBANK/i, bank: 'techcombank' },
  { pattern: /^MB|MBBank|MB Bank/i, bank: 'mbbank' },
  { pattern: /^TPB|TPBank|TPBANK/i, bank: 'tpbank' },
  { pattern: /^VPB|VPBank|VPBANK/i, bank: 'vpbank' },
  { pattern: /^ACB/i, bank: 'acb' },
  { pattern: /^STB|Sacombank/i, bank: 'sacombank' },
];

const PARSER_REGISTRY: Record<BankCode, BankSMSParser> = {
  vietcombank: vietcombankParser,
  techcombank: techcombankParser,
  mbbank: mbbankParser,
  tpbank: tpbankParser,
  vpbank: vpbankParser,
  acb: acbParser,
  sacombank: sacombankParser,
};

/** Detect bank từ sender ID. null nếu không match pattern nào. */
export function detectBankFromSender(sender: string): BankCode | null {
  for (const rule of SENDER_PATTERNS) {
    if (rule.pattern.test(sender)) return rule.bank;
  }
  return null;
}

/**
 * High-level entry: detect bank + dispatch parser.
 *
 * Returns:
 *   - null khi sender không match bank nào (caller → 422 unparseable)
 *   - { bank, parsed: null } khi parser detect SMS không phải transaction
 *     (caller → 200 ignored).
 *   - { bank, parsed: ParsedTransaction } khi parse OK.
 */
export function parseSms(
  sender: string,
  body: string,
): { bank: BankCode; parsed: ParsedTransaction | null } | null {
  const bank = detectBankFromSender(sender);
  if (!bank) return null;
  const parser = PARSER_REGISTRY[bank];
  return { bank, parsed: parser.parse(body) };
}

export type { ParsedTransaction } from './types';
