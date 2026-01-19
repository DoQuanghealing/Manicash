import React, { useState, useEffect } from 'react';
import { Budget, Category, FixedCost, Goal, AllocationSetting } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { Settings2, Plus, Trash2, Save, X, Edit3, AlertTriangle, CheckCircle, Calendar, Clock, Zap, Wallet } from 'lucide-react';
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
  
  // Flexible Budget State
  const [isEditing, setIsEditing] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  const [newCategoryToAdd, setNewCategoryToAdd] = useState<string>('');
  
  // Fixed Cost State
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [newCost, setNewCost] = useState<Partial<FixedCost>>({
      title: '',
      amount: 0,
      nextDueDate: '',
      frequencyMonths: 1
  });

  // Allocation State
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocSourceAmount, setAllocSourceAmount] = useState<string>('');
  const [allocSourceWallet, setAllocSourceWallet] = useState<string>('');
  const [allocationItems, setAllocationItems] = useState<AllocationSetting[]>([]);

  // --- HELPER: Available categories to add ---
  const allCategories = StorageService.getCategories();
  const availableToAdd = allCategories.filter(
      c => !localBudgets.find(b => b.category === c) && c !== Category.INCOME && c !== Category.TRANSFER
  );

  // --- HANDLERS: Flexible Budget ---
  const startEditing = () => {
    setLocalBudgets(JSON.parse(JSON.stringify(budgets))); // Deep copy
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setNewCategoryToAdd('');
  };

  const saveEditing = () => {
    onUpdateBudgets(localBudgets);
    setIsEditing(false);
    setNewCategoryToAdd('');
  };

  const handleAmountChange = (index: number, val: string) => {
      const newB = [...localBudgets];
      newB[index].limit = parseFloat(val) || 0;
      setLocalBudgets(newB);
  };

  const handleRemoveBudget = (index: number) => {
      const newB = [...localBudgets];
      newB.splice(index, 1);
      setLocalBudgets(newB);
  };

  const handleAddBudget = () => {
      if (!newCategoryToAdd) return;
      setLocalBudgets([
          ...localBudgets,
          { category: newCategoryToAdd as Category, limit: 1000000, spent: 0 } // Default 1M VND
      ]);
      setNewCategoryToAdd('');
  };

  // --- HANDLERS: Fixed Cost ---
  const handleSaveFixedCost = () => {
      if (!newCost.title || !newCost.amount || !newCost.nextDueDate) return;
      
      const cost: FixedCost = {
          id: `fc_${Date.now()}`,
          title: newCost.title,
          amount: Number(newCost.amount),
          allocatedAmount: 0,
          nextDueDate: newCost.nextDueDate,
          frequencyMonths: Number(newCost.frequencyMonths) || 1,
          description: ''
      };
      
      StorageService.addFixedCost(cost);
      onRefresh();
      setIsAddingCost(false);
      setNewCost({ title: '', amount: 0, nextDueDate: '', frequencyMonths: 1 });
  };

  const handleDeleteFixedCost = (id: string) => {
      if (confirm('Xóa hóa đơn này?')) {
          StorageService.deleteFixedCost(id);
          onRefresh();
      }
  };

  const handlePayClick = (cost: FixedCost) => {
      if (confirm(VI.budget.fixed.paidConfirm)) {
          onPayFixedCost(cost);
      }
  };

  const getDaysLeft = (dateStr: string) => {
      const diff = new Date(dateStr).getTime() - new Date().getTime();
      return Math.ceil(diff / (1000 * 3600 * 24));
  };

  // --- HANDLERS: Auto Allocation ---
  const openAllocationModal = () => {
      const goals = StorageService.getGoals();
      const currentCosts = StorageService.getFixedCosts();
      const savedConfig = StorageService.getAllocationConfig();
      const wallets = StorageService.getWallets();
      
      if (wallets.length > 0) setAllocSourceWallet(wallets[0].id);

      // Merge current items with saved config to preserve percentages
      const items: AllocationSetting[] = [];

      // Add Costs
      currentCosts.forEach(c => {
          const saved = savedConfig.find(s => s.itemId === c.id);
          items.push({
              itemId: c.id,
              type: 'COST',
              percentage: saved ? saved.percentage : 0,
              isEnabled: saved ? saved.isEnabled : false
          });
      });

      // Add Goals
      goals.forEach(g => {
          const saved = savedConfig.find(s => s.itemId === g.id);
          items.push({
              itemId: g.id,
              type: 'GOAL',
              percentage: saved ? saved.percentage : 0,
              isEnabled: saved ? saved.isEnabled : false
          });
      });

      setAllocationItems(items);
      setIsAllocating(true);
  };

  const toggleAllocationItem = (index: number) => {
      const newItems = [...allocationItems];
      newItems[index].isEnabled = !newItems[index].isEnabled;
      setAllocationItems(newItems);
  };

  const updateAllocationPercent = (index: number, val: string) => {
      const newItems = [...allocationItems];
      newItems[index].percentage = Math.min(100, Math.max(0, Number(val)));
      setAllocationItems(newItems);
  };

  const executeAllocation = () => {
      const amount = Number(allocSourceAmount);
      if (amount <= 0) {
          alert(VI.budget.allocation.error);
          return;
      }
      if (!allocSourceWallet) {
          alert(VI.budget.allocation.noSource);
          return;
      }

      const activeItems = allocationItems.filter(i => i.isEnabled && i.percentage > 0);
      const wallets = StorageService.getWallets();
      const wallet = wallets.find(w => w.id === allocSourceWallet);
      
      if (!wallet) return;

      // Check balance for Goals (Costs are virtual allocation, Goals are real transfers)
      const totalGoalTransfer = activeItems
        .filter(i => i.type === 'GOAL')
        .reduce((sum, i) => sum + (amount * i.percentage / 100), 0);
        
      if (wallet.balance < totalGoalTransfer) {
          alert(`Số dư ví không đủ để chuyển vào các mục tiêu (${formatVND(totalGoalTransfer)})`);
          return;
      }

      // Execute
      activeItems.forEach(item => {
          const itemAmount = Math.floor(amount * (item.percentage / 100));
          if (itemAmount <= 0) return;

          if (item.type === 'GOAL') {
              StorageService.contributeToGoal(
                  item.itemId, 
                  allocSourceWallet, 
                  itemAmount, 
                  'Phân bổ tự động', 
                  wallet.userId
              );
          } else {
              // Update Fixed Cost Allocated Amount (Virtual)
              const costs = StorageService.getFixedCosts();
              const cost = costs.find(c => c.id === item.itemId);
              if (cost) {
                  cost.allocatedAmount = (cost.allocatedAmount || 0) + itemAmount;
                  StorageService.updateFixedCost(cost);
              }
          }
      });

      // Save Config
      StorageService.saveAllocationConfig(allocationItems);
      
      alert(VI.budget.allocation.result);
      onRefresh();
      setIsAllocating(false);
      setAllocSourceAmount('');
  };

  const getItemName = (id: string, type: 'GOAL' | 'COST') => {
      if (type === 'GOAL') return StorageService.getGoals().find(g => g.id === id)?.name || id;
      return StorageService.getFixedCosts().find(c => c.id === id)?.title || id;
  };

  return (
    <div className="p-4 space-y-6 pt-8 pb-24">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-white">{VI.budget.title}</h2>
        
        <div className="flex space-x-2">
             <button 
                onClick={openAllocationModal}
                className="flex items-center space-x-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform"
            >
                <Zap size={14} fill="currentColor" />
                <span>{VI.budget.allocation.btn}</span>
            </button>

            {activeTab === 'flexible' && !isEditing && (
                <button 
                    onClick={startEditing}
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
                >
                    <Edit3 size={20} />
                </button>
            )}
            {activeTab === 'flexible' && isEditing && (
                <div className="flex space-x-2">
                    <button onClick={cancelEditing} className="p-2 bg-white/5 rounded-full text-zinc-400">
                        <X size={20} />
                    </button>
                    <button onClick={saveEditing} className="p-2 bg-emerald-500 rounded-full text-white shadow-lg shadow-emerald-500/20">
                        <Save size={20} />
                    </button>
                </div>
            )}
            {activeTab === 'fixed' && (
                <button 
                    onClick={() => setIsAddingCost(true)}
                    className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full hover:bg-emerald-500/30 transition-colors"
                >
                    <Plus size={20} />
                </button>
            )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-black/30 rounded-xl border border-white/5">
          <button 
            onClick={() => setActiveTab('flexible')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'flexible' ? 'bg-surfaceHighlight text-white shadow' : 'text-zinc-500'}`}
          >
              {VI.budget.tabs.flexible}
          </button>
          <button 
            onClick={() => setActiveTab('fixed')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'fixed' ? 'bg-surfaceHighlight text-white shadow' : 'text-zinc-500'}`}
          >
              {VI.budget.tabs.fixed}
          </button>
      </div>

      {activeTab === 'flexible' ? (
          /* --- FLEXIBLE BUDGET VIEW --- */
          !isEditing ? (
            <div className="space-y-5">
                {budgets.map((budget) => {
                const spent = getSpent(budget.category);
                const percentage = budget.limit > 0 ? Math.min(100, Math.round((spent / budget.limit) * 100)) : 100;
                const isOver = spent > budget.limit;
                const isWarning = !isOver && percentage >= 70;
                const color = CATEGORY_COLORS[budget.category] || '#ccc';

                return (
                    <div key={budget.category} className="bg-surface rounded-2xl p-4 border border-white/5">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner" style={{ backgroundColor: `${color}20`, color: color }}>
                            {(VI.category as any)[budget.category] ? '🏷️' : '🏷️'} 
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-100">{VI.category[budget.category] || budget.category}</h3>
                            <p className="text-xs text-zinc-500">
                            {formatVND(spent)} / {formatVND(budget.limit)}
                            </p>
                        </div>
                        </div>
                        <div className="text-right">
                        <span className={`text-sm font-bold ${isOver ? 'text-danger' : isWarning ? 'text-warning' : 'text-zinc-300'}`}>
                            {percentage}%
                        </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden relative">
                        <div 
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${isOver ? 'bg-danger animate-pulse' : isWarning ? 'bg-warning' : ''}`}
                        style={{ width: `${percentage}%`, backgroundColor: (isOver || isWarning) ? undefined : color }}
                        />
                    </div>
                    
                    {isOver && (
                        <p className="text-xs text-danger mt-2 flex items-center font-medium">
                        <AlertTriangle size={12} className="mr-1" />
                        {VI.budget.limitExceeded} {formatVND(spent - budget.limit)}
                        </p>
                    )}
                    {isWarning && (
                        <p className="text-xs text-warning mt-2 flex items-center font-medium">
                        <AlertTriangle size={12} className="mr-1" />
                        {VI.budget.warning}
                        </p>
                    )}
                    </div>
                );
                })}
            </div>
          ) : (
              /* --- EDIT MODE --- */
              <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-surfaceHighlight/50 p-3 rounded-xl border border-dashed border-white/10 text-center mb-4">
                      <span className="text-xs text-zinc-400">{VI.budget.edit}</span>
                  </div>

                  {localBudgets.map((budget, idx) => (
                      <div key={budget.category} className="bg-surface rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-3">
                          <div className="flex-1">
                              <label className="text-xs text-zinc-500 block mb-1">{VI.category[budget.category] || budget.category}</label>
                              <input 
                                  type="number" 
                                  value={budget.limit}
                                  onChange={(e) => handleAmountChange(idx, e.target.value)}
                                  className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white font-bold focus:border-primary focus:outline-none"
                                  placeholder={VI.budget.placeholderLimit}
                              />
                          </div>
                          <button 
                              onClick={() => handleRemoveBudget(idx)}
                              className="p-3 bg-red-500/10 text-red-500 rounded-xl mt-4 hover:bg-red-500/20"
                          >
                              <Trash2 size={20} />
                          </button>
                      </div>
                  ))}

                  {/* Add New Budget Section */}
                  <div className="bg-surface rounded-2xl p-4 border border-dashed border-white/20 mt-4">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase mb-3">{VI.budget.addBudget}</h4>
                      <div className="flex gap-2">
                          <select 
                              value={newCategoryToAdd}
                              onChange={(e) => setNewCategoryToAdd(e.target.value)}
                              className="flex-1 bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none"
                          >
                              <option value="">{VI.budget.selectCategory}</option>
                              {availableToAdd.map(c => (
                                  <option key={c} value={c}>{VI.category[c as keyof typeof VI.category] || c}</option>
                              ))}
                          </select>
                          <button 
                              onClick={handleAddBudget}
                              disabled={!newCategoryToAdd}
                              className="bg-primary disabled:bg-zinc-700 text-white px-4 rounded-xl font-bold shadow-lg shadow-violet-500/20 disabled:shadow-none"
                          >
                              <Plus size={24} />
                          </button>
                      </div>
                  </div>
              </div>
          )
      ) : (
          /* --- FIXED COSTS VIEW --- */
          <div className="space-y-4">
              {fixedCosts.length === 0 && (
                  <div className="text-center py-10 text-zinc-500">
                      <Clock size={40} className="mx-auto mb-3 opacity-30" />
                      <p>{VI.budget.fixed.empty}</p>
                  </div>
              )}
              {fixedCosts
                  .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
                  .map(cost => {
                      const days = getDaysLeft(cost.nextDueDate);
                      const isOverdue = days < 0;
                      const isNear = days >= 0 && days <= 3;
                      const isToday = days === 0;
                      
                      const savedPercent = Math.min(100, Math.round((cost.allocatedAmount / cost.amount) * 100));

                      return (
                          <div key={cost.id} className="bg-surface border border-white/10 rounded-2xl p-4 relative overflow-hidden group">
                              {/* Status Indicator Bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${isOverdue ? 'bg-danger' : isNear ? 'bg-warning' : 'bg-emerald-500'}`}></div>
                              
                              <div className="pl-3 flex justify-between items-start mb-3">
                                  <div>
                                      <h3 className="font-bold text-white text-lg">{cost.title}</h3>
                                      <div className="flex items-center space-x-2 text-xs mt-1">
                                          <span className={`flex items-center font-bold ${isOverdue ? 'text-danger' : isNear ? 'text-warning' : 'text-zinc-400'}`}>
                                              <Calendar size={12} className="mr-1" />
                                              {isToday ? VI.budget.fixed.today : isOverdue ? `${VI.budget.fixed.overdue} ${Math.abs(days)} ngày` : `${days} ${VI.budget.fixed.daysLeft}`}
                                          </span>
                                          <span className="text-zinc-600">•</span>
                                          <span className="text-zinc-500">
                                              {new Date(cost.nextDueDate).toLocaleDateString('vi-VN')}
                                          </span>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="font-bold text-white text-lg">{formatVND(cost.amount)}</p>
                                      <p className="text-[10px] text-zinc-500">
                                          {cost.frequencyMonths === 1 ? 'Mỗi tháng' : `${cost.frequencyMonths} tháng/lần`}
                                      </p>
                                  </div>
                              </div>

                              {/* Saved Progress for Fixed Cost */}
                              <div className="pl-3 mb-2">
                                   <div className="flex justify-between text-xs mb-1">
                                       <span className="text-zinc-500">{VI.budget.fixed.saved}: <span className="text-emerald-400 font-bold">{formatVND(cost.allocatedAmount)}</span></span>
                                       <span className="text-zinc-500">{savedPercent}%</span>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                       <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${savedPercent}%` }}></div>
                                   </div>
                              </div>
                              
                              <div className="flex justify-end items-center mt-3 pt-3 border-t border-white/5 space-x-3">
                                  <button onClick={() => handleDeleteFixedCost(cost.id)} className="text-zinc-600 hover:text-red-400 p-2">
                                      <Trash2 size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handlePayClick(cost)}
                                    className="flex items-center bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                  >
                                      <CheckCircle size={16} className="mr-2" />
                                      {VI.budget.fixed.payBtn}
                                  </button>
                              </div>
                          </div>
                      );
                  })
              }
          </div>
      )}

      {/* MODAL: ADD FIXED COST */}
      {isAddingCost && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
           <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-white">{VI.budget.fixed.addBtn}</h3>
                   <button onClick={() => setIsAddingCost(false)} className="p-2 bg-white/5 rounded-full">
                       <X size={20} />
                   </button>
               </div>
               
               <div className="space-y-4">
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.budget.fixed.name}</label>
                       <input 
                          type="text" 
                          autoFocus
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newCost.title}
                          onChange={(e) => setNewCost({...newCost, title: e.target.value})}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.budget.fixed.amount}</label>
                       <input 
                          type="number" 
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newCost.amount || ''}
                          onChange={(e) => setNewCost({...newCost, amount: Number(e.target.value)})}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.budget.fixed.nextDue}</label>
                       <input 
                          type="date" 
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newCost.nextDueDate}
                          onChange={(e) => setNewCost({...newCost, nextDueDate: e.target.value})}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.budget.fixed.cycle}</label>
                       <select 
                           className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                           value={newCost.frequencyMonths}
                           onChange={(e) => setNewCost({...newCost, frequencyMonths: Number(e.target.value)})}
                       >
                           <option value={1}>1 Tháng (Hàng tháng)</option>
                           <option value={3}>3 Tháng</option>
                           <option value={6}>6 Tháng</option>
                           <option value={12}>1 Năm</option>
                       </select>
                   </div>
                   
                   <button 
                     onClick={handleSaveFixedCost}
                     className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl mt-2 shadow-lg shadow-emerald-500/20"
                   >
                       {VI.settings.save}
                   </button>
               </div>
           </div>
        </div>
      )}

      {/* MODAL: AUTO ALLOCATION */}
      {isAllocating && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
           <div className="bg-surface w-full max-w-md h-[85vh] sm:h-auto overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2 text-amber-500">
                        <Zap size={24} fill="currentColor" />
                        <h3 className="text-xl font-bold text-white">{VI.budget.allocation.title}</h3>
                   </div>
                   <button onClick={() => setIsAllocating(false)} className="p-2 bg-white/5 rounded-full">
                       <X size={20} />
                   </button>
               </div>
               
               <p className="text-xs text-zinc-400 mb-6">{VI.budget.allocation.subtitle}</p>

               <div className="space-y-6">
                    {/* Source Input */}
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.budget.allocation.inputLabel}</label>
                       <input 
                          type="number" 
                          autoFocus
                          className="w-full bg-black/30 text-3xl font-bold text-amber-500 p-4 rounded-xl border border-amber-500/30 focus:border-amber-500 focus:outline-none text-right"
                          placeholder="0"
                          value={allocSourceAmount}
                          onChange={(e) => setAllocSourceAmount(e.target.value)}
                       />
                   </div>

                   {/* Wallet Selector */}
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.sourceWallet}</label>
                       <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <select 
                                value={allocSourceWallet}
                                onChange={(e) => setAllocSourceWallet(e.target.value)}
                                className="w-full bg-black/20 text-white p-3 pl-10 rounded-xl border border-white/10 focus:border-amber-500 focus:outline-none appearance-none"
                            >
                                {StorageService.getWallets().map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>
                                ))}
                            </select>
                       </div>
                   </div>

                   {/* Allocation List */}
                   <div>
                       <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 border-b border-white/10 pb-2">{VI.budget.allocation.tableHeader}</h4>
                       <div className="space-y-3">
                           {allocationItems.map((item, idx) => {
                               const calculatedAmount = Number(allocSourceAmount) > 0 ? (Number(allocSourceAmount) * item.percentage) / 100 : 0;
                               return (
                                   <div key={item.itemId} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${item.isEnabled ? 'bg-white/5 border-white/5' : 'bg-transparent border-white/5 opacity-50'}`}>
                                       <input 
                                          type="checkbox"
                                          checked={item.isEnabled}
                                          onChange={() => toggleAllocationItem(idx)}
                                          className="w-5 h-5 rounded border-zinc-500 text-amber-500 focus:ring-amber-500"
                                       />
                                       <div className="flex-1">
                                           <div className="flex items-center gap-1">
                                               {item.type === 'GOAL' ? <CheckCircle size={12} className="text-emerald-500"/> : <Calendar size={12} className="text-blue-400"/>}
                                               <span className="text-sm font-bold text-white truncate max-w-[120px]">{getItemName(item.itemId, item.type)}</span>
                                           </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                           <div className="relative w-16">
                                               <input 
                                                  type="number"
                                                  value={item.percentage}
                                                  onChange={(e) => updateAllocationPercent(idx, e.target.value)}
                                                  className="w-full bg-black/40 text-right text-white text-sm font-bold p-1 pr-4 rounded-lg focus:outline-none"
                                                  disabled={!item.isEnabled}
                                               />
                                               <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
                                           </div>
                                           <span className="text-xs text-zinc-400 font-mono w-20 text-right">{formatVND(calculatedAmount).replace('₫','')}</span>
                                       </div>
                                   </div>
                               );
                           })}
                           {allocationItems.length === 0 && <p className="text-center text-zinc-500 text-xs py-4">Chưa có Hóa đơn hoặc Mục tiêu nào.</p>}
                       </div>
                   </div>

                   <button 
                     onClick={executeAllocation}
                     className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                       <Zap size={20} fill="currentColor" />
                       {VI.budget.allocation.confirm}
                   </button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};