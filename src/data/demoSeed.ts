/* ═══ Demo Seed — hồ sơ mẫu để CHỤP ẢNH QUẢNG CÁO ═══
 *
 * CHỈ chạy khi `NEXT_PUBLIC_DEMO_MODE === 'true'` (xem các store gọi tới đây).
 * User thật KHÔNG BAO GIỜ thấy dữ liệu này — mọi store vẫn khởi tạo rỗng khi
 * flag tắt (rule PO: user mới phải thấy số 0).
 *
 * Nhân vật: nhân viên văn phòng, 1 con nhỏ.
 *   Thu:  lương cứng 24.000.000 + chồng đưa 12.000.000 + nhiệm vụ kiếm thêm ~2.000.000
 *   Bill: nhà 6.000.000 · học con 4.000.000 · điện 1.200.000 · nước 300.000
 *   Chi biến đổi: cà phê · ăn sáng · đi siêu thị · quần áo · mỹ phẩm
 *   Mục tiêu: xe máy · iPhone 17 Pro Max 256GB · túi 5 triệu
 *
 * NGUYÊN TẮC:
 *  1. Deterministic 100% (PRNG có seed, không Math.random, không Date.now) —
 *     server render và client render ra cùng một bộ số → không hydration mismatch.
 *  2. Mọi con số phái sinh (ngân sách đã chi, số dư ví, quỹ, tài khoản dashboard)
 *     đều TÍNH TỪ danh sách giao dịch bên dưới, không gõ tay → không mâu thuẫn
 *     giữa các màn hình khi chụp ảnh.
 *  3. Giờ giao dịch luôn nằm trong 07:00–21:00 giờ VN. dateHelpers gom nhóm theo
 *     UTC, để ngoài khoảng này giao dịch sẽ nhảy sang ngày khác trên lịch.
 */

import type { Transaction, FixedBill, EmotionTag, PaymentMethod } from '@/stores/useFinanceStore';
import type { CategoryBudget, Goal } from '@/types/budget';
import type { EarningTask } from '@/types/task';
import { getDateKey, getDateLabel, getCurrentMonthKey } from '@/lib/dateHelpers';

/* ────────────────────────── Khung thời gian ────────────────────────── */

const NOW = new Date();
const Y = NOW.getFullYear();
const M = NOW.getMonth();          // 0-based
const TODAY = NOW.getDate();       // seed từ ngày 1 → hôm nay của THÁNG HIỆN TẠI
const MONTH_KEY = getCurrentMonthKey();

/** Ngày `day` trong tháng hiện tại, giờ local. */
function at(day: number, hour: number, minute: number): Date {
  return new Date(Y, M, day, hour, minute, 0, 0);
}

/** PRNG deterministic (mulberry32) — cùng seed luôn ra cùng số. */
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Số tiền "đẹp" kiểu VN: làm tròn xuống bội của `step`. */
function money(min: number, max: number, r: number, step = 5_000): number {
  return Math.round((min + (max - min) * r) / step) * step;
}

/** Xoay vòng theo ngày — đảm bảo ghi chú KHÔNG lặp lại hai hôm liền nhau. */
function pick<T>(arr: T[], day: number, salt = 0): T {
  return arr[(day * 2 + salt) % arr.length];
}

let txnSeq = 0;
function makeTxn(p: {
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  day: number;
  hour: number;
  minute?: number;
  wallet?: 'main' | 'emergency' | 'bill-fund';
  emotionTag?: EmotionTag;
  method?: PaymentMethod;
}): Transaction {
  const date = at(p.day, p.hour, p.minute ?? 0);
  return {
    id: `demo-${String(++txnSeq).padStart(3, '0')}`,
    type: p.type,
    kind: p.type,
    amount: p.amount,
    categoryId: p.categoryId,
    note: p.note,
    wallet: p.wallet ?? 'main',
    date: date.toISOString(),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    dateLabel: getDateLabel(date),
    dateKey: getDateKey(date),
    ...(p.emotionTag ? { emotionTag: p.emotionTag } : {}),
    // Mặc định chuyển khoản — app khuyến khích CK, tiền mặt phải khai rõ.
    method: p.method ?? 'transfer',
  };
}

/* ────────────────────────── Hóa đơn cố định ────────────────────────── */

const BILL_DEFS = [
  { id: 'bill-rent',      name: 'Tiền nhà',      icon: '🏠', amount: 6_000_000, dueDay: 5,  categoryId: 'rent',      note: 'Tiền thuê nhà tháng này' },
  { id: 'bill-tuition',   name: 'Tiền học con',  icon: '📚', amount: 4_000_000, dueDay: 10, categoryId: 'education', note: 'Học phí bé Bơ' },
  { id: 'bill-electric',  name: 'Tiền điện',     icon: '⚡', amount: 1_200_000, dueDay: 15, categoryId: 'bills',     note: 'Hóa đơn điện' },
  { id: 'bill-water',     name: 'Tiền nước',     icon: '💧', amount:   300_000, dueDay: 15, categoryId: 'bills',     note: 'Hóa đơn nước' },
] as const;

/** Bill tới hạn TRƯỚC hôm nay coi như đã đóng — luôn hợp lý dù chụp ảnh ngày nào. */
const DEMO_BILLS: FixedBill[] = BILL_DEFS.map((b) => ({
  id: b.id,
  name: b.name,
  icon: b.icon,
  amount: b.amount,
  dueDay: b.dueDay,
  isPaid: b.dueDay < TODAY,
}));

const TOTAL_BILLS = BILL_DEFS.reduce((s, b) => s + b.amount, 0);           // 11.500.000
const UNPAID_BILLS = DEMO_BILLS.filter((b) => !b.isPaid);
/** Quỹ hóa đơn giữ đúng phần còn phải đóng → màn hình luôn "đã gom đủ 100%". */
const BILL_FUND_BALANCE = UNPAID_BILLS.reduce((s, b) => s + b.amount, 0);

/* ── Lịch sử đóng hóa đơn 12 tháng gần nhất ──
 * Cần dữ liệu quá khứ thì biểu đồ cột theo năm của từng hóa đơn mới có gì để
 * vẽ. Tiền điện dao động theo mùa (hè nóng → chạy điều hoà → cao hơn), tiền
 * nhà/học phí cố định — giống hoá đơn thật của một gia đình. */
const BILL_MONTH_FACTOR: Record<string, number[]> = {
  // index 0 = tháng 1 … 11 = tháng 12
  'bill-electric': [0.75, 0.72, 0.85, 1.0, 1.25, 1.45, 1.5, 1.4, 1.1, 0.9, 0.8, 0.78],
  'bill-water': [0.9, 0.9, 1.0, 1.05, 1.15, 1.2, 1.2, 1.15, 1.0, 0.95, 0.9, 0.9],
  'bill-rent': Array(12).fill(1),
  'bill-tuition': Array(12).fill(1),
};

const DEMO_BILL_PAYMENTS = (() => {
  const rows: {
    id: string; billId: string; billName: string; icon: string;
    amount: number; month: string; paidAt: string;
  }[] = [];
  for (const bill of BILL_DEFS) {
    const factors = BILL_MONTH_FACTOR[bill.id] ?? Array(12).fill(1);
    // Đi ngược 12 tháng, KHÔNG ghi tháng hiện tại nếu hóa đơn đó chưa đóng.
    for (let back = 12; back >= 0; back--) {
      const d = new Date(Y, M - back, Math.min(bill.dueDay, 28), 10, 0);
      const isCurrentMonth = back === 0;
      if (isCurrentMonth && bill.dueDay >= TODAY) continue; // chưa tới hạn → chưa đóng
      const factor = factors[d.getMonth()];
      const amount = Math.round((bill.amount * factor) / 10_000) * 10_000;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      rows.push({
        id: `bp-${bill.id}-${month}`,
        billId: bill.id,
        billName: bill.name,
        icon: bill.icon,
        amount,
        month,
        paidAt: d.toISOString(),
      });
    }
  }
  return rows;
})();

/* ────────────────────────── Giao dịch trong tháng ────────────────────────── */

const BREAKFAST_NOTES = ['Ăn sáng bún bò', 'Bánh mì + sữa đậu', 'Xôi mặn mang đi làm', 'Phở gà đầu ngõ', 'Bánh cuốn nóng'];
const COFFEE_NOTES = ['Cà phê sáng ở văn phòng', 'Highlands với đồng nghiệp', 'Trà sữa chiều', 'Cà phê muối', 'Bạc xỉu mang đi'];
const GROCERY_NOTES = ['Đi siêu thị mua đồ ăn cả nhà', 'Bách Hóa Xanh — thịt cá rau tuần này', 'Chợ đầu tuần cho cả nhà', 'Siêu thị: sữa cho bé + đồ khô'];
const CLOTHING_NOTES = ['Mua váy đi làm', 'Áo khoác cho bé', 'Đồ mặc nhà cho hai mẹ con'];
const COSMETIC_NOTES = ['Kem chống nắng', 'Serum dưỡng da', 'Son + phấn nước'];

const incomeTxns: Transaction[] = [];
const expenseTxns: Transaction[] = [];

/* ── Thu nhập ── */
const salaryDay = Math.min(5, TODAY);
incomeTxns.push(
  makeTxn({ type: 'income', amount: 24_000_000, categoryId: 'salary', note: 'Lương cứng tháng này', day: salaryDay, hour: 9 }),
  // Chồng đưa: phần lớn chuyển khoản, một ít đưa tay để tiêu vặt — giống thực
  // tế và cho thấy app tách được hai túi tiền.
  makeTxn({ type: 'income', amount: 8_000_000, categoryId: 'gift-in', note: 'Chồng chuyển sinh hoạt phí', day: salaryDay, hour: 20 }),
  makeTxn({ type: 'income', amount: 4_000_000, categoryId: 'gift-in', note: 'Chồng đưa tiền mặt đi chợ', day: salaryDay, hour: 20, method: 'cash' }),
);

/** Tiền từ nhiệm vụ kiếm thêm — chỉ ghi nhận khi ngày đó đã trôi qua. */
const SIDE_INCOME: { day: number; amount: number; categoryId: string; note: string; method: PaymentMethod }[] = [
  // Đồng nghiệp trả tay → tiền mặt. Hoa hồng sàn → về tài khoản.
  { day: 6, amount: 850_000, categoryId: 'business', note: 'Bán chả cá Nha Trang cho văn phòng', method: 'cash' },
  { day: 8, amount: 700_000, categoryId: 'business', note: 'Hoa hồng affiliate Shopee', method: 'transfer' },
];
for (const s of SIDE_INCOME) {
  if (s.day <= TODAY) {
    incomeTxns.push(makeTxn({ type: 'income', amount: s.amount, categoryId: s.categoryId, note: s.note, day: s.day, hour: 17, method: s.method }));
  }
}

/* ── Chi tiêu biến đổi, rải ngẫu nhiên (có seed) theo từng ngày ── */
for (let day = 1; day <= TODAY; day++) {
  const dow = at(day, 12, 0).getDay(); // 0 = Chủ nhật
  const isWeekday = dow >= 1 && dow <= 5;

  // Ăn sáng — gần như mỗi ngày
  if (rand(day * 11) > 0.15) {
    expenseTxns.push(makeTxn({
      type: 'expense', categoryId: 'food',
      amount: money(25_000, 45_000, rand(day * 13), 5_000),
      note: pick(BREAKFAST_NOTES, day),
      day, hour: 7, minute: 10 + (day % 5) * 6, method: 'cash',
    }));
  }

  // Cà phê — chủ yếu ngày đi làm
  if (isWeekday && rand(day * 23) > 0.3) {
    expenseTxns.push(makeTxn({
      type: 'expense', categoryId: 'coffee',
      amount: money(35_000, 65_000, rand(day * 29), 5_000),
      note: pick(COFFEE_NOTES, day, 1),
      day, hour: rand(day * 37) > 0.5 ? 9 : 15, minute: 5 + (day % 7) * 5, method: 'cash',
    }));
  }

  // Đi siêu thị mua đồ ăn chung cho gia đình — thứ Tư + thứ Bảy
  if (dow === 3 || dow === 6) {
    expenseTxns.push(makeTxn({
      type: 'expense', categoryId: 'groceries',
      amount: money(380_000, 950_000, rand(day * 41), 10_000),
      note: pick(GROCERY_NOTES, day, 2),
      day, hour: 18, minute: 30,
    }));
  }

  // Quần áo — 2 lần/tháng
  if (day === 7 || day === 21) {
    expenseTxns.push(makeTxn({
      type: 'expense', categoryId: 'clothing',
      amount: day === 7 ? 450_000 : 780_000,
      note: pick(CLOTHING_NOTES, day, 3),
      day, hour: 20,
      emotionTag: day === 7 ? 'self_reward' : 'stress',
    }));
  }

  // Mỹ phẩm — 2 lần/tháng
  if (day === 4 || day === 18) {
    expenseTxns.push(makeTxn({
      type: 'expense', categoryId: 'cosmetics',
      amount: day === 4 ? 320_000 : 690_000,
      note: pick(COSMETIC_NOTES, day, 1),
      day, hour: 20, minute: 40,
      emotionTag: day === 4 ? 'excited' : 'preference',
    }));
  }
}

/* ── Bill đã đóng → ghi nhận thành giao dịch, trừ vào quỹ hóa đơn ── */
const billTxns: Transaction[] = BILL_DEFS
  .filter((b) => b.dueDay < TODAY)
  .map((b) => makeTxn({
    type: 'expense', amount: b.amount, categoryId: b.categoryId,
    note: b.note, day: b.dueDay, hour: 10, wallet: 'bill-fund',
  }));

/** Mới nhất lên đầu — đúng thứ tự store dùng khi addTransaction. */
const DEMO_TRANSACTIONS: Transaction[] = [...incomeTxns, ...expenseTxns, ...billTxns].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);

/* ────────────────────────── Ngưỡng chi tiêu ────────────────────────── */

const BUDGET_LIMITS: Record<string, number> = {
  groceries: 4_000_000,
  food: 1_200_000,
  coffee: 1_000_000,
  clothing: 1_500_000,
  cosmetics: 1_000_000,
};

function spentOf(categoryId: string): number {
  return expenseTxns.filter((t) => t.categoryId === categoryId).reduce((s, t) => s + t.amount, 0);
}

/** `spent` lấy đúng từ giao dịch ở trên → thanh tiến trình khớp lịch sử chi. */
const DEMO_BUDGETS: CategoryBudget[] = Object.entries(BUDGET_LIMITS).map(([categoryId, monthlyLimit]) => ({
  categoryId,
  monthlyLimit,
  spent: spentOf(categoryId),
  month: MONTH_KEY,
}));

const TOTAL_INCOME = incomeTxns.reduce((s, t) => s + t.amount, 0);
const TOTAL_VARIABLE_SPENT = expenseTxns.reduce((s, t) => s + t.amount, 0);

/* ────────────────────────── Mục tiêu ────────────────────────── */

const iso = (day: number) => at(day, 12, 0).toISOString();
const deadline = (monthsAhead: number, day = 28) => {
  const d = new Date(Y, M + monthsAhead, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const DEMO_GOALS: Goal[] = [
  {
    id: 'goal-motorbike', name: 'Mua xe máy', icon: '🛵',
    targetAmount: 45_000_000, currentAmount: 18_500_000,
    deadline: deadline(11), color: '#3B82F6',
    monthlyContributionTarget: 3_000_000,
    whyNote: 'Đi làm và đưa con đi học không phải phụ thuộc ai.',
    milestones: [
      { id: 'ms-mb-1', name: 'Đủ tiền đặt cọc', amount: 10_000_000, targetDate: deadline(-2), isCompleted: true },
      { id: 'ms-mb-2', name: 'Đủ một nửa xe', amount: 22_500_000, targetDate: deadline(3), isCompleted: false },
    ],
    createdAt: iso(1),
    deposits: [
      { id: 'dep-mb-1', amount: 3_000_000, source: 'goals-fund', note: 'Trích lương tháng này', createdAt: iso(salaryDay) },
    ],
  },
  {
    id: 'goal-iphone', name: 'iPhone 17 Pro Max 256GB', icon: '📱',
    targetAmount: 37_000_000, currentAmount: 22_000_000,
    deadline: deadline(5), color: '#7C3AED',
    monthlyContributionTarget: 4_000_000,
    whyNote: 'Máy cũ hỏng camera, quay clip TikTok bán hàng không ăn thua.',
    milestones: [
      { id: 'ms-ip-1', name: 'Đủ tiền trả trước', amount: 20_000_000, targetDate: deadline(-1), isCompleted: true },
      { id: 'ms-ip-2', name: 'Đủ tiền mua thẳng', amount: 37_000_000, targetDate: deadline(5), isCompleted: false },
    ],
    createdAt: iso(1),
    deposits: [
      { id: 'dep-ip-1', amount: 4_000_000, source: 'goals-fund', note: 'Trích lương tháng này', createdAt: iso(salaryDay) },
    ],
  },
  {
    id: 'goal-bag', name: 'Túi xách 5 triệu', icon: '👜',
    targetAmount: 5_000_000, currentAmount: 3_200_000,
    deadline: deadline(2), color: '#EC4899',
    monthlyContributionTarget: 1_500_000,
    whyNote: 'Tự thưởng sau 2 năm không mua gì cho bản thân.',
    milestones: [
      { id: 'ms-bag-1', name: 'Đủ 50%', amount: 2_500_000, targetDate: deadline(-1), isCompleted: true },
    ],
    createdAt: iso(1),
    deposits: [
      { id: 'dep-bag-1', amount: 1_500_000, source: 'goals-fund', note: 'Trích lương tháng này', createdAt: iso(Math.min(6, TODAY)) },
    ],
  },
];

const GOALS_SAVED = DEMO_GOALS.reduce((s, g) => s + g.currentAmount, 0);
const GOALS_TARGET = DEMO_GOALS.reduce((s, g) => s + g.targetAmount, 0);
/** Tiền trích vào MỤC TIÊU trong tháng này (khớp monthlyContributionTarget). */
const GOALS_CONTRIB_THIS_MONTH = DEMO_GOALS.reduce((s, g) => s + (g.monthlyContributionTarget ?? 0), 0);

/* ────────────────────────── Nhiệm vụ kiếm thêm ────────────────────────── */

const dayOffset = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString();

const DEMO_TASKS: EarningTask[] = [
  {
    id: 'demo-task-chaca', name: 'Bán chả cá Nha Trang cho văn phòng',
    expectedAmount: 800_000, actualAmount: 850_000,
    startDate: dayOffset(-9), endDate: dayOffset(-2), completedAt: dayOffset(-7),
    createdAt: dayOffset(-10),
    subTasks: [
      { id: 'st-cc-1', name: 'Chốt số lượng với người nhà ở Nha Trang', isCompleted: true },
      { id: 'st-cc-2', name: 'Gom đơn trong group công ty', isCompleted: true },
      { id: 'st-cc-3', name: 'Nhận hàng gửi xe khách', isCompleted: true },
      { id: 'st-cc-4', name: 'Giao tận bàn + thu tiền', isCompleted: true },
    ],
  },
  {
    id: 'demo-task-shopee', name: 'Affiliate Shopee — review đồ gia dụng',
    expectedAmount: 700_000, actualAmount: 700_000,
    startDate: dayOffset(-12), endDate: dayOffset(-4), completedAt: dayOffset(-5),
    createdAt: dayOffset(-13),
    subTasks: [
      { id: 'st-sp-1', name: 'Chọn 5 sản phẩm hoa hồng cao', isCompleted: true },
      { id: 'st-sp-2', name: 'Chụp ảnh + viết review thật', isCompleted: true },
      { id: 'st-sp-3', name: 'Đăng link vào 3 group mẹ bỉm', isCompleted: true },
    ],
  },
  {
    id: 'demo-task-tiktok', name: 'Affiliate TikTok — clip mẹo chi tiêu',
    expectedAmount: 450_000,
    startDate: dayOffset(-4), endDate: dayOffset(6),
    createdAt: dayOffset(-5),
    subTasks: [
      { id: 'st-tt-1', name: 'Lên kịch bản 5 clip ngắn', isCompleted: true },
      { id: 'st-tt-2', name: 'Quay 5 clip vào buổi tối', isCompleted: true },
      { id: 'st-tt-3', name: 'Gắn giỏ hàng + đăng đều 5 ngày', isCompleted: false },
      { id: 'st-tt-4', name: 'Trả lời bình luận chốt đơn', isCompleted: false },
    ],
  },
  {
    id: 'demo-task-chaca2', name: 'Chả cá Nha Trang — đợt 2 cuối tháng',
    expectedAmount: 900_000,
    startDate: dayOffset(4), endDate: dayOffset(13),
    createdAt: dayOffset(-1),
    subTasks: [
      { id: 'st-cc2-1', name: 'Mở form đặt hàng đợt 2', isCompleted: false },
      { id: 'st-cc2-2', name: 'Chốt đơn trước ngày 25', isCompleted: false },
      { id: 'st-cc2-3', name: 'Giao hàng + thu tiền', isCompleted: false },
    ],
  },
];

/* ────────────────────────── Quỹ & số dư ────────────────────────── */

const RESERVE_BALANCE = 12_000_000;      // Quỹ dự phòng đã tích lũy
const INVESTMENT_BALANCE = 6_000_000;    // Quỹ đầu tư đã tích lũy
const RESERVE_CONTRIB = 2_000_000;       // Trích vào dự phòng tháng này
const INVESTMENT_CONTRIB = 1_000_000;    // Trích vào đầu tư tháng này

/** Tiền đã chuyển khỏi ví chính trong tháng: gom quỹ hóa đơn + 3 quỹ tiết kiệm. */
const MOVED_OUT = TOTAL_BILLS + RESERVE_CONTRIB + GOALS_CONTRIB_THIS_MONTH + INVESTMENT_CONTRIB;

/** Ví chính = thu − chi biến đổi − tiền đã chuyển đi. Bill trừ ở quỹ hóa đơn. */
const MAIN_BALANCE = Math.max(0, TOTAL_INCOME - TOTAL_VARIABLE_SPENT - MOVED_OUT);

/** Tiền mặt trong túi = thu tay − chi tay. Là TẬP CON của ví chính, không cộng
 * thêm — nên phần còn lại (ví chính − tiền mặt) chính là số dư ngân hàng. */
const CASH_IN = incomeTxns.filter((t) => t.method === 'cash').reduce((s, t) => s + t.amount, 0);
const CASH_OUT = expenseTxns.filter((t) => t.method === 'cash').reduce((s, t) => s + t.amount, 0);
const CASH_BALANCE = Math.max(0, Math.min(CASH_IN - CASH_OUT, MAIN_BALANCE));

const DEMO_CARRY_OVER = 2_400_000;       // Dư tháng trước chuyển sang

const DEMO_DASHBOARD_ACCOUNTS = {
  income: { balance: TOTAL_INCOME, icon: 'Wallet' as const },
  spending: {
    balance: TOTAL_VARIABLE_SPENT,
    limit: Object.values(BUDGET_LIMITS).reduce((s, v) => s + v, 0),
    icon: 'ShoppingBag' as const,
  },
  fixed_bills: { balance: BILL_FUND_BALANCE, pending_count: UNPAID_BILLS.length, icon: 'CreditCard' as const },
  reserve: { balance: RESERVE_BALANCE, is_locked: true, icon: 'Lock' as const },
  goals: { balance: GOALS_SAVED, target: GOALS_TARGET, icon: 'Target' as const },
  investment: { balance: INVESTMENT_BALANCE, growth: '+7.4%', icon: 'TrendingUp' as const },
};

const DEMO_CONTRIBUTIONS: Record<string, { month: string; amount: number; createdAt?: string }[]> = {
  reserve: [{ month: MONTH_KEY, amount: RESERVE_CONTRIB, createdAt: iso(salaryDay) }],
  goals: DEMO_GOALS.map((g, i) => ({
    month: MONTH_KEY,
    amount: g.monthlyContributionTarget ?? 0,
    createdAt: iso(Math.min(salaryDay + i, TODAY)),
  })),
  investment: [{ month: MONTH_KEY, amount: INVESTMENT_CONTRIB, createdAt: iso(salaryDay) }],
};

export {
  DEMO_TRANSACTIONS,
  DEMO_BILLS,
  DEMO_BILL_PAYMENTS,
  DEMO_BUDGETS,
  DEMO_GOALS,
  DEMO_TASKS,
  DEMO_DASHBOARD_ACCOUNTS,
  DEMO_CONTRIBUTIONS,
  DEMO_CARRY_OVER,
  MAIN_BALANCE as DEMO_MAIN_BALANCE,
  CASH_BALANCE as DEMO_CASH_BALANCE,
  RESERVE_BALANCE as DEMO_EMERGENCY_BALANCE,
  BILL_FUND_BALANCE as DEMO_BILL_FUND_BALANCE,
};
