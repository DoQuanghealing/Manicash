
import React, { useState, useEffect } from 'react';
import { Budget, Category, FixedCost, TransactionType, AllocationSetting, Wallet } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { Settings2, Plus, Trash2, Save, X, Edit3, AlertTriangle, CheckCircle, Calendar, Zap, Wallet as WalletIcon, ArrowRight, Clock, Percent, ReceiptText, BarChart3, Calculator } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface Props {
  budgets: Budget[];
  getSpent: (category: Category) => number;
  onUpdateBudgets: (newBudgets: Budget[]) => void;
  fixedCosts: FixedCost[];
  onPayFixedCost: (cost: FixedCost) => void;
  onRefresh: () => void;
}

export const BudgetView: React.FC<Props> = ({ budgets, getSpent, onUpdateBudgets, fixedCosts = [], onPayFixedCost, onRefresh }) => {
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
      
      if (exists) {
        await StorageService.updateFixedCost(data);
      } else {
        await StorageService.addFixedCost(data);
      }

      setIsFixedModalOpen(false);
      setEditingFixedCost(null);
      onRefresh();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Không thể lưu hóa đơn. Vui lòng thử lại.");
    }
  };

  // Tính toán tổng ngân sách
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
                {/* Tổng nhu cầu chi tiêu */}
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
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
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
                                  <div className="text-right">
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
              {/* Tổng hóa đơn cố định */}
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
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
              </div>

              {fixedCosts.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                   <div className="w-20 h-20 bg-foreground/5 rounded-[2rem] flex items-center justify-center mx-auto text-foreground/10">
                      <ReceiptText size={40} />
                   </div>
                   <p className="text-[11px] font-black text-foreground/20 uppercase tracking-widest leading-relaxed">Chưa có hóa đơn định kỳ.<br/>Nhấn "+" để bắt đầu cất giữ.</p>
                </div>
              ) : (
                fixedCosts.map(cost => {
                    const progressPercentage = cost.amount > 0 ? Math.min(100, Math.round((cost.allocatedAmount / cost.amount) * 100)) : 0;
                    return (
                      <div key={cost.id} className="glass-card liquid-glass rounded-[2.5rem] p-8 border-0 relative overflow-hidden group shadow-xl bg-gradient-to-br from-surface/80 to-background/40">
                          <div className="space-y-4 mb-8">
                              <div className="flex justify-between items-start">
                                  <h3 onClick={() => handleOpenFixedEdit(cost)} className="flex-1 font-black text-2xl text-foreground uppercase tracking-tighter leading-none hover:text-primary transition-colors cursor-pointer pr-4 break-words">{cost.title}</h3>
                                  <button onClick={() => { if(confirm("Xóa hóa đơn?")) { StorageService.deleteFixedCost(cost.id); onRefresh(); } }} className="p-2 text-danger/20 hover:text-danger transition-colors"><Trash2 size={18} /></button>
                              </div>
                              <div>
                                  <span className="text-3xl font-black text-primary tracking-tighter">{formatVND(cost.amount)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="flex items-center gap-3 text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                                    <Calendar size={14} className="text-warning" />
                                    <span>Hạn: {new Date(cost.nextDueDate).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-foreground/30 uppercase tracking-widest">
                                    <Clock size={14} className="text-secondary" />
                                    <span>{cost.frequencyMonths} tháng/lần</span>
                                </div>
                              </div>
                          </div>
                          
                          <div className="space-y-3 mb-8">
                              <div className="flex justify-between items-center text-[10px] font-black text-foreground/40 uppercase tracking-widest px-1">
                                  <span>Tiến độ tích lũy</span>
                                  <span className={progressPercentage >= 100 ? 'text-secondary' : 'text-primary'}>{formatVND(cost.allocatedAmount)} ({progressPercentage}%)</span>
                              </div>
                              <div className="h-4 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner relative border border-foreground/5">
                                  <div className={`h-full rounded-full transition-all duration-700 shadow-lg ${progressPercentage >= 100 ? 'bg-secondary' : 'bg-primary'}`} style={{ width: `${progressPercentage}%` }}></div>
                              </div>
                          </div>

                          <button 
                            onClick={() => onPayFixedCost(cost)} 
                            className="w-full bg-foreground text-background py-5 rounded-[1.75rem] text-[12px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3"
                          >
                            XÁC NHẬN ĐÃ CHI <ArrowRight size={18} />
                          </button>
                      </div>
                    );
                })
              )}
              <button onClick={() => handleOpenFixedEdit()} className="w-full py-10 glass-card bg-foreground/[0.02] rounded-[2.5rem] border-2 border-dashed border-foreground/10 text-foreground/30 font-black text-[11px] uppercase tracking-[0.3em] hover:bg-foreground/[0.05] transition-all flex items-center justify-center gap-3">
                <Plus size={20} strokeWidth={3} /> Thêm hóa đơn mới
              </button>
          </div>
      )}

      {/* ALLOCATION MODAL */}
      {isAllocationOpen && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-6">
           <div className="glass-card w-[92%] max-w-[420px] h-[85vh] sm:h-auto flex flex-col rounded-[3rem] p-10 shadow-2xl bg-surface animate-in slide-in-from-bottom duration-500 border-0">
               <div className="flex justify-between items-center mb-10 shrink-0">
                   <div>
                        <h3 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">Phân bổ dòng tiền</h3>
                        <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em] mt-2">{VI.budget.allocation.subtitle}</p>
                   </div>
                   <button onClick={() => setIsAllocationOpen(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground/40"><X size={22} /></button>
               </div>
               <form onSubmit={(e) => {
                   e.preventDefault();
                   const amount = parseNumberInput(allocationAmount);
                   if (!amount || !allocationSource) return;
                   const totalPerc = allocationConfig.reduce((sum, s) => sum + (s.isEnabled ? s.percentage : 0), 0);
                   if (totalPerc > 100) { alert("Tổng phần trăm không được vượt quá 100%"); return; }
                   StorageService.saveAllocationConfig(allocationConfig);
                   if (StorageService.executeAllocation(amount, allocationSource)) { onRefresh(); setIsAllocationOpen(false); setAllocationAmount(''); alert(VI.budget.allocation.result); }
               }} className="flex-1 overflow-y-auto no-scrollbar space-y-10 pr-2">
                   <div className="space-y-6">
                      <div className="space-y-2.5">
                          <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">Số tiền nhận vào</label>
                          <input type="text" inputMode="numeric" required autoFocus className="w-full bg-foreground/5 text-secondary text-4xl font-black p-8 rounded-[2.5rem] focus:outline-none tracking-tight border-0 shadow-inner" placeholder="0" value={allocationAmount} onChange={(e) => setAllocationAmount(formatNumberInput(e.target.value))} />
                      </div>
                      <div className="space-y-2.5">
                          <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">Nhận về ví</label>
                          <select className="w-full bg-foreground/5 text-foreground font-black p-5 rounded-2xl focus:outline-none appearance-none uppercase text-[12px] border-0 shadow-inner" value={allocationSource} onChange={(e) => setAllocationSource(e.target.value)}>
                             {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>)}
                          </select>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="flex justify-between items-center px-2">
                        <h4 className="text-[10px] font-black text-foreground/40 uppercase tracking-refined">Danh mục phân bổ</h4>
                        <span className={`text-[11px] font-black uppercase ${allocationConfig.reduce((sum, s) => sum + (s.isEnabled ? s.percentage : 0), 0) > 100 ? 'text-danger' : 'text-primary'}`}>{allocationConfig.reduce((sum, s) => sum + (s.isEnabled ? s.percentage : 0), 0)}% / 100%</span>
                      </div>
                      <div className="space-y-3">
                          {allocationConfig.map((item) => (
                              <div key={`${item.type}-${item.itemId}`} className="flex items-center gap-5 bg-foreground/[0.03] p-5 rounded-[1.75rem] border-0">
                                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-black ${item.type === 'COST' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'}`}>{item.type === 'COST' ? 'BILL' : 'GOAL'}</div>
                                  <span className="flex-1 text-[13px] font-bold text-foreground/70 uppercase truncate tracking-tight">{item.type === 'COST' ? fixedCosts.find(c => c.id === item.itemId)?.title : StorageService.getGoals().find(g => g.id === item.itemId)?.name}</span>
                                  <div className="flex items-center gap-2 bg-foreground/5 rounded-xl px-4 py-2.5 border border-foreground/10">
                                      <input type="number" className="w-10 bg-transparent text-[13px] font-black text-foreground focus:outline-none text-right" value={item.percentage} onChange={(e) => {
                                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                          setAllocationConfig(prev => prev.map(s => s.itemId === item.itemId ? { ...s, percentage: val } : s));
                                      }} />
                                      <span className="text-[10px] opacity-30">%</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                   </div>

                   <button type="submit" className="w-full bg-primary text-white font-black py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.3em] shadow-2xl neon-glow-primary active:scale-95 transition-all mb-10">Thực hiện phân bổ</button>
               </form>
           </div>
        </div>
      )}

      {/* FIXED COST EDIT MODAL */}
      {isFixedModalOpen && editingFixedCost && (
        <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6">
           <div className="glass-card w-[92%] max-w-[420px] h-[90vh] sm:h-auto flex flex-col rounded-[3.5rem] shadow-2xl bg-surface animate-in slide-in-from-bottom duration-500 border-0 relative overflow-hidden box-border">
               
               <div className="flex justify-between items-center p-8 pb-4 shrink-0 bg-surface/80 backdrop-blur-md z-10">
                   <div>
                        <h3 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">Cấu hình hóa đơn</h3>
                        <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em] mt-2 leading-[1.5]">Đảm bảo dòng tiền nền tảng</p>
                   </div>
                   <button onClick={() => { setIsFixedModalOpen(false); setEditingFixedCost(null); }} className="p-3 bg-foreground/5 rounded-2xl text-foreground/40 active:scale-90 transition-all"><X size={22} /></button>
               </div>
               
               <form onSubmit={handleSaveFixedCost} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-8 pb-32 pt-2">
                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">Tên hóa đơn</label>
                          <div className="relative group">
                              <ReceiptText size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-primary transition-colors" />
                              <input 
                                type="text" 
                                required 
                                autoFocus 
                                className="w-full bg-foreground/[0.03] text-foreground p-5 pl-14 rounded-[1.5rem] font-bold focus:ring-2 focus:ring-primary focus:outline-none uppercase text-sm border-0 shadow-inner block" 
                                placeholder="VD: TIỀN NHÀ, ĐIỆN NƯỚC..." 
                                value={editingFixedCost.title} 
                                onChange={e => setEditingFixedCost({...editingFixedCost, title: e.target.value})} 
                              />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">Số tiền dự kiến (VND)</label>
                          <div className="relative">
                              <input 
                                type="text" 
                                inputMode="numeric" 
                                required 
                                className="w-full bg-foreground/[0.03] text-primary text-3xl font-semibold p-6 rounded-[2rem] focus:outline-none tracking-tighter border-0 shadow-inner block placeholder:text-primary/10" 
                                placeholder="0"
                                value={editingFixedCost.amount} 
                                onChange={e => setEditingFixedCost({...editingFixedCost, amount: formatNumberInput(e.target.value)})} 
                              />
                              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-primary/40 font-black">đ</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <div className="flex items-center gap-1.5 ml-2 mb-1">
                                <Calendar size={12} className="text-warning" />
                                <label className="text-[10px] font-bold text-foreground/30 tracking-widest uppercase">Ngày đóng tiếp</label>
                              </div>
                              <input 
                                type="date" 
                                required 
                                className="w-full bg-foreground/[0.03] text-foreground p-4 rounded-2xl font-bold focus:outline-none text-[12px] border-0 block shadow-inner" 
                                value={editingFixedCost.nextDueDate} 
                                onChange={e => setEditingFixedCost({...editingFixedCost, nextDueDate: e.target.value})} 
                              />
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">Chu kỳ (Tháng)</label>
                              <input 
                                type="number" 
                                required 
                                min="1" 
                                className="w-full bg-foreground/[0.03] text-foreground p-4 rounded-2xl font-bold focus:outline-none text-[12px] border-0 block shadow-inner" 
                                value={editingFixedCost.frequencyMonths} 
                                onChange={e => setEditingFixedCost({...editingFixedCost, frequencyMonths: parseInt(e.target.value) || 1})} 
                              />
                          </div>
                      </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-8 bg-surface/90 backdrop-blur-md border-t border-foreground/5 z-[300]">
                      <button 
                        type="submit"
                        className="w-full bg-primary text-white font-[1000] py-6 rounded-[2.25rem] text-[13px] uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(139,92,246,0.4)] neon-glow-primary active:scale-95 transition-all border border-white/20"
                      >
                        LƯU HÓA ĐƠN
                      </button>
                  </div>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};
