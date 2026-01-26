import React, { useState, useEffect } from 'react';
import { Wallet, Transaction, TransactionType, User } from '../types';
import { ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, Settings, Calendar, List, ShieldCheck, TrendingUp, AlertTriangle, Target, Zap, X, Sparkles, ArrowRightLeft, MoveRight, PartyPopper } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { CalendarView } from './CalendarView';
import { StorageService } from '../services/storageService';

interface Props {
  wallets: Wallet[];
  transactions: Transaction[];
  users: User[];
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<Props> = ({ wallets, transactions, users, onOpenSettings, onRefresh }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeWalletTab, setActiveWalletTab] = useState<'main' | 'backup'>('main');
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [missions, setMissions] = useState<any[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    calculateMissions();
  }, [transactions]);

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);
  const mainWallet = wallets.find(w => w.id === 'w1') || wallets[0];
  const backupWallet = wallets.find(w => w.id === 'w2');

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.amount, 0);

  const calculateMissions = () => {
      const ms = [];
      const projects = StorageService.getIncomeProjects();
      projects.filter(p => p.status === 'in_progress').forEach(p => {
          const incomplete = p.milestones.filter(m => !m.isCompleted).length;
          if (incomplete > 0) {
              ms.push({ type: 'project', text: `${VI.insights.project.status.in_progress}: ${incomplete} đầu việc trong "${p.name}"` });
          }
      });
      setMissions(ms);
  };

  const handleQuickTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0) return;
    
    const success = StorageService.transferFunds('w1', 'w2', amount, 'Trích lập quỹ thủ công');
    if (success) {
      setTransferAmount('');
      setShowTransferModal(false);
      onRefresh();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Số dư Ví chính không đủ!");
    }
  };

  const recentTransactions = transactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const getDynamicFontSizeClass = (balance: number, isHeader = false) => {
    const str = formatVND(balance);
    const len = str.length;
    
    if (isHeader) {
      if (len > 18) return 'text-lg';
      if (len > 15) return 'text-xl';
      if (len > 12) return 'text-2xl';
      return 'text-3xl';
    }

    if (len > 20) return 'text-[1.1rem] sm:text-[1.4rem]';
    if (len > 16) return 'text-[1.4rem] sm:text-[1.8rem]';
    if (len > 13) return 'text-[1.9rem] sm:text-[2.3rem]';
    if (len > 10) return 'text-[2.3rem] sm:text-[2.8rem]';
    return 'text-[2.8rem] sm:text-[3.2rem]';
  };

  const activeBalance = activeWalletTab === 'main' ? mainWallet?.balance || 0 : backupWallet?.balance || 0;

  return (
    <div className="p-6 space-y-8 pt-12 animate-in fade-in duration-1000">
      
      {/* Header Area */}
      <div className="flex justify-between items-center px-1">
        <div className="space-y-1">
          <h1 className="text-foreground/40 text-[10px] font-black tracking-[0.3em] uppercase">QUẢN TRỊ TÀI CHÍNH</h1>
          <div className={`font-[900] text-foreground tracking-tighter filter drop-shadow-sm transition-all duration-300 ${getDynamicFontSizeClass(totalBalance, true)}`}>
            {formatVND(totalBalance)}
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-4 glass-card rounded-[1.5rem] text-primary hover:bg-primary/10 transition-all active:scale-90 border-0"
        >
          <Settings size={22} className="animate-[spin_10s_linear_infinite]" />
        </button>
      </div>

      {/* Floating Gradient Wallet with Liquid Tab Switcher */}
      <div className="space-y-6">
          <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
              <div className="flex relative">
                  <button 
                    onClick={() => setActiveWalletTab('main')}
                    className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 ${activeWalletTab === 'main' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}
                  >
                      <WalletIcon size={14} /> {mainWallet?.name?.toUpperCase() || 'VÍ CHÍNH'}
                  </button>
                  <button 
                    onClick={() => setActiveWalletTab('backup')}
                    className={`relative z-10 flex-1 py-4 text-[11px] font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3 ${activeWalletTab === 'backup' ? 'bg-secondary text-white shadow-xl neon-glow-secondary' : 'text-foreground/40 hover:text-foreground/60'}`}
                  >
                      <ShieldCheck size={14} /> {backupWallet?.name?.toUpperCase() || "DỰ PHÒNG"}
                  </button>
              </div>
          </div>

          <div className={`glass-card liquid-glass rounded-[3rem] p-10 relative overflow-hidden group transition-all duration-700 border-0 shadow-2xl ${activeWalletTab === 'main' ? 'bg-gradient-to-br from-primary/20 via-surface/60 to-primary/5' : 'bg-gradient-to-br from-secondary/20 via-surface/60 to-secondary/5'}`}>
               <div className={`absolute -right-16 -top-16 w-80 h-80 rounded-full blur-[100px] opacity-40 group-hover:opacity-60 transition-opacity ${activeWalletTab === 'main' ? 'bg-primary/30' : 'bg-secondary/30'}`}></div>
               
               <div className="relative z-10">
                    <p className="text-foreground/30 text-[11px] mb-2 font-black tracking-widest uppercase">SỐ DƯ QUẢN LÝ</p>
                    <div className="flex items-center justify-between mb-8 overflow-visible">
                        <p className={`font-[1000] tracking-tighter leading-tight transition-all duration-500 whitespace-nowrap ${activeWalletTab === 'backup' ? 'text-secondary' : 'text-foreground'} ${getDynamicFontSizeClass(activeBalance)}`}>
                            {formatVND(activeBalance)}
                        </p>
                        {activeWalletTab === 'main' && (
                          <button 
                            onClick={() => setShowTransferModal(true)}
                            className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg neon-glow-primary active:scale-90 transition-all border-2 border-primary/20"
                          >
                            <ArrowRightLeft size={22} />
                          </button>
                        )}
                    </div>
                    
                    {/* Vertical Stacked Cards for Income/Spending */}
                    <div className="flex flex-col gap-4">
                        <div className="glass-card bg-surface/50 p-6 rounded-[2.25rem] border-0 flex justify-between items-center group/card hover:bg-secondary/5 transition-all">
                            <div>
                                <span className="text-[10px] text-foreground/40 block font-black uppercase mb-1 tracking-[0.2em]">Tổng thu tháng</span>
                                <span className="text-secondary text-2xl font-[900] tracking-tight">{formatVND(monthlyIncome)}</span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner group-hover/card:scale-110 group-hover/card:rotate-6 transition-transform">
                                <TrendingUp size={24} />
                            </div>
                        </div>
                        <div className="glass-card bg-surface/50 p-6 rounded-[2.25rem] border-0 flex justify-between items-center group/card hover:bg-danger/5 transition-all">
                            <div>
                                <span className="text-[10px] text-foreground/40 block font-black uppercase mb-1 tracking-[0.2em]">Tổng chi tháng</span>
                                <span className="text-danger text-2xl font-[900] tracking-tight">{formatVND(monthlyExpense)}</span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center shadow-inner group-hover/card:scale-110 group-hover/card:rotate-[-6deg] transition-transform">
                                <AlertTriangle size={24} />
                            </div>
                        </div>
                    </div>
               </div>
          </div>
      </div>

      {/* QUICK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-6 animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 border-0 bg-surface">
               <div className="flex justify-between items-center mb-8">
                   <div>
                        <h3 className="text-2xl font-[1000] text-foreground tracking-tighter uppercase leading-none">TRÍCH LẬP QUỸ</h3>
                        <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mt-2">Ví chính → Quỹ dự phòng</p>
                   </div>
                   <button onClick={() => setShowTransferModal(false)} className="p-3 bg-foreground/5 rounded-2xl text-foreground/40 hover:bg-foreground/10 transition-all"><X size={22} /></button>
               </div>
               <form onSubmit={handleQuickTransfer} className="space-y-8">
                   <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Số tiền chuyển (VND)</label>
                          <input 
                              type="number" required autoFocus
                              className="w-full bg-foreground/5 text-secondary text-4xl font-[1000] p-6 rounded-[2rem] focus:outline-none tracking-tighter placeholder:text-foreground/5"
                              placeholder="0"
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(e.target.value)}
                          />
                          <div className="flex justify-between px-2 text-[9px] font-black text-foreground/20 uppercase tracking-widest">
                            <span>Khả dụng: {formatVND(mainWallet.balance)}</span>
                            <button type="button" onClick={() => setTransferAmount(String(mainWallet.balance))} className="text-primary hover:underline">Tất cả</button>
                          </div>
                      </div>
                   </div>

                   <button type="submit" className="w-full bg-primary text-white font-[1000] py-6 rounded-[2rem] text-[12px] uppercase tracking-[0.4em] shadow-xl neon-glow-primary active:scale-95 transition-all flex items-center justify-center gap-3">
                       XÁC NHẬN CHUYỂN <MoveRight size={20} />
                   </button>
               </form>
           </div>
        </div>
      )}

      {/* SUCCESS TOAST */}
      {showSuccessToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[300] bg-secondary text-white px-8 py-4 rounded-full shadow-2xl font-[1000] text-xs uppercase tracking-[0.3em] flex items-center gap-3 animate-in slide-in-from-top duration-500">
           <PartyPopper size={18} /> ĐÃ TRÍCH QUỸ YAHOOO!
        </div>
      )}

      {/* AI Mission Box with Liquid Glass */}
      <div className="glass-card liquid-glass rounded-[2.5rem] p-3 bg-gradient-to-r from-primary/10 via-surface/80 to-secondary/10 border-0 shadow-xl">
          <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-[1.25rem] bg-primary flex items-center justify-center text-white neon-glow-primary transform rotate-3">
                      <Zap size={28} fill="white" />
                  </div>
                  <div>
                      <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">AI Insight</h3>
                      <p className="text-[15px] font-[900] text-foreground uppercase tracking-tight">{missions.length} VIỆC CẦN LÀM</p>
                  </div>
              </div>
              <button 
                onClick={() => setShowMissionModal(true)}
                className="bg-primary hover:bg-primary/90 text-white px-7 py-4 rounded-[1.5rem] font-[900] text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-xl neon-glow-primary"
              >
                  XỬ LÝ
              </button>
          </div>
      </div>

      {/* Recent Activity Card */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border-0 shadow-xl">
        <div className="p-7 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-foreground/40">NHẬT KÝ DỮ LIỆU</h3>
            <div className="flex glass-card p-1.5 rounded-2xl bg-foreground/5 border-0">
                <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><List size={18} /></button>
                <button onClick={() => setViewMode('calendar')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><Calendar size={18} /></button>
            </div>
        </div>
        
        <div className="min-h-[300px] p-4">
            {viewMode === 'list' ? (
                <div className="space-y-2">
                    {recentTransactions.length > 0 ? recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-5 rounded-[1.75rem] hover:bg-foreground/[0.04] transition-all group active:scale-[0.98]">
                            <div className="flex items-center space-x-5">
                                <div 
                                    className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-white transition-all group-hover:rotate-6 shadow-lg"
                                    style={{ 
                                        background: tx.type === TransactionType.INCOME 
                                          ? 'linear-gradient(135deg, #10b981, #064e3b)' 
                                          : tx.type === TransactionType.TRANSFER 
                                            ? 'linear-gradient(135deg, #8b5cf6, #4c1d95)'
                                            : `linear-gradient(135deg, ${CATEGORY_COLORS[tx.category] || '#64748b'}, #00000044)`,
                                    }}
                                >
                                    {tx.type === TransactionType.INCOME ? <ArrowUpRight size={22} strokeWidth={3} /> : tx.type === TransactionType.TRANSFER ? <ArrowRightLeft size={22} strokeWidth={3} /> : <ArrowDownRight size={22} strokeWidth={3} />}
                                </div>
                                <div>
                                    <p className="font-[900] text-foreground text-[14px] uppercase tracking-tight">{tx.description}</p>
                                    <p className="text-[10px] text-foreground/40 font-bold tracking-[0.1em] uppercase">
                                        {tx.type === TransactionType.TRANSFER ? 'Chuyển khoản' : (VI.category[tx.category] || tx.category)}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-[900] text-[16px] tracking-tighter ${tx.type === TransactionType.INCOME ? 'text-secondary' : tx.type === TransactionType.TRANSFER ? 'text-primary' : 'text-foreground'}`}>
                                {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.TRANSFER ? '⇄' : '-'}{formatVND(tx.amount)}
                            </span>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-foreground/20 font-black uppercase text-xs tracking-widest">TRỐNG</div>
                    )}
                </div>
            ) : (
                <div className="p-2"><CalendarView transactions={transactions} /></div>
            )}
        </div>
      </div>

      {/* MISSION MODAL */}
      {showMissionModal && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-3xl p-6 animate-in fade-in duration-500">
              <div className="glass-card w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 border-0">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-indigo-500 to-secondary"></div>
                  <div className="flex justify-between items-center mb-10">
                       <div>
                           <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">TRUNG TÂM TÁC VỤ</h3>
                           <p className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em]">AI Analytics v2.8</p>
                       </div>
                       <button onClick={() => setShowMissionModal(false)} className="p-3 glass-card rounded-2xl text-foreground/20 hover:text-primary transition-colors border-0"><X size={24} /></button>
                  </div>
                  <div className="space-y-5 mb-10">
                      {missions.length > 0 ? missions.map((m, idx) => (
                          <div key={idx} className="glass-card bg-surface/40 p-6 rounded-[2rem] border-0 flex items-center gap-6 group hover:bg-primary/5 transition-all">
                              <div className="w-4 h-4 rounded-full bg-primary neon-glow-primary"></div>
                              <p className="text-[14px] font-[700] text-foreground/90 leading-relaxed uppercase tracking-tight">{m.text}</p>
                          </div>
                      )) : (
                          <div className="text-center py-16">
                              <Sparkles size={40} className="mx-auto mb-4 text-secondary/30" />
                              <p className="text-foreground/30 font-black text-xs uppercase tracking-[0.2em]">Hệ thống rảnh rỗi</p>
                          </div>
                      )}
                  </div>
                  <button onClick={() => setShowMissionModal(false)} 
                    className="w-full bg-primary text-white font-[900] py-6 rounded-[2rem] text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-2xl neon-glow-primary"
                  >
                      XÁC NHẬN
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};