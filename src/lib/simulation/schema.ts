/* ═══ Định dạng file giả lập + bộ kiểm ═══
 *
 * File JSON do PO tự viết tay, nên bộ kiểm phải báo lỗi bằng CÂU NGƯỜI ĐỌC ĐƯỢC
 * chỉ đúng chỗ sai, không phải quăng "invalid input". Sai một dấu phẩy mà phải
 * mò cả file thì lần sau không ai muốn dùng.
 *
 * Ngày ghi TUYỆT ĐỐI (YYYY-MM-DD) cho dễ đọc. Lúc nạp có tuỳ chọn "dịch mốc về
 * hôm nay" — xem `buildSimulation`.
 */

export interface SimTxn {
  /** YYYY-MM-DD */
  date: string;
  /** 'income' | 'expense' */
  type: 'income' | 'expense';
  categoryId: string;
  amount: number;
  note?: string;
  /** HH:mm — thiếu thì rải đều trong ngày để trông tự nhiên. */
  time?: string;
  method?: 'cash' | 'transfer';
  /** Lặp mỗi ngày từ `date` tới `repeatUntil`. Tiện cho bữa ăn hằng ngày. */
  repeatUntil?: string;
}

export interface SimGoal {
  name: string;
  icon?: string;
  target: number;
  current?: number;
  /** Góp mỗi tháng — con số mà "số dư khả dụng" trừ đi. */
  monthly?: number;
  /** YYYY-MM-DD */
  deadline?: string;
  color?: string;
}

export interface SimTask {
  name: string;
  expected: number;
  start: string;
  end: string;
  subTasks?: string[];
}

export interface SimBill {
  name: string;
  icon?: string;
  amount: number;
  dueDay: number;
  isPaid?: boolean;
}

export interface SimFile {
  /** Nhãn để nhận ra file, chỉ hiện trong admin. */
  label?: string;
  profile?: { displayName?: string; hideBalance?: boolean };
  accounts?: {
    main?: number;
    cash?: number;
    spending?: number;
    spendingLimit?: number;
    reserve?: number;
    goalsFund?: number;
    investment?: number;
    billFund?: number;
  };
  budgets?: { categoryId: string; monthlyLimit: number }[];
  transactions?: SimTxn[];
  goals?: SimGoal[];
  tasks?: SimTask[];
  bills?: SimBill[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  data: SimFile | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Kiểm file. Trả về MỌI lỗi cùng lúc, không dừng ở lỗi đầu — sửa từng lỗi rồi
 * nạp lại năm lần thì rất nản.
 */
export function validateSimFile(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['File phải là một object JSON ({ ... }).'], warnings, data: null };
  }
  const f = raw as Record<string, unknown>;

  // ── Giao dịch ──
  const txns = Array.isArray(f.transactions) ? f.transactions : [];
  if (!Array.isArray(f.transactions) && f.transactions !== undefined) {
    errors.push('`transactions` phải là một mảng.');
  }
  txns.forEach((t, i) => {
    const at = `transactions[${i}]`;
    const x = t as Record<string, unknown>;
    if (typeof x?.date !== 'string' || !isRealDate(x.date)) {
      errors.push(`${at}.date phải là ngày có thật, dạng YYYY-MM-DD (đang là: ${JSON.stringify(x?.date)}).`);
    }
    if (x?.type !== 'income' && x?.type !== 'expense') {
      errors.push(`${at}.type phải là "income" hoặc "expense".`);
    }
    if (!num(x?.amount) || (x.amount as number) <= 0) {
      errors.push(`${at}.amount phải là số dương.`);
    }
    if (typeof x?.categoryId !== 'string' || !x.categoryId) {
      errors.push(`${at}.categoryId không được để trống.`);
    }
    if (x?.time !== undefined && (typeof x.time !== 'string' || !TIME_RE.test(x.time))) {
      errors.push(`${at}.time phải dạng HH:mm.`);
    }
    if (x?.repeatUntil !== undefined) {
      if (typeof x.repeatUntil !== 'string' || !isRealDate(x.repeatUntil)) {
        errors.push(`${at}.repeatUntil phải là ngày có thật, dạng YYYY-MM-DD.`);
      } else if (typeof x.date === 'string' && x.repeatUntil < x.date) {
        errors.push(`${at}.repeatUntil (${x.repeatUntil}) sớm hơn date (${x.date}).`);
      }
    }
  });
  if (txns.length === 0) warnings.push('Chưa có giao dịch nào — màn Sổ sách và Tổng quan sẽ trống.');

  // ── Mục tiêu ──
  const goals = Array.isArray(f.goals) ? f.goals : [];
  goals.forEach((g, i) => {
    const at = `goals[${i}]`;
    const x = g as Record<string, unknown>;
    if (typeof x?.name !== 'string' || !x.name) errors.push(`${at}.name không được để trống.`);
    if (!num(x?.target) || (x.target as number) <= 0) errors.push(`${at}.target phải là số dương.`);
    if (x?.current !== undefined && !num(x.current)) errors.push(`${at}.current phải là số.`);
    if (num(x?.current) && num(x?.target) && (x.current as number) > (x.target as number)) {
      warnings.push(`${at}: đã góp (${x.current}) nhiều hơn mục tiêu (${x.target}) — thanh tiến độ sẽ đầy 100%.`);
    }
    if (x?.deadline !== undefined && (typeof x.deadline !== 'string' || !isRealDate(x.deadline))) {
      errors.push(`${at}.deadline phải là ngày có thật, dạng YYYY-MM-DD.`);
    }
  });

  // ── Nhiệm vụ ──
  const tasks = Array.isArray(f.tasks) ? f.tasks : [];
  tasks.forEach((t, i) => {
    const at = `tasks[${i}]`;
    const x = t as Record<string, unknown>;
    if (typeof x?.name !== 'string' || !x.name) errors.push(`${at}.name không được để trống.`);
    if (!num(x?.expected) || (x.expected as number) <= 0) errors.push(`${at}.expected phải là số dương.`);
    if (typeof x?.start !== 'string' || !isRealDate(x.start)) errors.push(`${at}.start phải dạng YYYY-MM-DD.`);
    if (typeof x?.end !== 'string' || !isRealDate(x.end)) errors.push(`${at}.end phải dạng YYYY-MM-DD.`);
    if (typeof x?.start === 'string' && typeof x?.end === 'string' && x.end < x.start) {
      errors.push(`${at}: end (${x.end}) sớm hơn start (${x.start}).`);
    }
    if (x?.subTasks !== undefined && !Array.isArray(x.subTasks)) {
      errors.push(`${at}.subTasks phải là mảng chuỗi.`);
    }
  });

  // ── Hoá đơn ──
  const bills = Array.isArray(f.bills) ? f.bills : [];
  bills.forEach((b, i) => {
    const at = `bills[${i}]`;
    const x = b as Record<string, unknown>;
    if (typeof x?.name !== 'string' || !x.name) errors.push(`${at}.name không được để trống.`);
    if (!num(x?.amount) || (x.amount as number) <= 0) errors.push(`${at}.amount phải là số dương.`);
    if (!num(x?.dueDay) || (x.dueDay as number) < 1 || (x.dueDay as number) > 31) {
      errors.push(`${at}.dueDay phải trong khoảng 1–31.`);
    }
  });

  return { ok: errors.length === 0, errors, warnings, data: errors.length === 0 ? (f as SimFile) : null };
}
