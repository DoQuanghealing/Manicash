import type { AccountBalances, AccountId, LedgerEntry } from './types';

export function getAccountBalance(
  ledgerEntries: LedgerEntry[],
  accountId: AccountId,
): number {
  return ledgerEntries.reduce((balance, entry) => {
    if (entry.accountId !== accountId) return balance;
    return entry.direction === 'debit'
      ? balance + entry.amount
      : balance - entry.amount;
  }, 0);
}

export function getAccountBalances(ledgerEntries: LedgerEntry[]): AccountBalances {
  return ledgerEntries.reduce<AccountBalances>((balances, entry) => {
    const current = balances[entry.accountId] ?? 0;
    balances[entry.accountId] = entry.direction === 'debit'
      ? current + entry.amount
      : current - entry.amount;
    return balances;
  }, {});
}

export function getAccountBalanceOrZero(
  balances: AccountBalances,
  accountId: AccountId,
): number {
  return balances[accountId] ?? 0;
}
