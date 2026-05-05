export interface SafeToSpendInputs {
  monthlyIncome: number;
  carryOver: number;
  spendingLimit: number;
  fixedBills: number;
  monthlySavings: number;
}

export type SafeToSpendStatus = 'safe' | 'low' | 'danger';

export function calculateSafeToSpend({
  monthlyIncome,
  carryOver,
  spendingLimit,
  fixedBills,
  monthlySavings,
}: SafeToSpendInputs): number {
  return monthlyIncome + carryOver - spendingLimit - fixedBills - monthlySavings;
}

export function getSafeToSpendStatus(amount: number): SafeToSpendStatus {
  if (amount <= 0) return 'danger';
  if (amount <= 1_000_000) return 'low';
  return 'safe';
}
