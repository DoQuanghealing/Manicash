/* ═══ MoneyBlocks — cụm 3 khối Thu nhập · Chi tiêu · Tiết kiệm ═══
 *
 * MẶT KHỐI CỐ Ý GỌN. Yêu cầu chốt 2026-08-27: bốn khối (Số dư khả dụng + ba
 * khối này) phải cùng vào MỘT màn hình. Đo thực tế: chỗ dùng được chỉ ~688px
 * (812 − 56 header − 68 thanh dưới), mà bản giàu biểu đồ trước đó cao 1.069px
 * SAU KHI đã ép hết khoảng trắng. Khoảng trắng không cứu được 381px — nên phần
 * nặng (vành khuyên, chú thích danh mục, dải chân, ba thẻ mục tiêu) chuyển hết
 * vào tấm trượt.
 *
 * Mỗi khối giờ đúng 4 tầng: hàng tên · số lớn · một vệt tỉ lệ · một dòng chú.
 * Bấm vào khối → MoneySheet hiện đủ. Muốn thêm gì lên mặt khối thì phải đo lại
 * tổng chiều cao trước, đừng thêm theo cảm tính.
 *
 * Mọi phép tính ở src/lib/moneyBlocks.ts + expenseBreakdown.ts — đây chỉ vẽ.
 */
'use client';

import { useMemo, useState } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { buildCategoryBreakdown } from '@/lib/expenseBreakdown';
import { buildIncomeBreakdown } from '@/lib/moneyBlocks';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import MoneySheet, { type MoneySheetKind } from './MoneySheet';
import './MoneyBlocks.css';

/** Số tiền + hậu tố "đ" nhỏ. */
function Money({ value }: { value: number }) {
  const s = formatCurrency(value);
  const hasDong = s.endsWith('đ');
  return (
    <>
      {hasDong ? s.slice(0, -1) : s}
      {hasDong && <i>đ</i>}
    </>
  );
}

/** Vệt tỉ lệ mỏng — thay cho vành khuyên đã chuyển vào tấm trượt. */
function MiniBar({ parts }: { parts: { key: string; percent: number; color: string }[] }) {
  const shown = parts.filter((p) => p.percent > 0);
  if (shown.length === 0) return <span className="mini-bar is-empty" aria-hidden />;
  return (
    <span className="mini-bar" aria-hidden>
      {shown.map((p) => (
        <span
          key={p.key}
          className="mini-seg"
          style={{ width: `${p.percent}%`, background: p.color }}
        />
      ))}
    </span>
  );
}

export default function MoneyBlocks() {
  const [open, setOpen] = useState<MoneySheetKind | null>(null);

  const transactions = useFinanceStore((s) => s.transactions);
  const monthlyIncome = useFinanceStore((s) => s.getMonthlyIncome());
  const monthlyExpense = useFinanceStore((s) => s.getMonthlyExpense());
  const totalFixedBills = useFinanceStore((s) => s.getTotalFixedBillsAmount());
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const accounts = useDashboardStore((s) => s.accounts);
  const monthlySavings = useDashboardStore((s) => s.getTotalMonthlySavings());
  const goals = useGoalsStore((s) => s.goals);
  const spendingLimit = useBudgetStore((s) => s.getTotalCategoryLimits());
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const toggleHide = useSettingsStore((s) => s.toggleHideBalance);

  const now = useMemo(() => new Date(), []);
  const month = now.getMonth() + 1;

  // ── Khối 1: Thu nhập ────────────────────────────────────
  const incomeSlices = useMemo(
    () => buildIncomeBreakdown(transactions, 'month', now),
    [transactions, now],
  );
  const incomeParts = incomeSlices.map((s) => ({
    key: s.categoryId,
    percent: s.percent,
    color: s.color,
  }));

  // ── Khối 2: Chi tiêu ────────────────────────────────────
  const slices = useMemo(
    () => buildCategoryBreakdown(transactions, 'month', now),
    [transactions, now],
  );
  const spendingBalance = accounts.spending.balance;
  const remaining = Math.max(0, spendingBalance - monthlyExpense);
  // Trọn vệt = tài khoản chi tiêu; phần chưa chi để trống ở đuôi.
  const spentShare = spendingBalance > 0 ? Math.min(100, (monthlyExpense / spendingBalance) * 100) : 0;
  const expenseParts = slices.map((s) => ({
    key: s.categoryId,
    percent: (s.percent / 100) * spentShare,
    color: s.color,
  }));
  const budgetPercent =
    monthlyIncome > 0
      ? Math.round(((spendingLimit + totalFixedBills) / monthlyIncome) * 100)
      : null;
  const dueSoon = fixedBills.filter((b) => !b.isPaid).length;

  // ── Khối 3: Tiết kiệm ───────────────────────────────────
  const goalRank = useMemo(
    () =>
      [...goals].sort(
        (a, b) =>
          b.currentAmount / Math.max(b.targetAmount, 1) -
          a.currentAmount / Math.max(a.targetAmount, 1),
      ),
    [goals],
  );
  const leadGoal = goalRank[0];
  const leadPct = leadGoal
    ? Math.min(100, Math.round((leadGoal.currentAmount / Math.max(leadGoal.targetAmount, 1)) * 100))
    : 0;

  return (
    <>
      {/* Lớp bọc BẮT BUỘC: file CSS này import kiểu toàn cục (client component),
       * mà `.stack` là class tiện ích đang dùng ở 8 trang khác — kể cả div bọc
       * chính trang Tổng quan. Không có lớp bọc thì nền kem của cụm khối đổ lên
       * cả 8 trang đó. Mọi rule trong MoneyBlocks.css neo vào `.money-blocks`. */}
      <div className="money-blocks">
        <div className="frame-title">
          <span>TIỀN THÁNG NÀY</span>
          <span>Tháng {month}</span>
        </div>

        <div className="stack">
          {/* ═══════════════ THU NHẬP ═══════════════ */}
          <div className="slot">
            <article className="blk blk-income">
              <button
                type="button"
                className="blk-hit"
                aria-label="Xem chi tiết thu nhập"
                onClick={() => setOpen('income')}
              />

              <div className="blk-row">
                <span className="coin-wrap"><span className="coin" /></span>
                <span className="blk-title shine">Thu nhập</span>
              </div>

              <span className="amount">
                {hideBalance ? (
                  <span className="amt-mask">•••••••••</span>
                ) : (
                  <span className="amt-real"><Money value={monthlyIncome} /></span>
                )}
              </span>

              <MiniBar parts={incomeParts} />

              <p className="mini-cap">
                {incomeSlices.length === 0
                  ? 'Chưa có khoản thu nào tháng này.'
                  : incomeSlices
                      .slice(0, 2)
                      .map((s) => `${s.name} ${hideBalance ? '•••' : formatCurrencyShort(s.amount)}`)
                      .join(' · ')}
              </p>
            </article>

            <button
              type="button"
              className="corner eye-btn"
              aria-label={hideBalance ? 'Hiện số tiền' : 'Ẩn số tiền'}
              aria-pressed={hideBalance}
              onClick={toggleHide}
            >
              {hideBalance ? '🙈' : '👁'}
            </button>
          </div>

          {/* ═══════════════ CHI TIÊU ═══════════════ */}
          <div className="slot">
            <article className="blk blk-expense">
              <button
                type="button"
                className="blk-hit"
                aria-label="Xem chi tiết chi tiêu"
                onClick={() => setOpen('expense')}
              />

              <div className="blk-row">
                <span className="tile t-exp">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M6.5 6.5 17.5 17.5" />
                    <path d="M17.5 9.5v8h-8" />
                  </svg>
                </span>
                <span className="blk-title">Chi tiêu</span>
              </div>

              <span className="amount">
                {hideBalance ? (
                  <span className="amt-mask">•••••••••</span>
                ) : (
                  <Money value={monthlyExpense} />
                )}
              </span>

              <MiniBar parts={expenseParts} />

              <p className="mini-cap">
                {remaining > 0 ? (
                  <>Còn lại <b>{hideBalance ? '•••' : formatCurrency(remaining)}</b></>
                ) : (
                  <>Đã dùng hết tài khoản chi tiêu</>
                )}
                {dueSoon > 0 && ` · ${dueSoon} bill chờ đóng`}
              </p>
            </article>

            {budgetPercent !== null && <span className="corner">{budgetPercent}% ngân sách</span>}
          </div>

          {/* ═══════════════ TIẾT KIỆM ═══════════════ */}
          <div className="slot">
            <article className="blk blk-save">
              <button
                type="button"
                className="blk-hit"
                aria-label="Xem chi tiết tiết kiệm"
                onClick={() => setOpen('savings')}
              />

              <div className="blk-row">
                <span className="tile t-sav">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 21v-7.2" />
                    <path d="M12 13.8C12 10.4 9.3 7.7 6 7.7c0 3.4 2.7 6.1 6 6.1Z" />
                    <path d="M12 13.8c0-4 3.2-7.2 7.2-7.2 0 4-3.2 7.2-7.2 7.2Z" />
                  </svg>
                </span>
                <span className="blk-title">Tiết kiệm</span>
              </div>

              <span className="amount">
                {hideBalance ? (
                  <span className="amt-mask">•••••••</span>
                ) : (
                  <Money value={monthlySavings} />
                )}
              </span>

              {/* `--tint` khai sẵn trên mọi .blk — KHÔNG bịa token mới rồi chống
               * bằng fallback, đó đúng là loại lỗi tàng hình đã dính hai lần. */}
              <MiniBar
                parts={leadGoal ? [{ key: leadGoal.id, percent: leadPct, color: 'var(--tint)' }] : []}
              />

              <p className="mini-cap">
                {leadGoal ? (
                  <>
                    {goalRank.length} mục tiêu · gần đích nhất{' '}
                    <b>{leadGoal.icon} {leadGoal.name} {leadPct}%</b>
                  </>
                ) : (
                  'Đặt một mục tiêu để việc để dành có đích đến'
                )}
              </p>
            </article>

            <span className="corner">Tháng {month}</span>
          </div>
        </div>
      </div>

      <MoneySheet kind={open} onClose={() => setOpen(null)} />
    </>
  );
}
