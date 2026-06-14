import { localDateKey, cutoffDateKey, pruneMessages, type StoredChatMessage } from '@/lib/chatRetention';

type TestFn = () => void;
function describe(name: string, fn: TestFn): void { console.log(`\n${name}`); fn(); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectEqual<T>(a: T, b: T): void { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`); }

function msg(dateKey: string): StoredChatMessage {
  return { id: dateKey, role: 'user', text: 't', createdAt: `${dateKey}T10:00:00.000Z`, dateKey };
}

// June 14 2026, local constructors → timezone-independent (mọi thứ local).
const NOW = new Date(2026, 5, 14, 10, 0);

describe('localDateKey / cutoffDateKey', () => {
  it('localDateKey YYYY-MM-DD local', () => {
    expectEqual(localDateKey(new Date(2026, 5, 7, 23, 59)), '2026-06-07');
  });
  it('cutoff = hôm nay − 7 ngày-lịch', () => {
    expectEqual(cutoffDateKey(NOW, 7), '2026-06-07');
  });
});

describe('pruneMessages — giữ 7 ngày, qua ngày thứ 8 xóa', () => {
  it('giữ today..today-7, xóa today-8', () => {
    const msgs = [msg('2026-06-14'), msg('2026-06-13'), msg('2026-06-07'), msg('2026-06-06')];
    const { kept, removed } = pruneMessages(msgs, NOW, 7);
    expectEqual(removed, 1); // chỉ 2026-06-06 (8 ngày) bị xóa
    expectEqual(kept.length, 3);
    expectEqual(kept.some((m) => m.dateKey === '2026-06-07'), true); // mốc 7 ngày GIỮ
    expectEqual(kept.some((m) => m.dateKey === '2026-06-06'), false); // 8 ngày XÓA
  });
  it('rỗng → removed 0', () => {
    expectEqual(pruneMessages([], NOW, 7).removed, 0);
  });
});

describe('boundary giờ trong ngày (00:05 vs 23:55 cùng kết quả)', () => {
  const msgs = [msg('2026-06-14'), msg('2026-06-07'), msg('2026-06-06')];
  it('00:05 và 23:55 prune giống nhau', () => {
    const early = pruneMessages(msgs, new Date(2026, 5, 14, 0, 5), 7);
    const late = pruneMessages(msgs, new Date(2026, 5, 14, 23, 55), 7);
    expectEqual(early.removed, late.removed);
    expectEqual(early.kept.length, late.kept.length);
    expectEqual(early.removed, 1);
  });
});

if (process.exitCode) process.exit(process.exitCode);
