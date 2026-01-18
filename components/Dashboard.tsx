import React from 'react';
import { Wallet, Transaction, TransactionType } from '../types';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Wallet as WalletIcon } from 'lucide-react';
import { CATEGORY_COLORS, formatVnd } from '../constants';
import { VI } from '../constants/vi';

interface Props {
  wallets: Wallet[];
  transactions: Transaction[];
}

export const Dashboard: React.FC<Props> = ({ wallets, transactions }) => {
  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  // Simple aggregation for chart (mocked here, in real app use Recharts)
  const recentTransactions = transactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  return (
    <div className="p-4 space-y-6 pt-6">

      {/* Header / Net Worth */}
      <div className="space-y-1 px-1">
        <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase">{VI.dashboard.netWorth}</h1>
        <div className="flex items-baseline space-x-1">
          <span className="text-4xl font-bold text-white tracking-tight">{formatVnd(totalBalance)}</span>
          <span className="text-emerald-500 text-sm font-medium">▲ 2.4%</span>
        </div>
      </div>

      {/* Wallet Cards (Horizontal Scroll) */}
      <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="min-w-[280px] h-40 bg-gradient-to-br from-surfaceHighlight to-surface border border-white/5 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group"
          >
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>

            <div className="flex justify-between items-start z-10">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-black/30 rounded-lg text-primary">
                  <WalletIcon size={18} />
                </div>
                <span className="font-semibold text-zinc-200">{wallet.name}</span>
              </div>
            </div>

            <div className="z-10">
              <p className="text-zinc-500 text-xs mb-1">{VI.dashboard.availableBalance}</p>
              <p className="text-2xl font-bold text-white">{formatVnd(wallet.balance)}</p>
            </div>
          </div>
        ))}

        {/* Add Wallet Placeholder */}
        <div className="min-w-[60px] h-40 flex items-center justify-center rounded-3xl border border-dashed border-white/10 text-zinc-600">
          <span className="text-2xl">+</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center">
          <h3 className="font-bold text-white">{VI.dashboard.recentActivity}</h3>
          <button className="text-xs text-primary font-medium">{VI.dashboard.viewAll}</button>
        </div>

        <div>
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
            >
              <div className="flex items-center space-x-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
                  style={{
                    backgroundColor:
                      tx.type === TransactionType.INCOME
                        ? '#10b981'
                        : CATEGORY_COLORS[tx.category] || '#64748b',
                  }}
                >
                  {tx.type === TransactionType.INCOME ? (
                    <ArrowUpRight size={18} />
                  ) : tx.type === TransactionType.TRANSFER ? (
                    <RefreshCw size={16} />
                  ) : (
                    <ArrowDownRight size={18} />
                  )}
                </div>

                <div>
                  <p className="font-semibold text-zinc-200 text-sm">{tx.description}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(tx.date).toLocaleDateString('vi-VN')} • {VI.category[tx.category] || tx.category}
                  </p>
                </div>
              </div>

              <span
                className={`font-mono font-medium text-sm ${
                  tx.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-zinc-100'
                }`}
              >
                {tx.type === TransactionType.INCOME ? '+' : '-'}
                {formatVnd(Math.abs(tx.amount))}
              </span>
            </div>
          ))}

          {recentTransactions.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">{VI.dashboard.noTransactions}</div>
          )}
        </div>
      </div>
    </div>
  );
};
