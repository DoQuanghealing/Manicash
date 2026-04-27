/* ═══ Techcombank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (income):
 *     "TCB: TK 19036*** GD: +5,000,000VND luc 14:30 25/04. SD: 5,234,567VND. ND: LUONG THANG 4"
 *
 *   Sample 2 (expense):
 *     "TCB: -1,000,000 VND, 14:30 25/04. SD: 2,500,000 VND. CT: SHOPEE PAY VN"
 *
 *   Sample 3 (notification subdomain):
 *     "Techcombank: TK 1234***. -250,000VND, 25/04/2026. SD 1,234,567VND. ND: HIGHLAND COFFEE"
 *
 * Notes:
 *   - TCB hay dùng "CT" thay vì "ND" cho field description.
 *   - Đôi khi prefix sender "TCB Soi" hoặc "TCB" tuỳ thiết bị.
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const techcombankParser: BankSMSParser = {
  bank: 'techcombank',
  parse: parseStandardSms,
};
