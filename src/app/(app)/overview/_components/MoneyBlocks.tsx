/* ═══ MoneyBlocks — cụm 3 khối Thu nhập · Chi tiêu · Tiết kiệm (phong cách D) ═══
 *
 * ⚠️ KHUNG HTML Ở ĐÂY BÁM 1:1 THEO MẪU D trong money-blocks-probes.html.
 * Bản đầu tôi viết gọn hơn mẫu (bỏ hàng tiêu đề, chip, chú thích, ô "chưa chi",
 * thẻ mục tiêu có icon) → CSS của những phần đó bị cắt vì không ai dùng, và khối
 * ra trơ trụi. Muốn đổi bố cục thì sửa mẫu trước, đừng cắt bớt ở đây.
 *
 * Khác mẫu ở mấy chỗ, đều do PO chốt sau khi xem bản thật:
 *   · Thu nhập chỉ còn mốc THÁNG, vẽ bằng VÀNH KHUYÊN (mảnh ghép nguồn thu).
 *     Nút Tháng|Năm và biểu đồ đường theo năm đã BỎ HẲN — đừng thêm lại.
 *   · Sau số tiền có mũi tên tăng trưởng so với tháng trước (`Trend`).
 *   · Chú thích nguồn thu tối đa 4 dòng: quá thì 3 nguồn lớn nhất + "Khác".
 *   · Tên khối (Thu nhập/Chi tiêu/Tiết kiệm) là một THẺ vắt lên viền trên của
 *     khối (`.blk-tab`), nằm NGOÀI `.blk` — nên nó không bị `.blk-hit` phủ.
 *     Hàng "TIỀN THÁNG NÀY / Tháng N" phía trên cụm đã bỏ.
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
import {
  buildConicGradient,
  buildIncomeBreakdown,
  buildIncomeMomentum,
  capIncomeSlices,
  getMethodSplit,
  type IncomeMomentum,
} from '@/lib/moneyBlocks';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import MoneySheet, { type MoneySheetKind } from './MoneySheet';
import './MoneyBlocks.css';

/** Số tiền + hậu tố "đ" nhỏ, đúng kiểu mẫu D. */
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

/**
 * Mũi tên tăng trưởng so với tháng trước.
 *
 * Ẩn hẳn khi `deltaPercent` là null — tháng trước bằng 0 thì không có phần trăm
 * nào đúng cả (xem `buildIncomeMomentum`). Thà không nói còn hơn nói "+100%" bịa.
 * Mũi tên là hình vẽ nên `aria-hidden`; phần chữ đã tự đọc được rồi.
 */
function Trend({ momentum }: { momentum: IncomeMomentum }) {
  const { deltaPercent, direction } = momentum;
  if (deltaPercent === null || direction === 'flat') return null;

  const up = direction === 'up';
  return (
    <span
      className={`trend trend-${direction}`}
      title={`So với tháng trước (${formatCurrency(momentum.previous)})`}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        {up ? (
          <>
            <path d="M5 17.5 13 9.5l4 4L21 6.5" />
            <path d="M15.5 6.5H21v5.5" />
          </>
        ) : (
          <>
            <path d="M5 6.5 13 14.5l4-4L21 17.5" />
            <path d="M15.5 17.5H21V12" />
          </>
        )}
      </svg>
      {up ? '+' : ''}
      {deltaPercent}%
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

  // ── Khối 1 ──────────────────────────────────────────────
  const incomeSplit = useMemo(
    () => getMethodSplit(transactions, 'income', 'month', now),
    [transactions, now],
  );
  const incomeSlices = useMemo(
    () => buildIncomeBreakdown(transactions, 'month', now),
    [transactions, now],
  );
  const incomeMomentum = useMemo(
    () => buildIncomeMomentum(transactions, now),
    [transactions, now],
  );
  /** Tối đa 4 dòng chú thích — quá thì 3 nguồn lớn nhất + "Khác". */
  const incomeLegend = useMemo(() => capIncomeSlices(incomeSlices, 4), [incomeSlices]);
  const incomeGradient = useMemo(
    () => buildConicGradient(incomeSlices, 'var(--ring-rest)'),
    [incomeSlices],
  );

  // ── Khối 2 ──────────────────────────────────────────────
  const slices = useMemo(
    () => buildCategoryBreakdown(transactions, 'month', now),
    [transactions, now],
  );
  const spendingBalance = accounts.spending.balance;
  const remaining = Math.max(0, spendingBalance - monthlyExpense);
  // Vành khuyên chi tiêu: trọn vòng = tài khoản chi tiêu, phần chưa chi để trống.
  const spentShare = spendingBalance > 0 ? (monthlyExpense / spendingBalance) * 100 : 0;
  const expenseGradient = useMemo(
    () =>
      buildConicGradient(
        slices.map((s) => ({ color: s.color, percent: (s.percent / 100) * spentShare })),
        'var(--ring-rest)',
      ),
    [slices, spentShare],
  );
  const budgetPercent =
    monthlyIncome > 0
      ? Math.round(((spendingLimit + totalFixedBills) / monthlyIncome) * 100)
      : null;

  const { yesterday, today } = useMemo(() => {
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const y0 = new Date(t0);
    y0.setDate(y0.getDate() - 1);
    let t = 0;
    let y = 0;
    for (const txn of transactions) {
      if (txn.type !== 'expense') continue;
      const d = new Date(txn.date);
      if (d >= t0) t += txn.amount;
      else if (d >= y0) y += txn.amount;
    }
    return { yesterday: y, today: t };
  }, [transactions, now]);

  const dueSoon = fixedBills.filter((b) => !b.isPaid).length;

  // ── Khối 3 ──────────────────────────────────────────────
  const topGoals = useMemo(
    () =>
      [...goals]
        .sort(
          (a, b) =>
            b.currentAmount / Math.max(b.targetAmount, 1) -
            a.currentAmount / Math.max(a.targetAmount, 1),
        )
        .slice(0, 3),
    [goals],
  );

  const month = now.getMonth() + 1;

  return (
    <>
      {/* Lớp bọc BẮT BUỘC: file CSS này import kiểu toàn cục (client component),
       * mà `.stack` là class tiện ích đang dùng ở 8 trang khác — kể cả div bọc
       * chính trang Tổng quan. Không có lớp bọc thì nền kem của cụm khối đổ lên
       * cả 8 trang đó. Mọi rule trong MoneyBlocks.css neo vào `.money-blocks`. */}
      <div className="money-blocks">
      <div className="stack">
        {/* ═══════════════ THU NHẬP ═══════════════ */}
        <div className="slot">
          <span className="blk-tab blk-tab-income">
            <span className="coin-wrap"><span className="coin" /></span>
            <span className="blk-title shine">Thu nhập</span>
          </span>

          <article className="blk blk-income">
            <button
              type="button"
              className="blk-hit"
              aria-label="Xem chi tiết thu nhập"
              onClick={() => setOpen('income')}
            />

            <div className="amount-row">
              <span className="amount">
                {hideBalance ? (
                  <span className="amt-mask">•••••••••</span>
                ) : (
                  <span className="amt-real"><Money value={monthlyIncome} /></span>
                )}
              </span>
              {!hideBalance && <Trend momentum={incomeMomentum} />}
            </div>

            <div className="chips">
              <span className="chip">
                Tiền mặt {hideBalance ? '•••' : formatCurrency(incomeSplit.cash)}
              </span>
              <span className="chip">
                Ngân hàng {hideBalance ? '•••' : formatCurrency(incomeSplit.bank)}
              </span>
            </div>

            {incomeSlices.length === 0 ? (
              <p className="blk-empty">Chưa có khoản thu nào tháng này.</p>
            ) : (
              <div className="inc-body">
                <div className="donut-hold donut-sm">
                  <div className="donut" style={{ background: incomeGradient }} />
                  <div className="donut-mid">
                    <span className="dm-lbl">THU</span>
                    <span className="dm-val">
                      {hideBalance ? '•••' : formatCurrencyShort(monthlyIncome)}
                    </span>
                  </div>
                </div>
                {/* Tối đa 4 dòng: quá thì 3 nguồn lớn nhất + một dòng "Khác". */}
                <ul className="legend legend-col">
                  {incomeLegend.map((s) => (
                    <li key={s.categoryId}>
                      <span className="lg-dot" style={{ background: s.color }} />
                      <span className="lg-name">{s.name}</span>
                      <b>{hideBalance ? '•••' : formatCurrencyShort(s.amount)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
          <span className="blk-tab blk-tab-expense">
            <span className="tile t-exp">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M6.5 6.5 17.5 17.5" />
                <path d="M17.5 9.5v8h-8" />
              </svg>
            </span>
            <span className="blk-title">Chi tiêu</span>
          </span>

          <article className="blk blk-expense">
            <button
              type="button"
              className="blk-hit"
              aria-label="Xem chi tiết chi tiêu"
              onClick={() => setOpen('expense')}
            />

            <div className="exp-body">
              <ul className="stat-list">
                <li>
                  <span className="sl-lbl">Tài khoản chi tiêu</span>
                  <span className="sl-val">
                    {hideBalance ? '•••' : <Money value={spendingBalance} />}
                  </span>
                </li>
                <li>
                  <span className="sl-lbl">Cần chi tháng này</span>
                  <span className="sl-val">
                    {hideBalance ? '•••' : <Money value={spendingLimit} />}
                  </span>
                </li>
                <li>
                  <span className="sl-lbl">Tổng bill dự kiến</span>
                  <span className="sl-val">
                    {hideBalance ? '•••' : <Money value={totalFixedBills} />}
                  </span>
                </li>
              </ul>

              <div className="donut-col">
                <div className="donut-hold">
                  <div className="donut" style={{ background: expenseGradient }} />
                  <div className="donut-mid">
                    <span className="dm-lbl">ĐÃ CHI</span>
                    {/* Dạng RÚT GỌN: lỗ khoét chỉ rộng ~66px, "7.250.000đ" ở 14px
                     * rộng hơn thế và sẽ đè lên vành. */}
                    <span className="dm-val">
                      {hideBalance ? '•••' : formatCurrencyShort(monthlyExpense)}
                    </span>
                  </div>
                </div>
                {remaining > 0 && (
                  <div className="rest">
                    <span>CHƯA CHI — CÒN LẠI</span>
                    <b>{hideBalance ? '•••' : formatCurrency(remaining)}</b>
                  </div>
                )}
              </div>
            </div>

            {slices.length > 0 && (
              <ul className="legend">
                {slices.slice(0, 4).map((s) => (
                  <li key={s.categoryId}>
                    <span className="lg-dot" style={{ background: s.color }} />
                    <span className="lg-name">{s.name}</span>
                    <b>{hideBalance ? '•••' : formatCurrencyShort(s.amount)}</b>
                  </li>
                ))}
              </ul>
            )}

            <ul className="blk-foot">
              <li>
                <span className="bf-lbl">Hôm qua</span>
                <span className="bf-val">{hideBalance ? '•••' : formatCurrency(yesterday)}</span>
              </li>
              <li>
                <span className="bf-lbl">Hôm nay</span>
                <span className="bf-val">{hideBalance ? '•••' : formatCurrency(today)}</span>
              </li>
              <li>
                <span className="bf-lbl">Sắp đến hạn</span>
                <span className="bf-val">{dueSoon} bill</span>
              </li>
            </ul>
          </article>

          {budgetPercent !== null && <span className="corner">{budgetPercent}% ngân sách</span>}
        </div>

        {/* ═══════════════ TIẾT KIỆM ═══════════════ */}
        <div className="slot">
          <span className="blk-tab blk-tab-save">
            <span className="tile t-sav">
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 21v-7.2" />
                <path d="M12 13.8C12 10.4 9.3 7.7 6 7.7c0 3.4 2.7 6.1 6 6.1Z" />
                <path d="M12 13.8c0-4 3.2-7.2 7.2-7.2 0 4-3.2 7.2-7.2 7.2Z" />
              </svg>
            </span>
            <span className="blk-title">Tiết kiệm</span>
          </span>

          <article className="blk blk-save">
            <button
              type="button"
              className="blk-hit"
              aria-label="Xem chi tiết tiết kiệm"
              onClick={() => setOpen('savings')}
            />

            <span className="amount">
              {hideBalance ? (
                <span className="amt-mask">•••••••</span>
              ) : (
                <Money value={monthlySavings} />
              )}
            </span>

            <svg className="wave" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden>
              <path d="M0,9 C60,16 110,2 165,7 C220,12 260,3 300,8 L300,16 L0,16 Z" />
            </svg>

            <p className="save-note">
              {topGoals.length > 0
                ? `Tháng này bạn đang xây ${topGoals.length} giấc mơ`
                : 'Đặt một mục tiêu để việc để dành có đích đến'}
            </p>

            {topGoals.length > 0 && (
              <ul className="goals">
                {topGoals.map((g, i) => {
                  const pct = Math.min(
                    100,
                    Math.round((g.currentAmount / Math.max(g.targetAmount, 1)) * 100),
                  );
                  const left = Math.max(0, g.targetAmount - g.currentAmount);
                  return (
                    <li
                      key={g.id}
                      className={`goal g${i + 1}`}
                      style={{ '--p': `${pct}%` } as React.CSSProperties}
                    >
                      <span className="goal-ico" aria-hidden>{g.icon}</span>
                      <span className="goal-main">
                        <span className="goal-top">
                          <b>{g.name}</b>
                          <em>{pct}%</em>
                        </span>
                        <span className="goal-bar"><span className="goal-fill" /></span>
                        <span className="goal-bot">
                          {formatCurrencyShort(g.currentAmount)} /{' '}
                          {formatCurrencyShort(g.targetAmount)} · còn{' '}
                          {formatCurrencyShort(left)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <span className="corner">Tháng {month}</span>
        </div>
      </div>
      </div>

      <MoneySheet kind={open} onClose={() => setOpen(null)} />
    </>
  );
}
