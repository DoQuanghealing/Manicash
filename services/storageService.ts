
import { Transaction, Wallet, Goal, TransactionType, Category, User, Budget, IncomeProject, FixedCost, AllocationSetting, ButlerType, UserGender } from '../types';

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
  AI_BRAIN: 'duocash_ai_brain', // 'gemini' | 'llama'
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
  init: () => {
    if (!localStorage.getItem(KEYS.USERS)) localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    if (!localStorage.getItem(KEYS.WALLETS)) localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    if (!localStorage.getItem(KEYS.CATEGORIES)) localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(Object.values(Category)));
    if (!localStorage.getItem(KEYS.BUDGETS)) localStorage.setItem(KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
    if (!localStorage.getItem(KEYS.THEME)) localStorage.setItem(KEYS.THEME, 'dark');
    if (!localStorage.getItem(KEYS.AI_BRAIN)) localStorage.setItem(KEYS.AI_BRAIN, 'gemini');
  },

  resetFull: () => {
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
    localStorage.setItem(KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    localStorage.setItem(KEYS.GOALS, JSON.stringify([]));
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify([]));
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify([]));
    localStorage.setItem(KEYS.AUTO_DEDUCT_ENABLED, 'false');
    localStorage.setItem(KEYS.ALLOCATION_CONFIG, JSON.stringify([]));
    localStorage.setItem(KEYS.AUTO_DEDUCT_PERCENT, '10');
  },

  // Fix: Added resetBalancesOnly to resolve the error in SettingsModal.tsx where this property was expected.
  resetBalancesOnly: () => {
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
  },

  getAiBrain: (): 'gemini' | 'llama' => (localStorage.getItem(KEYS.AI_BRAIN) as 'gemini' | 'llama') || 'gemini',
  setAiBrain: (brain: 'gemini' | 'llama') => localStorage.setItem(KEYS.AI_BRAIN, brain),
  getTheme: (): 'dark' | 'light' => (localStorage.getItem(KEYS.THEME) as 'dark' | 'light') || 'dark',
  setTheme: (theme: 'dark' | 'light') => localStorage.setItem(KEYS.THEME, theme),
  getUsers: (): User[] => JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
  updateUsers: (users: User[]) => localStorage.setItem(KEYS.USERS, JSON.stringify(users)),
  
  updateButlerPreference: (userId: string, type: ButlerType) => {
    const users = StorageService.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].butlerPreference = type;
      StorageService.updateUsers(users);
    }
  },

  updateUserGender: (userId: string, gender: UserGender) => {
    const users = StorageService.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].gender = gender;
      StorageService.updateUsers(users);
    }
  },

  getCategories: (): string[] => JSON.parse(localStorage.getItem(KEYS.CATEGORIES) || '[]'),
  addCategory: (newCategory: string): string[] => {
    const categories = StorageService.getCategories();
    if (!categories.some(c => c.toLowerCase() === newCategory.trim().toLowerCase())) {
      categories.push(newCategory.trim());
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    }
    return categories;
  },
  getTransactions: (): Transaction[] => JSON.parse(localStorage.getItem(KEYS.TRANSACTIONS) || '[]'),
  addTransaction: (tx: Transaction) => {
    const txs = StorageService.getTransactions();
    txs.push(tx);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === tx.walletId);
    if (wallet) {
      if (tx.type === TransactionType.INCOME) wallet.balance += tx.amount;
      else wallet.balance -= tx.amount;
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    }
  },
  transferFunds: (fromId: string, toId: string, amount: number, description: string) => {
    const wallets = StorageService.getWallets();
    const fromIdx = wallets.findIndex(w => w.id === fromId);
    const toIdx = wallets.findIndex(w => w.id === toId);
    
    if (fromIdx === -1 || toIdx === -1 || wallets[fromIdx].balance < amount) return false;
    
    wallets[fromIdx].balance -= amount;
    wallets[toIdx].balance += amount;
    
    const txs = StorageService.getTransactions();
    txs.push({
      id: `trf_${Date.now()}`,
      date: new Date().toISOString(),
      amount,
      type: TransactionType.TRANSFER,
      category: Category.TRANSFER,
      walletId: fromId,
      description: description || `Chuyển sang ${wallets[toIdx].name}`,
      timestamp: Date.now()
    });
    
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    return true;
  },
  depositToBill: (fromWalletId: string, billId: string, amount: number, description: string) => {
    const wallets = StorageService.getWallets();
    const costs = StorageService.getFixedCosts();
    const walletIdx = wallets.findIndex(w => w.id === fromWalletId);
    const costIdx = costs.findIndex(c => c.id === billId);

    if (walletIdx === -1 || costIdx === -1 || wallets[walletIdx].balance < amount) return false;

    wallets[walletIdx].balance -= amount;
    costs[costIdx].allocatedAmount += amount;

    const txs = StorageService.getTransactions();
    txs.push({
      id: `dep_bill_${Date.now()}`,
      date: new Date().toISOString(),
      amount,
      type: TransactionType.TRANSFER,
      category: Category.BILLS,
      walletId: fromWalletId,
      description: description || `Nạp quỹ hóa đơn: ${costs[costIdx].title}`,
      timestamp: Date.now()
    });

    localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    return true;
  },
  getWallets: (): Wallet[] => JSON.parse(localStorage.getItem(KEYS.WALLETS) || '[]'),
  updateWallets: (wallets: Wallet[]) => localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets)),
  getGoals: (): Goal[] => JSON.parse(localStorage.getItem(KEYS.GOALS) || '[]'),
  addGoal: (goal: Goal) => {
    const goals = StorageService.getGoals();
    goals.push(goal);
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  },
  contributeToGoal: (goalId: string, walletId: string, amount: number, note: string, userId: string) => {
    const goals = StorageService.getGoals();
    const wallets = StorageService.getWallets();
    const txs = StorageService.getTransactions();
    const gIdx = goals.findIndex(g => g.id === goalId);
    const wIdx = wallets.findIndex(w => w.id === walletId);
    if (gIdx === -1 || wIdx === -1 || wallets[wIdx].balance < amount) return false;
    wallets[wIdx].balance -= amount;
    goals[gIdx].currentAmount += amount;
    goals[gIdx].rounds.push({ id: `r_${Date.now()}`, date: new Date().toISOString().split('T')[0], amount, contributorId: userId, note: note || 'Nạp tiền' });
    txs.push({ id: `tx_${Date.now()}`, date: new Date().toISOString(), amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, walletId, description: `Nạp mục tiêu: ${goals[gIdx].name}`, timestamp: Date.now() });
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    return true;
  },
  updateGoal: (updatedGoal: Goal) => {
    const goals = StorageService.getGoals();
    const index = goals.findIndex(g => g.id === updatedGoal.id);
    if (index !== -1) { goals[index] = updatedGoal; localStorage.setItem(KEYS.GOALS, JSON.stringify(goals)); }
  },
  getBudgets: (): Budget[] => JSON.parse(localStorage.getItem(KEYS.BUDGETS) || '[]'),
  updateBudgets: (budgets: Budget[]) => localStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets)),
  getIncomeProjects: (): IncomeProject[] => JSON.parse(localStorage.getItem(KEYS.PROJECTS) || '[]'),
  addIncomeProject: (p: IncomeProject) => {
    const ps = StorageService.getIncomeProjects(); ps.push(p);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(ps));
  },
  updateIncomeProject: (up: IncomeProject) => {
    const ps = StorageService.getIncomeProjects();
    const idx = ps.findIndex(p => p.id === up.id);
    if (idx !== -1) { ps[idx] = up; localStorage.setItem(KEYS.PROJECTS, JSON.stringify(ps)); }
  },
  deleteIncomeProject: (id: string) => {
    const ps = StorageService.getIncomeProjects().filter(p => p.id !== id);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(ps));
  },
  getFixedCosts: (): FixedCost[] => JSON.parse(localStorage.getItem(KEYS.FIXED_COSTS) || '[]'),
  addFixedCost: (c: FixedCost) => {
    const cs = StorageService.getFixedCosts(); cs.push(c);
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(cs));
  },
  updateFixedCost: (uc: FixedCost) => {
    const cs = StorageService.getFixedCosts();
    const idx = cs.findIndex(c => c.id === uc.id);
    if (idx !== -1) { cs[idx] = uc; localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(cs)); }
  },
  deleteFixedCost: (id: string) => {
    const cs = StorageService.getFixedCosts().filter(c => c.id !== id);
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(cs));
  },
  getAllocationConfig: (): AllocationSetting[] => JSON.parse(localStorage.getItem(KEYS.ALLOCATION_CONFIG) || '[]'),
  saveAllocationConfig: (config: AllocationSetting[]) => localStorage.setItem(KEYS.ALLOCATION_CONFIG, JSON.stringify(config)),
  executeAllocation: (amount: number, sourceWalletId: string) => {
    const config = StorageService.getAllocationConfig();
    const fixedCosts = StorageService.getFixedCosts();
    const goals = StorageService.getGoals();
    const wallets = StorageService.getWallets();
    const txs = StorageService.getTransactions();
    const sourceWallet = wallets.find(w => w.id === sourceWalletId);
    if (!sourceWallet) return false;
    sourceWallet.balance += amount;
    txs.push({ id: `tx_alloc_in_${Date.now()}`, date: new Date().toISOString(), amount, type: TransactionType.INCOME, category: Category.INCOME, walletId: sourceWalletId, description: 'Thu nhập phân bổ tự động', timestamp: Date.now() });
    config.filter(s => s.isEnabled && s.percentage > 0).forEach(setting => {
      const allocAmount = Math.floor(amount * (setting.percentage / 100));
      if (allocAmount <= 0) return;
      if (setting.type === 'COST') {
        const cost = fixedCosts.find(c => c.id === setting.itemId);
        if (cost) { cost.allocatedAmount += allocAmount; sourceWallet.balance -= allocAmount; txs.push({ id: `tx_alloc_out_${setting.itemId}_${Date.now()}`, date: new Date().toISOString(), amount: allocAmount, type: TransactionType.TRANSFER, category: Category.BILLS, walletId: sourceWalletId, description: `Tích lũy hóa đơn: ${cost.title}`, timestamp: Date.now() + 1 }); }
      } else if (setting.type === 'GOAL') {
        const goal = goals.find(g => g.id === setting.itemId);
        if (goal) { goal.currentAmount += allocAmount; sourceWallet.balance -= allocAmount; goal.rounds.push({ id: `r_alloc_${Date.now()}`, date: new Date().toISOString().split('T')[0], amount: allocAmount, contributorId: 'u1', note: 'Phân bổ tự động' }); txs.push({ id: `tx_alloc_out_${setting.itemId}_${Date.now()}`, date: new Date().toISOString(), amount: allocAmount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, walletId: sourceWalletId, description: `Nạp mục tiêu: ${goal.name}`, timestamp: Date.now() + 1 }); }
      }
    });
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(fixedCosts));
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    return true;
  },
  getAutoDeductPercent: (): number => Number(localStorage.getItem(KEYS.AUTO_DEDUCT_PERCENT) || '10'),
  setAutoDeductPercent: (p: number) => localStorage.setItem(KEYS.AUTO_DEDUCT_PERCENT, String(p)),
  getAutoDeductEnabled: (): boolean => localStorage.getItem(KEYS.AUTO_DEDUCT_ENABLED) === 'true',
  setAutoDeductEnabled: (e: boolean) => localStorage.setItem(KEYS.AUTO_DEDUCT_ENABLED, String(e))
};
