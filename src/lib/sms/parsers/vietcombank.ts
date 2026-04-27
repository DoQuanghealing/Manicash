/* ═══ Vietcombank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (expense):
 *     "TK 0001234567890 (VCB): -250,000 VND luc 25/04/2026 14:30. So du 1,234,567 VND. ND: GRAB FOOD HCMC"
 *
 *   Sample 2 (income):
 *     "VCB: TK x1234567 GD: +5,000,000VND luc 14:30 25/04/26. SD: 5,234,567VND. ND: LUONG THANG 4"
 *
 *   Sample 3 (transfer):
 *     "VCB: TK 1234******: +500,000VND, 25/04/26 14:30, SD: 6,234,567VND. NDCT: GD CK NHAN ABC"
 *
 * Notes:
 *   - VCB SMS thường có "TK" prefix với account number, đôi khi có "(VCB)" inline.
 *   - Description thường ở field "ND" hoặc "NDCT".
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const vietcombankParser: BankSMSParser = {
  bank: 'vietcombank',
  parse: parseStandardSms,
};
