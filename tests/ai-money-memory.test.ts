export {};

type TestFn = () => void;

class MemoryStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorageMock(),
  configurable: true,
});

const { parseMoneyText } = await import('@/lib/aiMoneyChat/parser');
const { useAiMoneyMemoryStore } = await import('@/stores/useAiMoneyMemoryStore');

function describe(name: string, fn: TestFn): void {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: TestFn): void {
  try {
    fn();
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function expectEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

describe('AI Money Chat local memory', () => {
  it('learns a category correction and applies it to the next parse', () => {
    useAiMoneyMemoryStore.getState().clearMemory();

    const saved = useAiMoneyMemoryStore.getState().addCorrection({
      rawText: 'mua bai tarot 250k',
      type: 'expense',
      categoryId: 'shopping',
    });

    expectEqual(Boolean(saved), true);
    expectEqual(useAiMoneyMemoryStore.getState().rules.length, 1);

    const parsed = parseMoneyText('mua bai tarot 300k');
    expectEqual(parsed.category?.categoryId, 'entertain');

    const withMemory = useAiMoneyMemoryStore.getState().applyMemoryToIntent(parsed);
    expectEqual(withMemory.source, 'memory');
    expectEqual(withMemory.category?.categoryId, 'shopping');
    expectEqual(withMemory.needsConfirmation, true);
  });

  it('raises confidence after repeated confirmations', () => {
    useAiMoneyMemoryStore.getState().clearMemory();

    for (let i = 0; i < 3; i++) {
      useAiMoneyMemoryStore.getState().addCorrection({
        rawText: 'mua moc phoi do 80k',
        type: 'expense',
        categoryId: 'shopping',
      });
    }

    const rule = useAiMoneyMemoryStore.getState().rules[0];
    expectEqual(rule.categoryId, 'shopping');
    expectEqual(rule.hitCount, 3);

    const withMemory = useAiMoneyMemoryStore.getState().applyMemoryToIntent(
      parseMoneyText('mua moc phoi do 90k'),
    );
    expectEqual(withMemory.source, 'memory');
    expectEqual(withMemory.confidence, 'high');
    expectEqual(withMemory.needsConfirmation, false);
  });

  it('rejects unknown category IDs', () => {
    useAiMoneyMemoryStore.getState().clearMemory();

    const saved = useAiMoneyMemoryStore.getState().addCorrection({
      rawText: 'mua thu gi do 10k',
      type: 'expense',
      categoryId: 'brand-new-category',
    });

    expectEqual(saved, null);
    expectEqual(useAiMoneyMemoryStore.getState().rules.length, 0);
  });
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

