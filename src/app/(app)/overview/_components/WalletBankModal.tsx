/* ═══ WalletBankModal — Quản lý ví + liên kết ngân hàng ═══ */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Building2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { useWalletBankStore, type WalletGroup, type WalletGroupData } from '@/stores/useWalletBankStore';
import './WalletBankModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletBankModal({ isOpen, onClose }: Props) {
  const wallets = useWalletBankStore((s) => s.wallets);
  const updateBank = useWalletBankStore((s) => s.updateBank);
  const addSubWallet = useWalletBankStore((s) => s.addSubWallet);
  const removeSubWallet = useWalletBankStore((s) => s.removeSubWallet);
  const updateSubWallet = useWalletBankStore((s) => s.updateSubWallet);

  const [expandedGroup, setExpandedGroup] = useState<WalletGroup | null>('income');
  const [addingSubTo, setAddingSubTo] = useState<WalletGroup | null>(null);
  const [newSubName, setNewSubName] = useState('');

  const handleAddSub = (groupId: WalletGroup) => {
    if (!newSubName.trim()) return;
    addSubWallet(groupId, newSubName.trim());
    setNewSubName('');
    setAddingSubTo(null);
  };

  const toggleGroup = (id: WalletGroup) => {
    setExpandedGroup((prev) => (prev === id ? null : id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="wb-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="wb-panel"
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button className="wb-close" onClick={onClose}>
              <X size={18} />
            </button>

            {/* Header */}
            <h2 className="wb-title">🏦 Quản lý Ví & Ngân hàng</h2>
            <p className="wb-subtitle">Thiết lập tên ngân hàng và số tài khoản cho từng ví</p>

            {/* ═══ Wallet Groups ═══ */}
            <div className="wb-groups">
              {wallets.map((wallet) => (
                <WalletGroupCard
                  key={wallet.id}
                  wallet={wallet}
                  isExpanded={expandedGroup === wallet.id}
                  onToggle={() => toggleGroup(wallet.id)}
                  onUpdateBank={(bank, acc) => updateBank(wallet.id, bank, acc)}
                  onUpdateSubWallet={(subId, updates) => updateSubWallet(wallet.id, subId, updates)}
                  onRemoveSubWallet={(subId) => removeSubWallet(wallet.id, subId)}
                  addingSubTo={addingSubTo}
                  setAddingSubTo={setAddingSubTo}
                  newSubName={newSubName}
                  setNewSubName={setNewSubName}
                  onAddSub={() => handleAddSub(wallet.id)}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══ Wallet Group Card ═══ */
function WalletGroupCard({
  wallet,
  isExpanded,
  onToggle,
  onUpdateBank,
  onUpdateSubWallet,
  onRemoveSubWallet,
  addingSubTo,
  setAddingSubTo,
  newSubName,
  setNewSubName,
  onAddSub,
}: {
  wallet: WalletGroupData;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateBank: (bank: string, acc: string) => void;
  onUpdateSubWallet: (subId: string, updates: any) => void;
  onRemoveSubWallet: (subId: string) => void;
  addingSubTo: WalletGroup | null;
  setAddingSubTo: (v: WalletGroup | null) => void;
  newSubName: string;
  setNewSubName: (v: string) => void;
  onAddSub: () => void;
}) {
  return (
    <div className="wb-group" style={{ '--wb-accent': wallet.color } as React.CSSProperties}>
      {/* Group header */}
      <button className="wb-group-header" onClick={onToggle}>
        <div className="wb-group-left">
          <span className="wb-group-icon" style={{ background: `${wallet.color}15` }}>
            {wallet.icon}
          </span>
          <div>
            <p className="wb-group-label">{wallet.label}</p>
            {wallet.bankName && (
              <p className="wb-group-bank-preview">
                <Building2 size={10} /> {wallet.bankName}
                {wallet.accountNumber && <span> · {maskAccount(wallet.accountNumber)}</span>}
              </p>
            )}
          </div>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="wb-group-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Main bank info */}
            <div className="wb-bank-fields">
              <div className="wb-field">
                <label className="wb-field-label">
                  <Building2 size={12} /> Tên ngân hàng
                </label>
                <input
                  className="wb-field-input"
                  placeholder="VD: Vietcombank, MB Bank..."
                  value={wallet.bankName}
                  onChange={(e) => onUpdateBank(e.target.value, wallet.accountNumber)}
                />
              </div>
              <div className="wb-field">
                <label className="wb-field-label">
                  <CreditCard size={12} /> Số tài khoản
                </label>
                <input
                  className="wb-field-input"
                  placeholder="VD: 1234567890"
                  value={wallet.accountNumber}
                  onChange={(e) => onUpdateBank(wallet.bankName, e.target.value)}
                />
              </div>
            </div>

            {/* Sub-wallets */}
            {wallet.subWallets.length > 0 && (
              <div className="wb-subs">
                <p className="wb-subs-title">Ví phụ</p>
                {wallet.subWallets.map((sub) => (
                  <div key={sub.id} className="wb-sub-item">
                    <div className="wb-sub-info">
                      <p className="wb-sub-name">{sub.name}</p>
                      <div className="wb-sub-fields">
                        <input
                          className="wb-sub-input"
                          placeholder="Ngân hàng..."
                          value={sub.bankName}
                          onChange={(e) =>
                            onUpdateSubWallet(sub.id, { bankName: e.target.value })
                          }
                        />
                        <input
                          className="wb-sub-input"
                          placeholder="Số TK..."
                          value={sub.accountNumber}
                          onChange={(e) =>
                            onUpdateSubWallet(sub.id, { accountNumber: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <button
                      className="wb-sub-del"
                      onClick={() => onRemoveSubWallet(sub.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add sub-wallet */}
            {addingSubTo === wallet.id ? (
              <div className="wb-add-sub-form">
                <input
                  className="wb-add-sub-input"
                  placeholder="Tên ví phụ..."
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && onAddSub()}
                />
                <button className="wb-add-sub-ok" onClick={onAddSub}>
                  <Plus size={14} />
                </button>
                <button className="wb-add-sub-cancel" onClick={() => setAddingSubTo(null)}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                className="wb-add-sub-btn"
                onClick={() => setAddingSubTo(wallet.id)}
              >
                <Plus size={14} />
                <span>Thêm ví phụ</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Helper: mask account number ── */
function maskAccount(acc: string): string {
  if (acc.length <= 4) return acc;
  return '••' + acc.slice(-4);
}
