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
  
  const handlePayFixedCost = (cost: FixedCost) => {
      // FIX: Kiểm tra xem có ví nào không trước khi thanh toán
      if (wallets.length === 0) {
        alert("Bạn cần tạo ít nhất một ví tiền trước khi thanh toán hóa đơn!");
        return;
      }

      // 1. Create Transaction
      const tx: Transaction = {
          id: `tx_fix_${Date.now()}`,
          date: new Date().toISOString(),
          amount: cost.amount,
          type: TransactionType.EXPENSE,
          category: Category.BILLS,
          walletId: wallets[0].id, // Đã an toàn vì check length ở trên
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

  // Helper tính chi tiêu (giữ nguyên logic)
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

  const handleAddTransaction = async (data: Transaction) => {
    // 1. Lưu vào Storage trước
    StorageService.addTransaction(data);
    
    // 2. Cập nhật giao diện (Load lại transaction mới nhất từ storage vào state)
    // Lưu ý: refreshData() là hàm đồng bộ nhưng setState là bất đồng bộ
    const currentTransactions = StorageService.getTransactions(); 
    setTransactions(currentTransactions); // Cập nhật UI ngay lập tức

    // 3. Logic kiểm tra ngân sách (Budget Check)
    if (data.type === TransactionType.EXPENSE) {
        const budget = budgets.find(b => b.category === data.category);
        
        if (budget) {
            // FIX: Tính toán dựa trên danh sách transaction VỪA lấy từ Storage (chính xác nhất)
            // thay vì dùng hàm getSpentByCategory đang dựa vào state cũ
            const now = new Date();
            const totalSpentThisMonth = currentTransactions
                .filter(t => t.type === TransactionType.EXPENSE && t.category === data.category)
                .filter(t => {
                    const d = new Date(t.date);
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                })
                .reduce((sum, t) => sum + t.amount, 0);

            // Vì totalSpentThisMonth đã bao gồm transaction vừa thêm, nên so sánh trực tiếp
            if (totalSpentThisMonth > budget.limit) {
                const overage = totalSpentThisMonth - budget.limit;
                
                // Gọi AI (Gemini)
                try {
                    const message = await GeminiService.generateReflectionPrompt(data.category, overage);
                    setReflectionData({
                        isOpen: true,
                        message,
                        category: data.category
                    });
                } catch (error) {
                    console.error("Lỗi gọi Gemini:", error);
                }
            } else {
                // Nếu không vỡ ngân sách thì đóng modal luôn cho gọn (tùy bạn chọn)
                setIsTxModalOpen(false); 
            }
        } else {
             setIsTxModalOpen(false);
        }
    } else {
        setIsTxModalOpen(false);
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
        onClose={() => {
            setReflectionData({ ...reflectionData, isOpen: false });
            setIsTxModalOpen(false); // Đóng luôn form nhập liệu sau khi xem lời khuyên
        }}
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
