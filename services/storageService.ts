
import { Transaction, Wallet, Goal, TransactionType, Category, User, Budget, IncomeProject, FixedCost, AllocationSetting, ButlerType, UserGender } from '../types';
import { AuthService } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { DataGuard } from '../utils/dataGuard';

const KEYS = {
  TRANSACTIONS: 'duocash_transactions',
  WALLETS: 'duocash_wallets',
  GOALS: 'duocash_goals',
  CATEGORIES: 'duocash_categories',
  USERS: 'duocash_users',
  BUDGETS: 'duocash_budgets',
  PROJECTS: 'duocash_income_projects',
  FIXED_COSTS: 'duocash_fixed_costs',
  ALLOCATION_CONFIG: 'duocash_allocation_config',
  AUTO_DEDUCT_PERCENT: 'duocash_auto_deduct_percent',
  AUTO_DEDUCT_ENABLED: 'duocash_auto_deduct_enabled',
  THEME: 'duocash_theme',
  SIMPLE_MODE: 'duocash_simple_mode',
  AI_BRAIN: 'duocash_ai_brain',
};

const INITIAL_USERS: User[] = [
  { 
    id: 'u1', 
    name: 'Tôi', 
    avatar: '😎', 
    gender: UserGender.MALE, 
    butlerPreference: ButlerType.MALE,
    maleButlerName: 'Lord Diamond',
    femaleButlerName: 'Queen Crown'
  },
  { id: 'u2', name: 'Partner', avatar: '👻' },
];

const INITIAL_WALLETS: Wallet[] = [
  { id: 'w1', userId: 'u1', name: "Ví chính", balance: 0 },
  { id: 'w2', userId: 'u1', name: "Quỹ dự phòng", balance: 0 },
];

const INITIAL_BUDGETS: Budget[] = Object.values(Category)
  .filter(c => c !== Category.INCOME && c !== Category.TRANSFER)
  .map(c => ({ category: c as Category, limit: 0, spent: 0 }));

export const StorageService = {
  syncToCloud: async () => {
    const db = AuthService.getDb();
    const auth = AuthService.getAuth();
    if (!db || !auth) return;

    const user = auth.currentUser || (AuthService as any).lastUid; 
    const uid = typeof user === 'string' ? user : user?.uid;
    if (!uid) return;

    const data: any = {};
    Object.values(KEYS).forEach(key => {
        const val = localStorage.getItem(key);
        try {
            data[key] = val ? JSON.parse(val) : null;
        } catch {
            data[key] = val;
        }
    });

    try {
        await setDoc(doc(db, "userData", uid), {
            ...data,
            lastSynced: new Date().toISOString()
        });
    } catch (e) {
        console.error("[Storage] Lỗi đồng bộ:", e);
    }
  },

  loadFromCloud: async (uid: string) => {
    const db = AuthService.getDb();
    if (!db || !uid) return false;
    (AuthService as any).lastUid = uid;

    try {
        const docRef = doc(db, "userData", uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            Object.entries(data).forEach(([key, value]) => {
                if (key === 'lastSynced') return;
                
                // DATA GUARD INTEGRATION: Sanitize arrays from cloud
                let cleanedValue = value;
                try {
                  if (key === KEYS.TRANSACTIONS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeTransaction);
                  if (key === KEYS.BUDGETS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeBudget);
                  if (key === KEYS.WALLETS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeWallet);
                  if (key === KEYS.GOALS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeGoal);
                  if (key === KEYS.FIXED_COSTS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeFixedCost);
                  if (key === KEYS.PROJECTS && Array.isArray(value)) cleanedValue = value.map(DataGuard.sanitizeProject);
                } catch (e) {
                  console.error(`[DataGuard] Lỗi làm sạch key ${key}:`, e);
                }

                const stringVal = typeof cleanedValue === 'string' ? cleanedValue : JSON.stringify(cleanedValue);
                localStorage.setItem(key, stringVal);
            });
            return true;
        }
    } catch (e) {
        console.error("[Storage] Lỗi tải từ Cloud:", e);
    }
    return false;
  },

  init: () => {
    if (!localStorage.getItem(KEYS.USERS)) localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    if (!localStorage.getItem(KEYS.WALLETS)) localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    if (!localStorage.getItem(KEYS.CATEGORIES)) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(Object.values(Category)));
    if (!localStorage.getItem(KEYS.BUDGETS)) localStorage.setItem(KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.THEME)) localStorage.setItem(KEYS.THEME, 'dark');
    if (!localStorage.getItem(KEYS.SIMPLE_MODE)) localStorage.setItem(KEYS.SIMPLE_MODE, 'false');
    if (!localStorage.getItem(KEYS.AI_BRAIN)) localStorage.setItem(KEYS.AI_BRAIN, 'gemini');
    if (!localStorage.getItem(KEYS.FIXED_COSTS)) localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.GOALS)) localStorage.setItem(KEYS.GOALS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.ALLOCATION_CONFIG)) localStorage.setItem(KEYS.ALLOCATION_CONFIG, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.PROJECTS)) localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
  },

  saveAndSync: async (key: string, value: any) => {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringVal);
    await StorageService.syncToCloud();
  },

  resetFull: async () => {
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    localStorage.setItem(KEYS.GOALS, JSON.stringify([]));
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify([]));
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
    localStorage.setItem(KEYS.AUTO_DEDUCT_ENABLED, 'false');
    localStorage.setItem(KEYS.ALLOCATION_CONFIG, JSON.stringify([]));
    localStorage.setItem(KEYS.AUTO_DEDUCT_PERCENT, '10');
    await StorageService.syncToCloud();
  },

  resetBalancesOnly: async () => {
    const wallets = StorageService.getWallets();
    wallets.forEach(w => w.balance = 0);
    await StorageService.updateWallets(wallets);
  },

  getAiBrain: (): 'gemini' | 'llama' => (localStorage.getItem(KEYS.AI_BRAIN) as 'gemini' | 'llama') || 'gemini',
  setAiBrain: async (brain: 'gemini' | 'llama') => StorageService.saveAndSync(KEYS.AI_BRAIN, brain),
  getTheme: (): 'dark' | 'light' => (localStorage.getItem(KEYS.THEME) as 'dark' | 'light') || 'dark',
  setTheme: async (theme: 'dark' | 'light') => StorageService.saveAndSync(KEYS.THEME, theme),
  getSimpleMode: (): boolean => localStorage.getItem(KEYS.SIMPLE_MODE) === 'true',
  setSimpleMode: async (enabled: boolean) => StorageService.saveAndSync(KEYS.SIMPLE_MODE, String(enabled)),
  getUsers: (): User[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
      return Array.isArray(data) ? data : INITIAL_USERS;
    } catch { return INITIAL_USERS; }
  },
  updateUsers: async (users: User[]) => StorageService.saveAndSync(KEYS.USERS, users),
  
  updateButlerPreference: async (userId: string, type: ButlerType) => {
    const users = StorageService.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].butlerPreference = type;
      await StorageService.updateUsers(users);
    }
  },

  getCategories: (): string[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]');
      return Array.isArray(data) ? data : Object.values(Category);
    } catch { return Object.values(Category); }
  },
  addCategory: async (newCategory: string) => {
    const categories = StorageService.getCategories();
    if (!categories.some(c => c.toLowerCase() === newCategory.trim().toLowerCase())) {
      categories.push(newCategory.trim());
      await StorageService.saveAndSync(KEYS.CATEGORIES, categories);
    }
    return categories;
  },
  
  getTransactions: (): Transaction[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeTransaction) : [];
    } catch { return []; }
  },
  addTransaction: async (tx: Transaction) => {
    const txs = StorageService.getTransactions();
    const cleanTx = DataGuard.sanitizeTransaction(tx);
    
    txs.push(cleanTx);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === cleanTx.walletId);
    if (wallet) {
      if (cleanTx.type === TransactionType.INCOME) wallet.balance += cleanTx.amount;
      else wallet.balance -= cleanTx.amount;
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    }
    await StorageService.syncToCloud();
  },

  getWallets: (): Wallet[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.WALLETS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeWallet) : INITIAL_WALLETS;
    } catch { return INITIAL_WALLETS; }
  },
  updateWallets: async (wallets: Wallet[]) => StorageService.saveAndSync(KEYS.WALLETS, wallets),
  
  getGoals: (): Goal[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.GOALS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeGoal) : [];
    } catch { return []; }
  },
  addGoal: async (goal: Goal) => {
    const goals = StorageService.getGoals();
    goals.push(DataGuard.sanitizeGoal(goal));
    await StorageService.saveAndSync(KEYS.GOALS, goals);
  },

  contributeToGoal: (goalId: string, walletId: string, amount: number, note: string, userId: string): boolean => {
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === walletId);
    const goals = StorageService.getGoals();
    const goal = goals.find(g => g.id === goalId);

    if (wallet && goal && wallet.balance >= amount) {
      wallet.balance -= amount;
      goal.currentAmount += amount;
      goal.rounds.push({
        id: `rnd_${Date.now()}`,
        date: new Date().toLocaleDateString('vi-VN'),
        amount,
        contributorId: userId,
        note: note || 'Nạp quỹ mục tiêu'
      });

      const tx: Transaction = {
        id: `tx_goal_dep_${Date.now()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amount,
        type: TransactionType.TRANSFER,
        category: Category.INVESTMENT,
        walletId: walletId,
        description: `Nạp mục tiêu: ${goal.name}`,
        timestamp: Date.now()
      };

      const txs = StorageService.getTransactions();
      txs.push(tx);

      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
      localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
      StorageService.syncToCloud();
      return true;
    }
    return false;
  },

  getBudgets: (): Budget[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.BUDGETS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeBudget) : INITIAL_BUDGETS;
    } catch { return INITIAL_BUDGETS; }
  },
  updateBudgets: async (budgets: Budget[]) => StorageService.saveAndSync(KEYS.BUDGETS, budgets),
  
  getIncomeProjects: (): IncomeProject[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeProject) : [];
    } catch { return []; }
  },
  addIncomeProject: async (p: IncomeProject) => {
    const ps = StorageService.getIncomeProjects(); ps.push(DataGuard.sanitizeProject(p));
    await StorageService.saveAndSync(KEYS.PROJECTS, ps);
  },
  updateIncomeProject: async (up: IncomeProject) => {
    const ps = StorageService.getIncomeProjects();
    const idx = ps.findIndex(p => p.id === up.id);
    if (idx !== -1) { ps[idx] = DataGuard.sanitizeProject(up); await StorageService.saveAndSync(KEYS.PROJECTS, ps); }
  },
  deleteIncomeProject: async (id: string) => {
    const ps = StorageService.getIncomeProjects();
    const updated = ps.filter(p => p.id !== id);
    await StorageService.saveAndSync(KEYS.PROJECTS, updated);
  },

  getFixedCosts: (): FixedCost[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.FIXED_COSTS) || '[]');
      return Array.isArray(data) ? data.map(DataGuard.sanitizeFixedCost) : [];
    } catch { return []; }
  },
  addFixedCost: async (c: FixedCost) => {
    const cs = StorageService.getFixedCosts(); cs.push(DataGuard.sanitizeFixedCost(c));
    await StorageService.saveAndSync(KEYS.FIXED_COSTS, cs);
  },
  updateFixedCost: async (uc: FixedCost) => {
    const cs = StorageService.getFixedCosts();
    const idx = cs.findIndex(c => c.id === uc.id);
    if (idx !== -1) { cs[idx] = DataGuard.sanitizeFixedCost(uc); await StorageService.saveAndSync(KEYS.FIXED_COSTS, cs); }
  },
  deleteFixedCost: async (id: string) => {
    const cs = StorageService.getFixedCosts();
    const updated = cs.filter(c => c.id !== id);
    await StorageService.saveAndSync(KEYS.FIXED_COSTS, updated);
  },

  depositToBill: (walletId: string, billId: string, amount: number, description: string): boolean => {
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === walletId);
    const costs = StorageService.getFixedCosts();
    const cost = costs.find(c => c.id === billId);

    if (wallet && cost && wallet.balance >= amount) {
      wallet.balance -= amount;
      cost.allocatedAmount += amount;

      const tx: Transaction = {
        id: `tx_bill_dep_${Date.now()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amount,
        type: TransactionType.TRANSFER,
        category: Category.BILLS,
        walletId: walletId,
        description: description || `Nạp quỹ hóa đơn: ${cost.title}`,
        timestamp: Date.now()
      };

      const txs = StorageService.getTransactions();
      txs.push(tx);

      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
      localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs));
      StorageService.syncToCloud();
      return true;
    }
    return false;
  },

  transferFunds: (fromId: string, toId: string, amount: number, description: string): boolean => {
    const wallets = StorageService.getWallets();
    const fromW = wallets.find(w => w.id === fromId);
    const toW = wallets.find(w => w.id === toId);
    
    if (fromW && toW && fromW.balance >= amount) {
      fromW.balance -= amount;
      toW.balance += amount;
      
      const tx: Transaction = {
        id: `tx_trf_${Date.now()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amount,
        type: TransactionType.TRANSFER,
        category: Category.TRANSFER,
        walletId: fromId,
        description: description || `Chuyển tiền tới ${toW.name}`,
        timestamp: Date.now()
      };
      
      const txs = StorageService.getTransactions();
      txs.push(tx);
      
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
      StorageService.syncToCloud();
      return true;
    }
    return false;
  },

  getAllocationConfig: (): AllocationSetting[] => {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.ALLOCATION_CONFIG) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },
  saveAllocationConfig: async (config: AllocationSetting[]) => StorageService.saveAndSync(KEYS.ALLOCATION_CONFIG, config),
  executeAllocation: (totalAmount: number, sourceWalletId: string): boolean => {
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === sourceWalletId);
    if (!wallet || wallet.balance < totalAmount) return false;

    const config = StorageService.getAllocationConfig();
    const goals = StorageService.getGoals();
    const costs = StorageService.getFixedCosts();

    let totalAllocated = 0;

    config.filter(c => c.isEnabled && c.percentage > 0).forEach(item => {
      const amountToAlloc = Math.floor((totalAmount * item.percentage) / 100);
      if (amountToAlloc <= 0) return;

      if (item.type === 'GOAL') {
        const goal = goals.find(g => g.id === item.itemId);
        if (goal) {
          goal.currentAmount += amountToAlloc;
          goal.rounds.push({
            id: `rnd_auto_${Date.now()}_${item.itemId}`,
            date: new Date().toLocaleDateString('vi-VN'),
            amount: amountToAlloc,
            contributorId: wallet.userId,
            note: 'Phân bổ tự động'
          });
          totalAllocated += amountToAlloc;
        }
      } else if (item.type === 'COST') {
        const cost = costs.find(c => c.id === item.itemId);
        if (cost) {
          cost.allocatedAmount += amountToAlloc;
          totalAllocated += amountToAlloc;
        }
      }
    });

    if (totalAllocated > 0) {
      wallet.balance -= totalAllocated;
      
      const tx: Transaction = {
        id: `tx_alloc_${Date.now()}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amount: totalAllocated,
        type: TransactionType.TRANSFER,
        category: Category.TRANSFER,
        walletId: sourceWalletId,
        description: 'Phân bổ dòng tiền tự động',
        timestamp: Date.now()
      };

      const txs = StorageService.getTransactions();
      txs.push(tx);

      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
      localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
      localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs));
      StorageService.syncToCloud();
      return true;
    }
    return false;
  }
};
