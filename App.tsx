import React, { useEffect, useState } from 'react';
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
import { Transaction, Wallet, Goal, Category, TransactionType, User, Budget, FixedCost } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  const [reflectionData, setReflectionData] = useState<{isOpen: boolean, message: string, category: string}>({
    isOpen: false, message: '', category: ''
  });

  useEffect(() => {
    StorageService.init();
    refreshData();
    applyInitialTheme();
  }, []);

  const applyInitialTheme = () => {
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const refreshData = () => {
    setWallets(StorageService.getWallets());
    setTransactions(StorageService.getTransactions());
    setGoals(StorageService.getGoals());
    setUsers(StorageService.getUsers());
    setBudgets(StorageService.getBudgets());
    setFixedCosts(StorageService.getFixedCosts());
  };

  const handleSaveSettings = (updatedUsers: User[], updatedWallets: Wallet[]) => {
    StorageService.updateUsers(updatedUsers);
    StorageService.updateWallets(updatedWallets);
    refreshData();
  };

  const handleUpdateBudgets = (newBudgets: Budget[]) => {
      StorageService.updateBudgets(newBudgets);
      refreshData();
  };
  
  const handlePayFixedCost = (cost: FixedCost) => {
      const tx: Transaction = {
          id: `tx_fix_${Date.now()}`,
          date: new Date().toISOString(),
          amount: cost.amount,
          type: TransactionType.EXPENSE,
          category: Category.BILLS,
          walletId: wallets[0]?.id || '',
          description: `Thanh toán: ${cost.title}`,
          timestamp: Date.now()
      };
      StorageService.addTransaction(tx);
      const nextDate = new Date(cost.nextDueDate);
      nextDate.setMonth(nextDate.getMonth() + cost.frequencyMonths);
      const updatedCost: FixedCost = { ...cost, allocatedAmount: 0, nextDueDate: nextDate.toISOString().split('T')[0] };
      StorageService.updateFixedCost(updatedCost);
      refreshData();
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

  const handleAddTransaction = async (data: any) => {
    if (data.type === TransactionType.TRANSFER && data.toWalletId) {
      StorageService.transferFunds(data.walletId, data.toWalletId, data.amount, data.description);
    } else {
      StorageService.addTransaction(data as Transaction);
      
      if (data.type === TransactionType.EXPENSE) {
          const budget = budgets.find(b => b.category === data.category);
          if (budget) {
              const currentSpent = getSpentByCategory(data.category);
              if (currentSpent > budget.limit) {
                  const overage = currentSpent - budget.limit;
                  const message = await GeminiService.generateReflectionPrompt(data.category, overage);
                  setReflectionData({ isOpen: true, message, category: data.category });
              }
          }
      }
    }
    refreshData();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard wallets={wallets} transactions={transactions} users={users} onOpenSettings={() => setIsSettingsOpen(true)} onRefresh={refreshData} />;
      case 'budgets':
        return <BudgetView budgets={budgets} getSpent={getSpentByCategory} onUpdateBudgets={handleUpdateBudgets} fixedCosts={fixedCosts} onPayFixedCost={handlePayFixedCost} onRefresh={refreshData} />;
      case 'goals':
        return <InvestmentGoal goals={goals} users={users} wallets={wallets} onRefresh={refreshData} />;
      case 'insights':
        return <Insights transactions={transactions} users={users} />;
      default:
        return <Dashboard wallets={wallets} transactions={transactions} users={users} onOpenSettings={() => setIsSettingsOpen(true)} onRefresh={refreshData} />;
    }
  };

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors duration-300">
      <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddTransaction={() => setIsTxModalOpen(true)}>
        {renderContent()}
        <TransactionForm isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSubmit={handleAddTransaction} wallets={wallets} />
        <ReflectionModal isOpen={reflectionData.isOpen} message={reflectionData.message} category={reflectionData.category} onClose={() => setReflectionData({ ...reflectionData, isOpen: false })} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} users={users} wallets={wallets} onSave={handleSaveSettings} onRefresh={refreshData} />
      </Layout>
    </div>
  );
}

export default App;