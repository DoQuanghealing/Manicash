import { Transaction, Wallet, Goal, TransactionType, Category, User, Budget, IncomeProject, FixedCost, AllocationSetting } from '../types';

// This service mimics a Google Sheets backend by using LocalStorage with a schema 
// that is easily mappable to 2D arrays (rows/columns).

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
};

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Tôi', avatar: '😎' },
  // Second user kept for legacy data structure compatibility but hidden in UI
  { id: 'u2', name: 'Partner', avatar: '👻' },
];

const INITIAL_WALLETS: Wallet[] = [
  { id: 'w1', userId: 'u1', name: "Ví chính", balance: 25000000 },
  { id: 'w2', userId: 'u1', name: "Quỹ dự phòng", balance: 10000000 },
];

const INITIAL_BUDGETS: Budget[] = [
  { category: Category.FOOD, limit: 15000000, spent: 0 },
  { category: Category.SHOPPING, limit: 5000000, spent: 0 },
  { category: Category.ENTERTAINMENT, limit: 3000000, spent: 0 },
  { category: Category.TRANSPORT, limit: 2000000, spent: 0 },
];

export const StorageService = {
  // Initialize default data if empty
  init: () => {
    if (!localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!localStorage.getItem(KEYS.WALLETS)) {
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(INITIAL_WALLETS));
    }
    if (!localStorage.getItem(KEYS.CATEGORIES)) {
      // Seed default categories from Enum
      const defaultCats = Object.values(Category);
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(defaultCats));
    }
    if (!localStorage.getItem(KEYS.BUDGETS)) {
      localStorage.setItem(KEYS.BUDGETS, JSON.stringify(INITIAL_BUDGETS));
    }
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
      // Add some dummy transactions (converted to VND scale roughly)
      const dummyTransactions: Transaction[] = [
        { id: 't1', date: new Date().toISOString(), amount: 20000000, type: TransactionType.INCOME, category: Category.INCOME, walletId: 'w1', description: 'Lương tháng', timestamp: Date.now() },
        { id: 't2', date: new Date().toISOString(), amount: 500000, type: TransactionType.EXPENSE, category: Category.FOOD, walletId: 'w1', description: 'Ăn đồ nướng', timestamp: Date.now() },
        { id: 't3', date: new Date().toISOString(), amount: 2500000, type: TransactionType.EXPENSE, category: Category.SHOPPING, walletId: 'w1', description: 'Giày mới', timestamp: Date.now() },
      ];
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(dummyTransactions));
    }
    if (!localStorage.getItem(KEYS.GOALS)) {
      const initialGoal: Goal = {
        id: 'g1',
        name: 'Mua nhà',
        targetAmount: 2000000000,
        currentAmount: 150000000,
        deadline: '2026-01-01',
        rounds: [
          { id: 'r1', date: '2024-01-15', amount: 50000000, contributorId: 'u1', note: 'Thưởng tết' },
        ]
      };
      localStorage.setItem(KEYS.GOALS, JSON.stringify([initialGoal]));
    }
    if (!localStorage.getItem(KEYS.FIXED_COSTS)) {
       // Seed default fixed costs
       const nextMonth = new Date();
       if (nextMonth.getDate() > 20) nextMonth.setMonth(nextMonth.getMonth() + 1);
       nextMonth.setDate(20);
       
       const defaultFixed: FixedCost[] = [
           { id: 'fc1', title: 'Tiền nhà', amount: 8000000, allocatedAmount: 0, nextDueDate: nextMonth.toISOString().split('T')[0], frequencyMonths: 1, description: 'Đóng ngày 20 hàng tháng' },
           { id: 'fc2', title: 'Tiền học', amount: 5000000, allocatedAmount: 0, nextDueDate: new Date(new Date().setDate(10)).toISOString().split('T')[0], frequencyMonths: 1, description: 'Đóng trước ngày 10' },
           { id: 'fc3', title: 'Wifi 6 Tháng', amount: 1200000, allocatedAmount: 200000, nextDueDate: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0], frequencyMonths: 6, description: 'Gói 6 tháng' }
       ];
       localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(defaultFixed));
    }
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    return data ? JSON.parse(data) : INITIAL_USERS;
  },

  updateUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  getCategories: (): string[] => {
    const data = localStorage.getItem(KEYS.CATEGORIES);
    if (data) return JSON.parse(data);
    return Object.values(Category);
  },

  addCategory: (newCategory: string): string[] => {
    const categories = StorageService.getCategories();
    // Check for duplicates (case insensitive)
    if (!categories.some(c => c.toLowerCase() === newCategory.trim().toLowerCase())) {
      categories.push(newCategory.trim());
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
    }
    return categories;
  },

  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem(KEYS.TRANSACTIONS);
    return data ? JSON.parse(data) : [];
  },

  addTransaction: (tx: Transaction) => {
    const txs = StorageService.getTransactions();
    txs.push(tx); // Append row
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
    
    // Update wallet balance
    const wallets = StorageService.getWallets();
    const wallet = wallets.find(w => w.id === tx.walletId);
    if (wallet) {
      if (tx.type === TransactionType.INCOME) wallet.balance += tx.amount;
      if (tx.type === TransactionType.EXPENSE) wallet.balance -= tx.amount;
      if (tx.type === TransactionType.TRANSFER) {
          wallet.balance -= tx.amount;
      }
      localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    }

    // --- AUTO DEDUCT LOGIC ---
    // If it's an INCOME transaction, check if we need to auto-transfer to Black Fund (Wallet 2)
    if (tx.type === TransactionType.INCOME) {
        const isEnabled = StorageService.getAutoDeductEnabled();
        const autoDeductPercent = StorageService.getAutoDeductPercent();
        
        if (isEnabled && autoDeductPercent > 0) {
             const wallets = StorageService.getWallets();
             const targetWallet = wallets.find(w => w.id === 'w2'); // Assuming w2 is "Quỹ dự phòng"
             
             // Only deduct if target exists and source is NOT the target (prevent loop if income goes straight to savings)
             if (targetWallet && tx.walletId !== targetWallet.id) {
                 const deductAmount = Math.floor(tx.amount * (autoDeductPercent / 100));
                 if (deductAmount > 0) {
                     // 1. Create Transfer OUT from Source
                     const transferOut: Transaction = {
                         id: `tx_auto_out_${Date.now()}`,
                         date: tx.date,
                         amount: deductAmount,
                         type: TransactionType.TRANSFER,
                         category: Category.TRANSFER,
                         walletId: tx.walletId,
                         description: `Trích quỹ dự phòng (${autoDeductPercent}%)`,
                         timestamp: Date.now() + 1
                     };
                     
                     // 2. Create Transfer IN to Target (Simulated by adding balance directly or creating INCOME-like transfer)
                     // For correct accounting, we should create a mirrored transaction or just update balance.
                     // Let's update balance of target wallet directly for simplicity in this context
                     targetWallet.balance += deductAmount;
                     localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets)); // Save updated target wallet
                     
                     // Recursive call safe because type is TRANSFER
                     StorageService.addTransaction(transferOut);
                 }
             }
        }
    }

    return wallets; // Return updated wallets
  },

  getWallets: (): Wallet[] => {
    const data = localStorage.getItem(KEYS.WALLETS);
    return data ? JSON.parse(data) : [];
  },

  getGoals: (): Goal[] => {
    const data = localStorage.getItem(KEYS.GOALS);
    return data ? JSON.parse(data) : [];
  },

  addGoal: (goal: Goal) => {
    const goals = StorageService.getGoals();
    goals.push(goal);
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
  },

  contributeToGoal: (goalId: string, walletId: string, amount: number, note: string, userId: string) => {
    // 1. Get all Data
    const goals = StorageService.getGoals();
    const wallets = StorageService.getWallets();
    const txs = StorageService.getTransactions();

    const goalIndex = goals.findIndex(g => g.id === goalId);
    const walletIndex = wallets.findIndex(w => w.id === walletId);

    if (goalIndex === -1 || walletIndex === -1) return false;

    // 2. Validation
    if (wallets[walletIndex].balance < amount) return false;

    // 3. Update Wallet (Deduct)
    wallets[walletIndex].balance -= amount;

    // 4. Update Goal (Add)
    goals[goalIndex].currentAmount += amount;
    goals[goalIndex].rounds.push({
        id: `r_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        amount: amount,
        contributorId: userId,
        note: note || 'Nạp tiền đầu tư'
    });

    // 5. Create Transaction Record (Transfer/Expense)
    // We treat this as a TRANSFER to an asset (the goal)
    txs.push({
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        amount: amount,
        type: TransactionType.TRANSFER,
        category: Category.INVESTMENT, // Or custom 'Goal' category
        walletId: walletId,
        description: `Nạp mục tiêu: ${goals[goalIndex].name}`,
        timestamp: Date.now()
    });

    // 6. Save All
    localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
    localStorage.setItem(KEYS.WALLETS, JSON.stringify(wallets));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));

    return true;
  },

  updateGoal: (updatedGoal: Goal) => {
    const goals = StorageService.getGoals();
    const index = goals.findIndex(g => g.id === updatedGoal.id);
    if (index !== -1) {
      goals[index] = updatedGoal;
      localStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
    }
  },

  getBudgets: (): Budget[] => {
    const data = localStorage.getItem(KEYS.BUDGETS);
    return data ? JSON.parse(data) : INITIAL_BUDGETS;
  },

  updateBudgets: (budgets: Budget[]) => {
    localStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
  },

  // --- INCOME PROJECTS ---
  getIncomeProjects: (): IncomeProject[] => {
    const data = localStorage.getItem(KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  addIncomeProject: (project: IncomeProject) => {
    const projects = StorageService.getIncomeProjects();
    projects.push(project);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  },

  updateIncomeProject: (updatedProject: IncomeProject) => {
    const projects = StorageService.getIncomeProjects();
    const index = projects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) {
      projects[index] = updatedProject;
      localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    }
  },

  deleteIncomeProject: (id: string) => {
    const projects = StorageService.getIncomeProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(filtered));
  },

  // --- FIXED COSTS ---
  getFixedCosts: (): FixedCost[] => {
      const data = localStorage.getItem(KEYS.FIXED_COSTS);
      const costs = data ? JSON.parse(data) : [];
      // Migration for old data
      return costs.map((c: any) => ({ ...c, allocatedAmount: c.allocatedAmount || 0 }));
  },

  addFixedCost: (cost: FixedCost) => {
      const costs = StorageService.getFixedCosts();
      costs.push(cost);
      localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs));
  },

  updateFixedCost: (updatedCost: FixedCost) => {
      const costs = StorageService.getFixedCosts();
      const index = costs.findIndex(c => c.id === updatedCost.id);
      if (index !== -1) {
          costs[index] = updatedCost;
          localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(costs));
      }
  },

  deleteFixedCost: (id: string) => {
      const costs = StorageService.getFixedCosts();
      const filtered = costs.filter(c => c.id !== id);
      localStorage.setItem(KEYS.FIXED_COSTS, JSON.stringify(filtered));
  },

  // --- ALLOCATION CONFIG ---
  getAllocationConfig: (): AllocationSetting[] => {
    const data = localStorage.getItem(KEYS.ALLOCATION_CONFIG);
    return data ? JSON.parse(data) : [];
  },

  saveAllocationConfig: (config: AllocationSetting[]) => {
    localStorage.setItem(KEYS.ALLOCATION_CONFIG, JSON.stringify(config));
  },

  // --- AUTO DEDUCT CONFIG ---
  getAutoDeductPercent: (): number => {
    const data = localStorage.getItem(KEYS.AUTO_DEDUCT_PERCENT);
    return data ? Number(data) : 10; // Default 10%
  },

  setAutoDeductPercent: (percent: number) => {
    localStorage.setItem(KEYS.AUTO_DEDUCT_PERCENT, String(percent));
  },

  getAutoDeductEnabled: (): boolean => {
    const data = localStorage.getItem(KEYS.AUTO_DEDUCT_ENABLED);
    return data === 'true'; // Default false if not set
  },

  setAutoDeductEnabled: (enabled: boolean) => {
    localStorage.setItem(KEYS.AUTO_DEDUCT_ENABLED, String(enabled));
  }
};