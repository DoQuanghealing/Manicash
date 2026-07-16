import {
  createSession,
  getOrCreateSession,
  appendTurn,
  purgeExpired,
  MAX_TURNS,
  __clearConversationStoreForTest,
  __expireSessionForTest,
  type ConversationTurn,
} from '@/lib/aiMoneyChat/llm/conversationStore';
import { routeIntent, detectFollowUp } from '@/lib/aiMoneyChat/intent/intentRouter';
import { handleCFOReport } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import { handleFollowUp } from '@/lib/aiMoneyChat/handlers/handleFollowUp';
import { getFinanceSnapshot, __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ClientSnapshotInput, MonthlyFinancialSnapshot } from '@/lib/aiMoneyChat/aggregation/types';
import type { AiMoneyQuotaChargeResult } from '@/lib/aiMoneyChat/quota';
import type { LLMMessage } from '@/lib/aiMoneyChat/llm/types';

type AsyncTestFn = () => void | Promise<void>;
function describe(name: string): void {
  console.log(`\n${name}`);
}
async function it(name: string, fn: AsyncTestFn): Promise<void> {
  try {
    await fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
}
function expectIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) throw new Error(`Expected to include "${needle}".\n${haystack}`);
}
function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

const UID = 'conv-user';
const SID = 'sess-1';

const FULL_INPUT: ClientSnapshotInput = {
  wallets: { main: 4_500_000, emergency: 6_000_000, billFund: 1_200_000 },
  transactions: [
    { type: 'income', amount: 20_000_000, categoryId: 'salary' },
    { type: 'expense', amount: 1_800_000, categoryId: 'shopping' },
  ],
  budgets: [{ categoryId: 'shopping', name: 'Mua sắm', limit: 1_500_000 }],
};

async function makeSnapshot(): Promise<MonthlyFinancialSnapshot> {
  __clearSnapshotCacheForTest();
  return getFinanceSnapshot(UID, { clientSnapshot: FULL_INPUT });
}

const quotaOk = (): AiMoneyQuotaChargeResult => ({
  uid: UID,
  monthKey: '2026-06',
  plan: 'pro',
  monthlyLimit: 1500,
  hardLimit: 1500,
  usedCredits: 8,
  remainingCredits: 1492,
  allowed: true,
  reason: 'ok',
  chargedCredits: 8,
});
const quotaDenied = (): AiMoneyQuotaChargeResult => ({ ...quotaOk(), allowed: false, plan: 'pro', usedCredits: 1500, remainingCredits: 0 });

async function main() {
  __clearConversationStoreForTest();
  __clearSnapshotCacheForTest();

  /* ─────────── conversationStore unit ─────────── */
  describe('conversationStore — core');
  await it('createSession lưu snapshot + turns rỗng + chưa hết hạn', async () => {
    __clearConversationStoreForTest();
    const snap = await makeSnapshot();
    const ctx = await createSession(SID, UID, snap);
    expectEqual(ctx.turns.length, 0);
    expectEqual(ctx.snapshot.cashflow.income, 20_000_000);
    expectTrue(new Date(ctx.expiresAt).getTime() > Date.now(), 'not expired');
  });
  await it('getOrCreateSession trả phiên đúng uid', async () => {
    const got = await getOrCreateSession(SID, UID);
    expectTrue(got !== null, 'session found');
  });
  await it('uid khác -> null (chống rò rỉ chéo)', async () => {
    expectEqual(await getOrCreateSession(SID, 'other-user'), null);
  });
  await it('sessionId lạ -> null', async () => {
    expectEqual(await getOrCreateSession('khong-ton-tai', UID), null);
  });
  await it('hết hạn -> purge + null', async () => {
    __clearConversationStoreForTest();
    const snap = await makeSnapshot();
    await createSession(SID, UID, snap);
    __expireSessionForTest(SID);
    expectEqual(await getOrCreateSession(SID, UID), null);
    // đã bị xóa khỏi store
    expectEqual(await purgeExpired(), 0);
  });
  await it('appendTurn cap MAX_TURNS + giữ lượt mới nhất', async () => {
    __clearConversationStoreForTest();
    const snap = await makeSnapshot();
    await createSession(SID, UID, snap);
    for (let i = 1; i <= MAX_TURNS + 3; i++) {
      const turn: ConversationTurn = {
        at: new Date().toISOString(),
        intent: 'FOLLOW_UP',
        userMessage: `q${i}`,
        assistantMessage: `a${i}`,
        tokensUsed: 10,
      };
      await appendTurn(SID, turn);
    }
    const ctx = (await getOrCreateSession(SID, UID))!;
    expectEqual(ctx.turns.length, MAX_TURNS);
    // lượt cũ nhất (q1) bị loại, lượt mới nhất còn
    expectEqual(ctx.turns[0].userMessage, `q4`);
    expectEqual(ctx.turns[ctx.turns.length - 1].userMessage, `q${MAX_TURNS + 3}`);
  });

  /* ─────────── follow-up detector ─────────── */
  describe('detectFollowUp + routeIntent override');
  await it('keyword tiếp nối -> true', () => {
    expectTrue(detectFollowUp('tai sao muc nay lo'), 'tai sao');
    expectTrue(detectFollowUp('bang cach nao'), 'bang cach nao');
    expectTrue(detectFollowUp('cat the nao do'), 'token do');
  });
  await it('câu thường -> false (không dính nhầm "do" trong "doan")', () => {
    expectEqual(detectFollowUp('toi muon doan so'), false);
  });
  await it('UNKNOWN + keyword -> ép FOLLOW_UP', () => {
    const intent = routeIntent('tại sao mục mua sắm lại lố');
    expectEqual(intent.type, 'FOLLOW_UP');
    expectEqual(intent.pipeline, 'llm');
  });
  await it('intent rõ ràng KHÔNG bị override', () => {
    expectEqual(routeIntent('tôi còn bao nhiêu tiền').type, 'QUERY_BALANCE');
  });

  /* ─────────── 3-turn conversation ─────────── */
  describe('Hội thoại 3 lượt — tái dùng snapshot, không re-aggregate');
  await it('Turn 1 (CFO) -> tạo phiên + lưu turn đầu', async () => {
    __clearConversationStoreForTest();
    let captured: LLMMessage[] = [];
    let calls = 0;
    const gen = async (messages: LLMMessage[]) => {
      captured = messages;
      calls += 1;
      return { content: `reply-${calls}`, tokensUsed: 100, provider: 'openai' as const, fallbackUsed: false };
    };

    // Turn 1 — báo cáo CFO (có clientSnapshot + sessionId).
    // Mock gen trả 'reply-1' KHÔNG phải JSON hợp lệ -> runCFOAnalysis fallback
    // deterministic; message là markdown composeMarkdown (số từ CFOContextPack,
    // LLM chỉ diễn giải) chứ KHÔNG còn là raw LLM content.
    const r1 = await handleCFOReport(
      UID,
      routeIntent('lên báo cáo CFO tháng'),
      { clientSnapshot: FULL_INPUT, sessionId: SID },
      { charge: async () => quotaOk(), generate: gen },
    );
    expectEqual(r1.ui.kind, 'cfo-card');
    const s1 = (await getOrCreateSession(SID, UID))!;
    expectEqual(s1.turns.length, 1);
    expectIncludes(s1.turns[0].assistantMessage, '## Báo cáo CFO tháng này');
    expectIncludes(s1.turns[0].assistantMessage, '### Số liệu chính');
    expectEqual(s1.snapshot.cashflow.income, 20_000_000);

    // Turn 2 — "tại sao mua sắm lố" (KHÔNG gửi clientSnapshot)
    const i2 = routeIntent('tại sao mục mua sắm lại lố');
    expectEqual(i2.type, 'FOLLOW_UP');
    const r2 = await handleFollowUp(UID, i2, { sessionId: SID }, { charge: async () => quotaOk(), generate: gen });
    expectEqual(r2.meta.source, 'llm-cached');
    // Prompt phải chứa snapshot CŨ (income 20M) -> chứng minh KHÔNG re-aggregate
    const ctx2 = captured.map((m) => m.content).join('\n');
    expectIncludes(ctx2, '20000000');
    // History phải có assistant turn-1 (markdown báo cáo CFO)
    expectIncludes(ctx2, 'Báo cáo CFO tháng này');
    expectEqual((await getOrCreateSession(SID, UID))!.turns.length, 2);

    // Turn 3 — "bằng cách nào khắc phục"
    const i3 = routeIntent('bằng cách nào để khắc phục');
    expectEqual(i3.type, 'FOLLOW_UP');
    const r3 = await handleFollowUp(UID, i3, { sessionId: SID }, { charge: async () => quotaOk(), generate: gen });
    expectEqual(r3.meta.source, 'llm-cached');
    const ctx3 = captured.map((m) => m.content).join('\n');
    // History tích lũy: có cả turn-1 (markdown CFO) và turn-2 (reply LLM follow-up)
    expectIncludes(ctx3, 'Báo cáo CFO tháng này');
    expectIncludes(ctx3, 'reply-2');
    expectEqual((await getOrCreateSession(SID, UID))!.turns.length, 3);
  });

  await it('Follow-up khi phiên hết hạn -> mời tạo báo cáo mới', async () => {
    __clearConversationStoreForTest();
    const reply = await handleFollowUp(
      UID,
      routeIntent('tại sao lại lố'),
      { sessionId: 'het-han' },
      { charge: async () => quotaOk(), generate: async () => ({ content: 'x', tokensUsed: 0, provider: 'openai', fallbackUsed: false }) },
    );
    expectIncludes(reply.message, 'hết hạn');
    expectEqual(reply.ui.kind, 'follow-up-buttons');
  });

  await it('Follow-up hết quota -> báo hết credit, không gọi LLM', async () => {
    __clearConversationStoreForTest();
    const snap = await makeSnapshot();
    await createSession(SID, UID, snap);
    let llmCalled = false;
    const reply = await handleFollowUp(
      UID,
      routeIntent('tại sao lại lố'),
      { sessionId: SID },
      {
        charge: async () => quotaDenied(),
        generate: async () => {
          llmCalled = true;
          return { content: 'x', tokensUsed: 0, provider: 'openai', fallbackUsed: false };
        },
      },
    );
    expectIncludes(reply.message, 'hết hạn mức');
    expectEqual(llmCalled, false);
  });

  /* ─────────── #2 POST-PAYMENT — chỉ trừ credit khi LLM giao kết quả dùng được ─────────── */
  describe('Post-payment (#2) — LLM lỗi thì KHÔNG trừ credit, thành công mới trừ');

  await it('FOLLOW_UP thành công -> peek 1 lần + charge 1 lần (đúng thứ tự)', async () => {
    __clearConversationStoreForTest();
    await createSession(SID, UID, await makeSnapshot());
    let peekCalls = 0;
    let chargeCalls = 0;
    let llmRanBeforeCharge = false;
    let llmRan = false;
    await handleFollowUp(UID, routeIntent('tại sao lại lố'), { sessionId: SID }, {
      peek: async () => { peekCalls += 1; return quotaOk(); },
      charge: async () => { chargeCalls += 1; return quotaOk(); },
      generate: async () => { llmRan = true; llmRanBeforeCharge = chargeCalls === 0; return { content: 'x', tokensUsed: 10, provider: 'openai', fallbackUsed: false }; },
    });
    expectEqual(peekCalls, 1);
    expectEqual(chargeCalls, 1);
    expectTrue(llmRan, 'LLM chạy');
    expectTrue(llmRanBeforeCharge, 'LLM chạy TRƯỚC charge (post-payment)');
  });

  await it('FOLLOW_UP: LLM throw -> peek gọi, charge KHÔNG gọi (user không mất lượt)', async () => {
    __clearConversationStoreForTest();
    await createSession(SID, UID, await makeSnapshot());
    let peekCalls = 0;
    let chargeCalls = 0;
    const reply = await handleFollowUp(UID, routeIntent('tại sao lại lố'), { sessionId: SID }, {
      peek: async () => { peekCalls += 1; return quotaOk(); },
      charge: async () => { chargeCalls += 1; return quotaOk(); },
      generate: async () => { throw new Error('Groq down'); },
    });
    expectEqual(peekCalls, 1);
    expectEqual(chargeCalls, 0);
    expectIncludes(reply.message, 'tạm thời bận');
  });

  await it('FOLLOW_UP: peek denied -> LLM không chạy + charge KHÔNG gọi', async () => {
    __clearConversationStoreForTest();
    await createSession(SID, UID, await makeSnapshot());
    let llmRan = false;
    let chargeCalls = 0;
    const reply = await handleFollowUp(UID, routeIntent('tại sao lại lố'), { sessionId: SID }, {
      peek: async () => quotaDenied(),
      charge: async () => { chargeCalls += 1; return quotaOk(); },
      generate: async () => { llmRan = true; return { content: 'x', tokensUsed: 0, provider: 'openai', fallbackUsed: false }; },
    });
    expectEqual(llmRan, false);
    expectEqual(chargeCalls, 0);
    expectIncludes(reply.message, 'hết hạn mức');
  });

  const CFO_AI_JSON = JSON.stringify({
    summary: 'Tháng này tài chính ổn định.',
    diagnosis: ['Dòng tiền dương.'],
    risks: ['Quỹ dự phòng mỏng.'],
    opportunities: ['Giảm chi ăn uống.'],
    actionPlan7Days: ['Khóa bill', 'Soát chi lớn', 'Hoàn thành task'],
  });

  await it('CFO: LLM JSON hợp lệ (không fallback) -> charge gọi 1 lần', async () => {
    let chargeCalls = 0;
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: FULL_INPUT }, {
      peek: async () => quotaOk(),
      charge: async () => { chargeCalls += 1; return quotaOk(); },
      generate: async () => ({ content: CFO_AI_JSON, tokensUsed: 300, provider: 'openai' }),
    });
    expectEqual(reply.meta.source, 'llm');
    expectEqual(chargeCalls, 1);
  });

  await it('CFO: LLM lỗi -> fallback deterministic -> charge KHÔNG gọi (báo cáo miễn phí)', async () => {
    let chargeCalls = 0;
    const reply = await handleCFOReport(UID, routeIntent('lên báo cáo CFO tháng'), { clientSnapshot: FULL_INPUT }, {
      peek: async () => quotaOk(),
      charge: async () => { chargeCalls += 1; return quotaOk(); },
      generate: async () => { throw new Error('LLM down'); },
    });
    expectEqual(reply.meta.source, 'deterministic');
    expectEqual(chargeCalls, 0);
  });

  console.log('\nPhase 4 conversation state test suite complete.');
}

main();
