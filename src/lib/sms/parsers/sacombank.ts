/* ═══ Sacombank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (expense):
 *     "STB: GD: -300,000VND luc 25/04/2026 14:30. SD: 2,000,000VND. ND: VINMART"
 *
 *   Sample 2 (income):
 *     "Sacombank: TK 0123*** +1,000,000VND luc 14:30 25/04. SD 4,500,000VND. ND: LUONG T4"
 *
 *   Sample 3 (mobile banking):
 *     "STB: TK *1234. -75,000VND, 25/04/26 14:30. SD: 1,234,567VND. ND: GRABFOOD HCMC"
 *
 * Notes:
 *   - Sender variant: "STB" (Sacombank ticker), "Sacombank".
 *   - Format chuẩn — dùng common parser.
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const sacombankParser: BankSMSParser = {
  bank: 'sacombank',
  parse: parseStandardSms,
};
