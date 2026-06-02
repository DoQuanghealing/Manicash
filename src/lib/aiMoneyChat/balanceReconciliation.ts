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
    return `${input.label}: khop. So trong ManiCash dang dang tin.`;
  }

  const direction = difference > 0 ? 'ngan hang cao hon ManiCash' : 'ManiCash cao hon ngan hang';
  const prefix = status === 'major-drift' ? 'Can xu ly' : 'Lech nhe';
  return `${input.label}: ${prefix}, ${direction} ${formatVnd(Math.abs(difference))}.`;
}

function getOverallStatus(accounts: ReconciliationAccountResult[]): ReconciliationStatus {
  if (accounts.some((account) => account.status === 'major-drift')) return 'major-drift';
  if (accounts.some((account) => account.status === 'minor-drift')) return 'minor-drift';
  return 'matched';
}

function getOverallTitle(status: ReconciliationStatus): string {
  if (status === 'matched') return 'Doi chieu so du: khop';
  if (status === 'minor-drift') return 'Doi chieu so du: lech nhe';
  return 'Doi chieu so du: can kiem tra';
}

function getActionLine(status: ReconciliationStatus): string {
  if (status === 'matched') {
    return 'Ket luan: tiep tuc ghi giao dich deu. Bao cao CFO co nen tang du lieu tot.';
  }
  if (status === 'minor-drift') {
    return 'Ket luan: lech nhe. Hay tim giao dich gan nhat bi quen ghi truoc khi tu dieu chinh so du.';
  }
  return 'Ket luan: dung tin bao cao ngay. Hay doi chieu sao ke, tim giao dich bi thieu, roi moi cap nhat so du.';
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
      `Tong ManiCash: ${formatVnd(totalAppBalance)}.`,
      `Tong ngan hang ban nhap: ${formatVnd(totalBankBalance)}.`,
      `Tong chenh lech: ${formatVnd(totalDifference)}.`,
      ...accounts.map((account) => account.message),
      getActionLine(status),
    ].join('\n'),
    totalAppBalance,
    totalBankBalance,
    totalDifference,
    accounts,
  };
}
