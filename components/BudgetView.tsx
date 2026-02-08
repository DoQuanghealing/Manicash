
import React, { useState, useEffect } from 'react';
import { Budget, Category, FixedCost, TransactionType, AllocationSetting, Wallet } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { Settings2, Plus, Trash2, Save, X, Edit3, AlertTriangle, CheckCircle, Calendar, Zap, Wallet as WalletIcon, ArrowRight, Clock, Percent } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface Props {
  budgets: Budget[];
  getSpent: (category: Category) => number;
  onUpdateBudgets: (newBudgets: Budget[]) => void;
  fixedCosts: FixedCost[];
  onPayFixedCost: (cost: FixedCost) => void;
  onRefresh: () => void;
}

export const BudgetView: React.FC<Props> = ({ budgets, getSpent, onUpdateBudgets, fixedCosts, onPayFixedCost, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'flexible' | 'fixed'>('flexible');
  const [isEditingFlexible, setIsEditingFlexible] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  
  // Allocation State
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationSource, setAllocationSource] = useState('');
  const [allocationConfig, setAllocationConfig] = useState<AllocationSetting[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  // Fixed Cost Modal State
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
      
      // Merge existing config with all current costs/goals
      const newConfig: AllocationSetting[] = [
        ...fixedCosts.map(c => {
          const existing = currentConfig.find(s => s.itemId === c.id && s.type === 'COST');
          return {
            itemId: c.id,
            type: 'COST' as const,
            percentage: existing?.percentage || 0,
            isEnabled: existing?.isEnabled ?? true
          };
        }),
        ...goals.map(g => {
          const existing = currentConfig.find(s => s.itemId === g.id && s.type === 'GOAL');
          return {
            itemId: g.id,
            type: 'GOAL' as const,
            percentage: existing?.percentage || 0,
            isEnabled: existing?.isEnabled ?? true
          };
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
      const c: any = { ...cost };
      c.amount = formatNumberInput(c.amount);
      setEditingFixedCost(c);
    } else {
      setEditingFixedCost({
        id: `fc_${Date.now()}`,
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

  const handleSaveFixedCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFixedCost?.title || !editingFixedCost.amount) return;
    
    const cost: FixedCost = {
        ...editingFixedCost,
        amount: parseNumberInput(editingFixedCost.amount)
    };
    const exists = fixedCosts.find(c => c.id === cost.id);
    
    if (exists) {
      StorageService.updateFixedCost(cost);
    } else {
      StorageService.addFixedCost(cost);
    }
    
    onRefresh();
    setIsFixedModalOpen(false);
    setEditingFixedCost(null);
  };

  const handleDeleteFixedCost = (id: string) => {
    if (confirm("Xóa hóa đơn này?")) {
      StorageService.deleteFixedCost(id);
      onRefresh();
    }
  };

  const handleUpdateAllocPercentage = (itemId: string, percentage: string) => {
    const val = Math.min(100, Math.max(0, parseInt(percentage) || 0));
    setAllocationConfig(prev => prev.map(s => s.itemId === itemId ? { ...s, percentage: val } : s));
  };

  const handleExecuteAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseNumberInput(allocationAmount);
    if (!amount || !allocationSource) return;

    const totalPerc = allocationConfig.reduce((sum, s) => sum + (s.isEnabled ? s.percentage : 0), 0);
    if (totalPerc > 100) {
      alert("Tổng phần trăm không được vượt quá 100%");
      return;
    }

    StorageService.saveAllocationConfig(allocationConfig);
    const success = StorageService.executeAllocation(amount, allocationSource);
    if (success) {
      onRefresh();
      setIsAllocationOpen(false);
      setAllocationAmount('');
      alert(VI.budget.allocation.result);
    }
  };

  const handleAllocAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAllocationAmount(formatNumberInput(e.target.value));
  };

  const handleFixedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingFixedCost({...editingFixedCost, amount: formatNumberInput(e.target.value)});
  };

  const totalAllocPercentage = allocationConfig.reduce((sum, s) => sum + (s.isEnabled ? s.percentage : 0), 0);

  return (
    <div className="p-6 space-y-8 pt-12 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-[900] text-foreground tracking-tighter uppercase">{VI.budget.title}</h2>
        <div className="flex space-x-3">
             <button 
                onClick={() => setIsAllocationOpen(true)}
                className="glass-card bg-secondary/10 text-secondary p-3.5 rounded-2xl shadow-lg active:scale-90 transition-all border-0"
             >
                <Percent size={22} />
             </button>
             {activeTab === 'flexible' ? (
                isEditingFlexible ? (
                  <button onClick={saveFlexibleEditing} className="glass-card bg-secondary/20 text-secondary p-3.5 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Save size={22} /></button>
                ) : (
                  <button onClick={() => setIsEditingFlexible(true)} className="glass-card bg-primary/10 text-primary p-3.5 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Edit3 size={22} /></button>
                )
             ) : (
               <button onClick={() => handleOpenFixedEdit()} className="glass-card bg-primary/10 text-primary p-3.5 rounded-2xl shadow-lg active:scale-90 transition-all border-0"><Plus size={22} /></button>
             )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
              <button 
                onClick={() => { setActiveTab('flexible'); setIsEditingFlexible(false); }} 
                className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'flexible' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}
              >
                CHI TIÊU
              </button>
              <button 
                onClick={() => { setActiveTab('fixed'); setIsEditingFlexible(false); }} 
                className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] ${activeTab === 'fixed' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}
              >
                HÓA ĐƠN
              </button>
          </div>
      </div>

      {activeTab === 'flexible' ? (
            <div className="space-y-4">
                {(isEditingFlexible ? localBudgets : budgets).map((budget) => {
                  const spent = getSpent(budget.category);
                  const percentage = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : (spent > 0 ? 100 : 0);
                  const color = CATEGORY_COLORS[budget.category] || '#ccc';

                  return (
                      <div key={budget.category} className="glass-card liquid-glass rounded-[2.5rem] p-6 transition-all border-0 group">
                          <div className="flex justify-between items-center mb-5">
                              <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-transform" style={{ backgroundColor: `${color}22`, color: color }}>
                                      <WalletIcon size={24} />
                                  </div>
                                  <div>
                                      <h3 className="font-[900] text-foreground text-sm uppercase tracking-tight leading-none mb-2">{VI.category[budget.category] || budget.category}</h3>
                                      {isEditingFlexible ? (
                                        <div className="flex items-center bg-foreground/5 rounded-xl px-3 py-1 border border-foreground/10">
                                          <input 
                                            type="text" 
                                            inputMode="numeric"
                                            className="w-24 bg-transparent text-[11px] font-black text-foreground focus:outline-none"
                                            value={formatNumberInput(budget.limit)}
                                            onChange={(e) => handleUpdateLocalBudget(budget.category, e.target.value)}
                                          />
                                          <span className="text-[10px] opacity-30 font-black">VND</span>
                                        </div>
                                      ) : (
                                        <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">{formatVND(spent)} / {formatVND(budget.limit)}</p>
                                      )}
                                  </div>
                              </div>
                              {!isEditingFlexible && (
                                <div className="text-right">
                                    <span className={`text-lg font-[900] tracking-tighter ${percentage > 90 ? 'text-danger' : percentage > 70 ? 'text-warning' : 'text-foreground'}`}>{percentage}%</span>
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
                {isEditingFlexible && (
                  <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsEditingFlexible(false)} className="flex-1 py-5 rounded-[1.75rem] font-black text-[10px] uppercase tracking-widest bg-foreground/5 text-foreground/40">HỦY</button>
                    <button onClick={saveFlexibleEditing} className="flex-[2] py-5 rounded-[1.75rem] font-black text-[10px] uppercase tracking-widest bg-primary text-white shadow-xl neon-glow-primary">LƯU THAY ĐỔI</button>
                  </div>
                )}
            </div>
      ) : (
          <div className="space-y-5">
              {fixedCosts.length === 0 ? (
                <div className="glass-card rounded-[2.5rem] p-16 text-center border-0 opacity-50">
                  <Clock size={48} className="mx-auto mb-4 text-foreground/20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Chưa có hóa đơn nào</p>
                </div>
              ) : fixedCosts.map(cost => {
                  const progressPercentage = cost.amount > 0 ? Math.min(100, Math.round((cost.allocatedAmount / cost.amount) * 100)) : 0;
                  return (
                    <div key={cost.id} className="glass-card liquid-glass rounded-[2.5rem] p-7 border-0 relative overflow-hidden group">
                        <div className="space-y-2 mb-6">
                            {/* Dòng 1: Tên hóa đơn */}
                            <h3 onClick={() => handleOpenFixedEdit(cost)} className="font-[1000] text-xl text-foreground uppercase tracking-tighter leading-none hover:text-primary transition-colors cursor-pointer">{cost.title}</h3>
                            
                            {/* Dòng 2: Số tiền */}
                            <div>
                                <span className="text-2xl font-[1000] text-primary tracking-tighter">{formatVND(cost.amount)}</span>
                            </div>

                            {/* Dòng 3: Hạn đóng tiếp theo */}
                            <div className="flex items-center gap-2 text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">
                                <Calendar size={12} />
                                <span>Hạn đóng tiếp: {new Date(cost.nextDueDate).toLocaleDateString('vi-VN')}</span>
                            </div>

                            {/* Dòng 4: Tần suất (Xanh lá) */}
                            <div className="flex items-center gap-2 text-[10px] font-black text-secondary uppercase tracking-[0.2em] pt-1">
                                <Clock size={12} />
                                <span>{cost.frequencyMonths} tháng / lần</span>
                            </div>
                        </div>
                        
                        {/* Dòng 5: Tiến độ tích lũy */}
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between items-center text-[9px] font-black text-foreground/30 uppercase tracking-widest px-1">
                                <span>Tiến độ tích lũy</span>
                                <span className="text-secondary">{progressPercentage}%</span>
                            </div>
                            
                            {/* Dòng 6: Thanh tích lũy (Xanh lá) */}
                            <div className="h-2.5 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative">
                                <div 
                                    className="h-full bg-secondary rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.4)]" 
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={() => onPayFixedCost(cost)} 
                            className="flex-[3] bg-primary text-white py-5 rounded-[1.75rem] text-[11px] font-[900] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-xl neon-glow-primary flex items-center justify-center gap-3"
                          >
                            THANH TOÁN <ArrowRight size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteFixedCost(cost.id)}
                            className="flex-1 bg-danger/10 text-danger py-5 rounded-[1.75rem] flex items-center justify-center active:scale-95 transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                    </div>
                  );
              })}
              <button onClick={() => handleOpenFixedEdit()} className="w-full py-7 glass-card bg-foreground/[0.02] rounded-[2.5rem] border-dashed border-foreground/20 text-foreground/30 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-foreground/[0.05] transition-all border-2">
                + THÊM HÓA ĐƠN ĐỊNH KỲ
              </button>
          </div>
      )}

      {/* ALLOCATION MODAL ... existing code ... */}
      {isAllocationOpen && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-6">
           <div className="glass-card w-full max-w-md h-[85vh] sm:h-auto flex flex-col rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 border-0 bg-surface">
               <div className="flex justify-between items-center mb-8">
                   <div>
                        <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">{VI.budget.allocation.title}</h3>
                        <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mt-1">{VI.budget.allocation.subtitle}</p>
                   </div>
                   <button onClick={() => setIsAllocationOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground/40"><X size={22} /></button>
               </div>
               <form onSubmit={handleExecuteAllocation} className="flex-1 overflow-y-auto no-scrollbar space-y-8 pr-2">
                   <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">{VI.budget.allocation.inputLabel}</label>
                          <input 
                              type="text"
                              inputMode="numeric"
                              required autoFocus
                              className="w-full bg-foreground/5 text-secondary text-3xl font-[900] p-6 rounded-[2rem] focus:outline-none tracking-tighter"
                              placeholder="0"
                              value={allocationAmount}
                              onChange={handleAllocAmountChange}
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Nhận về Ví</label>
                          <select 
                            className="w-full bg-foreground/5 text-foreground font-black p-5 rounded-[1.75rem] focus:outline-none appearance-none uppercase text-xs"
                            value={allocationSource}
                            onChange={(e) => setAllocationSource(e.target.value)}
                          >
                             {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>)}
                          </select>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex justify-between items-center px-2">
                        <h4 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em]">{VI.budget.allocation.tableHeader}</h4>
                        <span className={`text-[10px] font-black uppercase ${totalAllocPercentage > 100 ? 'text-danger' : 'text-primary'}`}>{totalAllocPercentage}% / 100%</span>
                      </div>
                      <div className="space-y-3">
                          {allocationConfig.map((item, idx) => {
                              const label = item.type === 'COST' 
                                ? fixedCosts.find(c => c.id === item.itemId)?.title 
                                : StorageService.getGoals().find(g => g.id === item.itemId)?.name;
                              
                              return (
                                  <div key={`${item.type}-${item.itemId}`} className="flex items-center gap-4 bg-foreground/[0.03] p-4 rounded-2xl">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-black ${item.type === 'COST' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'}`}>
                                          {item.type === 'COST' ? 'BILL' : 'GOAL'}
                                      </div>
                                      <span className="flex-1 text-[11px] font-[900] text-foreground/70 uppercase truncate">{label}</span>
                                      <div className="flex items-center gap-2 bg-foreground/5 rounded-xl px-3 py-2 border border-foreground/10">
                                          <input 
                                              type="number"
                                              className="w-10 bg-transparent text-[11px] font-black text-foreground focus:outline-none text-right"
                                              value={item.percentage}
                                              onChange={(e) => handleUpdateAllocPercentage(item.itemId, e.target.value)}
                                          />
                                          <span className="text-[10px] opacity-20">%</span>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                   </div>

                   <button type="submit" className="w-full bg-primary text-white font-[900] py-6 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-xl neon-glow-primary active:scale-95 transition-all">
                       {VI.budget.allocation.confirm}
                   </button>
               </form>
           </div>
        </div>
      )}

      {/* FIXED COST EDIT MODAL ... existing code ... */}
      {isFixedModalOpen && editingFixedCost && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-6">
           <div className="glass-card w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 border-0 bg-surface">
               <div className="flex justify-between items-center mb-8">
                   <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">HÓA ĐƠN CỐ ĐỊNH</h3>
                   <button onClick={() => setIsFixedModalOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground/40"><X size={22} /></button>
               </div>
               <form onSubmit={handleSaveFixedCost} className="space-y-6">
                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên hóa đơn</label>
                       <input 
                          type="text" required
                          className="w-full bg-foreground/5 text-foreground font-[800] p-4 rounded-2xl focus:ring-2 focus:ring-primary focus:outline-none uppercase text-sm"
                          value={editingFixedCost.title}
                          onChange={(e) => setEditingFixedCost({...editingFixedCost, title: e.target.value})}
                       />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Số tiền (VND)</label>
                          <input 
                              type="text"
                              inputMode="numeric"
                              required
                              className="w-full bg-foreground/5 text-secondary text-lg font-[900] p-4 rounded-2xl focus:outline-none"
                              value={editingFixedCost.amount}
                              onChange={handleFixedAmountChange}
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Kỳ hạn (tháng)</label>
                          <input 
                              type="number" required
                              className="w-full bg-foreground/5 text-foreground font-black p-4 rounded-2xl focus:outline-none"
                              value={editingFixedCost.frequencyMonths}
                              onChange={(e) => setEditingFixedCost({...editingFixedCost, frequencyMonths: parseInt(e.target.value) || 1})}
                          />
                      </div>
                   </div>
                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Ngày đến hạn tiếp theo</label>
                       <input 
                          type="date" required
                          className="w-full bg-foreground/5 text-foreground font-black p-4 rounded-2xl focus:outline-none"
                          value={editingFixedCost.nextDueDate}
                          onChange={(e) => setEditingFixedCost({...editingFixedCost, nextDueDate: e.target.value})}
                       />
                   </div>
                   <button type="submit" className="w-full bg-primary text-white font-[900] py-6 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] shadow-xl neon-glow-primary">
                       LƯU THÔNG TIN
                   </button>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};
