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
  
  // Data State
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  // Logic State
  const [reflectionData, setReflectionData] = useState<{isOpen: boolean, message: string, category: string}>({
    isOpen: false, message: '', category: ''
  });

  useEffect(() => {
    StorageService.init();
    refreshData();
  }, []);

  const refreshData = () => {
    setWallets(StorageService.getWallets());
    setTransactions(StorageService.getTransactions());
    setGoals(StorageService.getGoals());
    setUsers(StorageService.getUsers());
    setBudgets(StorageService.getBudgets());
    setFixedCosts(StorageService.getFixedCosts());
  };

  const handleUpdateUsers = (updatedUsers: User[]) => {
    StorageService.updateUsers(updatedUsers);
    refreshData();
  };
  
  const handleUpdateBudgets = (newBudgets: Budget[]) => {
      StorageService.updateBudgets(newBudgets);
      refreshData();
  };
  
  const handleUpdateFixedCosts = (newCosts: FixedCost[]) => {
      // Not typically used for bulk replace, but good for simple CRUD
      // We will handle specific CRUD in sub-component, this is a fallback
  };
  
  const handlePayFixedCost = (cost: FixedCost) => {
      // 1. Create Transaction
      const tx: Transaction = {
          id: `tx_fix_${Date.now()}`,
          date: new Date().toISOString(),
          amount: cost.amount,
          type: TransactionType.EXPENSE,
          category: Category.BILLS,
          walletId: wallets[0]?.id || '', // Default to first wallet
          description: `Thanh toán: ${cost.title}`,
          timestamp: Date.now()
      };
      
      StorageService.addTransaction(tx);
      
      // 2. Update Next Due Date AND Reset Allocated Amount
      const nextDate = new Date(cost.nextDueDate);
      nextDate.setMonth(nextDate.getMonth() + cost.frequencyMonths);
      
      const updatedCost: FixedCost = {
          ...cost,
          allocatedAmount: 0, // Reset savings after paying
          nextDueDate: nextDate.toISOString().split('T')[0]
      };
      
      StorageService.updateFixedCost(updatedCost);
      refreshData();
  };

  const getSpentByCategory = (category: Category) => {
    // Filter for current month expense transactions
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
    // Save locally
    StorageService.addTransaction(data);
    refreshData();
    // Note: We do NOT close the modal here anymore to allow the form to show post-submit reflection
    // setIsTxModalOpen(false); 

    // Check Budget Logic
    if (data.type === TransactionType.EXPENSE) {
        const budget = budgets.find(b => b.category === data.category);
        if (budget) {
            const currentSpent = getSpentByCategory(data.category); // Note: this calculates based on state which might be stale by 1 tick, but okay for demo, ideally pass updated txs
            // Re-calculate with new tx amount for accuracy
            const newTotal = currentSpent + data.amount; 
            
            if (newTotal > budget.limit) {
                const overage = newTotal - budget.limit;
                // Generate AI reflection
                const message = await GeminiService.generateReflectionPrompt(data.category, overage);
                setReflectionData({
                    isOpen: true,
                    message,
                    category: data.category
                });
            }
        }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard wallets={wallets} transactions={transactions} users={users} onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'budgets':
        return <BudgetView 
            budgets={budgets} 
            getSpent={getSpentByCategory} 
            onUpdateBudgets={handleUpdateBudgets}
            fixedCosts={fixedCosts}
            onPayFixedCost={handlePayFixedCost}
            onRefresh={refreshData}
        />;
      case 'goals':
        return <InvestmentGoal goals={goals} users={users} wallets={wallets} onRefresh={refreshData} />;
      case 'insights':
        return <Insights transactions={transactions} users={users} />;
      default:
        return <Dashboard wallets={wallets} transactions={transactions} users={users} onOpenSettings={() => setIsSettingsOpen(true)} />;
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
        wallets={wallets}
      />

      <ReflectionModal
        isOpen={reflectionData.isOpen}
        message={reflectionData.message}
        category={reflectionData.category}
        onClose={() => setReflectionData({ ...reflectionData, isOpen: false })}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        users={users}
        onSave={handleUpdateUsers}
      />
    </Layout>
  );
}

export default App;