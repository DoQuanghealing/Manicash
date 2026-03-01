
import React, { useState } from 'react';
import { Goal, User, Wallet, UserGender } from '../types';
import { TrendingUp, Plus, Calendar, Target, Wallet as WalletIcon, X, CheckCircle2, PartyPopper, Trophy, Sparkles, Star } from 'lucide-react';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { StorageService } from '../services/storageService';

interface Props {
  goals: Goal[];
  users: User[];
  wallets: Wallet[];
  onRefresh: () => void;
}

const InvestmentGoal: React.FC<Props> = ({ goals, users, wallets, onRefresh }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [celebrationQuote, setCelebrationQuote] = useState('');

  // Create Goal State
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  // Deposit State
  const [depositAmount, setDepositAmount] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState(wallets[0]?.id || '');
  const [depositNote, setDepositNote] = useState('');

  const activeUser = users[0];
  const userTitle = activeUser?.gender === UserGender.FEMALE ? "Cô chủ" : "Cậu chủ";

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newTarget || !newDeadline) return;

    const newGoal: Goal = {
        id: `g_${Date.now()}`,
        name: newName,
        targetAmount: parseNumberInput(newTarget),
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

    const amount = parseNumberInput(depositAmount);
    const wallet = wallets.find(w => w.id === sourceWalletId);
    const userId = wallet?.userId || users[0].id;

    const success = StorageService.contributeToGoal(selectedGoalId, sourceWalletId, amount, depositNote, userId);
    
    if (success) {
        onRefresh();
        setIsDepositOpen(false);
        
        // Pick random celebration quote
        const randomQuote = VI.goals.celebration[Math.floor(Math.random() * VI.goals.celebration.length)];
        setCelebrationQuote(randomQuote);
        setIsCelebrationOpen(true);
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

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTarget(formatNumberInput(e.target.value));
  };

  const handleDepositAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDepositAmount(formatNumberInput(e.target.value));
  };

  return (
    <div className="p-6 pt-12 space-y-8 pb-32 animate-in fade-in duration-700">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-[1000] text-foreground tracking-tighter uppercase">MỤC TIÊU</h2>
        <button 
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 bg-primary text-white px-5 py-3 rounded-2xl text-[11px] font-[1000] tracking-widest uppercase shadow-lg neon-glow-primary active:scale-95 transition-all"
        >
            <Plus size={16} strokeWidth={4} />
            <span>TẠO MỚI</span>
        </button>
      </div>

      {goals.length === 0 && (
          <div className="glass-card rounded-[2rem] p-16 text-center border-0">
              <div className="w-16 h-16 bg-foreground/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target size={32} className="text-foreground/20" />
              </div>
              <p className="text-foreground/30 font-black text-xs uppercase tracking-[0.2em]">{VI.goals.noGoals}</p>
          </div>
      )}

      {goals.map((goal) => {
          const percentage = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const daysLeft = calculateDaysLeft(goal.deadline);
          
          return (
            <div key={goal.id} className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] -mr-16 -mt-16 opacity-30"></div>

                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-secondary text-white rounded-2xl flex items-center justify-center shadow-lg neon-glow-secondary">
                                <TrendingUp size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-[1000] text-foreground leading-tight uppercase tracking-tight">{goal.name}</h3>
                                <div className="flex items-center space-x-2 text-[10px] text-foreground/40 font-black uppercase tracking-widest mt-1">
                                    <Calendar size={12} className="text-warning" />
                                    <span>{daysLeft > 0 ? `${daysLeft} NGÀY CÒN LẠI` : `HẠN: ${goal.deadline}`}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => openDepositModal(goal.id)}
                            className="bg-foreground text-background w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-all"
                        >
                            <Plus size={22} strokeWidth={4} />
                        </button>
                    </div>

                    <div className="mb-4">
                        <p className="text-[10px] text-foreground/30 font-black uppercase tracking-widest mb-1">Số tiền hiện có</p>
                        <span className="text-3xl font-[1000] text-secondary tracking-tighter">{formatVND(goal.currentAmount)}</span>
                    </div>

                    <div className="h-4 bg-foreground/5 rounded-full overflow-hidden mb-3 relative border border-foreground/5 shadow-inner">
                        <div className="h-full bg-gradient-to-r from-secondary to-emerald-400 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.3)]" style={{ width: `${percentage}%` }}></div>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-foreground mix-blend-difference uppercase tracking-widest">{percentage}%</span>
                    </div>

                    {/* New Layout Elements: Target below bar & Congratulation line */}
                    <div className="flex flex-col gap-2 mb-8">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <span className="text-foreground/40">Mục tiêu cần đạt:</span>
                            <span className="text-foreground">{formatVND(goal.targetAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 rounded-2xl bg-secondary/5 border border-secondary/10 animate-in fade-in slide-in-from-left duration-700">
                            <Sparkles size={14} className="text-secondary" />
                            <p className="text-[10px] font-black text-secondary uppercase tracking-tight">
                                Chúc mừng {userTitle} đã hoàn thành {percentage}% mục tiêu! ✨💎🚀
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-foreground/5">
                        <h4 className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">LỊCH SỬ NẠP</h4>
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                            {goal.rounds.length === 0 ? (
                                <p className="text-[11px] font-bold text-foreground/20 italic">Chưa có giao dịch nạp.</p>
                            ) : (
                                [...goal.rounds].reverse().map((round) => (
                                    <div key={round.id} className="flex items-center justify-between glass-card bg-foreground/[0.03] p-4 rounded-2xl border-0">
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-[800] text-foreground leading-tight uppercase tracking-tight">{round.note}</span>
                                            <span className="text-[9px] text-foreground/40 font-black uppercase tracking-widest mt-0.5">{round.date} • {getUserName(round.contributorId)}</span>
                                        </div>
                                        <span className="font-black text-sm text-secondary tracking-tighter">+{formatVND(round.amount)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
          );
      })}

      {/* CREATE GOAL MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6 overflow-hidden">
           <div className="glass-card w-full max-w-md h-[88vh] flex flex-col rounded-[3rem] shadow-2xl border-0 bg-surface overflow-hidden relative animate-in zoom-in-95">
               <div className="flex justify-between items-center p-6 pb-2 shrink-0 bg-surface/80 backdrop-blur-md z-10 border-b border-foreground/5">
                   <h3 className="text-lg font-[1000] text-foreground tracking-tighter uppercase">MỤC TIÊU MỚI</h3>
                   <button onClick={() => setIsCreateOpen(false)} className="p-2 bg-foreground/5 rounded-2xl hover:text-primary transition-colors"><X size={18} /></button>
               </div>
               <form onSubmit={handleCreateGoal} className="flex-1 overflow-y-auto no-scrollbar px-6 pb-72 space-y-6">
                   <div className="mt-4 space-y-1">
                       <label className="text-[8px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên mục tiêu</label>
                       <input 
                          type="text" required
                          className="w-full bg-foreground/5 text-foreground font-[800] p-4 rounded-[1.25rem] focus:ring-2 focus:ring-primary focus:outline-none transition-all uppercase text-xs tracking-tight border-0 shadow-inner"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-[8px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Số tiền cần đạt (VND)</label>
                       <input 
                          type="text"
                          inputMode="numeric"
                          required
                          className="w-full bg-foreground/5 text-secondary text-2xl font-[900] p-4 rounded-[1.25rem] focus:ring-2 focus:ring-secondary focus:outline-none tracking-tighter border-0 shadow-inner"
                          value={newTarget}
                          onChange={handleTargetChange}
                       />
                   </div>
                   <div className="space-y-1">
                       <div className="flex items-center gap-1.5 ml-2">
                           <Calendar size={12} className="text-warning" />
                           <label className="text-[8px] font-black text-foreground/30 tracking-widest uppercase">Ngày hoàn thành</label>
                       </div>
                       <input 
                          type="date" required
                          className="w-full bg-foreground/5 text-foreground font-black p-4 rounded-[1.25rem] focus:ring-2 focus:ring-primary focus:outline-none border-0 shadow-inner"
                          value={newDeadline}
                          onChange={(e) => setNewDeadline(e.target.value)}
                       />
                   </div>
               </form>
               <div className="absolute bottom-[140px] left-0 right-0 px-12 z-30 pointer-events-none">
                  <div className="w-full pointer-events-auto">
                    <button 
                        type="submit" 
                        onClick={handleCreateGoal} 
                        className="w-full bg-primary text-white font-[1000] py-3 rounded-xl text-[10px] uppercase tracking-[0.4em] shadow-[0_12px_35px_rgba(139,92,246,0.6)] neon-glow-primary active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20 backdrop-blur-xl"
                    >
                        LƯU MỤC TIÊU <CheckCircle2 size={14} strokeWidth={3} />
                    </button>
                  </div>
               </div>
           </div>
        </div>
      )}
      {/* DEPOSIT MODAL */}
      {isDepositOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-4 sm:p-6 overflow-hidden">
           <div className="glass-card w-full max-w-md h-[88vh] flex flex-col rounded-[3rem] shadow-2xl border-0 bg-surface overflow-hidden relative animate-in zoom-in-95">
               <div className="flex justify-between items-center p-6 pb-2 shrink-0 bg-surface/80 backdrop-blur-md z-10 border-b border-foreground/5">
                   <h3 className="text-lg font-[1000] text-foreground tracking-tighter uppercase">NẠP TIỀN MỤC TIÊU</h3>
                   <button onClick={() => setIsDepositOpen(false)} className="p-2 bg-foreground/5 rounded-2xl hover:text-primary transition-colors"><X size={18} /></button>
               </div>
               <form onSubmit={handleDeposit} className="flex-1 overflow-y-auto no-scrollbar px-6 pb-72 space-y-6">
                   <div className="mt-4 space-y-1">
                       <label className="text-[8px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Chọn ví nguồn</label>
                       <div className="grid grid-cols-1 gap-3">
                           {wallets.map(w => (
                               <button 
                                  key={w.id}
                                  type="button"
                                  onClick={() => setSourceWalletId(w.id)}
                                  className={`p-4 rounded-2xl border-2 transition-all text-left flex justify-between items-center ${sourceWalletId === w.id ? 'border-secondary bg-secondary/10' : 'border-foreground/5 bg-foreground/5'}`}
                               >
                                   <div>
                                       <p className="text-[10px] font-black uppercase tracking-tight text-foreground">{w.name}</p>
                                       <p className="text-xs font-black text-secondary">{formatVND(w.balance)}</p>
                                   </div>
                                   {sourceWalletId === w.id && <CheckCircle2 size={18} className="text-secondary" />}
                               </button>
                           ))}
                       </div>
                   </div>
                   <div className="space-y-1">
                       <label className="text-[8px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Số tiền nạp (VND)</label>
                       <input 
                          type="text"
                          inputMode="numeric"
                          required
                          className="w-full bg-foreground/5 text-secondary text-2xl font-[900] p-4 rounded-[1.25rem] focus:ring-2 focus:ring-secondary focus:outline-none tracking-tighter border-0 shadow-inner"
                          value={depositAmount}
                          onChange={handleDepositAmountChange}
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="text-[8px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Ghi chú</label>
                       <input 
                          type="text"
                          className="w-full bg-foreground/5 text-foreground font-[800] p-4 rounded-[1.25rem] focus:ring-2 focus:ring-primary focus:outline-none transition-all uppercase text-xs tracking-tight border-0 shadow-inner"
                          value={depositNote}
                          onChange={(e) => setDepositNote(e.target.value)}
                          placeholder="VD: Tiền thưởng tháng 3"
                       />
                   </div>
               </form>
               <div className="absolute bottom-[140px] left-0 right-0 px-12 z-30 pointer-events-none">
                  <div className="w-full pointer-events-auto">
                    <button 
                        type="submit" 
                        onClick={handleDeposit} 
                        className="w-full bg-secondary text-white font-[1000] py-4 rounded-2xl text-[11px] uppercase tracking-[0.4em] shadow-[0_12px_35px_rgba(16,185,129,0.5)] neon-glow-secondary active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20 backdrop-blur-xl"
                    >
                        XÁC NHẬN NẠP <PartyPopper size={16} strokeWidth={3} />
                    </button>
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* CELEBRATION MODAL */}
      {isCelebrationOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute animate-bounce"
                        style={{ 
                            left: `${Math.random() * 100}%`, 
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: 0.3
                        }}
                    >
                        {i % 2 === 0 ? <Star className="text-warning" size={24} /> : <PartyPopper className="text-secondary" size={24} />}
                    </div>
                ))}
            </div>

            <div className="glass-card w-full max-w-sm p-10 rounded-[3.5rem] text-center relative animate-in zoom-in-50 duration-500 border-0 bg-gradient-to-b from-secondary/20 to-transparent shadow-[0_0_100px_rgba(16,185,129,0.2)]">
                <div className="w-24 h-24 bg-secondary text-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl neon-glow-secondary animate-pulse">
                    <Trophy size={48} strokeWidth={2.5} />
                </div>
                
                <h3 className="text-3xl font-[1000] text-foreground tracking-tighter uppercase mb-4 leading-tight">
                    TUYỆT VỜI <br/> {userTitle}!
                </h3>
                
                <div className="p-6 rounded-3xl bg-foreground/5 border border-foreground/5 mb-8">
                    <p className="text-sm font-bold text-foreground/80 leading-relaxed italic">
                        "{celebrationQuote}"
                    </p>
                </div>

                <button 
                    onClick={() => setIsCelebrationOpen(false)}
                    className="w-full bg-foreground text-background font-[1000] py-4 rounded-2xl text-xs uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
                >
                    TIẾP TỤC CỐ GẮNG
                </button>

                <div className="mt-6 flex justify-center gap-2">
                    <Sparkles className="text-secondary animate-spin-slow" size={16} />
                    <span className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Hành trình triệu đô</span>
                    <Sparkles className="text-secondary animate-spin-slow" size={16} />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
export default InvestmentGoal;
