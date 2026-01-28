import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetView } from './components/BudgetView';
import { InvestmentGoal } from './components/InvestmentGoal';
import { Insights } from './components/Insights';
import { ReflectionModal } from './components/ReflectionModal';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login'; // ĐÃ SỬA: Khớp với tên file thực tế của bạn
import { StorageService } from './services/storageService';
import { GeminiService } from './services/geminiService';
import { AuthService } from './services/firebase';
import { BrandLogo } from './components/BrandLogo';
import { Transaction, Wallet, Goal, User as AppUser, Budget, FixedCost, TransactionType, Category } from './types';
import { User as FirebaseUser } from 'firebase/auth';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  const [reflectionData, setReflectionData] = useState<{isOpen: boolean, message: string, category: string}>({
    isOpen: false, message: '', category: ''
  });

  // 1. Khởi tạo ứng dụng và Auth
  useEffect(() => {
    // Theme initialization
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');

    const authUnsubscribe = AuthService.onAuthChange((user) => {
      setCurrentUser(user);
      if (user) {
        try {
          StorageService.init();
          refreshData();
        } catch (e: any) {
          setBootError("Lỗi đồng bộ dữ liệu: " + e.message);
        }
      }
      setIsInitialLoading(false);
    });

    return () => authUnsubscribe();
  }, []);

  const refreshData = () => {
    try {
      setWallets(StorageService.getWallets());
      setTransactions(StorageService.getTransactions());
      setGoals(StorageService.getGoals());
      setUsers(StorageService.getUsers());
      setBudgets(StorageService.getBudgets());
      setFixedCosts(StorageService.getFixedCosts());
    } catch (e) {
      console.error("Lỗi làm mới dữ liệu:", e);
    }
  };

  // 2. Xử lý nghiệp vụ (Business Logic)
  const handleAddTransaction = async (data: any) => {
    try {
      if (data.type === TransactionType.TRANSFER && data.toWalletId) {
        StorageService.transferFunds(data.walletId, data.toWalletId, data.amount, data.description);
      } else {
        StorageService.addTransaction(data as Transaction);
        
        // AI Reflection logic
        if (data.type === TransactionType.EXPENSE) {
          const budget = budgets.find(b => b.category === data.category);
          if (budget) {
            const currentSpent = getSpentByCategory(data.category);
            if (currentSpent > budget.limit) {
              const message = await GeminiService.generateReflectionPrompt(data.category, currentSpent - budget.limit);
              setReflectionData({ isOpen: true, message, category: data.category });
            }
          }
        }
      }
      refreshData();
    } catch (e) {
      console.error("Lỗi giao dịch:", e);
    }
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

  // 3. Render giao diện
  if (isInitialLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8fafa] dark:bg-[#020617] space-y-6">
        <div className="w-24 h-24 bg-gold rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-bounce">
            <BrandLogo size={64} color="white" />
        </div>
        <div className="text-primary font-bold tracking-widest animate-pulse">MANICASH ĐANG KHỞI ĐỘNG</div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-10 text-center">
        <AlertTriangle className="text-danger mb-6" size={60} />
        <h1 className="text-xl font-black uppercase mb-2">Lỗi khởi động</h1>
        <p className="text-sm text-foreground/50 mb-8">{bootError}</p>
        <button onClick={() => window.location.reload()} className="bg-primary text-white px-8 py-4 rounded-2xl flex items-center gap-2">
          <RefreshCw size={18} /> Thử lại
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />; // ĐÃ SỬA: Sẽ gọi components/Login.tsx
  }

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors duration-300">
      <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddTransaction={() => setIsTxModalOpen(true)}>
        {activeTab === 'dashboard' && <Dashboard wallets={wallets} transactions={transactions} users={users} onOpenSettings={() => setIsSettingsOpen(true)} onRefresh={refreshData} />}
        {activeTab === 'budgets' && <BudgetView budgets={budgets} getSpent={getSpentByCategory} onUpdateBudgets={(nb) => { StorageService.updateBudgets(nb); refreshData(); }} fixedCosts={fixedCosts} onPayFixedCost={(c) => { /* logic */ refreshData(); }} onRefresh={refreshData} />}
        {activeTab === 'goals' && <InvestmentGoal goals={goals} users={users} wallets={wallets} onRefresh={refreshData} />}
        {activeTab === 'insights' && <Insights transactions={transactions} users={users} />}
        
        <TransactionForm isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSubmit={handleAddTransaction} wallets={wallets} />
        <ReflectionModal isOpen={reflectionData.isOpen} message={reflectionData.message} category={reflectionData.category} onClose={() => setReflectionData({ ...reflectionData, isOpen: false })} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} users={users} wallets={wallets} onSave={(u, w) => { StorageService.updateUsers(u); StorageService.updateWallets(w); refreshData(); }} onRefresh={refreshData} currentUser={currentUser} />
      </Layout>
    </div>
  );
}

export default App;
