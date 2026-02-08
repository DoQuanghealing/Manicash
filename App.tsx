
import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetView } from './components/BudgetView';
import { InvestmentGoal } from './components/InvestmentGoal';
import { Insights } from './components/Insights';
import { ReflectionModal } from './components/ReflectionModal';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';
import { StorageService } from './services/storageService';
import { GeminiService } from './services/aiService';
import { AuthService } from './services/firebase';
import { BrandLogo } from './components/BrandLogo';
import { Transaction, Wallet, Goal, Category, TransactionType, User as AppUser, Budget, FixedCost, ButlerType } from './types';
import { User as FirebaseUser } from 'firebase/auth';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { VI } from './constants/vi';

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

  const [reflectionData, setReflectionData] = useState<{isOpen: boolean, message: string, category: string, title?: string, variant?: 'danger' | 'success', isLoading?: boolean}>({
    isOpen: false, message: '', category: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 4000);

    try {
      const unsubscribe = AuthService.onAuthChange((user) => {
        setCurrentUser(user);
        setIsInitialLoading(false);
        if (user) {
          StorageService.init();
          refreshData();
        }
      });
      return () => {
        unsubscribe();
        clearTimeout(timer);
      };
    } catch (e: any) {
      console.error("App Boot Error:", e);
      setBootError(e.message || "Lỗi khởi động dịch vụ.");
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    applyInitialTheme();
  }, []);

  const applyInitialTheme = () => {
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const refreshData = () => {
    try {
      setWallets(StorageService.getWallets());
      setTransactions(StorageService.getTransactions());
      setGoals(StorageService.getGoals());
      setUsers(StorageService.getUsers());
      setBudgets(StorageService.getBudgets());
      setFixedCosts(StorageService.getFixedCosts());
    } catch (e) {
      console.error("Data refresh error:", e);
    }
  };

  const handleSaveSettings = (updatedUsers: AppUser[], updatedWallets: Wallet[]) => {
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

  const handleAddTransaction = (data: any) => {
    refreshData();

    if (data && data.type === TransactionType.EXPENSE) {
        const user = users[0];
        const butlerName = user?.butlerPreference === ButlerType.FEMALE 
            ? (user.femaleButlerName || "Queen Crown") 
            : (user.maleButlerName || "Lord Diamond");

        // Hiện modal ngay lập tức với thông điệp chờ để tăng cảm giác phản hồi nhanh
        setReflectionData({
            isOpen: true,
            message: "Đang phân tích thói quen của Người...",
            category: data.category,
            variant: 'success',
            title: butlerName,
            isLoading: true
        });

        (async () => {
            const budget = budgets.find(b => b.category === data.category);
            const currentSpent = getSpentByCategory(data.category);
            
            if (budget && currentSpent > budget.limit) {
                const overage = currentSpent - budget.limit;
                const message = await GeminiService.generateReflectionPrompt(data.category, overage);
                setReflectionData({ 
                    isOpen: true, 
                    message, 
                    category: data.category, 
                    variant: 'danger',
                    title: VI.reflection.defaultTitle,
                    isLoading: false
                });
            } else {
                const comment = await GeminiService.generateTransactionComment(data);
                if (comment) {
                    setReflectionData({ 
                        isOpen: true, 
                        message: comment, 
                        category: data.category, 
                        variant: 'success',
                        title: butlerName,
                        isLoading: false
                    });
                } else {
                    // Nếu lỗi AI, đóng modal hoặc hiện mặc định
                    setReflectionData(prev => ({ ...prev, isOpen: false }));
                }
            }
        })();
    }
  };

  if (isInitialLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background space-y-6">
        <div className="w-24 h-24 bg-gold rounded-[2.5rem] flex items-center justify-center shadow-2xl neon-glow-gold animate-bounce">
            <BrandLogo size={64} color="white" />
        </div>
        <div className="w-12 h-1 bg-foreground/10 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-primary animate-progress"></div>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background p-10 text-center">
        <div className="w-20 h-20 bg-danger/10 text-danger rounded-3xl flex items-center justify-center mb-6">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-xl font-black uppercase mb-2">Lỗi hệ thống</h1>
        <p className="text-sm text-foreground/50 mb-8 max-w-xs">{bootError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <RefreshCw size={18} /> Thử lại
        </button>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

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
    <div className="bg-background text-foreground h-full transition-colors duration-300 relative">
      <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddTransaction={() => setIsTxModalOpen(true)}>
        {renderContent()}
      </Layout>
      
      <TransactionForm isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} onSubmit={handleAddTransaction} wallets={wallets} />
      <ReflectionModal 
        isOpen={reflectionData.isOpen} 
        message={reflectionData.message} 
        category={reflectionData.category} 
        variant={reflectionData.variant}
        title={reflectionData.title}
        isLoading={reflectionData.isLoading}
        onClose={() => setReflectionData({ ...reflectionData, isOpen: false })} 
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} users={users} wallets={wallets} onSave={handleSaveSettings} onRefresh={refreshData} currentUser={currentUser} />
    </div>
  );
}

export default App;
