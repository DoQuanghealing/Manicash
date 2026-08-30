/* ═══ MoneyBlocks — cụm 3 khối Thu nhập · Chi tiêu · Tiết kiệm (phong cách D) ═══
 *
 * ⚠️ KHUNG HTML Ở ĐÂY BÁM 1:1 THEO MẪU D trong money-blocks-probes.html.
 * Bản đầu tôi viết gọn hơn mẫu (bỏ hàng tiêu đề, chip, chú thích, ô "chưa chi",
 * thẻ mục tiêu có icon) → CSS của những phần đó bị cắt vì không ai dùng, và khối
 * ra trơ trụi. Muốn đổi bố cục thì sửa mẫu trước, đừng cắt bớt ở đây.
 *
 * Khác mẫu đúng MỘT chỗ, do PO yêu cầu sau khi xem bản thật:
 *   biểu đồ thu nhập mốc THÁNG là VÀNH KHUYÊN (thấy mảnh ghép thu nhập),
 *   mốc NĂM mới là đường như trong mẫu.
 *
 * Mọi phép tính ở src/lib/moneyBlocks.ts + expenseBreakdown.ts — đây chỉ vẽ.
 */
'use client';

import { useId, useMemo, useState } from 'react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { buildCategoryBreakdown } from '@/lib/expenseBreakdown';
import {
  buildConicGradient,
  buildIncomeBreakdown,
  buildIncomeSeries,
  getMethodSplit,
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

export default function MoneyBlocks() {
  const [open, setOpen] = useState<MoneySheetKind | null>(null);
  const [incomeView, setIncomeView] = useState<'month' | 'year'>('month');

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
  const incomeYear = useMemo(
    () => buildIncomeSeries(transactions, 'month', now).slice(0, now.getMonth() + 1),
    [transactions, now],
  );
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

            <div className="chips">
              <span className="chip">
                Tiền mặt {hideBalance ? '•••' : formatCurrency(incomeSplit.cash)}
              </span>
              <span className="chip">
                Ngân hàng {hideBalance ? '•••' : formatCurrency(incomeSplit.bank)}
              </span>
            </div>

            {/* PO chốt: mốc THÁNG là vành khuyên mảnh ghép, mốc NĂM là đường. */}
            <div className="view-switch">
              <button
                type="button"
                className={incomeView === 'month' ? 'is-on' : ''}
                onClick={() => setIncomeView('month')}
              >
                Tháng
              </button>
              <button
                type="button"
                className={incomeView === 'year' ? 'is-on' : ''}
                onClick={() => setIncomeView('year')}
              >
                Năm
              </button>
            </div>

            {incomeView === 'month' ? (
              incomeSlices.length === 0 ? (
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
                  <ul className="legend legend-col">
                    {incomeSlices.map((s) => (
                      <li key={s.categoryId}>
                        <span className="lg-dot" style={{ background: s.color }} />
                        <span className="lg-name">{s.name}</span>
                        <b>{hideBalance ? '•••' : formatCurrencyShort(s.amount)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <div className="spark-box">
                <div className="spark-cap">
                  <span>Đà thu nhập {incomeYear.length} tháng</span>
                  <span>{deltaLabel(incomeYear.map((p) => p.total))}</span>
                </div>
                <Spark values={incomeYear.map((p) => p.total)} />
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

/** "+18% so tháng trước" — so mốc cuối với mốc liền trước CÓ SỐ. */
function deltaLabel(values: number[]): string {
  const idx = values.length - 1;
  if (idx < 1) return '';
  const cur = values[idx];
  let prev = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (values[i] > 0) {
      prev = values[i];
      break;
    }
  }
  if (prev <= 0 || cur <= 0) return '';
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d >= 0 ? '+' : ''}${d}% so tháng trước`;
}

/** Đường đà thu nhập — dựng đúng hình dạng svg của mẫu D. */
function Spark({ values }: { values: number[] }) {
  // id phải DUY NHẤT: hai svg cùng id gradient thì cái sau ăn nhầm def của cái
  // trước. Hiện chỉ có một Spark, nhưng đây là loại lỗi chỉ lộ ra khi thêm cái thứ hai.
  const gradId = useId();
  if (values.length < 2) return null;
  const w = 300;
  const h = 56;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: 4 + (i / (values.length - 1)) * (w - 8),
    y: 5 + (1 - (v - min) / range) * (h - 16),
  }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} L${w - 4},${h} L4,${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity=".30" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline className="spark-line" points={line} />
      <circle className="spark-dot" cx={last.x} cy={last.y} r="4" />
    </svg>
  );
}
