/* ═══ VPBank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (expense):
 *     "VPB: TK *1234 -100,000VND luc 25/04 14:30. SD 4,500,000VND. ND: SHOPEEPAY"
 *
 *   Sample 2 (income):
 *     "VPBank: GD +500,000VND luc 14:30 25/04/26. SD 5,000,000VND. ND: NHAN TIEN ABC"
 *
 *   Sample 3 (subscription notification):
 *     "VPBank: TK 1234***. -350,000VND, 25/04/2026 14:30. SD: 1,234,567VND. ND: NETFLIX"
 *
 * Notes:
 *   - Sender variant: "VPB", "VPBank", "VPBANK".
 *   - Format gần giống các bank chuẩn — dùng common parser.
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const vpbankParser: BankSMSParser = {
  bank: 'vpbank',
  parse: parseStandardSms,
};
