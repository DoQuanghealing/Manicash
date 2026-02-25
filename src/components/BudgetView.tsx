import React, { useState, useEffect } from 'react';
// Import từ các thư mục đã được gom vào src
import { Budget, Category, FixedCost, TransactionType, AllocationSetting, Wallet } from '../types';
import { CATEGORY_COLORS } from '../constants'; // Đảm bảo bạn có file index.ts hoặc sửa đúng tên file trong constants
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { StorageService } from '../services/storageService';
import { 
  Settings2, Plus, Trash2, Save, X, Edit3, AlertTriangle, CheckCircle, 
  Calendar, Zap, Wallet as WalletIcon, ArrowRight, Clock, Percent, 
  ReceiptText, BarChart3, Calculator 
} from 'lucide-react';

interface Props {
  budgets: Budget[];
  getSpent: (category: Category) => number;
  onUpdateBudgets: (newBudgets: Budget[]) => void;
  fixedCosts: FixedCost[];
  onPayFixedCost: (cost: FixedCost) => void;
  onRefresh: () => void;
}

export const BudgetView: React.FC<Props> = ({ 
  budgets, getSpent, onUpdateBudgets, fixedCosts = [], onPayFixedCost, onRefresh 
}) => {
  const [activeTab, setActiveTab] = useState<'flexible' | 'fixed'>('flexible');
  const [isEditingFlexible, setIsEditingFlexible] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationSource, setAllocationSource] = useState('');
  const [allocationConfig, setAllocationConfig] = useState<AllocationSetting[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [editingFixedCost, setEditingFixedCost] = useState<any>(null);

  useEffect(() => {
    if (isEditingFlexible) {
      setLocalBudgets(JSON.parse(JSON.stringify(budgets)));
    }
  }, [isEditingFlexible, budgets]);

  useEffect(() => {
    if (isAllocationOpen) {
      const w = StorageService.getWallets();
      setWallets(w);
      if (w.length > 0) setAllocationSource(w[0].id);
      
      const goals = StorageService.getGoals();
      const currentConfig = StorageService.getAllocationConfig();
      
      const newConfig: AllocationSetting[] = [
        ...fixedCosts.map(c => {
          const existing = currentConfig.find(s => s.itemId === c.id && s.type === 'COST');
          return { itemId: c.id, type: 'COST' as const, percentage: existing?.percentage || 0, isEnabled: existing?.isEnabled ?? true };
        }),
        ...goals.map(g => {
          const existing = currentConfig.find(s => s.itemId === g.id && s.type === 'GOAL');
          return { itemId: g.id, type: 'GOAL' as const, percentage: existing?.percentage || 0, isEnabled: existing?.isEnabled ?? true };
        })
      ];
      setAllocationConfig(newConfig);
    }
  }, [isAllocationOpen, fixedCosts]);

  const saveFlexibleEditing = () => {
    onUpdateBudgets(localBudgets);
    setIsEditingFlexible(false);
  };

  const handleUpdateLocalBudget = (category: Category, limit: string) => {
    const val = parseNumberInput(limit);
    setLocalBudgets(prev => prev.map(b => b.category === category ? { ...b, limit: val } : b));
  };

  const handleOpenFixedEdit = (cost?: FixedCost) => {
    if (cost) {
      setEditingFixedCost({ 
        ...cost, 
        amount: formatNumberInput(cost.amount) 
      });
    } else {
      setEditingFixedCost({ 
        id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
        title: '', 
        amount: '', 
        allocatedAmount: 0, 
        nextDueDate: new Date().toISOString().split('T')[0], 
        frequencyMonths: 1, 
        description: '' 
      });
    }
    setIsFixedModalOpen(true);
  };

  const handleSaveFixedCost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingFixedCost || !editingFixedCost.title.trim()) {
      alert("Vui lòng nhập tên hóa đơn!");
      return;
    }
    const numericAmount = parseNumberInput(String(editingFixedCost.amount || '0'));
    if (numericAmount <= 0) {
      alert("Vui lòng nhập số tiền hợp lệ!");
      return;
    }
    const data: FixedCost = {
      ...editingFixedCost,
      amount: numericAmount,
      title: editingFixedCost.title.trim()
    };

    try {
      const currentCosts = StorageService.getFixedCosts();
      const exists = currentCosts.some(c => c.id === data.id);
      if (exists) await StorageService.updateFixedCost(data);
      else await StorageService.addFixedCost(data);
      setIsFixedModalOpen(false);
      setEditingFixedCost(null);
      onRefresh();
    } catch (error) {
      alert("Không thể lưu hóa đơn.");
    }
  };

  const totalFlexibleLimit = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalFixedAmount = fixedCosts.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="p-6 space-y-8 pt-12 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-black text-foreground tracking-tight uppercase leading-none">{VI.budget.title}</h2>
        <div className="flex space-x-3">
             <button onClick={() => setIsAllocationOpen(true)} className="glass-card bg-secondary/10 text-secondary p-4 rounded-2xl shadow-lg active:scale-90 transition-all border-0">
                <Percent size={20} />
             </button>
             {activeTab === 'flexible' ? (
                isEditingFlexible ? (
                  <button onClick={saveFlexibleEditing} className="glass-card bg-secondary/20 text-secondary p-4 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Save size={20} /></button>
                ) : (
                  <button onClick={() => setIsEditingFlexible(true)} className="glass-card bg-primary/10 text-primary p-4 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Edit3 size={20} /></button>
                )
             ) : (
               <button onClick={() => handleOpenFixedEdit()} className="glass-card bg-primary/10 text-primary p-4 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Plus size={20} /></button>
             )}
        </div>
      </div>

      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
              <button onClick={() => { setActiveTab('flexible'); setIsEditingFlexible(false); }} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${activeTab === 'flexible' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>CHI TIÊU</button>
              <button onClick={() => { setActiveTab('fixed'); setIsEditingFlexible(false); }} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined ${activeTab === 'fixed' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>HÓA ĐƠN</button>
          </div>
      </div>

      {activeTab === 'flexible' ? (
            <div className="space-y-6">
                <div className="glass-card bg-gradient-to-br from-primary/20 via-surface/40 to-background rounded-[2.5rem] p-7 border-0 shadow-lg relative overflow-hidden group">
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                      <Calculator size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em] mb-1">Tổng nhu cầu chi tiêu</p>
                      <h3 className="text-3xl font-black text-foreground tracking-tighter leading-none">{formatVND(totalFlexibleLimit)}</h3>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(isEditingFlexible ? localBudgets : budgets).map((budget) => {
                    const spent = getSpent(budget.category);
                    const percentage = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : (spent > 0 ? 100 : 0);
                    const color = CATEGORY_COLORS[budget.category] || '#ccc';

                    return (
                        <div key={budget.category} className="glass-card liquid-glass rounded-[2.5rem] p-7 transition-all border-0 group shadow-sm">
                            <div className="flex justify-between items-center mb-5">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform" style={{ backgroundColor: `${color}15`, color: color }}>
                                        <WalletIcon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground text-[14px] uppercase tracking-tight leading-none mb-2">{(VI.category as any)[budget.category] || budget.category}</h3>
                                        {isEditingFlexible ? (
                                          <div className="flex items-center bg-foreground/5 rounded-xl px-4 py-2 border border-foreground/10">
                                            <input type="text" inputMode="numeric" className="w-24 bg-transparent text-[12px] font-bold text-foreground focus:outline-none" value={formatNumberInput(budget.limit)} onChange={(e) => handleUpdateLocalBudget(budget.category, e.target.value)} />
                                            <span className="text-[10px] opacity-40 font-bold ml-2">VND</span>
                                          </div>
                                        ) : (
                                          <p className="text-[11px] font-medium text-foreground/40 uppercase tracking-widest">{formatVND(spent)} / {formatVND(budget.limit)}</p>
                                        )}
                                    </div>
                                </div>
                                {!isEditingFlexible && (
                                  <div className="flex flex-col items-end">
                                      <span className={`text-xl font-black tracking-tight ${percentage > 90 ? 'text-danger' : percentage > 70 ? 'text-warning' : 'text-foreground'}`}>{percentage}%</span>
                                  </div>
                                )}
                            </div>
                            {!isEditingFlexible && (
                              <div className="h-3 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative">
                                  <div className="h-full rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
                              </div>
                            )}
                        </div>
                    );
                  })}
                </div>
            </div>
      ) : (
          <div className="space-y-6">
              <div className="glass-card bg-gradient-to-br from-secondary/20 via-surface/40 to-background rounded-[2.5rem] p-7 border-0 shadow-lg relative overflow-hidden group">
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center shadow-inner">
                    <BarChart3 size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em] mb-1">Tổng hóa đơn cố định</p>
                    <h3 className="text-3xl font-black text-foreground tracking-tighter leading-none">{formatVND(totalFixedAmount)}</h3>
                  </div>
                </div>
              </div>

              {fixedCosts.map(cost => {
                  const progressPercentage = cost.amount > 0 ? Math.min(100, Math.round((cost.allocatedAmount / cost.amount) * 100)) : 0;
                  return (
                    <div key={cost.id} className="glass-card liquid-glass rounded-[2.5rem] p-8 border-0 relative overflow-hidden group shadow-xl">
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-start">
                                <h3 onClick={() => handleOpenFixedEdit(cost)} className="flex-1 font-black text-2xl text-foreground uppercase tracking-tighter leading-none hover:text-primary transition-colors cursor-pointer pr-4">{cost.title}</h3>
                                <button onClick={() => { if(confirm("Xóa hóa đơn?")) { StorageService.deleteFixedCost(cost.id); onRefresh(); } }} className="p-2 text-danger/20 hover:text-danger"><Trash2 size={18} /></button>
                            </div>
                            <div><span className="text-3xl font-black text-primary tracking-tighter">{formatVND(cost.amount)}</span></div>
                        </div>
                        <button onClick={() => onPayFixedCost(cost)} className="w-full bg-foreground text-background py-5 rounded-[1.75rem] text-[12px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3">XÁC NHẬN ĐÃ CHI <ArrowRight size={18} /></button>
                    </div>
                  );
              })}
          </div>
      )}
    </div>
  );
};
