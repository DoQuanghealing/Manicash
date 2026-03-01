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
import {
  Transaction,
  Wallet,
  Goal,
  Category,
  TransactionType,
  User as AppUser,
  Budget,
  FixedCost,
  ButlerType
} from './types';
import { User as FirebaseUser } from 'firebase/auth';
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react';
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
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);

  const [reflectionData, setReflectionData] = useState<{
    isOpen: boolean;
    message: string;
    category: string;
    title?: string;
    variant?: 'danger' | 'success';
    isLoading?: boolean;
  }>({
    isOpen: false,
    message: '',
    category: ''
  });

  /* =========================
     AUTH + BOOT
  ========================== */

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
          await refreshData();
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
      console.error('App Boot Error:', e);
      setBootError(e.message || 'Lỗi khởi động dịch vụ.');
      setIsInitialLoading(false);
    }
  }, []);

  /* =========================
     UTILITIES
  ========================== */

  const applyInitialPreferences = () => {
    const theme = StorageService.getTheme();
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const simpleMode = StorageService.getSimpleMode();
    if (simpleMode) document.documentElement.classList.add('simple-mode');
    else document.documentElement.classList.remove('simple-mode');
  };

  const refreshData = async () => {
    try {
      setWallets(
        StorageService.getWallets().map(DataGuard.sanitizeWallet)
      );
      setTransactions(
        StorageService.getTransactions().map(DataGuard.sanitizeTransaction)
      );
      setGoals(
        StorageService.getGoals().map(DataGuard.sanitizeGoal)
      );
      setUsers(StorageService.getUsers());
      setBudgets(
        StorageService.getBudgets().map(DataGuard.sanitizeBudget)
      );
      setFixedCosts(
        StorageService.getFixedCosts().map(DataGuard.sanitizeFixedCost)
      );
    } catch (e) {
      console.error('Data refresh error:', e);
      alert('Hệ thống phát hiện dữ liệu lỗi. Đang tự làm sạch...');
    }
  };

  const getSpentByCategory = (category: Category) => {
    const now = new Date();
    return transactions
      .filter(
        (t) =>
          t.type === TransactionType.EXPENSE &&
          t.category === category
      )
      .filter((t) => {
        const d = new Date(t.date);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, t) => sum + DataGuard.asNumber(t.amount), 0);
  };

  /* =========================
     HANDLERS
  ========================== */

  const handleAddTransaction = async (data: any) => {
    await refreshData();

    if (data?.type === TransactionType.EXPENSE) {
      const user = users[0];
      const butlerName =
        user?.butlerPreference === ButlerType.FEMALE
          ? user.femaleButlerName || VI.butler.femaleName
          : user.maleButlerName || VI.butler.maleName;

      const sarcasmMessage = getRandomSarcasm(data.category);
      const budget = budgets.find((b) => b.category === data.category);
      const currentSpent = getSpentByCategory(data.category);
      const isOver = budget && currentSpent > budget.limit;

      setReflectionData({
        isOpen: true,
        message: sarcasmMessage,
        category: data.category,
        variant: isOver ? 'danger' : 'success',
        title: isOver ? VI.reflection.defaultTitle : butlerName
      });
    }
  };

  /* =========================
     LOADING STATES
  ========================== */

  if (isInitialLoading || isDataSyncing) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background space-y-6">
        <div className="w-24 h-24 bg-gold rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-bounce">
          <BrandLogo size={64} color="white" />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-foreground/40">
          {isDataSyncing
            ? 'Đang đồng bộ dữ liệu Cloud...'
            : 'Đang khởi động hệ thống...'}
        </p>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background p-10 text-center">
        <AlertTriangle size={40} className="text-danger mb-6" />
        <p className="mb-8">{bootError}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black"
        >
          <RefreshCw size={18} /> Thử lại
        </button>
      </div>
    );
  }

  /* =========================
     AUTH GATE
  ========================== */

  if (!currentUser) return <Login />;

  const displayUser = currentUser;

  /* =========================
     MAIN APP
  ========================== */

  return (
    <div className="bg-background text-foreground h-full">
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAddTransaction={() => setIsTxModalOpen(true)}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            wallets={wallets}
            transactions={transactions}
            users={users}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRefresh={refreshData}
            onOpenFuture={() => setIsFutureModalOpen(true)}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetView
            budgets={budgets}
            getSpent={getSpentByCategory}
            onUpdateBudgets={async (b) => {
              await StorageService.updateBudgets(b);
              refreshData();
            }}
            fixedCosts={fixedCosts}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'goals' && (
          <InvestmentGoal
            goals={goals}
            users={users}
            wallets={wallets}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'insights' && (
          <Insights transactions={transactions} users={users} />
        )}
      </Layout>

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
        variant={reflectionData.variant}
        title={reflectionData.title}
        onClose={() =>
          setReflectionData({ ...reflectionData, isOpen: false })
        }
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        users={users}
        wallets={wallets}
        onRefresh={refreshData}
        currentUser={displayUser}
      />

      <FutureRoadmap
        isOpen={isFutureModalOpen}
        onClose={() => setIsFutureModalOpen(false)}
        userEmail={displayUser.email || ''}
        userId={displayUser.uid}
      />
    </div>
  );
}

export default App;
