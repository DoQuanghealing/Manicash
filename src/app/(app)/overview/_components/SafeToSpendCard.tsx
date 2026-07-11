/* ═══ SafeToSpendCard — Số dư khả dụng (navy) + Trạng thái tài khoản ═══
 * Mặc định GỌN: chỉ số dư khả dụng nổi bật + tình trạng. Bấm "Cách tính số này"
 * (nhỏ) → xổ ĐẦY ĐỦ: breakdown bấm-từng-dòng + lý do + nút hành động (điều hướng).
 * Số che mặc định (nút mắt, nhớ qua useSettingsStore.hideBalance).
 * Logic: computeAccountStatus + getBalanceBreakdownDetail (moneyBrain, đã test).
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { useSafeBalance } from '@/hooks/useSafeBalance';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { AccountStatusResult } from '@/lib/moneyBrain/accountStatus';
import type { BreakdownItem } from '@/lib/moneyBrain/balanceBreakdown';
import './SafeToSpendCard.css';

/** Màu semantic theo tone trạng thái (nền card luôn navy). */
const TONE: Record<AccountStatusResult['tone'], string> = {
  excellent: 'sts-tone-green',
  good: 'sts-tone-blue',
  average: 'sts-tone-amber',
  danger: 'sts-tone-red',
};

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('vi-VN');
}

export default function SafeToSpendCard() {
  const router = useRouter();
  const { safeToSpend, accountStatus, detail } = useSafeBalance();
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const toggleHide = useSettingsStore((s) => s.toggleHideBalance);

  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const isNegative = safeToSpend < 0;
  const isZero = safeToSpend === 0;
  const toneClass = TONE[accountStatus.tone];

  const num = (
    <span className="sts-num">
      {isNegative ? '−' : ''}
      {fmt(safeToSpend)}
    </span>
  );

  return (
    <motion.div
      className={`sts-card ${toneClass} ${hideBalance ? 'is-masked' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <button className="sts-eye" onClick={toggleHide} aria-label={hideBalance ? 'Hiện số dư' : 'Ẩn số dư'}>
        {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>

      {/* Label + ? */}
      <div className="sts-lblrow">
        <span className="sts-lbl">Số dư khả dụng</span>
        <button className="sts-qmark" onClick={() => setShowInfo(true)} aria-label="Số dư khả dụng là gì">?</button>
      </div>

      {/* Số dư nổi bật */}
      <div className={`sts-amount ${isNegative ? 'sts-amount--neg' : ''}`}>
        {num}
        {isZero ? <span className="sts-cur"> đồng</span> : <span className="sts-cur">đ</span>}
      </div>

      {/* Tình trạng */}
      <div className="sts-statusline">
        <span className="sts-status-k">Tình trạng:</span>
        <span className="sts-chip">{accountStatus.emoji} {accountStatus.label}</span>
      </div>

      {/* Nút cách tính — nhỏ */}
      <button className={`sts-calc ${expanded ? 'is-open' : ''}`} onClick={() => setExpanded((v) => !v)}>
        <span>{expanded ? 'Thu gọn' : 'Cách tính số này'}</span>
        <ChevronDown size={13} className="sts-chev" />
      </button>

      {/* ĐẦY ĐỦ */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="sts-full"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="sts-breakdown">
              <BreakdownRow id="income" label="Thu nhập tháng" amount={detail.monthlyIncome} sign={0}
                items={detail.incomes} openRow={openRow} setOpenRow={setOpenRow} />
              {detail.carryOver !== 0 && (
                <BreakdownRow id="carry" label="Dư tháng trước" amount={detail.carryOver} sign={1}
                  items={[{ label: 'Chuyển từ tháng trước', amount: detail.carryOver }]} openRow={openRow} setOpenRow={setOpenRow} />
              )}
              <BreakdownRow id="budget" label="Ngưỡng chi tiêu" amount={detail.plannedMonthlyBudget} sign={-1}
                items={detail.budgets} openRow={openRow} setOpenRow={setOpenRow} />
              <BreakdownRow id="bills" label="Bill chưa đóng" amount={detail.totalUnpaidBills} sign={-1}
                items={detail.unpaidBills} openRow={openRow} setOpenRow={setOpenRow}
                action={detail.unpaidBills.length > 0 ? { label: '💳 Thanh toán ngay → Sổ sách', onClick: () => router.push('/ledger?tab=bills') } : undefined} />
              <BreakdownRow id="savings" label="Tiết kiệm/tháng" amount={detail.plannedMonthlyGoalContributions} sign={-1}
                items={detail.goalContributions} openRow={openRow} setOpenRow={setOpenRow} />
            </div>

            {/* Lý do + hành động */}
            <div className="sts-why">
              <div className="sts-why-h">{accountStatus.emoji} {accountStatus.headline}</div>
              <ul className="sts-why-list">
                {accountStatus.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {accountStatus.actions.length > 0 && (
                <div className="sts-acts">
                  {accountStatus.actions.map((a, i) => (
                    <button
                      key={i}
                      className={`sts-act ${a.kind === 'pay-bills' || a.kind === 'earn-more' ? 'is-primary' : ''}`}
                      onClick={() => a.target && router.push(a.target)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal giải thích */}
      <AnimatePresence>
        {showInfo && (
          <motion.div className="sts-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}>
            <motion.div className="sts-modal-card" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="sts-modal-title">Số dư khả dụng là gì?</h3>
              <p className="sts-modal-sub">
                <strong>Số tiền an toàn bạn thật sự có thể tiêu</strong> phần còn lại của tháng — sau khi đã chừa đủ cho các khoản cứng.
              </p>
              <div className="sts-formula">
                [Thu nhập tháng]<br />
                <span className="sts-op sts-op--p">+</span> [Dư tháng trước]<br />
                <span className="sts-op sts-op--m">−</span> [Ngưỡng chi tiêu]<br />
                <span className="sts-op sts-op--m">−</span> [Bill chưa đóng]<br />
                <span className="sts-op sts-op--m">−</span> [Tiết kiệm/tháng]<br />
                <span className="sts-op sts-op--e">=</span> <span className="sts-formula-res">Số dư khả dụng</span>
              </div>
              <p className="sts-modal-note">
                Về <strong>0 đồng</strong> là vừa đủ — chưa đáng lo. Chỉ khi <strong>âm</strong> mới là dấu hiệu tiêu nhiều hơn thu.
              </p>
              <button className="sts-modal-btn" onClick={() => setShowInfo(false)}>Đã hiểu</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Dòng breakdown bấm được → xổ chi tiết ── */
function BreakdownRow({
  id, label, amount, sign, items, openRow, setOpenRow, action,
}: {
  id: string;
  label: string;
  amount: number;
  sign: -1 | 0 | 1;
  items: BreakdownItem[];
  openRow: string | null;
  setOpenRow: (v: string | null) => void;
  action?: { label: string; onClick: () => void };
}) {
  const open = openRow === id;
  const pre = sign < 0 ? '−' : sign > 0 ? '+' : '';
  const valClass = sign < 0 ? 'sts-brow-neg' : sign > 0 ? 'sts-brow-pos' : '';

  return (
    <div className="sts-brow-wrap">
      <button className={`sts-brow ${open ? 'is-open' : ''}`} onClick={() => setOpenRow(open ? null : id)}>
        <span className="sts-brow-l">
          <ChevronRight size={12} className="sts-brow-cx" />
          {label}
        </span>
        <span className={`sts-brow-v ${valClass}`}>
          <span className="sts-num">{pre}{fmt(amount)}đ</span>
        </span>
      </button>
      {open && (
        <div className="sts-bdetail">
          {items.length === 0 ? (
            <div className="sts-ditem"><span>Chưa có mục nào</span></div>
          ) : (
            items.map((it, i) => (
              <div className="sts-ditem" key={i}>
                <span><strong>{it.label}</strong>{it.note ? <span className="sts-dnote"> ({it.note})</span> : null}</span>
                <span className="sts-num">{fmt(it.amount)}đ</span>
              </div>
            ))
          )}
          {action && (
            <button className="sts-paybtn" onClick={action.onClick}>{action.label}</button>
          )}
        </div>
      )}
    </div>
  );
}
