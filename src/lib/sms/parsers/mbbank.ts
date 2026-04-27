/* ═══ MB Bank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (expense):
 *     "MBBank: TK 0123. -50,000VND, 14:30 25/04/2026. SD 2,000,000VND. ND: GRAB*ABC HCMC"
 *
 *   Sample 2 (income):
 *     "MB: TK *1234 +200,000VND luc 14:30 25/04. SD 1,234,567VND. ND: NGUYEN VAN B chuyen tien"
 *
 *   Sample 3 (alternate sender):
 *     "MB Bank: GD: -120,000VND luc 25/04/26 14:30. SD: 3,500,000VND. ND: SHOPEEPAY"
 *
 * Notes:
 *   - MB hay dùng "GD:" prefix trước amount.
 *   - Sender thường gặp: "MB", "MBBank", "MB Bank".
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const mbbankParser: BankSMSParser = {
  bank: 'mbbank',
  parse: parseStandardSms,
};
