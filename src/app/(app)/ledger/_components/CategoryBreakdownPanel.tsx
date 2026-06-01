/* ═══ CategoryBreakdownPanel ═══════════════════════════════════════
 * Tab "Danh mục" của Sổ sách: liệt kê các danh mục chi tiêu trong tháng,
 * cho phép user gắn cờ ⚑ những khoản chi quá tay. Mỗi card hiện:
 *   - Icon + tên + số đã chi / ngưỡng
 *   - Progress bar màu hóa theo % (xanh / vàng / đỏ)
 *   - Nếu vượt ngưỡng → badge "Vượt Xđ"
 *   - Nếu đã flag → highlight + hiện "Nếu giảm 20% → tiết kiệm Y/tháng"
 *
 * Flag state lưu ở useBudgetStore.flaggedCategories. AI CFO sẽ nhận
 * danh sách flagged + over-budget kèm tên category để nhắc nhở cụ thể
 * (thay vì chỉ con số đếm).
 * ─────────────────────────────────────────────────────────────────── */
'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatCurrency';
import CategoryDetailDrawer from './CategoryDetailDrawer';
import './CategoryBreakdownPanel.css';

/** % cắt giảm mặc định khi tính savings preview. UX có slider cho phép user đổi. */
const DEFAULT_CUT_PERCENT = 0.2;

interface BreakdownRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  spent: number;
  limit: number;
  percent: number;     // 0..∞ (có thể >100 nếu vượt)
  overBy: number;      // 0 nếu chưa vượt
  isOver: boolean;
  isFlagged: boolean;
  /** Số transaction trong category này đã được flag riêng. */
  flaggedTxnCount: number;
  /** Tổng amount của các txn đã flag trong category. */
  flaggedTxnTotal: number;
  /** Tiết kiệm 1 tháng nếu cắt cutPercent. */
  savingsAtCut: number;
  /** Tiết kiệm trung bình 1 tuần (÷4.33). */
  weeklySavings: number;
  /** Có hoạt động hay không (spent > 0 || đã flag) — để filter empty rows. */
  hasActivity: boolean;
}

export default function CategoryBreakdownPanel() {
  const categories = useCategoryStore((s) => s.expenseCategories);
  const categoryBudgets = useBudgetStore((s) => s.categoryBudgets);
  const currentMonth = useBudgetStore((s) => s.currentMonth);
  const flaggedCategories = useBudgetStore((s) => s.flaggedCategories);
  const flaggedTransactionIds = useBudgetStore((s) => s.flaggedTransactionIds);
  const transactions = useFinanceStore((s) => s.transactions);

  /** % cắt giảm user đang muốn mô phỏng. */
  const [cutPercent, setCutPercent] = useState(DEFAULT_CUT_PERCENT);
  /** Category đang mở drawer. null = drawer đóng. */
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  /** Thực chi tháng này theo categoryId + map đếm flagged txn / category. */
  const { actualSpending, flaggedByCategory } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const flagSet = new Set(flaggedTransactionIds);
    const spendingMap: Record<string, number> = {};
    const flagMap: Record<string, { count: number; total: number }> = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (new Date(t.date) < monthStart) continue;
      spendingMap[t.categoryId] = (spendingMap[t.categoryId] || 0) + t.amount;
      if (flagSet.has(t.id)) {
        if (!flagMap[t.categoryId]) flagMap[t.categoryId] = { count: 0, total: 0 };
        flagMap[t.categoryId].count += 1;
        flagMap[t.categoryId].total += t.amount;
      }
    }
    return { actualSpending: spendingMap, flaggedByCategory: flagMap };
  }, [transactions, flaggedTransactionIds]);

  /** Toàn bộ rows — kể cả category chưa có chi tiêu (để user có thể flag chủ động). */
  const rows = useMemo<BreakdownRow[]>(() => {
    return categories.map((cat) => {
      const spent = actualSpending[cat.id] || 0;
      const budget = categoryBudgets.find(
        (b) => b.categoryId === cat.id && b.month === currentMonth,
      );
      const limit = budget?.monthlyLimit || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;
      const overBy = Math.max(0, spent - limit);
      const isOver = limit > 0 && spent > limit;
      const savingsAtCut = Math.round(spent * cutPercent);
      const flagInfo = flaggedByCategory[cat.id] || { count: 0, total: 0 };
      const isFlagged = flaggedCategories.includes(cat.id);
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        spent,
        limit,
        percent,
        overBy,
        isOver,
        isFlagged,
        flaggedTxnCount: flagInfo.count,
        flaggedTxnTotal: flagInfo.total,
        savingsAtCut,
        weeklySavings: Math.round(savingsAtCut / 4.33),
        hasActivity: spent > 0 || isFlagged || flagInfo.count > 0,
      };
    });
  }, [
    categories,
    actualSpending,
    categoryBudgets,
    currentMonth,
    flaggedCategories,
    flaggedByCategory,
    cutPercent,
  ]);

  /** Sort: có flagged-txn → flagged-category → over-budget → spent giảm dần.
   *  Empty rows (chưa chi gì) đẩy xuống cuối nhưng vẫn render để user có thể flag chủ động. */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.hasActivity !== b.hasActivity) return a.hasActivity ? -1 : 1;
      const aHasFlagTxn = a.flaggedTxnCount > 0;
      const bHasFlagTxn = b.flaggedTxnCount > 0;
      if (aHasFlagTxn !== bHasFlagTxn) return aHasFlagTxn ? -1 : 1;
      if (a.isFlagged !== b.isFlagged) return a.isFlagged ? -1 : 1;
      if (a.isOver !== b.isOver) return a.isOver ? -1 : 1;
      return b.spent - a.spent;
    });
  }, [rows]);

  /** Tổng kết banner đầu trang. */
  const summary = useMemo(() => {
    const flagged = rows.filter((r) => r.isFlagged);
    const over = rows.filter((r) => r.isOver);
    // Savings = cut% × (spent của flagged-categories + total của flagged-txns không thuộc flagged-cat).
    // Để tránh double-count: nếu category đã flag, dùng spent. Còn lại dùng flaggedTxnTotal.
    let savingsBase = 0;
    let flaggedTxnTotalAcross = 0;
    for (const r of rows) {
      if (r.isFlagged) savingsBase += r.spent;
      else savingsBase += r.flaggedTxnTotal;
      flaggedTxnTotalAcross += r.flaggedTxnCount;
    }
    const flaggedSavings = Math.round(savingsBase * cutPercent);
    return {
      flaggedCount: flagged.length,
      overCount: over.length,
      flaggedTxnCount: flaggedTxnTotalAcross,
      flaggedSavings,
      flaggedWeeklySavings: Math.round(flaggedSavings / 4.33),
    };
  }, [rows, cutPercent]);

  return (
    <div className="cbp-root">
      {/* ═══ Banner: tổng kết flagged ═══ */}
      <div className="cbp-banner">
        <div className="cbp-banner-row">
          <div className="cbp-banner-stat">
            <span className="cbp-banner-label">⚑ DM theo dõi</span>
            <span className="cbp-banner-value">{summary.flaggedCount}</span>
          </div>
          <div className="cbp-banner-divider" />
          <div className="cbp-banner-stat">
            <span className="cbp-banner-label">⚑ GD cảnh báo</span>
            <span className="cbp-banner-value">{summary.flaggedTxnCount}</span>
          </div>
          <div className="cbp-banner-divider" />
          <div className="cbp-banner-stat">
            <span className="cbp-banner-label">💰 Tiết kiệm</span>
            <span className="cbp-banner-value cbp-banner-savings">
              {summary.flaggedSavings > 0 ? formatCurrencyShort(summary.flaggedSavings) : '—'}
            </span>
          </div>
        </div>

        {(summary.flaggedCount > 0 || summary.flaggedTxnCount > 0) && summary.flaggedSavings > 0 && (
          <p className="cbp-banner-hint">
            Nếu cắt {Math.round(cutPercent * 100)}% các khoản đã đánh dấu, cậu chủ tiết kiệm
            khoảng <strong>{formatCurrency(summary.flaggedWeeklySavings)}/tuần</strong>
            {' '}— tổng <strong>{formatCurrency(summary.flaggedSavings)}/tháng</strong>. 🎯
          </p>
        )}
      </div>

      {/* ═══ Slider cắt giảm ═══ */}
      <div className="cbp-cut-row">
        <span className="cbp-cut-label">Mô phỏng cắt giảm</span>
        <div className="cbp-cut-options">
          {[0.1, 0.2, 0.3, 0.5].map((pct) => (
            <button
              key={pct}
              className={`cbp-cut-chip ${cutPercent === pct ? 'active' : ''}`}
              onClick={() => setCutPercent(pct)}
              id={`cbp-cut-${Math.round(pct * 100)}`}
            >
              {Math.round(pct * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Category list ═══ */}
      <div className="cbp-list">
        <AnimatePresence initial={false}>
          {sortedRows.map((row) => (
            <CategoryRow
              key={row.id}
              row={row}
              onOpen={() => setOpenCategoryId(row.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ═══ Empty hint ═══ */}
      {summary.flaggedCount === 0 && summary.flaggedTxnCount === 0 && (
        <div className="cbp-empty-hint">
          <p>
            💡 Bấm vào 1 danh mục để xem chi tiết — gắn cảnh báo từng giao dịch
            chi quá tay (vd: ăn sang &gt; 500k). AI CFO sẽ ưu tiên nhắc nhở các khoản
            này trong báo cáo tháng.
          </p>
        </div>
      )}

      {/* ═══ Drawer drill-down ═══ */}
      <CategoryDetailDrawer
        categoryId={openCategoryId}
        isOpen={openCategoryId !== null}
        onClose={() => setOpenCategoryId(null)}
      />
    </div>
  );
}

/* ─────────── Sub-component: 1 hàng category — click để mở drawer ─────────── */
interface CategoryRowProps {
  row: BreakdownRow;
  onOpen: () => void;
}

function CategoryRow({ row, onOpen }: CategoryRowProps) {
  // Color theo % usage
  const barColor =
    row.percent >= 100
      ? 'linear-gradient(90deg, #EF4444, #DC2626)'
      : row.percent >= 70
        ? 'linear-gradient(90deg, #F59E0B, #F97316)'
        : `linear-gradient(90deg, ${row.color}, ${row.color}CC)`;

  const barWidth = Math.min(100, row.percent);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className={`cbp-card ${row.isFlagged ? 'flagged' : ''} ${row.isOver ? 'over' : ''}`}
      id={`cbp-card-${row.id}`}
    >
      <div
        className="cbp-card-head"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <div className="cbp-card-icon" style={{ background: `${row.color}18` }}>
          {row.icon}
        </div>

        <div className="cbp-card-info">
          <div className="cbp-card-name-row">
            <span className="cbp-card-name">{row.name}</span>
            {row.isFlagged && <span className="cbp-flag-pill">⚑ Theo dõi</span>}
            {row.flaggedTxnCount > 0 && (
              <span className="cbp-flag-pill cbp-flag-pill-txn">
                ⚑ {row.flaggedTxnCount} GD
              </span>
            )}
            {row.isOver && (
              <span className="cbp-over-pill">Vượt {formatCurrencyShort(row.overBy)}</span>
            )}
          </div>
          <p className="cbp-card-spent">
            {formatCurrencyShort(row.spent)}
            {row.limit > 0 && (
              <>
                {' '}
                <span className="cbp-card-limit">/ {formatCurrencyShort(row.limit)}</span>
              </>
            )}
            {row.limit === 0 && row.spent > 0 && (
              <span className="cbp-card-nolimit"> · Chưa đặt ngưỡng</span>
            )}
            {row.spent === 0 && (
              <span className="cbp-card-nolimit">Chưa có chi tiêu tháng này</span>
            )}
          </p>
        </div>

        <div className="cbp-card-right">
          <span
            className="cbp-card-percent"
            style={{
              color:
                row.percent >= 100
                  ? 'var(--c-danger)'
                  : row.percent >= 70
                    ? 'var(--c-warning)'
                    : 'var(--c-text-secondary)',
            }}
          >
            {row.limit > 0 ? `${Math.round(row.percent)}%` : '—'}
          </span>
          <ChevronRight size={14} className="cbp-chevron" />
        </div>
      </div>

      {row.limit > 0 && (
        <div className="cbp-bar-track">
          <motion.div
            className="cbp-bar-fill"
            initial={false}
            animate={{ width: `${barWidth}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 24 }}
            style={{ background: barColor }}
          />
        </div>
      )}
    </motion.div>
  );
}
