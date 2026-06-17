/* PRISM P2 — gợi ý inline + lệnh "/".
 * Kiểm: intent -> gợi ý đúng & không tự lặp; lệnh "/" lọc + ánh xạ chuẩn. */
import {
  suggestForIntent,
  filterSlashCommands,
  resolveSlashCommand,
  SLASH_COMMANDS,
} from '@/lib/aiMoneyChat/prism/prismSuggestions';

type Fn = () => void;
function describe(name: string): void { console.log(`\n${name}`); }
function it(name: string, fn: Fn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? ''} expected ${String(b)}, got ${String(a)}`);
}
function ok(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

describe('suggestForIntent');
it('intent đã biết -> trả gợi ý riêng (>=2)', () => {
  const s = suggestForIntent('QUERY_BALANCE');
  ok(s.length >= 2, 'cần >=2 gợi ý');
  ok(s.every((x) => !!x.query && !!x.label), 'mỗi gợi ý cần query + label');
});
it('intent lạ -> gợi ý mặc định', () => {
  const s = suggestForIntent('SOMETHING_ELSE');
  ok(s.length >= 2, 'default >=2');
});
it('undefined -> gợi ý mặc định', () => {
  ok(suggestForIntent(undefined).length >= 2, 'default cho undefined');
});

describe('filterSlashCommands');
it('"/" -> toàn bộ lệnh', () => {
  eq(filterSlashCommands('/').length, SLASH_COMMANDS.length);
});
it('"/so" -> khớp /sodu', () => {
  const m = filterSlashCommands('/so');
  ok(m.some((c) => c.cmd === '/sodu'), 'phải có /sodu');
});
it('không phải lệnh -> rỗng', () => {
  eq(filterSlashCommands('mua cafe').length, 0);
});

describe('resolveSlashCommand');
it('"/sodu" -> câu hỏi số dư', () => {
  eq(resolveSlashCommand('/sodu'), 'tôi còn bao nhiêu tiền');
});
it('"/baocao" -> câu CFO', () => {
  eq(resolveSlashCommand('/baocao'), 'lên báo cáo CFO tháng này');
});
it('lệnh lạ -> null', () => {
  eq(resolveSlashCommand('/khongco'), null);
});
it('không có "/" -> null', () => {
  eq(resolveSlashCommand('số dư'), null);
});

if (process.exitCode) process.exit(process.exitCode);
