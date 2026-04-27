/* ═══ TPBank SMS Parser ═══
 *
 * EXPECTED FORMAT (VERIFIED: NO — researched từ public sources, verify với SMS thật):
 *
 *   Sample 1 (income):
 *     "TPBank: TK 0123 +1,500,000 VND luc 14:30 25/04. SD 3,500,000 VND. Nd: LUONG T4"
 *
 *   Sample 2 (expense):
 *     "TPB: -250,000VND, 14:30 25/04/2026. SD 2,000,000VND. ND: HIGHLAND COFFEE"
 *
 *   Sample 3 (eBank notification):
 *     "TPBank eBank: TK *1234 GD: -100,000VND luc 14:30 25/04. SD: 1,234,567VND. Nd: PHARMACITY"
 *
 * Notes:
 *   - TPBank đôi khi dùng "Nd:" (lowercase d) thay vì "ND:".
 *   - Sender variant: "TPB", "TPBank", "TPBank eBank".
 */

import type { BankSMSParser } from './types';
import { parseStandardSms } from './_common';

export const tpbankParser: BankSMSParser = {
  bank: 'tpbank',
  parse: parseStandardSms,
};
