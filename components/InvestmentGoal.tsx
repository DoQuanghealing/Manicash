import React, { useState } from 'react';
import { Goal, User, Wallet } from '../types';
import { TrendingUp, Plus, Calendar, Target, Wallet as WalletIcon, X } from 'lucide-react';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { StorageService } from '../services/storageService';

interface Props {
  goals: Goal[];
  users: User[];
  wallets: Wallet[];
  onRefresh: () => void;
}

export const InvestmentGoal: React.FC<Props> = ({ goals, users, wallets, onRefresh }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Create Goal State
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  // Deposit State
  const [depositAmount, setDepositAmount] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState(wallets[0]?.id || '');
  const [depositNote, setDepositNote] = useState('');

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newTarget || !newDeadline) return;

    const newGoal: Goal = {
        id: `g_${Date.now()}`,
        name: newName,
        targetAmount: parseFloat(newTarget.replace(/\./g, '')),
        currentAmount: 0,
        deadline: newDeadline,
        rounds: []
    };

    StorageService.addGoal(newGoal);
    onRefresh();
    setIsCreateOpen(false);
    setNewName('');
    setNewTarget('');
    setNewDeadline('');
  };

  const openDepositModal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setIsDepositOpen(true);
    setSourceWalletId(wallets[0]?.id || '');
    setDepositAmount('');
    setDepositNote('');
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !depositAmount || !sourceWalletId) return;

    const amount = parseFloat(depositAmount.replace(/\./g, ''));
    
    // Find active user based on wallet owner (simplification for demo)
    const wallet = wallets.find(w => w.id === sourceWalletId);
    const userId = wallet?.userId || users[0].id;

    const success = StorageService.contributeToGoal(selectedGoalId, sourceWalletId, amount, depositNote, userId);
    
    if (success) {
        onRefresh();
        setIsDepositOpen(false);
    } else {
        alert("Số dư không đủ!");
    }
  };

  const calculateDaysLeft = (deadline: string) => {
      const diff = new Date(deadline).getTime() - new Date().getTime();
      return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const getUserName = (id: string) => {
    return users.find(u => u.id === id)?.name || id;
  };

  return (
    <div className="p-4 pt-8 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{VI.goals.title}</h2>
        <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-1 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-sm font-bold border border-emerald-500/20"
        >
            <Plus size={16} />
            <span>{VI.goals.newGoal}</span>
        </button>
      </div>

      {goals.length === 0 && (
          <div className="text-center py-10 text-zinc-500 bg-surface rounded-3xl border border-white/5 border-dashed">
              <Target size={48} className="mx-auto mb-4 opacity-50" />
              <p>{VI.goals.noGoals}</p>
          </div>
      )}

      {goals.map((goal) => {
          const percentage = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const daysLeft = calculateDaysLeft(goal.deadline);
          
          return (
            <div key={goal.id} className="bg-surface border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-lg">
                {/* Background Decorative */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white leading-tight">{goal.name}</h3>
                                <div className="flex items-center space-x-2 text-xs text-zinc-400 mt-1">
                                    <Calendar size={12} />
                                    <span>{daysLeft > 0 ? `${daysLeft} ${VI.goals.daysLeft}` : VI.goals.by + ' ' + goal.deadline}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => openDepositModal(goal.id)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white p-2 rounded-full shadow-lg shadow-emerald-500/20 transition-transform active:scale-95"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="flex items-end justify-between mb-2">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">{VI.goals.current}</p>
                            <span className="text-3xl font-bold text-emerald-400">{formatVND(goal.currentAmount)}</span>
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-zinc-500 mb-1">{VI.goals.target}</p>
                             <span className="text-sm font-bold text-zinc-300">{formatVND(goal.targetAmount)}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-4 bg-black/40 rounded-full overflow-hidden mb-6 relative">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">{percentage}%</span>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{VI.goals.rounds}</h4>
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                            {goal.rounds.length === 0 && <p className="text-xs text-zinc-600 italic">Chưa có khoản nạp nào.</p>}
                            {[...goal.rounds].reverse().map((round) => (
                                <div key={round.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <div className="flex flex-col">
                                            <span className="text-zinc-300">{round.note}</span>
                                            <span className="text-[10px] text-zinc-500">{round.date} • {getUserName(round.contributorId)}</span>
                                        </div>
                                    </div>
                                    <span className="font-medium text-emerald-400">+{formatVND(round.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          );
      })}

      {/* CREATE GOAL MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
           <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-white">{VI.goals.createTitle}</h3>
                   <button onClick={() => setIsCreateOpen(false)} className="p-2 bg-white/5 rounded-full">
                       <X size={20} />
                   </button>
               </div>
               <form onSubmit={handleCreateGoal} className="space-y-4">
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.nameLabel}</label>
                       <input 
                          type="text" 
                          required
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.targetLabel}</label>
                       <input 
                          type="number" 
                          required
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newTarget}
                          onChange={(e) => setNewTarget(e.target.value)}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.deadlineLabel}</label>
                       <input 
                          type="date" 
                          required
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                       />
                   </div>
                   <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl mt-2 shadow-lg shadow-emerald-500/20">
                       {VI.goals.saveGoal}
                   </button>
               </form>
           </div>
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
           <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-white">{VI.goals.depositTitle}</h3>
                   <button onClick={() => setIsDepositOpen(false)} className="p-2 bg-white/5 rounded-full">
                       <X size={20} />
                   </button>
               </div>
               <form onSubmit={handleDeposit} className="space-y-4">
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.sourceWallet}</label>
                       <div className="relative">
                            <WalletIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <select 
                                value={sourceWalletId}
                                onChange={(e) => setSourceWalletId(e.target.value)}
                                className="w-full bg-black/20 text-white p-3 pl-10 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none appearance-none"
                            >
                                {wallets.map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>
                                ))}
                            </select>
                       </div>
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.depositAmount}</label>
                       <input 
                          type="number" 
                          required
                          autoFocus
                          className="w-full bg-black/20 text-3xl font-bold text-emerald-400 p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none text-right"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-xs text-zinc-400 ml-1">{VI.goals.note}</label>
                       <input 
                          type="text" 
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
                          value={depositNote}
                          placeholder="VD: Trích lương..."
                          onChange={(e) => setDepositNote(e.target.value)}
                       />
                   </div>
                   <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl mt-2 shadow-lg shadow-emerald-500/20">
                       {VI.goals.confirmDeposit}
                   </button>
               </form>
           </div>
        </div>
      )}
    </div>
  );
};