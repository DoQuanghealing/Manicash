/**
 * Day 6 sample — prints engine event output for 3 representative
 * domain events so leadership can see the mapping concretely.
 *
 * Run via:
 *   node -e "process.env.JITI_ALIAS=JSON.stringify({'@':process.cwd()+'/src'});
 *            require('jiti/register');
 *            require('./tests/three-account/sample-domain-events.ts')"
 */

import { toEngineEvents } from '@/core/finance/domainEventAdapter';
import type {
  AllocateToSavingEvent,
  IncomeReceivedEvent,
  PayBillEvent,
} from '@/core/finance/domainEvents';

function divider(title: string): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════════════');
}

// ── 1. INCOME_RECEIVED ───────────────────────────────────────────────
divider('1. INCOME_RECEIVED  (lương vào tài khoản thu nhập)');
const inc: IncomeReceivedEvent = {
  id: 'income-may-salary',
  type: 'INCOME_RECEIVED',
  amount: 19_111_550,
  occurredAt: '2026-05-01T09:00:00.000Z',
  incomeKind: 'salary',
  categoryId: 'salary',
  description: 'Lương tháng 5',
};
console.log('Domain event:');
console.log(JSON.stringify(inc, null, 2));
console.log('');
console.log('→ Engine events:');
console.log(JSON.stringify(toEngineEvents(inc), null, 2));

// ── 2. ALLOCATE_TO_SAVING ────────────────────────────────────────────
divider('2. ALLOCATE_TO_SAVING  (chuyển vào quỹ dự phòng)');
const alloc: AllocateToSavingEvent = {
  id: 'alloc-may-reserve',
  type: 'ALLOCATE_TO_SAVING',
  amount: 800_000,
  occurredAt: '2026-05-01T09:06:00.000Z',
  savingBucket: 'reserve',
  monthKey: '2026-05',
  allocationSessionId: 'sess-may-01',
};
console.log('Domain event:');
console.log(JSON.stringify(alloc, null, 2));
console.log('');
console.log('→ Engine events:');
console.log(JSON.stringify(toEngineEvents(alloc), null, 2));

// ── 3. PAY_BILL ──────────────────────────────────────────────────────
divider('3. PAY_BILL  (trả tiền nhà đúng hạn)');
const bill: PayBillEvent = {
  id: 'pay-may-rent',
  type: 'PAY_BILL',
  amount: 2_500_000,
  occurredAt: '2026-05-05T09:00:00.000Z',
  billId: 'bill-rent',
  dueDay: 5,
  paidOnTime: true,
  description: 'Tiền nhà tháng 5',
};
console.log('Domain event:');
console.log(JSON.stringify(bill, null, 2));
console.log('');
console.log('→ Engine events:');
console.log(JSON.stringify(toEngineEvents(bill), null, 2));

console.log('');
