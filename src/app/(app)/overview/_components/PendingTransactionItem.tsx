/* ═══ PendingTransactionItem — 1 row pending với 3 actions ═══
 *
 * Quick Confirm: tap nút Xác nhận → addTransaction với prediction defaults.
 * Edit: toggle inline form (category + note + wallet) → Xác nhận với edits.
 * Reject: xoá pending, không log gì.
 */
'use client';

import { useState } from 'react';
import { Check, Edit2, X, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/data/categories';
import { BANK_NAMES, type PendingTransaction } from '@/types/webhook';
import type { ConfirmEdits } from '@/hooks/usePendingTransactions';
import type { WalletType } from '@/stores/useFinanceStore';

interface Props {
  pending: PendingTransaction;
  onConfirm: (id: string, edits?: ConfirmEdits) => void;
  onReject: (id: string) => void;
}

export default function PendingTransactionItem({ pending, onConfirm, onReject }: Props) {
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(
    pending.predictedCategoryId ?? 'other',
  );
  const [note, setNote] = useState(pending.description);
  const [wallet, setWallet] = useState<WalletType>('main');

  const isIncome = pending.type === 'income';
  const cats = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const predictedCat = pending.predictedCategoryId
    ? cats.find((c) => c.id === pending.predictedCategoryId)
    : null;

  return (
    <div className="ptx-item">
      <div className="ptx-item-row">
        <span className={`ptx-item-amount ${isIncome ? 'income' : 'expense'}`}>
          {isIncome ? '+' : '-'}
          {formatCurrency(pending.amount)}
        </span>
        <span className="ptx-item-bank">{BANK_NAMES[pending.bankCode]}</span>
      </div>

      <p className="ptx-item-desc">{pending.description || '(không có mô tả)'}</p>

      {predictedCat && (
        <div className="ptx-item-predict">
          <Sparkles size={11} />
          <span>
            {predictedCat.icon} {predictedCat.name}
          </span>
          <span className="ptx-item-conf">{Math.round(pending.confidence * 100)}%</span>
        </div>
      )}

      {editing ? (
        <div className="ptx-edit-form">
          <select
            className="ptx-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <input
            className="ptx-input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú..."
          />
          <div className="ptx-wallet-row">
            <button
              className={wallet === 'main' ? 'active' : ''}
              onClick={() => setWallet('main')}
              type="button"
            >
              💳 Ví chính
            </button>
            <button
              className={wallet === 'emergency' ? 'active' : ''}
              onClick={() => setWallet('emergency')}
              type="button"
            >
              🛡️ Khẩn cấp
            </button>
          </div>
          <div className="ptx-item-actions">
            <button className="ptx-btn-cancel" onClick={() => setEditing(false)} type="button">
              Huỷ
            </button>
            <button
              className="ptx-btn-confirm"
              onClick={() => onConfirm(pending.id, { categoryId, note, wallet })}
              type="button"
            >
              <Check size={14} /> Xác nhận
            </button>
          </div>
        </div>
      ) : (
        <div className="ptx-item-actions">
          <button className="ptx-btn-confirm" onClick={() => onConfirm(pending.id)} type="button">
            <Check size={14} /> Xác nhận
          </button>
          <button className="ptx-btn-edit" onClick={() => setEditing(true)} type="button">
            <Edit2 size={14} /> Sửa
          </button>
          <button className="ptx-btn-reject" onClick={() => onReject(pending.id)} type="button">
            <X size={14} /> Bỏ qua
          </button>
        </div>
      )}
    </div>
  );
}
