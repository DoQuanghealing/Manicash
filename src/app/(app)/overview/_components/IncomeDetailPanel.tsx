/* ═══ IncomeDetailPanel — phần dưới trang Thu nhập ═══
 *
 *   1. Tài khoản ngân hàng nhận lương (tên + số tài khoản).
 *   2. Hai túi tiền: trong tài khoản vs tiền mặt trong túi — cộng lại đúng
 *      bằng ví chính, nên hai con số không bao giờ chênh nhau.
 *   3. Lịch sử thu nhập: bao nhiêu, lý do, khi nào, nhận bằng cách nào.
 */
'use client';

import { useMemo, useState } from 'react';
import { Banknote, Building2, Copy, Check, Pencil } from 'lucide-react';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useWalletBankStore } from '@/stores/useWalletBankStore';
import { INCOME_CATEGORIES } from '@/data/categories';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import WalletBankModal from './WalletBankModal';
import './IncomeDetailPanel.css';

/** Nhóm nguồn thu theo tháng đang xem. */
const HISTORY_LIMIT = 30;

export default function IncomeDetailPanel() {
  const [showBankModal, setShowBankModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const transactions = useFinanceStore((s) => s.transactions);
  const mainBalance = useFinanceStore((s) => s.mainBalance);
  const cashBalance = useFinanceStore((s) => s.cashBalance);
  const bankBalance = useFinanceStore((s) => s.getBankBalance());
  const monthKey = useFinanceStore((s) => s.getCurrentMonthKey());

  const wallets = useWalletBankStore((s) => s.wallets);
  const incomeWallet = wallets.find((w) => w.id === 'income');

  const monthIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income' && t.dateKey.startsWith(monthKey))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, HISTORY_LIMIT),
    [transactions, monthKey],
  );

  const cashIncome = monthIncome
    .filter((t) => t.method === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const transferIncome = monthIncome
    .filter((t) => t.method !== 'cash')
    .reduce((s, t) => s + t.amount, 0);

  async function copyAccount() {
    if (!incomeWallet?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(incomeWallet.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* trình duyệt chặn clipboard thì thôi, không chặn luồng */
    }
  }

  return (
    <div className="idp">
      {/* ── 1. Tài khoản nhận tiền ── */}
      <section className="idp-bank">
        <div className="idp-bank-head">
          <Building2 size={15} />
          <span className="idp-bank-title">Tài khoản nhận thu nhập</span>
          <button type="button" className="idp-bank-edit" onClick={() => setShowBankModal(true)}>
            <Pencil size={13} /> Sửa
          </button>
        </div>

        {incomeWallet?.accountNumber ? (
          <>
            <p className="idp-bank-name">{incomeWallet.bankName || 'Ngân hàng'}</p>
            <button type="button" className="idp-bank-number" onClick={copyAccount}>
              <span>{incomeWallet.accountNumber}</span>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {copied && <span className="idp-bank-copied">Đã chép số tài khoản</span>}
          </>
        ) : (
          <button type="button" className="idp-bank-empty" onClick={() => setShowBankModal(true)}>
            Chưa khai tài khoản — bấm để thêm tên ngân hàng và số tài khoản
          </button>
        )}
      </section>

      {/* ── 2. Hai túi tiền ── */}
      <section className="idp-pockets">
        <p className="idp-section-title">Tiền đang nằm ở đâu</p>
        <div className="idp-pocket-row">
          <div className="idp-pocket idp-pocket--bank">
            <span className="idp-pocket-icon"><Building2 size={16} /></span>
            <span className="idp-pocket-label">Trong tài khoản</span>
            <span className="idp-pocket-val">{formatCurrencyShort(bankBalance)}</span>
          </div>
          <div className="idp-pocket idp-pocket--cash">
            <span className="idp-pocket-icon"><Banknote size={16} /></span>
            <span className="idp-pocket-label">Tiền mặt trong túi</span>
            <span className="idp-pocket-val">{formatCurrencyShort(cashBalance)}</span>
          </div>
        </div>
        <p className="idp-pocket-note">
          Cộng lại đúng bằng ví chính <strong>{formatCurrency(mainBalance)}</strong>. Ghi rõ hình
          thức mỗi lần thu/chi thì hai con số này không bao giờ lệch với app ngân hàng.
        </p>
      </section>

      {/* ── 3. Lịch sử thu nhập ── */}
      <section className="idp-history">
        <div className="idp-history-head">
          <p className="idp-section-title">Thu nhập tháng này</p>
          <span className="idp-history-split">
            🏦 {formatCurrencyShort(transferIncome)} · 💵 {formatCurrencyShort(cashIncome)}
          </span>
        </div>

        {monthIncome.length === 0 ? (
          <p className="idp-empty">Tháng này chưa ghi khoản thu nào.</p>
        ) : (
          <ul className="idp-list">
            {monthIncome.map((txn) => {
              const cat = INCOME_CATEGORIES.find((c) => c.id === txn.categoryId);
              const isCash = txn.method === 'cash';
              return (
                <li key={txn.id} className="idp-item">
                  <span className="idp-item-icon" aria-hidden>{cat?.icon ?? '💵'}</span>
                  <span className="idp-item-copy">
                    <span className="idp-item-note">{txn.note || cat?.name || 'Thu nhập'}</span>
                    <span className="idp-item-meta">
                      <span className={`idp-tag ${isCash ? 'idp-tag--cash' : 'idp-tag--bank'}`}>
                        {isCash ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}
                      </span>
                      {cat?.name && <span className="idp-item-cat">{cat.name}</span>}
                      <span className="idp-item-time">{txn.dateLabel} • {txn.time}</span>
                    </span>
                  </span>
                  <span className="idp-item-amt">+{formatCurrencyShort(txn.amount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <WalletBankModal isOpen={showBankModal} onClose={() => setShowBankModal(false)} />
    </div>
  );
}
