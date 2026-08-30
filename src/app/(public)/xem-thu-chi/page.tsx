/* ═══ TRANG XEM THỬ — CHỈ SỐNG TRÊN NHÁNH, KHÔNG MERGE VÀO main ═══
 *
 * Dựng một hồ sơ 2 tháng có số liệu sống để PO nhìn và chụp màn hình.
 *
 * ⚠️ VÌ SAO KHÔNG ĐƯỢC MERGE VÀO main: đây là route CÔNG KHAI trong
 * (public), không có cổng đăng nhập. Vào main là Vercel dựng thẳng lên
 * prod, ai có link cũng mở được một trang tiền giả mang nhãn ManiCash.
 * Luật PO đã chốt: KHÔNG để seed/demo lọt prod, người dùng mới phải thấy
 * số 0. Muốn chụp thì mở bản xem trước (preview) mà Vercel dựng cho nhánh
 * này. Muốn đưa vào prod thật thì phải gate sau NEXT_PUBLIC_DEMO_MODE
 * trước đã.
 *
 * ⚠️ CÁCH LY DỮ LIỆU THẬT: các store tài chính đều persist xuống localStorage,
 * nên `setState` thẳng như bản trước sẽ GHI ĐÈ dữ liệu thật của người đang đăng
 * nhập. Ở đây tráo kho lưu sang bộ nhớ tạm TRƯỚC khi nạp — số giả chỉ sống trong
 * tab này, tải lại trang là về dữ liệu thật.
 *
 * Hồ sơ: một người thu nhập 2 nguồn.
 *   Thu cố định 20tr/tháng (lương, chuyển khoản)
 *   Affiliate: tháng trước 10tr · tháng này 13tr
 *   Để dành 5tr/tháng · ăn uống ghi từng bữa mỗi ngày
 *
 * Số dư khả dụng chốt ở 18.249.000đ, ráp từ công thức thật:
 *   33.000.000 (thu) + 500.000 (dư tháng trước)
 *   − 8.500.000 (ngưỡng chi tiêu) − 1.751.000 (bill chưa đóng) − 5.000.000 (để dành)
 *   = 18.249.000
 */
'use client';

import { useEffect, useState } from 'react';
import { createJSONStorage } from 'zustand/middleware';
import MoneyBlocks from '../../(app)/overview/_components/MoneyBlocks';
import SafeToSpendCard from '../../(app)/overview/_components/SafeToSpendCard';
import { useFinanceStore } from '@/stores/useFinanceStore';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useGoalsStore } from '@/stores/useGoalsStore';
import { useBudgetStore } from '@/stores/useBudgetStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWalletBankStore } from '@/stores/useWalletBankStore';

/* ─────────────────────────────────────────────────────────────
 * Cách ly kho lưu
 * ───────────────────────────────────────────────────────────── */

const memBox = new Map<string, string>();
const memStorage = createJSONStorage(() => ({
  getItem: (k: string) => memBox.get(k) ?? null,
  setItem: (k: string, v: string) => void memBox.set(k, v),
  removeItem: (k: string) => void memBox.delete(k),
}));

/** Trỏ mọi store sắp bị nạp số giả vào bộ nhớ tạm, không cho chạm localStorage. */
function isolatePersistence() {
  const stores = [
    useFinanceStore,
    useBudgetStore,
    useGoalsStore,
    useDashboardStore,
    useWalletBankStore,
    useSettingsStore,
  ] as unknown as { persist?: { setOptions: (o: { storage: unknown }) => void } }[];
  for (const s of stores) s.persist?.setOptions({ storage: memStorage });
}

/* ─────────────────────────────────────────────────────────────
 * Dựng giao dịch
 * ───────────────────────────────────────────────────────────── */

type Method = 'cash' | 'transfer';

let seq = 0;
function tx(
  type: 'income' | 'expense',
  amount: number,
  categoryId: string,
  d: Date,
  note: string,
  method: Method,
  time = '08:00',
) {
  return {
    id: `seed-${seq++}`,
    type,
    amount,
    categoryId,
    note,
    wallet: 'main' as const,
    date: d.toISOString(),
    time,
    dateLabel: '',
    dateKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    method,
  };
}

/** Dao động quanh `base` nhưng TẤT ĐỊNH theo (ngày, hạt) — tải lại không nhảy số. */
function jitter(base: number, day: number, seed: number, spread = 0.18) {
  const r = Math.sin(day * 12.9898 + seed * 78.233) * 43758.5453;
  const f = r - Math.floor(r); // 0..1
  return Math.round((base * (1 - spread + f * spread * 2)) / 1000) * 1000;
}

const monthKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function buildData() {
  const now = new Date();
  const txns: ReturnType<typeof tx>[] = [];

  // back = 1 → tháng trước (affiliate 10tr) · back = 0 → tháng này (affiliate 13tr)
  for (let back = 1; back >= 0; back--) {
    const first = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const Y = first.getFullYear();
    const Mo = first.getMonth();
    const lastDay =
      back === 0 ? now.getDate() : new Date(Y, Mo + 1, 0).getDate();

    // ── Thu: lương cố định + hoa hồng affiliate chia 2 đợt ──
    const affiliate = back === 0 ? 13_000_000 : 10_000_000;
    const aff1 = Math.round(affiliate * 0.54); // đợt giữa tháng
    const aff2 = affiliate - aff1; // đợt cuối tháng

    if (lastDay >= 5)
      txns.push(tx('income', 20_000_000, 'salary', new Date(Y, Mo, 5), 'Lương tháng', 'transfer', '09:00'));
    if (lastDay >= 12)
      txns.push(tx('income', aff1, 'business', new Date(Y, Mo, 12), 'Hoa hồng affiliate đợt 1', 'transfer', '14:30'));
    if (lastDay >= 24)
      txns.push(tx('income', aff2, 'business', new Date(Y, Mo, 24), 'Hoa hồng affiliate đợt 2', 'transfer', '15:10'));

    // ── Chi mỗi ngày: ba bữa + đồ uống ──
    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(Y, Mo, day);
      txns.push(tx('expense', jitter(32_000, day, 1), 'food', d, 'Ăn sáng', 'cash', '07:15'));
      txns.push(tx('expense', jitter(58_000, day, 2), 'food', d, 'Ăn trưa', 'cash', '12:00'));
      txns.push(tx('expense', jitter(62_000, day, 3), 'food', d, 'Ăn tối', 'cash', '19:00'));

      const drink = day % 3;
      if (drink === 0) txns.push(tx('expense', 12_000, 'food', d, 'Nước suối', 'cash', '10:00'));
      else if (drink === 1) txns.push(tx('expense', 32_000, 'food', d, 'Trà sữa', 'cash', '16:00'));
      else txns.push(tx('expense', 35_000, 'coffee', d, 'Cà phê', 'cash', '08:30'));

      // Đổ xăng mỗi thứ Hai
      if (d.getDay() === 1)
        txns.push(tx('expense', jitter(110_000, day, 4, 0.12), 'transport', d, 'Đổ xăng', 'transfer', '18:00'));

      // Vài cuốc xe trong tháng
      if (day === 9 || day === 18)
        txns.push(tx('expense', jitter(45_000, day, 7, 0.2), 'transport', d, 'Xe ôm công nghệ', 'cash', '20:00'));
    }

    // ── Mua sắm trong tháng ──
    if (lastDay >= 14)
      txns.push(tx('expense', jitter(620_000, Mo, 5), 'shopping', new Date(Y, Mo, 14), 'Đồ dùng gia đình', 'transfer', '21:00'));
    if (lastDay >= 22)
      txns.push(tx('expense', jitter(780_000, Mo, 6), 'shopping', new Date(Y, Mo, 22), 'Đặt hàng online', 'transfer', '21:30'));
  }

  // ── Hóa đơn cố định: chưa đóng đúng 1.751.000 ──
  const bills = [
    { id: 'rent',  name: 'Tiền nhà',    icon: '🏠', amount: 4_000_000, dueDay: 5,  isPaid: true },
    { id: 'net',   name: 'Internet',    icon: '🌐', amount:   250_000, dueDay: 8,  isPaid: true },
    { id: 'util',  name: 'Điện + nước', icon: '💡', amount: 1_451_000, dueDay: 15, isPaid: false },
    { id: 'phone', name: 'Điện thoại',  icon: '📱', amount:   300_000, dueDay: 20, isPaid: false },
  ];

  // Lịch sử đóng bill tháng trước — để biểu đồ hóa đơn có mốc so sánh.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const billPayments: Record<string, unknown>[] = [
    { id: 'bp-r-1', billId: 'rent', billName: 'Tiền nhà',    icon: '🏠', amount: 4_000_000, month: monthKeyOf(prev), paidAt: prev.toISOString() },
    { id: 'bp-n-1', billId: 'net',  billName: 'Internet',    icon: '🌐', amount:   250_000, month: monthKeyOf(prev), paidAt: prev.toISOString() },
    { id: 'bp-u-1', billId: 'util', billName: 'Điện + nước', icon: '💡', amount: 1_180_000, month: monthKeyOf(prev), paidAt: prev.toISOString() },
    { id: 'bp-p-1', billId: 'phone',billName: 'Điện thoại',  icon: '📱', amount:   300_000, month: monthKeyOf(prev), paidAt: prev.toISOString() },
    // Tháng này mới đóng tiền nhà + internet.
    { id: 'bp-r-0', billId: 'rent', billName: 'Tiền nhà',    icon: '🏠', amount: 4_000_000, month: monthKeyOf(now), paidAt: now.toISOString() },
    { id: 'bp-n-0', billId: 'net',  billName: 'Internet',    icon: '🌐', amount:   250_000, month: monthKeyOf(now), paidAt: now.toISOString() },
  ];

  return { txns, bills, billPayments, monthKey: monthKeyOf(now) };
}

/* ─────────────────────────────────────────────────────────────
 * Trang
 * ───────────────────────────────────────────────────────────── */

export default function XemThuChiPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    isolatePersistence();

    const { txns, bills, billPayments, monthKey } = buildData();

    const thisMonth = txns.filter((t) => new Date(t.date).getMonth() === new Date().getMonth());
    const thu = thisMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const chi = thisMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    useFinanceStore.setState({
      transactions: txns as never,
      mainBalance: 24_500_000,
      cashBalance: 2_400_000,
      emergencyBalance: 42_000_000,
      // Quỹ bill vừa đủ trả hết phần chưa đóng.
      billFundBalance: 1_751_000,
      fixedBills: bills as never,
      billPayments: billPayments as never,
      billSnapshots: [],
    });

    const nowIso = new Date().toISOString();
    useDashboardStore.setState({
      accounts: {
        spending: { balance: 10_000_000, limit: 8_500_000 },
        reserve: { balance: 42_000_000 },
        goals: { balance: 159_500_000 },
        investment: { balance: 28_000_000 },
      },
      // Để dành tháng này — tổng đúng 5.000.000.
      monthlyContributions: {
        reserve: [{ amount: 1_500_000, createdAt: nowIso, month: monthKey }],
        goals: [{ amount: 2_500_000, createdAt: nowIso, month: monthKey }],
        investment: [{ amount: 1_000_000, createdAt: nowIso, month: monthKey }],
      },
    } as never);

    // Ngưỡng chi tiêu tháng này — tổng đúng 8.500.000.
    useBudgetStore.setState({
      currentMonth: monthKey,
      carryOver: 500_000,
      categoryBudgets: [
        { categoryId: 'food',      monthlyLimit: 5_000_000, spent: 0, month: monthKey },
        { categoryId: 'transport', monthlyLimit: 1_200_000, spent: 0, month: monthKey },
        { categoryId: 'shopping',  monthlyLimit: 1_500_000, spent: 0, month: monthKey },
        { categoryId: 'coffee',    monthlyLimit:   800_000, spent: 0, month: monthKey },
      ],
    } as never);

    // monthlyContributionTarget mới là con số safe-to-spend đọc — KHÔNG phải currentAmount.
    // Tổng đúng 5.000.000/tháng.
    useGoalsStore.setState({
      goals: [
        { id: 'g1', name: 'Mua nhà',      icon: '🏡', targetAmount: 900_000_000, currentAmount: 128_000_000, monthlyContributionTarget: 2_500_000, color: '#C79A2E', milestones: [], createdAt: '' },
        { id: 'g2', name: 'Xe máy mới',   icon: '🛵', targetAmount:  45_000_000, currentAmount:  31_500_000, monthlyContributionTarget: 1_000_000, color: '#A8432B', milestones: [], createdAt: '' },
        { id: 'g3', name: 'Quỹ dự phòng', icon: '🛡️', targetAmount: 100_000_000, currentAmount:  42_000_000, monthlyContributionTarget: 1_500_000, color: '#4E7A72', milestones: [], createdAt: '' },
      ],
    } as never);

    const w = useWalletBankStore.getState().wallets;
    useWalletBankStore.setState({
      wallets: w.map((g, i) =>
        i === 0
          ? { ...g, bankName: 'Vietcombank', accountNumber: '0071 0004 5xxx' }
          : i === 1
            ? { ...g, bankName: 'Techcombank', accountNumber: '1903 6xxx xxx' }
            : g,
      ),
    } as never);

    useSettingsStore.setState({ hideBalance: false });

    // eslint-disable-next-line no-console
    console.log('[xem-thu-chi] thu tháng này', thu, '· chi tháng này', chi);
    setReady(true);
  }, []);

  return (
    <div className="xtc-page">
      {/* Khung mô phỏng ĐÚNG app thật: header 56px + thanh dưới 68px, ruột dùng
       * lại .shell-content + .overview-stack — có vậy phép đo "vừa 1 màn hình"
       * mới thật, chứ đo trên trang trống thì lúc nào cũng vừa. */}
      <div className="xtc-shell">
        <div className="xtc-head">Chào buổi sáng, Lite</div>

        <main className="shell-content xtc-body">
          {ready ? (
            <div className="stack overview-stack">
              <SafeToSpendCard />
              <MoneyBlocks />
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: 40 }}>Đang nạp dữ liệu…</p>
          )}
        </main>

        <div className="xtc-nav">Tổng quan · Sổ sách · Chat · Mục tiêu · Money</div>
      </div>

      <style>{`
        .xtc-page {
          min-height: 100vh; display: flex; justify-content: center;
          background: #EEE; padding: 0;
        }
        .xtc-shell {
          position: relative; width: 100%; max-width: 430px; height: 100vh;
          display: flex; flex-direction: column; overflow: hidden;
          background: var(--clay-bg, #fff);
        }
        .xtc-head {
          flex: none; height: 56px; display: flex; align-items: center; padding: 0 16px;
          font-size: 13px; font-weight: 700; color: #4E7A72;
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
        .xtc-body { flex: 1; min-height: 0; }
        .xtc-nav {
          flex: none; height: 68px; display: flex; align-items: center; justify-content: center;
          font-size: 10px; letter-spacing: .04em; color: #8A8A8A;
          border-top: 1px solid rgba(0,0,0,.06);
        }
      `}</style>
    </div>
  );
}
