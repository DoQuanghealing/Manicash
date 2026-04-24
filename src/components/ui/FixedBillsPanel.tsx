/* ═══ FixedBillsPanel — Bill management with edit, icon picker, auto-scroll ═══ */
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFinanceStore, type FixedBill } from '@/stores/useFinanceStore';
import './FixedBillsPanel.css';

const formatVND = (n: number) => n.toLocaleString('vi-VN') + 'đ';

/* ── Extended icon pool ── */
const ALL_ICONS = [
  '🏠','📚','💳','⚡','💧','📡','🚗','🏥','📱','🎓','🏋️','📑',
  '🎶','🎬','🐾','👶','💊','🧹','🔒','🎮','✈️','🍽️',
  '🛒','🧾','☁️','📦','🏢','🧑‍💻','🪙','💎','🌐','📺',
];

export default function FixedBillsPanel() {
  const billFundBalance = useFinanceStore((s) => s.billFundBalance);
  const fixedBills = useFinanceStore((s) => s.fixedBills);
  const payBill = useFinanceStore((s) => s.payBill);
  const addBill = useFinanceStore((s) => s.addBill);
  const updateBill = useFinanceStore((s) => s.updateBill);
  const removeBill = useFinanceStore((s) => s.removeBill);
  const addToBillFund = useFinanceStore((s) => s.addToBillFund);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);
  const [newBill, setNewBill] = useState({ name: '', icon: '', amount: '', dueDay: '' });
  const [fundAmount, setFundAmount] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editBill, setEditBill] = useState({ name: '', icon: '', amount: '', dueDay: '' });
  const [showIconPicker, setShowIconPicker] = useState<'add' | 'edit' | null>(null);

  const addFormRef = useRef<HTMLDivElement>(null);

  // Icons already used by existing bills
  const usedIcons = useMemo(() => fixedBills.map((b) => b.icon), [fixedBills]);

  // Available icons = ALL minus used (except current editing bill's icon)
  const getAvailableIcons = (excludeIcon?: string) => {
    return ALL_ICONS.filter((ic) => {
      if (ic === excludeIcon) return true; // Keep current bill's own icon
      return !usedIcons.includes(ic);
    });
  };

  // Compute bill targets
  const { total, accumulated, bills } = useMemo(() => {
    const sorted = [...fixedBills].sort((a, b) => a.dueDay - b.dueDay);
    let runningTotal = 0;
    const billsWithTotals = sorted.map((b) => {
      runningTotal += b.amount;
      return {
        ...b,
        runningTotal,
        canPay: billFundBalance >= runningTotal,
        shortage: Math.max(0, runningTotal - billFundBalance),
      };
    });
    return {
      total: sorted.reduce((s, b) => s + b.amount, 0),
      accumulated: billFundBalance,
      bills: billsWithTotals,
    };
  }, [fixedBills, billFundBalance]);

  const progressPercent = total > 0 ? Math.min(100, (accumulated / total) * 100) : 0;

  // Auto-scroll to add form when opened
  useEffect(() => {
    if (showAddForm && addFormRef.current) {
      setTimeout(() => {
        addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [showAddForm]);

  // Auto-set first available icon for new bill
  useEffect(() => {
    if (showAddForm && !newBill.icon) {
      const available = getAvailableIcons();
      if (available.length > 0) setNewBill((prev) => ({ ...prev, icon: available[0] }));
    }
  }, [showAddForm]);

  const handleAddBill = () => {
    const amt = parseInt(newBill.amount.replace(/\D/g, ''), 10);
    const day = parseInt(newBill.dueDay, 10);
    if (!newBill.name || !amt || !day || day < 1 || day > 31) return;

    addBill({ name: newBill.name, icon: newBill.icon || '📑', amount: amt, dueDay: day });
    setNewBill({ name: '', icon: '', amount: '', dueDay: '' });
    setShowAddForm(false);
    setShowIconPicker(null);
  };

  const handleAddFund = () => {
    const amt = parseInt(fundAmount.replace(/\D/g, ''), 10);
    if (!amt || amt <= 0) return;
    addToBillFund(amt);
    setFundAmount('');
    setShowFundForm(false);
  };

  const startEdit = (bill: FixedBill) => {
    setEditingBillId(bill.id);
    setEditBill({
      name: bill.name,
      icon: bill.icon,
      amount: bill.amount.toLocaleString('vi-VN'),
      dueDay: String(bill.dueDay),
    });
    setShowIconPicker(null);
  };

  const saveEdit = () => {
    if (!editingBillId) return;
    const amt = parseInt(editBill.amount.replace(/\D/g, ''), 10);
    const day = parseInt(editBill.dueDay, 10);
    if (!editBill.name || !amt || !day || day < 1 || day > 31) return;

    updateBill(editingBillId, {
      name: editBill.name,
      icon: editBill.icon,
      amount: amt,
      dueDay: day,
    });
    setEditingBillId(null);
    setShowIconPicker(null);
  };

  const cancelEdit = () => {
    setEditingBillId(null);
    setShowIconPicker(null);
  };

  return (
    <div className="bills-panel">
      {/* ═══ Fund Header ═══ */}
      <div className="bills-fund-header">
        <div className="bills-fund-label">
          <span className="bills-fund-icon">🏦</span>
          <span>Quỹ Bill Cố Định</span>
        </div>
        <span className="bills-fund-total-badge">{formatVND(total)}</span>
      </div>

      {/* ═══ Progress Bar ═══ */}
      <div className="bills-progress-wrapper">
        <div className="bills-progress-bar">
          <div
            className="bills-progress-fill"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="bills-progress-shimmer" />
          </div>
        </div>
        <div className="bills-progress-labels">
          <span className="bills-progress-current">💰 {formatVND(accumulated)}</span>
          <span className="bills-progress-target">/ {formatVND(total)}</span>
        </div>
      </div>

      <button className="bills-add-fund-btn" onClick={() => setShowFundForm(!showFundForm)}>
        💰 Nạp tiền vào quỹ bill
      </button>

      {/* Fund form */}
      {showFundForm && (
        <div className="bills-add-form">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Số tiền nạp..."
            value={fundAmount}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setFundAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
            }}
            className="bills-input"
          />
          <button className="bills-confirm-btn" onClick={handleAddFund}>Nạp</button>
        </div>
      )}

      {/* ═══ Bill list ═══ */}
      <div className="bills-list">
        {bills.map((bill) => {
          const isEditing = editingBillId === bill.id;
          const shortageMsg = !bill.isPaid && !bill.canPay && bill.shortage > 0
            ? `Cậu chủ ơi, ráng chút xíu nữa! Còn ${formatVND(bill.shortage)} nữa là trả được bill này rồi! 💪`
            : null;

          return (
            <div key={bill.id} className={`bill-card ${bill.isPaid ? 'paid' : ''}`}>
              {isEditing ? (
                /* ═══ Edit mode ═══ */
                <div className="bill-edit-form">
                  <div className="bill-edit-row">
                    <button
                      className="bill-icon-picker-btn"
                      onClick={() => setShowIconPicker(showIconPicker === 'edit' ? null : 'edit')}
                    >
                      {editBill.icon || '📑'}
                    </button>
                    <input
                      className="bills-input"
                      style={{ flex: 1 }}
                      value={editBill.name}
                      onChange={(e) => setEditBill({ ...editBill, name: e.target.value })}
                      placeholder="Tên bill..."
                    />
                  </div>

                  {/* Icon picker for edit */}
                  {showIconPicker === 'edit' && (
                    <div className="bill-icon-grid">
                      {getAvailableIcons(editBill.icon).map((ic) => (
                        <button
                          key={ic}
                          className={`bill-icon-option ${editBill.icon === ic ? 'active' : ''}`}
                          onClick={() => {
                            setEditBill({ ...editBill, icon: ic });
                            setShowIconPicker(null);
                          }}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="bill-edit-row">
                    <input
                      className="bills-input"
                      style={{ flex: 1 }}
                      inputMode="numeric"
                      placeholder="Số tiền..."
                      value={editBill.amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setEditBill({ ...editBill, amount: raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '' });
                      }}
                    />
                    <input
                      className="bills-input"
                      style={{ width: 70 }}
                      type="number"
                      placeholder="Ngày"
                      value={editBill.dueDay}
                      onChange={(e) => setEditBill({ ...editBill, dueDay: e.target.value })}
                      min="1"
                      max="31"
                    />
                  </div>
                  <div className="bill-edit-actions">
                    <button className="bills-confirm-btn" onClick={saveEdit}>💾 Lưu</button>
                    <button className="bills-cancel-btn" onClick={cancelEdit}>Hủy</button>
                    <button
                      className="bills-delete-btn"
                      onClick={() => { removeBill(bill.id); setEditingBillId(null); }}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ) : (
                /* ═══ View mode ═══ */
                <>
                  <div className="bill-card-main">
                    <span className="bill-icon">{bill.icon}</span>
                    <div className="bill-info">
                      <span className="bill-name">{bill.name}</span>
                      <span className="bill-due">Ngày {bill.dueDay} hàng tháng</span>
                    </div>
                    <div className="bill-right">
                      <span className="bill-amount">{formatVND(bill.amount)}</span>
                      {bill.isPaid ? (
                        <span className="bill-paid-badge">✅ Đã trả</span>
                      ) : (
                        <div className="bill-right-actions">
                          <button
                            className="bill-pay-btn"
                            onClick={() => payBill(bill.id)}
                            disabled={billFundBalance < bill.amount}
                          >
                            Thanh toán
                          </button>
                          <button className="bill-edit-btn" onClick={() => startEdit(bill)}>✏️</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Running total */}
                  <div className="bill-running-total">
                    <div className="bill-running-bar">
                      <div
                        className="bill-running-fill"
                        style={{ width: `${Math.min(100, (accumulated / bill.runningTotal) * 100)}%` }}
                      />
                    </div>
                    <span className="bill-running-label">
                      Cộng dồn: {formatVND(bill.runningTotal)}
                    </span>
                  </div>

                  {shortageMsg && (
                    <div className="bill-shortage-msg">
                      <span>🎩</span>
                      <p>{shortageMsg}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Add bill button ═══ */}
      <button className="bills-add-btn" onClick={() => setShowAddForm(!showAddForm)}>
        ➕ Thêm bill cố định
      </button>

      {/* ═══ Add bill form ═══ */}
      {showAddForm && (
        <div className="bills-add-form" ref={addFormRef}>
          <div className="bills-add-row">
            <button
              className="bill-icon-picker-btn"
              onClick={() => setShowIconPicker(showIconPicker === 'add' ? null : 'add')}
            >
              {newBill.icon || '📑'}
            </button>
            <input
              type="text"
              placeholder="Tên bill..."
              value={newBill.name}
              onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
              className="bills-input"
              style={{ flex: 1 }}
              autoFocus
            />
          </div>

          {/* Icon picker for add */}
          {showIconPicker === 'add' && (
            <div className="bill-icon-grid">
              {getAvailableIcons().map((ic) => (
                <button
                  key={ic}
                  className={`bill-icon-option ${newBill.icon === ic ? 'active' : ''}`}
                  onClick={() => {
                    setNewBill({ ...newBill, icon: ic });
                    setShowIconPicker(null);
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          )}

          <div className="bills-add-row">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Số tiền..."
              value={newBill.amount}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setNewBill({ ...newBill, amount: raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '' });
              }}
              className="bills-input"
              style={{ flex: 1 }}
            />
            <input
              type="number"
              placeholder="Ngày đóng"
              value={newBill.dueDay}
              onChange={(e) => setNewBill({ ...newBill, dueDay: e.target.value })}
              className="bills-input"
              style={{ width: 80 }}
              min="1"
              max="31"
            />
          </div>
          <button className="bills-confirm-btn" onClick={handleAddBill}>
            Thêm bill
          </button>
        </div>
      )}
    </div>
  );
}
