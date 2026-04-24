/* ═══ Transaction Types ═══ */

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  fromWallet?: string;
  toWallet?: string;
  date: string;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  monthlyLimit: number;
  spent: number;
  color: string;
}

export interface FixedBill {
  id: string;
  name: string;
  icon: string;
  amount: number;
  dueDay: number;
  isPaid: boolean;
  accumulated: number;
}
