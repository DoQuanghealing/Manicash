/* ═══ Nội dung tấm trượt Chi tiêu ═══
 *
 * Trả lời đúng thứ tự câu hỏi PO đặt ra:
 *   1. Tài khoản chi tiêu đang có bao nhiêu
 *   2. Ngân sách tháng = ngưỡng chi tiêu + hóa đơn cố định
 *   3. Bao nhiêu hóa đơn, tổng phải trả bao nhiêu
 *   4. Ngân hàng nào đang giữ các khoản chi
 *   5. Chi chuyển khoản bao nhiêu, tiền mặt bao nhiêu
 *   6. Cột chi tiêu theo tháng + đường ngưỡng (vượt là đỏ)
 *   7. Hóa đơn tháng này so với tháng trước
 *   8. Ngân sách chiếm bao nhiêu % thu nhập, tách chi tiêu vs hóa đơn
 */
'use client';

import { useMemo } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useWalletBankStore } from '@/stores/useWalletBankStore';
import { getBillDueStatus } from '@/lib/billAnalytics';
import {
  BANK_COLOR,
  CASH_COLOR,
  buildBillMonthTotals,
  buildSpendingSeries,
  getBudgetComposition,
  getMethodSplit,
} from '@/lib/moneyBlocks';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import { ShareDonut, ThresholdChart } from './SheetCharts';
import './SheetContent.css';

/** Màu hai phần ngân sách — chi tiêu cam, hóa đơn tím, khớp tông app. */
const SPEND_COLOR = '#F97316';
const BILL_COLOR = '#8B5CF6';

export default function ExpenseSheetContent() {
  const transactions = useFinanceStore((s) => s.transactions);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const billPayments = useFinanceStore((s) => s.billPayments);
  const totalFixedBills = useFinanceStore((s) => s.getTotalFixedBillsAmount());
  const monthlyIncome = useFinanceStore((s) => s.getMonthlyIncome());
  const accounts = useDashboardStore((s) => s.accounts);
  const spendingLimit = useBudgetStore((s) => s.getTotalCategoryLimits());
  const wallets = useWalletBankStore((s) => s.wallets);

  const now = useMemo(() => new Date(), []);

  const spending = useMemo(
    () => buildSpendingSeries(transactions, spendingLimit, now),
    [transactions, spendingLimit, now],
  );
  const methodSplit = useMemo(
    () => getMethodSplit(transactions, 'expense', 'month', now),
    [transactions, now],
  );
  const billMonths = useMemo(
    () => buildBillMonthTotals(billPayments, now.getFullYear(), now),
    [billPayments, now],
  );
  const budget = getBudgetComposition(monthlyIncome, spendingLimit, totalFixedBills);

  const thisMonth = billMonths.find((m) => m.isCurrent);
  const paidMonths = billMonths.filter((m) => m.amount > 0);
  const hasBillHistory = paidMonths.length > 0;

  // Ngân hàng nào đang giữ khoản chi — chỉ nêu ví đã khai tên ngân hàng.
  const spendingBanks = wallets.filter((w) => w.bankName.trim() !== '');

  return (
    <>
      {/* ── 1–3. Ba con số nền ── */}
      <section className="sh-card">
        <div className="sh-rows">
          <Row label="Tài khoản chi tiêu hiện có" value={formatCurrency(accounts.spending.balance)} />
          <Row
            label="Ngân sách tháng"
            value={formatCurrency(spendingLimit + totalFixedBills)}
            hint="ngưỡng chi tiêu + hóa đơn cố định"
          />
          <Row
            label="Ngưỡng chi tiêu 1 tháng"
            value={spendingLimit > 0 ? formatCurrency(spendingLimit) : 'Chưa đặt'}
            muted={spendingLimit <= 0}
          />
          <Row
            label={`Hóa đơn (${fixedBills.length})`}
            value={formatCurrency(totalFixedBills)}
          />
        </div>
      </section>

      {/* ── 5. Chuyển khoản vs tiền mặt ── */}
      <section className="sh-card">
        <p className="sh-section-title">Chi bằng gì trong tháng này</p>
        {methodSplit.total === 0 ? (
          <p className="sh-empty">Chưa có khoản chi nào trong tháng.</p>
        ) : (
          <div className="sh-split">
            <div className="sh-split-item">
              <span className="sh-dot" style={{ background: CASH_COLOR }} aria-hidden />
              <span className="sh-split-name">Tiền mặt</span>
              <span className="sh-split-val">{formatCurrency(methodSplit.cash)}</span>
              <span className="sh-split-pct">{methodSplit.cashPercent}%</span>
            </div>
            <div className="sh-split-item">
              <span className="sh-dot" style={{ background: BANK_COLOR }} aria-hidden />
              <span className="sh-split-name">Chuyển khoản</span>
              <span className="sh-split-val">{formatCurrency(methodSplit.bank)}</span>
              <span className="sh-split-pct">{methodSplit.bankPercent}%</span>
            </div>
          </div>
        )}
      </section>

      {/* ── 4. Ngân hàng giữ khoản chi ── */}
      <section className="sh-card">
        <p className="sh-section-title">Ngân hàng đang giữ khoản chi</p>
        {spendingBanks.length === 0 ? (
          <p className="sh-empty">
            Chưa khai ngân hàng nào. Thêm số tài khoản để nhìn vào là biết tiền đang nằm ở đâu.
          </p>
        ) : (
          <ul className="sh-banks">
            {spendingBanks.map((w) => (
              <li key={w.id}>
                <span className="sh-bank-name">{w.bankName}</span>
                <span className="sh-bank-acc">{w.accountNumber || 'chưa có số TK'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 6. Cột chi tiêu + đường ngưỡng ── */}
      <section className="sh-card">
        <p className="sh-section-title">
          {spending.mode === 'monthly' ? 'Chi tiêu từng tháng' : 'Chi tiêu cộng dồn tháng này'}
        </p>
        <ThresholdChart series={spending} />
        {spending.threshold > 0 && spending.mode === 'monthly' && (
          <div className="sh-verdict">
            {spending.monthsOver > 0 ? (
              <p className="is-over">
                Vượt ngưỡng {spending.monthsOver} tháng, tổng {formatCurrencyShort(spending.totalOver)}.
              </p>
            ) : (
              <p className="is-good">Chưa tháng nào vượt ngưỡng.</p>
            )}
            {spending.totalSaved > 0 && (
              <p className="is-good">
                Các tháng dưới ngưỡng để dành được {formatCurrencyShort(spending.totalSaved)}.
              </p>
            )}
          </div>
        )}
        {spending.threshold <= 0 && (
          <p className="sh-empty">
            Chưa đặt ngưỡng chi tiêu — đặt hạn mức cho các danh mục để có đường so sánh.
          </p>
        )}
      </section>

      {/* ── 7. Hóa đơn so tháng với tháng ── */}
      <section className="sh-card">
        <p className="sh-section-title">Hóa đơn theo tháng</p>
        {!hasBillHistory ? (
          <>
            <p className="sh-empty">
              Chưa có tháng nào đóng xong để so. Tạm thời là danh sách hóa đơn và ngày đóng:
            </p>
            <ul className="sh-bills">
              {fixedBills.map((b) => {
                const st = getBillDueStatus(b, now);
                return (
                  <li key={b.id}>
                    <span className="sh-bill-icon" aria-hidden>{b.icon}</span>
                    <span className="sh-bill-name">{b.name}</span>
                    <span className={`sh-bill-due tone-${st.tone}`}>{st.label}</span>
                    <span className="sh-bill-amt">{formatCurrencyShort(b.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <div className="sh-billbars">
              {billMonths.map((m) => {
                const max = Math.max(...billMonths.map((x) => x.amount), 1);
                return (
                  <div key={m.month} className="sh-billbar">
                    <span
                      className={`sh-billbar-fill${m.isCurrent ? ' is-current' : ''}`}
                      style={{ height: `${(m.amount / max) * 100}%` }}
                    />
                    <span className="sh-billbar-label">{m.label}</span>
                  </div>
                );
              })}
            </div>
            {thisMonth && thisMonth.changePercent !== null && (
              <p className={`sh-billdelta${thisMonth.changePercent > 0 ? ' is-up' : ' is-down'}`}>
                Tháng này {thisMonth.changePercent > 0 ? 'cao hơn' : 'thấp hơn'}{' '}
                {Math.abs(thisMonth.changePercent)}% so với lần đóng trước — vào Sổ sách xem
                khoản nào lệch.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── 8. Ngân sách chiếm bao nhiêu phần thu nhập ── */}
      <section className="sh-card">
        <p className="sh-section-title">Ngân sách so với thu nhập</p>
        {!budget ? (
          <p className="sh-empty">Chưa có thu nhập tháng này để so sánh.</p>
        ) : (
          <>
            <ShareDonut
              isOver={budget.isOverIncome}
              centerValue={`${budget.budgetPercentOfIncome}%`}
              centerCaption="của thu nhập"
              slices={[
                {
                  label: 'Chi tiêu',
                  amount: budget.spendingLimit,
                  percent: budget.spendingPercentOfIncome,
                  color: SPEND_COLOR,
                },
                {
                  label: 'Hóa đơn cố định',
                  amount: budget.fixedBills,
                  percent: budget.billPercentOfIncome,
                  color: BILL_COLOR,
                },
              ]}
            />
            {budget.isOverIncome ? (
              <p className="sh-verdict is-over">
                Ngân sách đang vượt thu nhập {formatCurrencyShort(Math.abs(budget.leftover))}.
              </p>
            ) : (
              <p className="sh-verdict is-good">
                Còn lại {formatCurrencyShort(budget.leftover)} ({budget.leftoverPercent}%) chưa bị
                ngân sách chiếm.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Row({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="sh-row">
      <span className="sh-row-label">
        {label}
        {hint && <em className="sh-row-hint">{hint}</em>}
      </span>
      <span className={`sh-row-value${muted ? ' is-muted' : ''}`}>{value}</span>
    </div>
  );
}
