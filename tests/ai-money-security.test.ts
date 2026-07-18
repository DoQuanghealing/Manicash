import { createHash } from 'crypto';
import { isLicenseValid, assertLicenseOrThrow, LICENSE_ERROR_MESSAGE } from '@/lib/aiMoneyChat/security/license';
import { getDomainFingerprint } from '@/lib/aiMoneyChat/security/telemetry';
import { buildLLMMessages, buildOriginWatermark } from '@/lib/aiMoneyChat/llm/promptBuilder';
import {
  extractProfileNote,
  stripProfileNote,
} from '@/lib/aiMoneyChat/memory/longTermProfile';
import { getFinanceSnapshot, __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import { handleFollowUp } from '@/lib/aiMoneyChat/handlers/handleFollowUp';
import { createSession, __clearConversationStoreForTest } from '@/lib/aiMoneyChat/llm/conversationStore';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import type { AiMoneyQuotaChargeResult } from '@/lib/aiMoneyChat/quota';

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
function expectNotIncludes(haystack: string, needle: string): void {
  if (haystack.includes(needle)) throw new Error(`Expected NOT to include "${needle}".\n${haystack}`);
}
function expectTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`Expected ${label} to be true`);
}

const UID = 'sec-user';

async function main() {
  /* ─────────── License gate ─────────── */
  describe('License gate (fail-loud, an toàn dev)');
  await it('dev/test -> luôn hợp lệ (không chặn)', () => {
    expectEqual(isLicenseValid(undefined, false), true);
    expectEqual(isLicenseValid('', false), true);
  });
  await it('production thiếu key -> invalid', () => {
    expectEqual(isLicenseValid(undefined, true), false);
    expectEqual(isLicenseValid('short', true), false);
  });
  await it('production key hợp lệ -> valid', () => {
    expectEqual(isLicenseValid('abcd1234efgh', true), true);
  });
  await it('assertLicenseOrThrow không ném trong dev', () => {
    let threw = false;
    try {
      assertLicenseOrThrow();
    } catch {
      threw = true;
    }
    expectEqual(threw, false);
  });
  await it('thông điệp lỗi tường minh', () => {
    expectIncludes(LICENSE_ERROR_MESSAGE, 'License Key Invalid or Missing');
  });

  /* ─────────── Telemetry fingerprint ─────────── */
  describe('Telemetry domain fingerprint');
  await it('hash ổn định + đúng độ dài + khác nhau theo domain', async () => {
    const a1 = await getDomainFingerprint('https://manicash.app');
    const a2 = await getDomainFingerprint('https://manicash.app');
    const b = await getDomainFingerprint('https://pirate.example');
    expectEqual(a1, a2);
    expectEqual(a1.length, 16);
    expectTrue(a1 !== b, 'different domains -> different hash');
  });

  /* ─────────── Watermark ─────────── */
  describe('Watermark truy vết nguồn');
  await it('buildOriginWatermark = md5(uid) 8 hex', () => {
    const expected = createHash('md5').update(UID).digest('hex').slice(0, 8);
    expectEqual(buildOriginWatermark(UID), `[origin-verify:manicash-${expected}]`);
    expectEqual(buildOriginWatermark(''), '');
  });
  await it('watermark được nhúng vào system prompt', async () => {
    __clearSnapshotCacheForTest();
    const snap = await getFinanceSnapshot(UID, { clientSnapshot: { wallets: { main: 1_000_000 } } });
    const msgs = buildLLMMessages({ snapshot: snap, userMessage: 'báo cáo', intent: 'CFO_REPORT' });
    const expectedHash = createHash('md5').update(UID).digest('hex').slice(0, 8);
    expectIncludes(msgs.map((m) => m.content).join('\n'), `origin-verify:manicash-${expectedHash}`);
  });

  /* ─────────── Long-term profile (pure) ─────────── */
  describe('Long-term profile parse');
  await it('extractProfileNote bóc tag [profile: ...]', () => {
    expectEqual(
      extractProfileNote('## Tình hình\nabc\n[profile: hay chi tieu Shopee cuoi thang]'),
      'hay chi tieu Shopee cuoi thang',
    );
  });
  await it('không có tag -> null', () => {
    expectEqual(extractProfileNote('không có metadata gì'), null);
  });
  await it('stripProfileNote xóa tag khỏi message', () => {
    const stripped = stripProfileNote('Nội dung báo cáo.\n\n[profile: ghi chu]');
    expectNotIncludes(stripped, '[profile:');
    expectIncludes(stripped, 'Nội dung báo cáo');
  });

  /* ─────────── Long-term profile: lưu note + ẩn tag (handleFollowUp) ───────────
   * LƯU Ý: CFO JSON flow (handleCFOReport) KHÔNG còn đọc/inject profile dài hạn.
   * Việc GHI note hệ thống chỉ sống ở handleFollowUp (extractProfileNote). Test này
   * bám theo hành vi THẬT hiện tại — không test tính năng "nạp profile cũ vào prompt"
   * đã bị bỏ. */
  describe('handleFollowUp — profile note: lưu note mới + ẩn tag; LLM sạch thì không lưu');
  const quotaOk = (): AiMoneyQuotaChargeResult => ({
    uid: UID, monthKey: '2026-06', plan: 'pro', monthlyLimit: 1500, hardLimit: 1500,
    usedCredits: 8, remainingCredits: 1492, allowed: true, reason: 'ok', chargedCredits: 8,
  });
  const CONTENT_WITH_TAG =
    'Mục mua sắm lố vì mua nhiều cuối tháng. Ngài nên đặt hạn mức.\n\n[profile: hay chi tieu Shopee cuoi thang]';
  const SID = 'sec-followup';

  async function makeProfileSession(): Promise<void> {
    __clearConversationStoreForTest();
    __clearSnapshotCacheForTest();
    const snap = await getFinanceSnapshot(UID, {
      clientSnapshot: { wallets: { main: 2_000_000 }, transactions: [{ type: 'income', amount: 20_000_000 }] },
    });
    await createSession(SID, UID, snap);
  }

  await it('LLM trả [profile: ...] -> lưu note + ẩn tag khỏi message hiển thị', async () => {
    await makeProfileSession();
    let savedNote: string | null = null;
    const reply = await handleFollowUp(
      UID,
      routeIntent('tại sao mục mua sắm lại lố'),
      { sessionId: SID },
      {
        peek: async () => quotaOk(),
        charge: async () => quotaOk(),
        generate: async () => ({ content: CONTENT_WITH_TAG, tokensUsed: 200, provider: 'openai', fallbackUsed: false }),
        saveProfile: async (_uid, note) => { savedNote = note; },
      },
    );
    // note mới được bóc từ tag + lưu
    expectEqual(savedNote, 'hay chi tieu Shopee cuoi thang');
    // tag KHÔNG rò ra message hiển thị
    expectNotIncludes(reply.message, '[profile:');
    expectIncludes(reply.message, 'Ngài nên đặt hạn mức');
  });

  await it('LLM không có tag -> KHÔNG gọi saveProfile', async () => {
    await makeProfileSession();
    let saveCalled = false;
    await handleFollowUp(
      UID,
      routeIntent('tại sao lại lố'),
      { sessionId: SID },
      {
        peek: async () => quotaOk(),
        charge: async () => quotaOk(),
        generate: async () => ({ content: 'Phân tích ổn, không có gì bất thường.', tokensUsed: 50, provider: 'openai', fallbackUsed: false }),
        saveProfile: async () => { saveCalled = true; },
      },
    );
    expectEqual(saveCalled, false);
  });

  console.log('\nPhase 5 security & hardening test suite complete.');
}

main();
