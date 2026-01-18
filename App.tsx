import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetView } from './components/BudgetView';
import { InvestmentGoal } from './components/InvestmentGoal';
import { Insights } from './components/Insights';
import { ReflectionModal } from './components/ReflectionModal';
import { SettingsModal } from './components/SettingsModal';

import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { INITIAL_BUDGETS, USERS, LS_KEYS } from './constants';
import { Transaction, Wallet, Goal, Category, TransactionType, User } from './types';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  // Settings UI
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data State
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets] = useState(INITIAL_BUDGETS); // Static config for now

  // People (editable)
  const [users, setUsers] = useState<User[]>(() => safeParse<User[]>(localStorage.getItem(LS_KEYS.USERS), USERS));

  // Wallet name overrides (editable)
  const [walletNameOverrides, setWalletNameOverrides] = useState<Record<string, string>>(() => {
    const savedWallets = safeParse<Wallet[]>(localStorage.getItem(LS_KEYS.WALLETS), []);
    const map: Record<string, string> = {};
    for (const w of savedWallets) {
      if (w?.id && w?.name) map[w.id] = w.name;
    }
    return map;
  });

  // Logic State
  const [reflectionData, setReflectionData] = useState<{ isOpen: boolean; message: string; category: string }>({
    isOpen: false,
    message: '',
    category: '',
  });

  useEffect(() => {
    StorageService.init();
    refreshData();
  }, []);

  const applyWalletOverrides = (baseWallets: Wallet[]) => {
    if (!walletNameOverrides || Object.keys(walletNameOverrides).length === 0) return baseWallets;
    return baseWallets.map(w => (walletNameOverrides[w.id] ? { ...w, name: walletNameOverrides[w.id] } : w));
  };

  const refreshData = () => {
    const baseWallets = StorageService.getWallets();
    setWallets(applyWalletOverrides(baseWallets));
    setTransactions(StorageService.getTransactions());
    setGoals(StorageService.getGoals());
  };

  const getSpentByCategory = (category: Category) => {
    const now = new Date();
    return transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.category === category)
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const handleAddTransaction = async (data: Transaction) => {
    StorageService.addTransaction(data);
    refreshData();

    if (data.type === TransactionType.EXPENSE) {
      const budget = budgets.find(b => b.category === data.category);
      if (budget) {
        const currentSpent = getSpentByCategory(data.category);
        const newTotal = currentSpent + data.amount;

        if (newTotal > budget.limit) {
          const overage = newTotal - budget.limit;
          const message = await GeminiService.generateReflectionPrompt(data.category, overage);
          setReflectionData({
            isOpen: true,
            message,
            category: data.category,
          });
        }
      }
    }
  };

  // Wallets to show (always apply overrides)
  const walletsForUI = useMemo(() => applyWalletOverrides(wallets), [wallets, walletNameOverrides]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard wallets={walletsForUI} transactions={transactions} onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'budgets':
        return <BudgetView budgets={budgets} getSpent={getSpentByCategory} />;
      case 'goals':
        return <InvestmentGoal goals={goals} />;
      case 'insights':
        return <Insights transactions={transactions} users={users} />;
      default:
        return <Dashboard wallets={walletsForUI} transactions={transactions} onOpenSettings={() => setIsSettingsOpen(true)} />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onAddTransaction={() => setIsTxModalOpen(true)}
    >
      {renderContent()}

      <TransactionForm
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSubmit={handleAddTransaction}
        wallets={walletsForUI}
      />

      <ReflectionModal
        isOpen={reflectionData.isOpen}
        message={reflectionData.message}
        category={reflectionData.category}
        onClose={() => setReflectionData({ ...reflectionData, isOpen: false })}
      />

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        users={users}
        wallets={walletsForUI}
        onSave={(nextUsers, nextWallets) => {
          setUsers(nextUsers);

          // Map wallet names by id so even if StorageService overwrites later,
          // UI still shows user's chosen names.
          const map: Record<string, string> = {};
          for (const w of nextWallets) {
            map[w.id] = w.name;
          }
          setWalletNameOverrides(map);

          // Also update current wallets view immediately
          setWallets(prev => prev.map(w => (map[w.id] ? { ...w, name: map[w.id] } : w)));
        }}
        onReset={() => {
          setUsers(USERS);
          setWalletNameOverrides({});
          // refresh from storage again (and apply no overrides)
          const baseWallets = StorageService.getWallets();
          setWallets(baseWallets);
        }}
      />
    </Layout>
  );
}

export default App;
