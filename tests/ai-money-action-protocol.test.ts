/* Phase 4A — action protocol flow (server-side build + validate, no execute) */
import { toMoneySnapshotV1 } from '@/lib/moneyBrain';
import type { ClientSnapshotInput } from '@/lib/aiMoneyChat/aggregation/types';
import { parseActionCommand } from '@/lib/aiMoneyChat/actions/actionCommandParser';
import { validateActionRequestAgainstSnapshot } from '@/lib/aiMoneyChat/actions/actionValidators';
import { createActionRequest } from '@/lib/aiMoneyChat/actions/actionRequestBuilder';

function it(name: string, fn: () => void): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq(a: unknown, b: unknown): void {
  if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

const INPUT: ClientSnapshotInput = {
  version: 'money_snapshot_v1', clientNow: '2026-06-08T03:00:00Z', timezone: 'Asia/Ho_Chi_Minh',
  wallets: { main: 10_000_000, emergency: 5_000_000, billFund: 2_000_000 },
  bills: [
    { id: 'b1', name: 'Tiền điện', amount: 350_000, dueDay: 10, isPaid: false },
    { id: 'b2', name: 'Internet', amount: 250_000, dueDay: 12, isPaid: true },
  ],
};
const SNAP = toMoneySnapshotV1(INPUT);

/** Mô phỏng tryBuildActionReply của /api/chat (không import route Next.js). */
function buildActionReply(message: string) {
  const req = parseActionCommand(message, SNAP);
  if (!req) return null;
  const v = validateActionRequestAgainstSnapshot(SNAP, req);
  return v.ok ? { actionRequest: req } : { clarification: v.reason };
}

function main() {
  console.log('\naction protocol');

  it('action command -> trả actionRequest (pending_confirmation)', () => {
    const out = buildActionReply('đánh dấu tiền điện đã đóng');
    const ar = out && 'actionRequest' in out ? out.actionRequest : null;
    ok(ar !== null, 'has actionRequest');
    eq(ar!.action, 'MARK_BILL_PAID');
    eq(ar!.status, 'pending_confirmation');
    eq(ar!.requiresConfirmation, true);
  });

  it('pure query -> KHÔNG có actionRequest', () => {
    eq(buildActionReply('bill nào chưa đóng'), null);
    eq(buildActionReply('hôm nay tôi chi bao nhiêu'), null);
  });

  it('invalid action (bill đã đóng) -> clarification, không actionRequest', () => {
    // Bill b2 đã đóng -> tạo request thủ công rồi validate -> fail.
    const req = createActionRequest(SNAP, {
      action: 'MARK_BILL_PAID',
      payload: { billId: 'b2', billName: 'Internet', amount: 250_000 },
      preview: '',
    });
    const v = validateActionRequestAgainstSnapshot(SNAP, req);
    ok(!v.ok, 'validation fails');
    if (!v.ok) ok(v.reason.length > 0, 'has reason');
  });

  it('deterministic: parseActionCommand đồng bộ, không Promise (không gọi LLM)', () => {
    const r = parseActionCommand('ghi chi 50k cà phê', SNAP);
    ok(!(r instanceof Promise), 'sync result, no LLM');
    eq(r?.action, 'CREATE_EXPENSE');
  });

  it('snapshot adapter (ClientSnapshotInput) hoạt động với parser', () => {
    const out = buildActionReply('tôi vừa nhận lương 15tr');
    ok(out !== null && 'actionRequest' in out, 'income request built');
  });

  console.log('\naction protocol test complete.');
}

main();
