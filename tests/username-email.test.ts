import { normalizeUsername, isValidUsername, usernameToEmail, TEST_EMAIL_DOMAIN } from '@/lib/auth/usernameEmail';

type TestFn = () => void;
function describe(name: string, fn: TestFn): void { console.log(`\n${name}`); fn(); }
function it(name: string, fn: TestFn): void {
  try { fn(); console.log(`  PASS ${name}`); }
  catch (e) { console.error(`  FAIL ${name}`); console.error(e); process.exitCode = 1; }
}
function expectEqual<T>(a: T, b: T): void { if (a !== b) throw new Error(`Expected ${String(b)}, got ${String(a)}`); }

describe('normalizeUsername', () => {
  it('trim + lowercase', () => {
    expectEqual(normalizeUsername('  Bob_1 '), 'bob_1');
  });
});

describe('isValidUsername (3–20 [a-z0-9_])', () => {
  it('hợp lệ', () => {
    expectEqual(isValidUsername('bob'), true);
    expectEqual(isValidUsername('user_123'), true);
    expectEqual(isValidUsername('a'.repeat(20)), true);
  });
  it('không hợp lệ', () => {
    expectEqual(isValidUsername('ab'), false); // <3
    expectEqual(isValidUsername('a'.repeat(21)), false); // >20
    expectEqual(isValidUsername('bad name'), false); // space
    expectEqual(isValidUsername('bad!'), false); // ký tự lạ
    expectEqual(isValidUsername('Bob'), false); // hoa (đã chuẩn hóa trước khi validate)
  });
});

describe('usernameToEmail', () => {
  it('deterministic + chuẩn hóa', () => {
    expectEqual(usernameToEmail('Bob'), `bob@${TEST_EMAIL_DOMAIN}`);
    expectEqual(usernameToEmail('user_1'), `user_1@${TEST_EMAIL_DOMAIN}`);
  });
});

if (process.exitCode) process.exit(process.exitCode);
