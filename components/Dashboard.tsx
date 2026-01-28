
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

export const Dashboard: React.FC<Props> = ({ wallets = [], transactions = [], users = [], onOpenSettings, onRefresh }) => {
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

  const totalBalance = Array.isArray(wallets) ? wallets.reduce((acc, w) => acc + (w.balance || 0), 0) : 0;
  const mainWallet = wallets?.find(w => w.id === 'w1') || wallets?.[0];
  const backupWallet = wallets?.find(w => w.id === 'w2');

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyIncome = Array.isArray(transactions) ? transactions
    .filter(t => t.type === TransactionType.INCOME && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (t.amount || 0), 0) : 0;

  const monthlyExpense = Array.isArray(transactions) ? transactions
    .filter(t => t.type === TransactionType.EXPENSE && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (t.amount || 0), 0) : 0;

  const calculateMissions = () => {
      const ms = [];
      try {
        const projects = StorageService.getIncomeProjects() || [];
        projects.filter(p => p.status === 'in_progress').forEach(p => {
            const incomplete = p.milestones?.filter(m => !m.isCompleted).length || 0;
            if (incomplete > 0) {
                ms.push({ type: 'project', text: `${VI.insights.project.status.in_progress}: ${incomplete} việc trong "${p.name}"` });
            }
        });
      } catch (e) {}
      setMissions(ms);
  };

  const handleQuickTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmount);
    if (!amount || amount <= 0 || !mainWallet) return;
    
    const success = StorageService.transferFunds(mainWallet.id, 'w2', amount, 'Trích lập quỹ thủ công');
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

  const recentTransactions = Array.isArray(transactions) 
    ? [...transactions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5) 
    : [];

  const getDynamicFontSizeClass = (balance: number = 0, isHeader = false) => {
    const str = formatVND(balance);
    const len = str.length;
    
    if (isHeader) {
      if (len > 18) return 'text-lg';
      if (len > 15) return 'text-xl';
      if (len > 12) return 'text-2xl';
      return 'text-3xl';
    }

    if (len > 20) return 'text-[1.1rem]';
    if (len > 16) return 'text-[1.4rem]';
    if (len > 13) return 'text-[1.9rem]';
    if (len > 10) return 'text-[2.3rem]';
    return 'text-[2.8rem]';
  };

  const activeBalance = activeWalletTab === 'main' ? (mainWallet?.balance || 0) : (backupWallet?.balance || 0);

  return (
    <div className="space-y-8 pt-8 animate-in fade-in duration-1000">
      
      {/* Header Area - High Z-index to ensure gear is clickable */}
      <div className="flex justify-between items-center px-1 relative z-50">
        <div className="space-y-1">
          <h1 className="text-foreground/40 text-[10px] font-black tracking-[0.3em] uppercase">QUẢN TRỊ TÀI CHÍNH</h1>
          <div className={`font-[1000] text-foreground tracking-tighter filter drop-shadow-sm transition-all duration-300 ${getDynamicFontSizeClass(totalBalance, true)}`}>
            {formatVND(totalBalance)}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenSettings();
          }}
          className="p-4 glass-card bg-surface/80 rounded-[1.5rem] text-primary hover:bg-primary/20 transition-all active:scale-90 border-0 shadow-xl relative z-[60] cursor-pointer"
          aria-label="Cài đặt"
        >
          <Settings size={22} className="animate-[spin_20s_linear_infinite]" />
        </button>
      </div>

      {/* Floating Gradient Wallet */}
      <div className="space-y-6 relative z-10">
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
               <div className="relative z-10">
                    <p className="text-foreground/30 text-[11px] mb-2 font-black tracking-widest uppercase">SỐ DƯ QUẢN LÝ</p>
                    <div className="flex items-center justify-between mb-8 overflow-visible">
                        <p className={`font-[1000] tracking-tighter leading-tight transition-all duration-500 whitespace-nowrap ${activeWalletTab === 'backup' ? 'text-secondary' : 'text-foreground'} ${getDynamicFontSizeClass(activeBalance)}`}>
                            {formatVND(activeBalance)}
                        </p>
                        {activeWalletTab === 'main' && mainWallet && (
                          <button 
                            onClick={() => setShowTransferModal(true)}
                            className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg neon-glow-primary active:scale-90 transition-all border-2 border-primary/20"
                          >
                            <ArrowRightLeft size={22} />
                          </button>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-4">
                        <div className="glass-card bg-surface/50 p-6 rounded-[2.25rem] border-0 flex justify-between items-center group/card hover:bg-secondary/5 transition-all">
                            <div>
                                <span className="text-[10px] text-foreground/40 block font-black uppercase mb-1 tracking-[0.2em]">Tổng thu tháng</span>
                                <span className="text-secondary text-2xl font-[900] tracking-tight">{formatVND(monthlyIncome)}</span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-inner group-hover/card:scale-110 transition-transform">
                                <TrendingUp size={24} />
                            </div>
                        </div>
                        <div className="glass-card bg-surface/50 p-6 rounded-[2.25rem] border-0 flex justify-between items-center group/card hover:bg-danger/5 transition-all">
                            <div>
                                <span className="text-[10px] text-foreground/40 block font-black uppercase mb-1 tracking-[0.2em]">Tổng chi tháng</span>
                                <span className="text-danger text-2xl font-[900] tracking-tight">{formatVND(monthlyExpense)}</span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center shadow-inner group-hover/card:scale-110 transition-transform">
                                <AlertTriangle size={24} />
                            </div>
                        </div>
                    </div>
               </div>
          </div>
      </div>
      
      <div className="glass-card rounded-[2.5rem] overflow-hidden border-0 shadow-xl relative z-10">
        <div className="p-7 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-foreground/40">NHẬT KÝ DỮ LIỆU</h3>
            <div className="flex glass-card p-1.5 rounded-2xl bg-foreground/5 border-0">
                <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><List size={18} /></button>
                <button onClick={() => setViewMode('calendar')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><Calendar size={18} /></button>
            </div>
        </div>
        
        <div className="min-h-[200px] p-4">
            {viewMode === 'list' ? (
                <div className="space-y-2">
                    {recentTransactions.length > 0 ? recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-5 rounded-[1.75rem] hover:bg-foreground/[0.04] transition-all group active:scale-[0.98]">
                            <div className="flex items-center space-x-5">
                                <div 
                                    className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-white transition-all group-hover:rotate-6 shadow-lg"
                                    style={{ 
                                        background: tx.type === TransactionType.INCOME 
                                          ? 'linear-gradient(135deg, #10b981, #064e3b)' 
                                          : tx.type === TransactionType.TRANSFER 
                                            ? 'linear-gradient(135deg, #8b5cf6, #4c1d95)'
                                            : `linear-gradient(135deg, ${CATEGORY_COLORS[tx.category] || '#64748b'}, #00000044)`,
                                    }}
                                >
                                    {tx.type === TransactionType.INCOME ? <ArrowUpRight size={20} strokeWidth={3} /> : tx.type === TransactionType.TRANSFER ? <ArrowRightLeft size={20} strokeWidth={3} /> : <ArrowDownRight size={20} strokeWidth={3} />}
                                </div>
                                <div>
                                    <p className="font-[900] text-foreground text-[14px] uppercase tracking-tight">{tx.description || 'Không có mô tả'}</p>
                                    <p className="text-[10px] text-foreground/40 font-bold uppercase">
                                        {tx.type === TransactionType.TRANSFER ? 'Nội bộ' : (VI.category[tx.category] || tx.category)}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-[900] text-[15px] tracking-tighter ${tx.type === TransactionType.INCOME ? 'text-secondary' : tx.type === TransactionType.TRANSFER ? 'text-primary' : 'text-foreground'}`}>
                                {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.TRANSFER ? '⇄' : '-'}{formatVND(tx.amount)}
                            </span>
                        </div>
                    )) : (
                        <div className="py-20 text-center text-foreground/20 font-black uppercase text-xs tracking-widest">CHƯA CÓ DỮ LIỆU</div>
                    )}
                </div>
            ) : (
                <div className="p-2"><CalendarView transactions={transactions} /></div>
            )}
        </div>
      </div>
    </div>
  );
};
