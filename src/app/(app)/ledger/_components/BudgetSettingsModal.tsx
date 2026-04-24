/* ═══ BudgetSettingsModal — Thiết lập ngưỡng chi tiêu tháng ═══ */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import './BudgetSettingsModal.css';

/* ── Random colors for new categories ── */
const PALETTE = ['#F97316','#3B82F6','#EC4899','#8B5CF6','#10B981','#EF4444','#F59E0B','#6366F1','#14B8A6','#D946EF'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function BudgetSettingsModal({ isOpen, onClose }: Props) {
  const categories = useCategoryStore((s) => s.expenseCategories);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const updateCategory = useCategoryStore((s) => s.updateCategory);
  const removeCategory = useCategoryStore((s) => s.removeCategory);

  const budgets = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const setCategoryBudget = useBudgetStore((s) => s.setCategoryBudget);

  const transactions = useFinanceStore((s) => s.transactions);

  /* ── Local state for add/edit ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📌');

  /* ── Computed: actual spending from transactions ── */
  const actualSpending = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const expenses = transactions.filter(
      (t) => t.type === 'expense' && new Date(t.date) >= monthStart
    );
    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
    return map;
  }, [transactions]);

  /* ── Get budget for a category ── */
  const getBudgetLimit = useCallback(
    (catId: string) => {
      const b = budgets.find((x) => x.categoryId === catId && x.month === currentMonth);
      return b?.monthlyLimit || 0;
    },
    [budgets, currentMonth]
  );

  /* ── Totals ── */
  const totalBudget = useMemo(
    () => categories.reduce((s, c) => s + getBudgetLimit(c.id), 0),
    [categories, getBudgetLimit]
  );

  const totalSpent = useMemo(
    () => Object.values(actualSpending).reduce((s, v) => s + v, 0),
    [actualSpending]
  );

  /* ── Pie chart data ── */
  const pieData = useMemo(() => {
    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        limit: getBudgetLimit(c.id),
      }))
      .filter((d) => d.limit > 0);
  }, [categories, getBudgetLimit]);

  /* ── SVG Pie ── */
  const pieSlices = useMemo(() => {
    if (totalBudget === 0) return [];
    let cumAngle = 0;
    return pieData.map((d) => {
      const pct = d.limit / totalBudget;
      const startAngle = cumAngle;
      cumAngle += pct * 360;
      return { ...d, startAngle, endAngle: cumAngle, pct };
    });
  }, [pieData, totalBudget]);

  /* ── Handle budget amount change ── */
  const handleBudgetChange = (catId: string, value: string) => {
    const num = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setCategoryBudget(catId, num);
  };

  /* ── Add new category ── */
  const handleAddCategory = () => {
    if (!newName.trim()) return;
    const id = `custom-${Date.now()}`;
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    addCategory({ id, name: newName.trim(), icon: newIcon, color });
    setNewName('');
    setNewIcon('📌');
    setShowAddForm(false);
  };

  /* ── Edit category ── */
  const startEdit = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    setEditingId(catId);
    setEditName(cat.name);
    setEditIcon(cat.icon);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateCategory(editingId, { name: editName.trim(), icon: editIcon });
    setEditingId(null);
  };

  /* ── SVG helpers ── */
  const polarToXY = (cx: number, cy: number, r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const drawArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const s = polarToXY(cx, cy, r, start);
    const e = polarToXY(cx, cy, r, end);
    const large = end - start > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="bs-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bs-panel"
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button className="bs-close" onClick={onClose}>
              <X size={18} />
            </button>

            {/* Header */}
            <h2 className="bs-title">⚙️ Thiết lập ngưỡng chi tiêu tháng</h2>
            <p className="bs-subtitle">
              Đặt hạn mức chi tiêu cho từng danh mục để kiểm soát tài chính
            </p>

            {/* Total Summary */}
            <div className="bs-total-summary">
              <div className="bs-total-item">
                <span className="bs-total-label">Tổng ngưỡng</span>
                <span className="bs-total-value">{formatCurrency(totalBudget)}</span>
              </div>
              <div className="bs-total-divider" />
              <div className="bs-total-item">
                <span className="bs-total-label">Đã chi</span>
                <span className="bs-total-value bs-total-spent">{formatCurrency(totalSpent)}</span>
              </div>
              <div className="bs-total-divider" />
              <div className="bs-total-item">
                <span className="bs-total-label">Còn lại</span>
                <span className={`bs-total-value ${totalBudget - totalSpent < 0 ? 'bs-total-danger' : 'bs-total-safe'}`}>
                  {formatCurrency(Math.max(0, totalBudget - totalSpent))}
                </span>
              </div>
            </div>

            {/* ═══ Pie Chart ═══ */}
            {pieSlices.length > 0 && (
              <div className="bs-chart-section">
                <p className="bs-section-label">📊 Phân bổ ngân sách</p>
                <div className="bs-pie-wrap">
                  <svg viewBox="0 0 200 200" className="bs-pie-svg">
                    {pieSlices.map((slice) => (
                      <path
                        key={slice.id}
                        d={drawArc(100, 100, 80, slice.startAngle, slice.endAngle - 0.5)}
                        fill={slice.color}
                        opacity={0.85}
                      />
                    ))}
                    {/* Center circle (donut hole) */}
                    <circle cx="100" cy="100" r="45" fill="var(--c-bg-secondary)" />
                    <text x="100" y="96" textAnchor="middle" className="bs-pie-center-label">Tổng</text>
                    <text x="100" y="112" textAnchor="middle" className="bs-pie-center-value">
                      {formatCurrencyShort(totalBudget)}
                    </text>
                  </svg>
                  {/* Legend */}
                  <div className="bs-pie-legend">
                    {pieSlices.map((s) => (
                      <div key={s.id} className="bs-pie-legend-item">
                        <span className="bs-pie-dot" style={{ background: s.color }} />
                        <span className="bs-pie-legend-name">{s.icon} {s.name}</span>
                        <span className="bs-pie-legend-pct">{Math.round(s.pct * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Stacked Bar Chart (Budget vs Actual) ═══ */}
            <div className="bs-chart-section">
              <p className="bs-section-label">📈 Ngưỡng vs Thực chi</p>
              <div className="bs-bar-chart">
                {categories.map((cat) => {
                  const limit = getBudgetLimit(cat.id);
                  const spent = actualSpending[cat.id] || 0;
                  if (limit === 0 && spent === 0) return null;
                  const maxVal = Math.max(limit, spent, 1);
                  const limitPct = (limit / maxVal) * 100;
                  const spentPct = (spent / maxVal) * 100;
                  const isOver = spent > limit && limit > 0;

                  return (
                    <div key={cat.id} className="bs-bar-row">
                      <span className="bs-bar-label">{cat.icon}</span>
                      <div className="bs-bar-track">
                        {/* Budget limit layer (top) */}
                        <div
                          className="bs-bar-limit"
                          style={{ width: `${limitPct}%`, background: `${cat.color}30` }}
                        />
                        {/* Actual spending layer (bottom, grows up) */}
                        <div
                          className={`bs-bar-spent ${isOver ? 'bs-bar-over' : ''}`}
                          style={{
                            width: `${Math.min(spentPct, 100)}%`,
                            background: isOver
                              ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                              : `linear-gradient(90deg, ${cat.color}, ${cat.color}CC)`,
                          }}
                        />
                      </div>
                      <span className="bs-bar-values">
                        <span className={isOver ? 'bs-bar-over-text' : ''}>{formatCurrencyShort(spent)}</span>
                        <span className="bs-bar-sep">/</span>
                        <span>{formatCurrencyShort(limit)}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ Category Budget List ═══ */}
            <div className="bs-cat-section">
              <p className="bs-section-label">💰 Ngưỡng theo danh mục</p>
              <div className="bs-cat-list">
                {categories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  const limit = getBudgetLimit(cat.id);
                  const spent = actualSpending[cat.id] || 0;

                  return (
                    <div key={cat.id} className="bs-cat-item">
                      {isEditing ? (
                        /* Edit mode */
                        <div className="bs-cat-edit-row">
                          <input
                            className="bs-cat-edit-icon"
                            value={editIcon}
                            onChange={(e) => setEditIcon(e.target.value)}
                            maxLength={2}
                          />
                          <input
                            className="bs-cat-edit-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Tên danh mục"
                          />
                          <button className="bs-cat-save-btn" onClick={saveEdit}>
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        /* View mode */
                        <>
                          <div className="bs-cat-info">
                            <span className="bs-cat-icon" style={{ background: `${cat.color}15` }}>
                              {cat.icon}
                            </span>
                            <div>
                              <p className="bs-cat-name">{cat.name}</p>
                              <p className="bs-cat-spent">
                                Đã chi: <span style={{ color: spent > limit && limit > 0 ? '#EF4444' : 'var(--c-text-secondary)' }}>
                                  {formatCurrencyShort(spent)}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="bs-cat-actions">
                            <div className="bs-cat-input-wrap">
                              <input
                                className="bs-cat-budget-input"
                                type="text"
                                inputMode="numeric"
                                placeholder="0"
                                value={limit ? limit.toLocaleString('vi-VN') : ''}
                                onChange={(e) => handleBudgetChange(cat.id, e.target.value)}
                              />
                              <span className="bs-cat-currency">đ</span>
                            </div>
                            <button className="bs-cat-edit-btn" onClick={() => startEdit(cat.id)}>
                              <Pencil size={12} />
                            </button>
                            <button className="bs-cat-del-btn" onClick={() => removeCategory(cat.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ Add Category ═══ */}
            <AnimatePresence>
              {showAddForm ? (
                <motion.div
                  className="bs-add-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    className="bs-add-icon-input"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    maxLength={2}
                    placeholder="🔖"
                  />
                  <input
                    className="bs-add-name-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tên danh mục mới..."
                    autoFocus
                  />
                  <button className="bs-add-confirm" onClick={handleAddCategory}>
                    <Check size={16} />
                  </button>
                  <button className="bs-add-cancel" onClick={() => setShowAddForm(false)}>
                    <X size={16} />
                  </button>
                </motion.div>
              ) : (
                <button className="bs-add-btn" onClick={() => setShowAddForm(true)}>
                  <Plus size={16} />
                  <span>Thêm danh mục</span>
                </button>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
