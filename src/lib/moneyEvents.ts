/* ═══ Money Events — Singleton EventTarget for transaction reactions ═══
 * Mirror xpEvents: addTransaction (income/expense) emit, MoneyReactionHost
 * subscribe để bắn popup chúc mừng (thu) / cằn nhằn (chi) TOÀN APP — bất kể ghi
 * từ Chat hay tab /input hay AI action. Tách khỏi store để consumer không phải
 * subscribe Zustand state.
 *
 * SSR/node-safe: no-op khi không có window (giống emitXPGranted) → test không nổ.
 */

export interface MoneyRecordedDetail {
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  transactionId: string;
}

type MoneyListener = (detail: MoneyRecordedDetail) => void;

const EVENT_NAME = 'money-recorded';

let target: EventTarget | null = null;
function getTarget(): EventTarget | null {
  if (typeof window === 'undefined') return null;
  if (!target) target = new EventTarget();
  return target;
}

/** Emit khi 1 giao dịch thu/chi thật được ghi. No-op trong SSR/node. */
export function emitMoneyRecorded(detail: MoneyRecordedDetail): void {
  const t = getTarget();
  if (!t) return;
  t.dispatchEvent(new CustomEvent<MoneyRecordedDetail>(EVENT_NAME, { detail }));
}

/** Subscribe — trả về cleanup. No-op trong SSR/node. */
export function subscribeMoneyRecorded(handler: MoneyListener): () => void {
  const t = getTarget();
  if (!t) return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<MoneyRecordedDetail>).detail);
  t.addEventListener(EVENT_NAME, listener);
  return () => t.removeEventListener(EVENT_NAME, listener);
}
