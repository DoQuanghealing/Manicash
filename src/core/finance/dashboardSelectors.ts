import { DEFAULT_ACCOUNT_IDS } from './accounts';
import { getAccountBalance } from './selectors';
import type { LedgerEntry } from './types';

export interface CoreDashboardBalances {
  mainBankBalance: number;
  billFundBalance: number;
  emergencyFundBalance: number;
  goalFundBalance: number;
  investmentFundBalance: number;
  totalSavingsBalance: number;
}

export function buildCoreDashboardBalances(
  ledgerEntries: LedgerEntry[],
): CoreDashboardBalances {
  const mainBankBalance = getAccountBalance(ledgerEntries, DEFAULT_ACCOUNT_IDS.MAIN_BANK);
  const billFundBalance = getAccountBalance(ledgerEntries, DEFAULT_ACCOUNT_IDS.BILL_FUND);
  const emergencyFundBalance = getAccountBalance(
    ledgerEntries,
    DEFAULT_ACCOUNT_IDS.EMERGENCY_FUND,
  );
  const goalFundBalance = getAccountBalance(ledgerEntries, DEFAULT_ACCOUNT_IDS.GOAL_FUND);
  const investmentFundBalance = getAccountBalance(
    ledgerEntries,
    DEFAULT_ACCOUNT_IDS.INVESTMENT_FUND,
  );

  return {
    mainBankBalance,
    billFundBalance,
    emergencyFundBalance,
    goalFundBalance,
    investmentFundBalance,
    totalSavingsBalance: emergencyFundBalance + goalFundBalance + investmentFundBalance,
  };
}
