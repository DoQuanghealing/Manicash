/* ═══ ACB SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (income):
 *     "ACB: TK *1234 GD: +200,000VND luc 14:30 25/04/26. SD 1,500,000VND. NDCT: HIGHLAND HCMC"
 *
 *   Sample 2 (expense):
 *     "ACB: TK 1234*** -150,000VND, 14:30 25/04. SD: 3,500,000VND. NDCT: GRAB ABC HCMC"
 *
 *   Sample 3 (debit card):
 *     "ACB: GD POS: -450,000VND luc 25/04/2026 14:30. SD 2,000,000VND. ND: VINMART HCMC"
 *
 * Notes:
 *   - ACB hay dùng "NDCT" (Noi Dung Chi Tiet) field, dài hơn "ND" thông thường.
 *   - "GD POS" prefix khi giao dịch qua POS terminal.
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const acbParser: BankSMSParser = {
  bank: 'acb',
  parse: parseStandardSms,
};
