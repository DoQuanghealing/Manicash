/* ═══ AI Money Chat — Snapshot Firestore fallback (SERVER-ONLY) ═══
 * Tách khỏi snapshotBuilder.ts để firebase-admin KHÔNG lọt vào bundle client.
 * Chỉ được nạp qua `await import('./snapshotFirestore')` sau cổng
 * `typeof window === 'undefined'` trong getFinanceSnapshot → client build DCE.
 *
 * Đường này chỉ chạy khi KHÔNG có clientSnapshot (vd webhook/cron phía server).
 * PRISM ở client luôn có clientSnapshot nên không bao giờ tới đây.
 */
import {
  BILL_FUND_ACCOUNT_ID,
  EMERGENCY_FUND_ACCOUNT_ID,
  MAIN_BANK_ACCOUNT_ID,
  SPENDING_ACCOUNT_ID,
} from '@/core/finance/accounts';
import { getAccountBalance } from '@/core/finance/selectors';
import type { LedgerEntry } from '@/core/finance/types';
import type { MonthlyFinancialSnapshot } from './types';
import { daysInMonthOf, emptySnapshot, round, zeroSections } from './snapshotBuilder';

export async function buildFromFirestore(
  uid: string,
  monthKey: string,
  now: Date,
): Promise<MonthlyFinancialSnapshot> {
  const warnings: string[] = [];

  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    const db = getAdminDb();

    const [coreDoc, billsSnap, tasksSnap] = await Promise.all([
      db.doc(`users/${uid}/finance_core/state`).get(),
      db.collection(`users/${uid}/bills`).get().catch(() => null),
      db.collection(`users/${uid}/tasks`).get().catch(() => null),
    ]);

    let main = 0;
    let emergency = 0;
    let billFund = 0;

    if (coreDoc.exists) {
      const data = coreDoc.data() as { ledgerEntries?: LedgerEntry[] } | undefined;
      const ledger = Array.isArray(data?.ledgerEntries) ? data!.ledgerEntries! : [];
      main = getAccountBalance(ledger, MAIN_BANK_ACCOUNT_ID) + getAccountBalance(ledger, SPENDING_ACCOUNT_ID);
      emergency = getAccountBalance(ledger, EMERGENCY_FUND_ACCOUNT_ID);
      billFund = getAccountBalance(ledger, BILL_FUND_ACCOUNT_ID);
    } else {
      warnings.push('Không tìm thấy finance_core/state trên Firestore.');
    }

    if (!billsSnap || billsSnap.empty) {
      warnings.push('Hóa đơn chưa được đồng bộ lên server — gửi clientSnapshot để có dữ liệu bill.');
    }
    if (!tasksSnap || tasksSnap.empty) {
      warnings.push('Nhiệm vụ chưa được đồng bộ lên server — gửi clientSnapshot để có dữ liệu task.');
    }
    warnings.push('Cashflow/ngân sách/mục tiêu cần clientSnapshot để phân tích đầy đủ.');

    const m = Math.max(0, round(main));
    const e = Math.max(0, round(emergency));
    const b = Math.max(0, round(billFund));

    return {
      meta: {
        uid,
        monthKey,
        generatedAt: now.toISOString(),
        dayOfMonth: now.getDate(),
        daysInMonth: daysInMonthOf(now),
        source: 'firestore',
        warnings,
      },
      wallets: { main: m, emergency: e, billFund: b, total: round(m + e + b) },
      bills: { items: [], totalDue: 0, totalPaid: 0 },
      tasks: { items: [], activeCount: 0, completedCount: 0 },
      ...zeroSections(e),
    };
  } catch (error) {
    console.error('[snapshotFirestore] Firestore fallback failed:', error);
    warnings.push('Không đọc được dữ liệu server. Vui lòng thử lại.');
    return emptySnapshot(uid, monthKey, now, warnings);
  }
}
