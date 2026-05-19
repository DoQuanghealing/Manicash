import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDB } from '@/lib/firebase/config';
import type { FinanceEvent, LedgerEntry } from '@/core/finance/types';

export interface PersistedFinanceCoreState {
  ledgerEntries: LedgerEntry[];
  events: FinanceEvent[];
}

function isPersistableUid(uid: string): boolean {
  return uid.trim().length > 0 && uid !== 'local_user';
}

function isFinanceCoreState(value: unknown): value is PersistedFinanceCoreState {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<Record<keyof PersistedFinanceCoreState, unknown>>;
  return Array.isArray(candidate.ledgerEntries) && Array.isArray(candidate.events);
}

function getFinanceCoreStateDoc(uid: string) {
  return doc(getFirebaseDB(), 'users', uid, 'finance_core', 'state');
}

export async function loadFinanceCoreState(
  uid: string,
): Promise<PersistedFinanceCoreState | null> {
  if (!isPersistableUid(uid)) return null;

  const snap = await getDoc(getFinanceCoreStateDoc(uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (!isFinanceCoreState(data)) return null;

  return {
    ledgerEntries: data.ledgerEntries,
    events: data.events,
  };
}

export async function saveFinanceCoreState(
  uid: string,
  state: PersistedFinanceCoreState,
): Promise<void> {
  if (!isPersistableUid(uid)) return;

  await setDoc(
    getFinanceCoreStateDoc(uid),
    {
      ledgerEntries: state.ledgerEntries,
      events: state.events,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
