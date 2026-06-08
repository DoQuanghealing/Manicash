import { createHash } from 'crypto';
import { isLicenseValid, assertLicenseOrThrow, LICENSE_ERROR_MESSAGE } from '@/lib/aiMoneyChat/security/license';
import { getDomainFingerprint } from '@/lib/aiMoneyChat/security/telemetry';
import { buildLLMMessages, buildOriginWatermark } from '@/lib/aiMoneyChat/llm/promptBuilder';
import {
  extractProfileNote,
  stripProfileNote,
} from '@/lib/aiMoneyChat/memory/longTermProfile';
import { getFinanceSnapshot, __clearSnapshotCacheForTest } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import { handleCFOReport } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
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
  await it('hash ổn định + đúng độ dài + khác nhau theo domain', () => {
    const a1 = getDomainFingerprint('https://manicash.app');
    const a2 = getDomainFingerprint('https://manicash.app');
    const b = getDomainFingerprint('https://pirate.example');
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

  /* ─────────── Profile injection + save trong handleCFOReport ─────────── */
  describe('handleCFOReport — profile read/inject + save/strip');
  const quotaOk = (): AiMoneyQuotaChargeResult => ({
    uid: UID, monthKey: '2026-06', plan: 'pro', monthlyLimit: 1500, hardLimit: 1500,
    usedCredits: 8, remainingCredits: 1492, allowed: true, reason: 'ok', chargedCredits: 8,
  });
  const CONTENT_WITH_TAG =
    '## Tình hình\nThu 20.000.000đ.\n## Hành động đề xuất\n- **Cắt Shopee**: 500.000đ → tiết kiệm.\n\n[profile: hay chi tieu Shopee cuoi thang]';

  await it('đọc profile cũ -> nạp vào prompt; lưu note mới; ẩn tag khỏi message', async () => {
    let captured: LLMMessage[] = [];
    let savedNote: string | null = null;
    const reply = await handleCFOReport(
      UID,
      routeIntent('lên báo cáo CFO tháng'),
      { clientSnapshot: { wallets: { main: 2_000_000 }, transactions: [{ type: 'income', amount: 20_000_000 }] } },
      {
        charge: async () => quotaOk(),
        generate: async (messages) => {
          captured = messages;
          return { content: CONTENT_WITH_TAG, tokensUsed: 200, provider: 'openai', fallbackUsed: false };
        },
        readProfile: async () => 'thoi quen cu: luong cao nhung chi nhieu',
        saveProfile: async (_uid, note) => {
          savedNote = note;
        },
      },
    );
    // profile cũ nạp vào prompt
    expectIncludes(captured.map((m) => m.content).join('\n'), 'thoi quen cu');
    // note mới được lưu
    expectEqual(savedNote, 'hay chi tieu Shopee cuoi thang');
    // tag bị ẩn khỏi message hiển thị
    expectNotIncludes(reply.message, '[profile:');
    expectIncludes(reply.message, '## Hành động đề xuất');
  });

  await it('không có tag -> KHÔNG gọi saveProfile', async () => {
    let saveCalled = false;
    await handleCFOReport(
      UID,
      routeIntent('phân tích năng lực tài chính'),
      { clientSnapshot: { wallets: { main: 1 } } },
      {
        charge: async () => quotaOk(),
        generate: async () => ({ content: '## Tình hình\nổn.', tokensUsed: 50, provider: 'openai', fallbackUsed: false }),
        readProfile: async () => null,
        saveProfile: async () => {
          saveCalled = true;
        },
      },
    );
    expectEqual(saveCalled, false);
  });

  console.log('\nPhase 5 security & hardening test suite complete.');
}

main();
