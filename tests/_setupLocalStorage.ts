/* Test setup (KHÔNG phải *.test.ts) — cài localStorage mock cho node TRƯỚC khi
 * import các store có persist. Import file này ĐẦU TIÊN trong test persistence. */

const mem = new Map<string, string>();

if (typeof (globalThis as unknown as { localStorage?: unknown }).localStorage === 'undefined') {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); },
    clear: () => { mem.clear(); },
    // Spec-compliant enumeration (Map-backed) — cần cho clearAllSyncCursors().
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() { return mem.size; },
  } as Storage;
}

export const persistMem = mem;
