/* Phase 6B-2A — Serializer / Deserializer safety tests */
import { serializeMoneyStateToCloud, deserializeCloudMoneyDocument } from '@/lib/moneySync/serialize';
import type { LocalMoneyStateInput } from '@/lib/moneySync/cloudTypes';
import type { UserProfile } from '@/types/user';

type AsyncFn = () => void | Promise<void>;
async function it(name: string, fn: AsyncFn): Promise<void> {
  try { await fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, m?: string): void {
  if (a !== b) throw new Error(`${m ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(v: boolean, m: string): void { if (!v) throw new Error(m); }

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = '2026-06-13T03:00:00Z';
const DEVICE_ID = 'dev-test-abc';
const UID = 'user-xyz-123';

const MOCK_USER: UserProfile = {
  uid: UID,
  displayName: 'Test User',
  email: 'test@example.com',
  photoURL: null,
  rank: 'iron',
  xp: 100,
  streak: 5,
  lastActiveDate: '2026-06-13',
  resistCount: 2,
  totalResistSaved: 50000,
  isPremium: false,
  plan: 'free',
  premiumExpiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: NOW,
};

function makeInput(overrides: Partial<LocalMoneyStateInput> = {}): LocalMoneyStateInput {
  return {
    uid: UID,
    now: NOW,
    deviceId: DEVICE_ID,
    finance: {
      transactions: [{ id: 'tx1', amount: 100000, type: 'expense', category: 'food', description: 'lunch', date: '2026-06-13', createdAt: NOW, updatedAt: NOW } as never],
      mainBalance: 5000000,
      emergencyBalance: 1000000,
      billFundBalance: 500000,
      fixedBills: [],
      billSnapshots: [],
    },
    budget: {
      carryOver: 0,
      currentMonth: '2026-06',
      categoryBudgets: [],
      flaggedCategories: [],
      flaggedTransactionIds: [],
      monthlySnapshots: [],
      unviewedReportMonth: null,
      xpAtMonthStart: 80,
    },
    goals: { goals: [] },
    tasks: { tasks: [], xpPenalties: [] },
    auth: { user: MOCK_USER },
    audit: { records: [] },
    ...overrides,
  };
}

// ── Serialize tests ───────────────────────────────────────────────────────────

console.log('\nmoney-sync-serialize.test.ts');

await it('serialize produces correct version tag', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.version, 'cloud_money_v1', 'version');
});

await it('serialize sets uid from input', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.uid, UID, 'uid');
});

await it('serialize sets updatedAt and clientUpdatedAt from now', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.updatedAt, NOW, 'updatedAt');
  eq(doc.clientUpdatedAt, NOW, 'clientUpdatedAt');
});

await it('serialize sets lastPushedByDeviceId', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.lastPushedByDeviceId, DEVICE_ID, 'deviceId');
});

await it('serialize does NOT include firebaseUser in authProgress', async () => {
  const userWithFirebase = { ...MOCK_USER, firebaseUser: { uid: 'should-not-appear' } };
  const doc = serializeMoneyStateToCloud(makeInput({ auth: { user: userWithFirebase as never } }));
  ok(!('firebaseUser' in doc.authProgress), 'firebaseUser must not be in authProgress');
});

await it('serialize does NOT include isLoading in authProgress', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  ok(!('isLoading' in doc.authProgress), 'isLoading must not be in authProgress');
});

await it('serialize does NOT include isAuthenticated in authProgress', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  ok(!('isAuthenticated' in doc.authProgress), 'isAuthenticated must not be in authProgress');
});

await it('serialize includes safe authProgress fields', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.authProgress.uid, UID, 'authProgress.uid');
  eq(doc.authProgress.xp, 100, 'authProgress.xp');
  eq(doc.authProgress.streak, 5, 'authProgress.streak');
  eq(doc.authProgress.isPremium, false, 'authProgress.isPremium');
});

await it('serialize caps audit records at 200', async () => {
  const manyRecords = Array.from({ length: 300 }, (_, i) => ({
    id: `audit-${i}`,
    actionType: 'add_transaction',
    createdAt: NOW,
    snapshot: {} as never,
    reversalSnapshot: {} as never,
  }));
  const doc = serializeMoneyStateToCloud(makeInput({ audit: { records: manyRecords as never } }));
  ok(doc.audit.records.length <= 200, `audit capped at 200, got ${doc.audit.records.length}`);
});

await it('serialize throws when uid is empty', async () => {
  let threw = false;
  try { serializeMoneyStateToCloud(makeInput({ uid: '' })); }
  catch { threw = true; }
  ok(threw, 'should throw for empty uid');
});

await it('serialize throws when uid is whitespace-only', async () => {
  let threw = false;
  try { serializeMoneyStateToCloud(makeInput({ uid: '   ' })); }
  catch { threw = true; }
  ok(threw, 'should throw for whitespace uid');
});

await it('serialize throws when user is null', async () => {
  let threw = false;
  try { serializeMoneyStateToCloud(makeInput({ auth: { user: null } })); }
  catch { threw = true; }
  ok(threw, 'should throw when user is null');
});

await it('serialize round-trips finance balance', async () => {
  const doc = serializeMoneyStateToCloud(makeInput());
  eq(doc.finance.mainBalance, 5000000, 'mainBalance');
  eq(doc.finance.emergencyBalance, 1000000, 'emergencyBalance');
  eq(doc.finance.billFundBalance, 500000, 'billFundBalance');
});

// ── Deserialize tests ─────────────────────────────────────────────────────────

await it('deserialize returns {} for null input', async () => {
  const patch = deserializeCloudMoneyDocument(null);
  eq(Object.keys(patch).length, 0, 'empty patch for null');
});

await it('deserialize returns {} for undefined input', async () => {
  const patch = deserializeCloudMoneyDocument(undefined);
  eq(Object.keys(patch).length, 0, 'empty patch for undefined');
});

await it('deserialize returns {} for unknown version', async () => {
  const patch = deserializeCloudMoneyDocument({ version: 'unknown_v99', uid: UID });
  eq(Object.keys(patch).length, 0, 'empty patch for unknown version');
});

await it('deserialize does not crash on completely empty doc', async () => {
  const patch = deserializeCloudMoneyDocument({ version: 'cloud_money_v1' });
  ok(typeof patch === 'object' && patch !== null, 'patch is object');
  ok(Array.isArray(patch.finance?.transactions ?? []), 'finance.transactions defaults to array');
});

await it('deserialize returns safe defaults for missing fields', async () => {
  const patch = deserializeCloudMoneyDocument({ version: 'cloud_money_v1' });
  eq(patch.finance?.mainBalance ?? 0, 0, 'mainBalance defaults to 0');
  eq(patch.finance?.emergencyBalance ?? 0, 0, 'emergencyBalance defaults to 0');
  eq(patch.budget?.carryOver ?? 0, 0, 'carryOver defaults to 0');
  eq(patch.budget?.currentMonth ?? '', '', 'currentMonth defaults to empty string');
});

await it('deserialize handles extra unknown fields safely (ignored)', async () => {
  const doc = {
    version: 'cloud_money_v1',
    finance: { mainBalance: 999, unknownField: 'should-be-ignored' },
  };
  const patch = deserializeCloudMoneyDocument(doc);
  eq(patch.finance?.mainBalance, 999, 'mainBalance preserved');
});

await it('deserialize round-trips a serialized doc', async () => {
  const original = serializeMoneyStateToCloud(makeInput());
  const patch = deserializeCloudMoneyDocument(original);
  eq(patch.finance?.mainBalance, 5000000, 'mainBalance round-trip');
  eq(patch.finance?.emergencyBalance, 1000000, 'emergencyBalance round-trip');
  eq(patch.budget?.currentMonth, '2026-06', 'currentMonth round-trip');
});

await it('deserialize finance.transactions is array', async () => {
  const patch = deserializeCloudMoneyDocument({
    version: 'cloud_money_v1',
    finance: { transactions: [{ id: 'tx1' }] },
  });
  ok(Array.isArray(patch.finance?.transactions), 'transactions is array');
  eq(patch.finance?.transactions?.length, 1, 'transactions length');
});

await it('deserialize ignores non-array transactions', async () => {
  const patch = deserializeCloudMoneyDocument({
    version: 'cloud_money_v1',
    finance: { transactions: 'not-an-array' },
  });
  ok(Array.isArray(patch.finance?.transactions), 'transactions forced to array');
  eq(patch.finance?.transactions?.length, 0, 'transactions empty when invalid');
});
