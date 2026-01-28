import React, { useState, useEffect } from 'react';
import { Wallet, Transaction, TransactionType, User } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, Settings, 
  Calendar, List, ShieldCheck, TrendingUp, AlertTriangle, 
  X, Sparkles, ArrowRightLeft, MoveRight, Zap 
} from 'lucide-react';
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

  useEffect(() => {
    calculateMissions();
  }, [transactions]);

  // Tính toán số dư và thu chi tháng
  const totalBalance = Array.isArray(wallets) ? wallets.reduce((acc, w) => acc + (w.balance || 0), 0) : 0;
  const mainWallet = wallets?.find(w => w.id === 'w1') || wallets?.[0];
  const backupWallet = wallets?.find(w => w.id === 'w2');

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const monthlyExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && 
            new Date(t.date).getMonth() === currentMonth && 
            new Date(t.date).getFullYear() === currentYear)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const calculateMissions = () => {
      const ms = [];
      try {
        const projects = StorageService.getIncomeProjects() || [];
        projects.filter(p => p.status === 'in_progress').forEach(p => {
            const incomplete = p.milestones?.filter(m => !m.isCompleted).length || 0;
            if (incomplete > 0) {
                ms.push({ type: 'project', text: `${p.name}: ${incomplete} việc` });
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
    } else {
      alert("Số dư Ví chính không đủ!");
    }
  };

  // Lấy 5 giao dịch gần nhất
  const recentTransactions = [...transactions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);

  const getFontSizeClass = (balance: number = 0) => {
    const len = formatVND(balance).length;
    if (len > 15) return 'text-2xl';
    if (len > 12) return 'text-3xl';
    return 'text-4xl';
  };

  const activeBalance = activeWalletTab === 'main' ? (mainWallet?.balance || 0) : (backupWallet?.balance || 0);

  return (
    <div className="p-4 space-y-6 pt-10 animate-in fade-in duration-700">
      
      {/* Header: Tổng tài sản */}
      <div className="flex justify-between items-center px-2">
        <div className="space-y-1">
          <h1 className="text-foreground/40 text-[9px] font-black tracking-[0.3em] uppercase">Tổng tài sản hiện có</h1>
          <div className={`font-[1000] text-white tracking-tighter transition-all duration-500 ${getFontSizeClass(totalBalance)}`}>
            {formatVND(totalBalance)}
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-4 glass-card rounded-[1.5rem] text-primary hover:scale-110 transition-all active:scale-90"
        >
          <Settings size={22} className="animate-[spin_15s_linear_infinite]" />
        </button>
      </div>

      {/* Wallet Tabs & Display */}
      <div className="space-y-4">
          <div className="p-1 glass-card bg-white/5 rounded-[2rem] flex border-0">
            <button 
              onClick={() => setActiveWalletTab('main')}
              className={`flex-1 py-3 text-[10px] font-black rounded-[1.75rem] transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${activeWalletTab === 'main' ? 'bg-primary text-white shadow-lg' : 'text-foreground/40'}`}
            >
              <WalletIcon size={14} /> {mainWallet?.name || 'VÍ CHÍNH'}
            </button>
            <button 
              onClick={() => setActiveWalletTab('backup')}
              className={`flex-1 py-3 text-[10px] font-black rounded-[1.75rem] transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${activeWalletTab === 'backup' ? 'bg-emerald-500 text-white shadow-lg' : 'text-foreground/40'}`}
            >
              <ShieldCheck size={14} /> {backupWallet?.name || "DỰ PHÒNG"}
            </button>
          </div>

          <div className="glass-card bg-gradient-to-br from-white/[0.05] to-transparent rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl">
              <p className="text-foreground/30 text-[10px] mb-2 font-black tracking-widest uppercase">Số dư ví hiện tại</p>
              <div className="flex items-center justify-between mb-8">
                  <p className={`font-[1000] text-4xl tracking-tighter ${activeWalletTab === 'backup' ? 'text-emerald-400' : 'text-white'}`}>
                      {formatVND(activeBalance)}
                  </p>
                  {activeWalletTab === 'main' && (
                    <button onClick={() => setShowTransferModal(true)} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-primary hover:bg-white/20 transition-all">
                      <ArrowRightLeft size={20} />
                    </button>
                  )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 p-4 rounded-3xl border border-emerald-500/20">
                      <span className="text-[9px] text-emerald-500/60 block font-black uppercase mb-1">Thu tháng này</span>
                      <span className="text-emerald-400 text-lg font-black">{formatVND(monthlyIncome)}</span>
                  </div>
                  <div className="bg-rose-500/10 p-4 rounded-3xl border border-rose-500/20">
                      <span className="text-[9px] text-rose-500/60 block font-black uppercase mb-1">Chi tháng này</span>
                      <span className="text-rose-400 text-lg font-black">{formatVND(monthlyExpense)}</span>
                  </div>
              </div>
          </div>
      </div>

      {/* AI Insight Section */}
      <div className="glass-card bg-primary/10 p-5 rounded-[2rem] flex items-center justify-between border-primary/20">
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                  <Zap size={24} fill="white" />
              </div>
              <div>
                  <h3 className="text-[9px] font-black text-primary uppercase tracking-widest">AI Insight</h3>
                  <p className="text-sm font-black text-white uppercase">{missions.length} Việc cần xử lý</p>
              </div>
          </div>
          <button onClick={() => setShowMissionModal(true)} className="bg-primary text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
              XỬ LÝ
          </button>
      </div>

      {/* Nhật ký dữ liệu */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden bg-white/[0.02]">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-foreground/40">Nhật ký dữ liệu</h3>
            <div className="flex bg-white/5 p-1 rounded-xl">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'text-foreground/30'}`}><List size={16} /></button>
                <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg ${viewMode === 'calendar' ? 'bg-primary text-white' : 'text-foreground/30'}`}><Calendar size={16} /></button>
            </div>
        </div>
        
        <div className="p-2 min-h-[200px]">
            {viewMode === 'list' ? (
                <div className="space-y-1">
                    {recentTransactions.length > 0 ? recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${tx.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                    {tx.type === TransactionType.INCOME ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                                </div>
                                <div>
                                    <p className="font-black text-white text-[13px] uppercase tracking-tight">{tx.description || 'Giao dịch'}</p>
                                    <p className="text-[9px] text-foreground/40 font-bold uppercase">{VI.category[tx.category] || tx.category}</p>
                                </div>
                            </div>
                            <span className={`font-black text-sm ${tx.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-white'}`}>
                                {tx.type === TransactionType.INCOME ? '+' : '-'}{formatVND(tx.amount)}
                            </span>
                        </div>
                    )) : (
                        <div className="py-16 text-center text-foreground/20 font-black uppercase text-[10px] tracking-widest">Chưa có dữ liệu</div>
                    )}
                </div>
            ) : (
                <CalendarView transactions={transactions} />
            )}
        </div>
      </div>
    </div>
  );
};
