export type ReconciliationAccountId = 'income' | 'expense' | 'saving';
export type ReconciliationStatus = 'matched' | 'minor-drift' | 'major-drift';

export interface ReconciliationAccountInput {
  id: ReconciliationAccountId;
  label: string;
  appBalance: number;
  bankBalance: number;
}

export interface ReconciliationAccountResult extends ReconciliationAccountInput {
  difference: number;
  absoluteDifference: number;
  status: ReconciliationStatus;
  message: string;
}

export interface ReconciliationReport {
  status: ReconciliationStatus;
  title: string;
  message: string;
  totalAppBalance: number;
  totalBankBalance: number;
  totalDifference: number;
  accounts: ReconciliationAccountResult[];
}

const MATCH_TOLERANCE = 1_000;
const MINOR_DRIFT_TOLERANCE = 50_000;

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
}

function getAccountStatus(absoluteDifference: number): ReconciliationStatus {
  if (absoluteDifference <= MATCH_TOLERANCE) return 'matched';
  if (absoluteDifference <= MINOR_DRIFT_TOLERANCE) return 'minor-drift';
  return 'major-drift';
}

function getAccountMessage(input: ReconciliationAccountInput, difference: number, status: ReconciliationStatus): string {
  if (status === 'matched') {
    return `${input.label}: khớp. Số trong ManiCash đang đáng tin.`;
  }

  const direction = difference > 0 ? 'ngân hàng cao hơn ManiCash' : 'ManiCash cao hơn ngân hàng';
  const prefix = status === 'major-drift' ? 'Cần xử lý' : 'Lệch nhẹ';
  return `${input.label}: ${prefix}, ${direction} ${formatVnd(Math.abs(difference))}.`;
}

function getOverallStatus(accounts: ReconciliationAccountResult[]): ReconciliationStatus {
  if (accounts.some((account) => account.status === 'major-drift')) return 'major-drift';
  if (accounts.some((account) => account.status === 'minor-drift')) return 'minor-drift';
  return 'matched';
}

function getOverallTitle(status: ReconciliationStatus): string {
  if (status === 'matched') return 'Đối chiếu số dư: khớp';
  if (status === 'minor-drift') return 'Đối chiếu số dư: lệch nhẹ';
  return 'Đối chiếu số dư: cần kiểm tra';
}

function getActionLine(status: ReconciliationStatus): string {
  if (status === 'matched') {
    return 'Kết luận: tiếp tục ghi giao dịch đều. Báo cáo CFO có nền tảng dữ liệu tốt.';
  }
  if (status === 'minor-drift') {
    return 'Kết luận: lệch nhẹ. Hãy tìm giao dịch gần nhất bị quên ghi trước khi tự điều chỉnh số dư.';
  }
  return 'Kết luận: đừng tin báo cáo ngay. Hãy đối chiếu sao kê, tìm giao dịch bị thiếu, rồi mới cập nhật số dư.';
}

export function createBalanceReconciliationReport(inputs: ReconciliationAccountInput[]): ReconciliationReport {
  const accounts = inputs.map((input) => {
    const difference = input.bankBalance - input.appBalance;
    const absoluteDifference = Math.abs(difference);
    const status = getAccountStatus(absoluteDifference);
    return {
      ...input,
      difference,
      absoluteDifference,
      status,
      message: getAccountMessage(input, difference, status),
    };
  });

  const totalAppBalance = accounts.reduce((sum, account) => sum + account.appBalance, 0);
  const totalBankBalance = accounts.reduce((sum, account) => sum + account.bankBalance, 0);
  const totalDifference = totalBankBalance - totalAppBalance;
  const status = getOverallStatus(accounts);
  const title = getOverallTitle(status);

  return {
    status,
    title,
    message: [
      `${title}.`,
      `Tổng ManiCash: ${formatVnd(totalAppBalance)}.`,
      `Tổng ngân hàng bạn nhập: ${formatVnd(totalBankBalance)}.`,
      `Tổng chênh lệch: ${formatVnd(totalDifference)}.`,
      ...accounts.map((account) => account.message),
      getActionLine(status),
    ].join('\n'),
    totalAppBalance,
    totalBankBalance,
    totalDifference,
    accounts,
  };
}
