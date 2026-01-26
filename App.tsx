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
import { Transaction, Wallet, Goal, User, Budget, FixedCost, Category, TransactionType } from './types';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Khởi tạo state với mảng rỗng để tránh lỗi undefined khi render lần đầu
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  const [reflectionData, setReflectionData] = useState({
    isOpen: false, message: '', category: ''
  });

  useEffect(() => {
    try {
      // Đảm bảo StorageService có tồn tại và được init thành công
      if (StorageService && typeof StorageService.init === 'function') {
        StorageService.init();
        refreshData();
        applyInitialTheme();
      }
    } catch (error) {
      console.error("Lỗi khi khởi tạo ứng dụng:", error);
    }
  }, []);

  const applyInitialTheme = () => {
    const theme = StorageService.getTheme();
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const refreshData = () => {
    try {
      setWallets(StorageService.getWallets() || []);
      setTransactions(StorageService.getTransactions() || []);
      setGoals(StorageService.getGoals() || []);
      setUsers(StorageService.getUsers() || []);
      setBudgets(StorageService.getBudgets() || []);
      setFixedCosts(StorageService.getFixedCosts() || []);
    } catch (error) {
      console.error("Lỗi khi làm mới dữ liệu:", error);
    }
  };

  // ... (Giữ nguyên các hàm handleAddTransaction, handleSaveSettings, v.v. của bạn)

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
        {/* Bọc trong một vùng kiểm tra để tránh crash toàn bộ app */}
        {renderContent()}
        
        <TransactionForm isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSubmit={handleAddTransaction} wallets={wallets} />
        <ReflectionModal isOpen={reflectionData.isOpen} message={reflectionData.message} category={reflectionData.category} onClose={() => setReflectionData({ ...reflectionData, isOpen: false })} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} users={users} wallets={wallets} onSave={handleSaveSettings} onRefresh={refreshData} />
      </Layout>
    </div>
  );
}

export default App;
