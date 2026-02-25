import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetView } from './components/BudgetView';
import { InvestmentGoal } from './components/InvestmentGoal';
import { Insights } from './components/Insights';
import { ReflectionModal } from './components/ReflectionModal';
import { SettingsModal } from './components/SettingsModal';
import { FutureRoadmap } from './components/FutureRoadmap'; 
import { Login } from './components/Login';
import { StorageService } from './services/storageService';
import { AuthService } from './services/firebase';
import { BrandLogo } from './components/BrandLogo';
import { Transaction, Wallet, Goal, Category, TransactionType, User as AppUser, Budget, FixedCost, ButlerType } from './types';
import { User as FirebaseUser } from 'firebase/auth';
import { AlertTriangle, RefreshCw, Zap, Sparkles } from 'lucide-react';
import { VI } from './constants/vi';
import { getRandomSarcasm } from './constants/sarcasm';
import { DataGuard } from './utils/dataGuard';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFutureModalOpen, setIsFutureModalOpen] = useState(false); 
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);
  
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
    const handleUpdate = (e: any) => {
      setUpdateRegistration(e.detail);
    };
    window.addEventListener('app-update-available', handleUpdate);

    try {
      const unsubscribe = AuthService.onAuthChange(async (user) => {
        setCurrentUser(user);
        
        if (user) {
          setIsDataSyncing(true);
          StorageService.init();
          await StorageService.loadFromCloud(user.uid);
          await StorageService.checkNewMonth();
          refreshData();
          applyInitialPreferences();
          setIsDataSyncing(false);
        }
        setIsInitialLoading(false);
      });
      return () => {
        unsubscribe();
        window.removeEventListener('app-update-available', handleUpdate);
      };
    } catch (e: any) {
      console.error("App Boot Error:", e);
      setBootError(e.message || "Lỗi khởi động dịch vụ.");
      setIsInitialLoading(false);
    }
  }, []);

  const handleUpdateApp = () => {
    if (updateRegistration && updateRegistration.waiting) {
      updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const applyInitialPreferences = () => {
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const simpleMode = StorageService.getSimpleMode();
    if (simpleMode) document.documentElement.classList.add('simple-mode');
    else document.documentElement.classList.remove('simple-mode');
  };

  const refreshData = () => {
    try {
      const rawWallets = StorageService.getWallets();
      setWallets(rawWallets.map(DataGuard.sanitizeWallet));

      const rawTxs = StorageService.getTransactions();
      setTransactions(rawTxs.map(DataGuard.sanitizeTransaction));

      const rawGoals = StorageService.getGoals();
      setGoals(rawGoals.map(DataGuard.sanitizeGoal));

      setUsers(StorageService.getUsers());

      const rawBudgets = StorageService.getBudgets();
      setBudgets(rawBudgets.map(DataGuard.sanitizeBudget));

      const rawCosts = StorageService.getFixedCosts();
      setFixedCosts(rawCosts.map(DataGuard.sanitizeFixedCost));
    } catch (e) {
      console.error("Data refresh error:", e);
      alert("Hệ thống phát hiện dữ liệu không đồng nhất. Đang tự động làm sạch...");
    }
  };

  const handleSaveSettings = async (updatedUsers: AppUser[], updatedWallets: Wallet[]) => {
    await StorageService.updateUsers(updatedUsers);
    await StorageService.updateWallets(updatedWallets);
    refreshData();
  };

  const handleUpdateBudgets = async (newBudgets: Budget[]) => {
      await StorageService.updateBudgets(newBudgets);
      refreshData();
  };
  
  const handlePayFixedCost = async (cost: FixedCost) => {
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
      await StorageService.addTransaction(tx);
      const nextDate = new Date(cost.nextDueDate);
      nextDate.setMonth(nextDate.getMonth() + cost.frequencyMonths);
      const updatedCost: FixedCost = { ...cost, allocatedAmount: 0, nextDueDate: nextDate.toISOString().split('T')[0] };
      await StorageService.updateFixedCost(updatedCost);
      refreshData();
  };

  const getSpentByCategory = (category: Category) => {
    try {
        const now = new Date();
        return transactions
          .filter(t => t.type === TransactionType.EXPENSE && t.category === category)
          .filter(t => {
              const d = new Date(t.date);
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
          .reduce((sum, t) => sum + DataGuard.asNumber(t.amount), 0);
    } catch {
        return 0;
    }
  };

  const handleAddTransaction = async (data: any) => {
    refreshData();

    if (data && data.type === TransactionType.EXPENSE) {
        const user = users[0];
        const butlerName = user?.butlerPreference === ButlerType.FEMALE 
            ? (user.femaleButlerName || VI.butler.femaleName) 
            : (user.maleButlerName || VI.butler.maleName);

        const sarcasmMessage = getRandomSarcasm(data.category);
        const budget = budgets.find(b => b.category === data.category);
        const currentSpent = getSpentByCategory(data.category);
        const isOver = budget && currentSpent > budget.limit;

        setReflectionData({
            isOpen: true,
            message: sarcasmMessage,
            category: data.category,
            variant: isOver ? 'danger' : 'success',
            title: isOver ? VI.reflection.defaultTitle : butlerName,
            isLoading: false
        });
    }
  };

  // Màn hình Loading
  if (isInitialLoading || isDataSyncing) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background space-y-6">
        <div className="w-24 h-24 bg-gold rounded-[2.5rem] flex items-center justify-center shadow-2xl neon-glow-gold animate-bounce">
            <BrandLogo size={64} color="white" />
        </div>
        <div className="text-center space-y-2">
            <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">
                {isDataSyncing ? "Đang đồng bộ dữ liệu Cloud..." : "Đang khởi động hệ thống..."}
            </p>
            <div className="w-12 h-1 bg-foreground/10 rounded-full mx-auto overflow-hidden relative">
                <div className="absolute inset-0 bg-primary animate-progress"></div>
            </div>
        </div>
      </div>
    );
  }

  // Màn hình Lỗi
  if (bootError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background p-10 text-center">
        <div className="w-20 h-20 bg-danger/10 text-danger rounded-3xl flex items-center justify-center mb-6">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-xl font-black uppercase mb-2">Lỗi hệ thống</h1>
        <p className="text-sm text-foreground/50 mb-8 max-w-xs">{bootError}</p>
        <button onClick={() => window.location.reload()} className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
          <RefreshCw size={18} /> Thử lại
        </button>
      </div>
    );
  }

  // Nếu chưa đăng nhập, bắt buộc vào Login (đã bỏ bypass)
  if (!currentUser) return <Login />;

  return (
    <div className="bg-background text-foreground h-full transition-colors duration-300 relative">
      {updateRegistration && (
        <div className="fixed top-0 left-0 right-0 z-[1000] p-4 animate-in slide-in-from-top duration-500">
           <div className="max-w-md mx-auto glass-card bg-primary text-white p-5 rounded-[2rem] shadow-2xl flex items-center justify-between border-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50 group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                  <Zap size={24} className="text-white fill-white animate-pulse" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest">Nâng cấp hệ thống!</h4>
                  <p className="text-[10px] font-bold opacity-80 uppercase leading-none mt-1">Đã có phiên bản Manicash mới!</p>
                </div>
              </div>
              <button 
                onClick={handleUpdateApp}
                className="bg-white text-primary px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all relative z-10"
              >
                Cập nhật ngay
              </button>
           </div>
        </div>
      )}

      <Layout activeTab={activeTab} onTabChange={setActiveTab} onAddTransaction={() => setIsTxModalOpen(true)}>
        {activeTab === 'dashboard' ? (
            <Dashboard 
              wallets={wallets} 
              transactions={transactions} 
              users={users} 
              onOpenSettings={() => setIsSettingsOpen(true)} 
              onRefresh={refreshData}
              onOpenFuture={() => setIsFutureModalOpen(true)} 
            />
        ) : activeTab === 'budgets' ? (
            <BudgetView budgets={budgets} getSpent={getSpentByCategory} onUpdateBudgets={handleUpdateBudgets} fixedCosts={fixedCosts} onPayFixedCost={handlePayFixedCost} onRefresh={refreshData} />
        ) : activeTab === 'goals' ? (
            <InvestmentGoal goals={goals} users={users} wallets={wallets} onRefresh={refreshData} />
        ) : (
            <Insights transactions={transactions} users={users} />
        )}
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
      
      <FutureRoadmap 
        isOpen={isFutureModalOpen} 
        onClose={() => setIsFutureModalOpen(false)} 
        userEmail={currentUser.email || ''} 
        userId={currentUser.uid}
      />
    </div>
  );
}

export default App;
