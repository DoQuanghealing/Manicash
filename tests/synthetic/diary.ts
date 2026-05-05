import type { PhaseRunResult, PersonaProfile, SyntheticAction } from './types';
import { TEST_START_DATE_KEY, addDays } from './dates';
import { formatVnd, sum } from './math';

type RecordIncomeAction = Extract<SyntheticAction, { kind: 'record-income' }>;
type RecordExpenseAction = Extract<SyntheticAction, { kind: 'record-expense' }>;

function isRecordIncomeAction(action: SyntheticAction): action is RecordIncomeAction {
  return action.kind === 'record-income';
}

function isRecordExpenseAction(action: SyntheticAction): action is RecordExpenseAction {
  return action.kind === 'record-expense';
}

function actionsOnDay(actions: SyntheticAction[], dateKey: string): SyntheticAction[] {
  return actions.filter((action) => action.dateKey === dateKey);
}

function personaTone(persona: PersonaProfile, neutral: string, pain: string): string {
  if (persona.id === 'minh') return `${neutral} ${pain ? `Hoi can: ${pain}` : ''}`.trim();
  if (persona.id === 'huong') return `${neutral} ${pain ? `Can theo doi: ${pain}` : ''}`.trim();
  return `${neutral} ${pain ? `Hoi met: ${pain}` : ''}`.trim();
}

function buildDailyLog(persona: PersonaProfile, result: PhaseRunResult, actions: SyntheticAction[], day: number): string {
  const dateKey = addDays(TEST_START_DATE_KEY, day - 1);
  const dayActions = actionsOnDay(actions, dateKey);
  const income = sum(dayActions.filter(isRecordIncomeAction).map((action) => action.amount));
  const expense = sum(
    dayActions
      .filter(isRecordExpenseAction)
      .filter((action) => !action.transactionDateKey)
      .map((action) => action.amount),
  );
  const backfills = dayActions.filter(isRecordExpenseAction).filter((action) => action.transactionDateKey);
  const bills = dayActions.filter((action) => action.kind === 'pay-bill');

  if (day === 1) {
    return `Ngay 1 (${persona.displayName}): Onboarding xong voi ${persona.bills.length} bill va ${persona.goals.length} muc tieu. ${personaTone(persona, 'Dashboard bat dau tu 0 nen de hieu.', 'nhung neu khong co huong dan backdate thi se hoi lo khi quen ghi')}`;
  }

  if (backfills.length > 0) {
    return `Ngay ${day} (${persona.displayName}): Nhap bu ${backfills.length} giao dich cu, tong ngay goc van phai khop lich su. ${personaTone(persona, 'So lieu ledger van hop ly.', 'backdate can that ro vi day la luc de nhap sai nhat')}`;
  }

  if (income > 0) {
    return `Ngay ${day} (${persona.displayName}): Ghi thu ${formatVnd(income)} va chia tien ngay sau do. ${personaTone(persona, `Chi tieu trong ngay ${formatVnd(expense)}.`, 'flow chia tien can ngan va ro neu khong se ngai bam')}`;
  }

  if (bills.length > 0) {
    return `Ngay ${day} (${persona.displayName}): Co ${bills.length} bill den lich thanh toan. ${personaTone(persona, `Chi tieu ngay nay ${formatVnd(expense)}.`, 'neu quy bill thieu thi app can noi thieu bao nhieu truoc khi cho tick da tra')}`;
  }

  if (expense > 0) {
    const expenseCount = dayActions
      .filter(isRecordExpenseAction)
      .filter((action) => !action.transactionDateKey).length;
    return `Ngay ${day} (${persona.displayName}): Ghi ${expenseCount} giao dich chi, tong ${formatVnd(expense)}. ${personaTone(persona, 'Thoi quen nhap lieu van giu duoc.', expense > persona.dailySpendingLimit / 30 ? 'muc chi ngay nay cao hon nhip trung binh' : '')}`;
  }

  return `Ngay ${day} (${persona.displayName}): Khong co giao dich moi. ${personaTone(persona, 'Trang thai khong doi.', 'neu app co nhac nhe qua manh thi de bi bo qua')}`;
}

function buildWeeklyReview(persona: PersonaProfile, result: PhaseRunResult, weekNumber: number, startDay: number, endDay: number): string {
  const dateKeys = Array.from({ length: endDay - startDay + 1 }, (_, index) =>
    addDays(TEST_START_DATE_KEY, startDay + index - 1),
  );
  const txns = result.finalState.ledger.transactions.filter((txn) => dateKeys.includes(txn.dateKey));
  const income = sum(txns.filter((txn) => txn.type === 'income').map((txn) => txn.amount));
  const expense = sum(txns.filter((txn) => txn.type === 'expense').map((txn) => txn.amount));

  if (persona.id === 'huong') {
    return `Tuan ${weekNumber}: Thu ${formatVnd(income)}, chi ${formatVnd(expense)}. Toi thich nhin tien tiet kiem tang, nhung can bieu do ro hon ve chi cho con va shopping cuoi thang de quyet dinh cat giam.`;
  }

  if (persona.id === 'tuan') {
    return `Tuan ${weekNumber}: Thu ${formatVnd(income)}, chi ${formatVnd(expense)}. App co ich luc nhin tong tien bay mau, nhung backdate ma kho tim la toi de bo luon.`;
  }

  return `Tuan ${weekNumber}: Thu ${formatVnd(income)}, chi ${formatVnd(expense)}. Minh thay ro thang nay hoi phong tay, nhung can man hinh nhap bu nhanh hon de khong bi dut thoi quen.`;
}

export function buildPersonaDiary(persona: PersonaProfile, result: PhaseRunResult, actions: SyntheticAction[]): string {
  const dailyLogs = Array.from({ length: 30 }, (_, index) =>
    buildDailyLog(persona, result, actions, index + 1),
  );
  const weeklyReviews = [
    buildWeeklyReview(persona, result, 1, 1, 7),
    buildWeeklyReview(persona, result, 2, 8, 14),
    buildWeeklyReview(persona, result, 3, 15, 21),
    buildWeeklyReview(persona, result, 4, 22, 30),
  ];

  const income = sum(result.finalState.ledger.transactions.filter((txn) => txn.type === 'income').map((txn) => txn.amount));
  const expense = sum(result.finalState.ledger.transactions.filter((txn) => txn.type === 'expense').map((txn) => txn.amount));
  const savings = sum(Object.values(result.finalState.app.fundBalances));

  return [
    `# Diary - ${persona.displayName}`,
    '',
    '## Phase 0+1 Daily Logs',
    '',
    ...dailyLogs,
    '',
    '## Weekly Retrospectives',
    '',
    ...weeklyReviews.map((review) => `- ${review}`),
    '',
    '## Month 1 Review',
    '',
    `- Thu nhap ghi nhan: ${formatVnd(income)}`,
    `- Chi tieu ghi nhan: ${formatVnd(expense)}`,
    `- Tiet kiem tu split: ${formatVnd(savings)}`,
    `- Diem can chu y: ${persona.uxRisk}`,
    '',
  ].join('\n');
}
