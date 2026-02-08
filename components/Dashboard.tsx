
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Transaction, TransactionType, User, ProsperityPlan, ButlerType, UserGender } from '../types';
import { ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, Settings, Calendar, List, ShieldCheck, TrendingUp, AlertTriangle, Target, Zap, X, Sparkles, ArrowRightLeft, MoveRight, PartyPopper, HeartPulse, ChevronRight, Activity, Ban, Bot, Loader2, Cpu } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';
import { CalendarView } from './CalendarView';
import { StorageService } from '../services/storageService';
import { GeminiService } from '../services/aiService';

interface Props {
  wallets: Wallet[];
  transactions: Transaction[];
  users: User[];
  onOpenSettings: () => void;
  onRefresh: () => void;
}

// Luxurious Icon Butler Component
const SimpleButler = ({ type }: { type: ButlerType }) => {
  return (
    <svg width="80" height="80" viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#FFD700', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#B8860B', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4fc3f7', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#0288d1', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#01579b', stopOpacity: 1 }} />
        </linearGradient>
      </defs>

      {/* Base Coins for both */}
      <ellipse cx="50" cy="80" rx="35" ry="10" fill="url(#goldGrad)" opacity="0.6" />
      <ellipse cx="50" cy="75" rx="30" ry="8" fill="url(#goldGrad)" />
      
      {type === ButlerType.MALE ? (
        <>
          {/* Blue Diamond for Male */}
          <path 
            d="M50 15 L75 35 L50 70 L25 35 Z" 
            fill="url(#diamondGrad)" 
            stroke="#fff" 
            strokeWidth="0.5"
          />
          <path d="M50 15 L60 35 L50 70 L40 35 Z" fill="rgba(255,255,255,0.3)" />
          <path d="M25 35 L75 35 L60 25 L40 25 Z" fill="rgba(255,255,255,0.2)" />
          {/* Sparkles */}
          <circle cx="35" cy="25" r="1.5" fill="white" className="animate-pulse" />
          <circle cx="65" cy="30" r="1" fill="white" className="animate-pulse" />
        </>
      ) : (
        <>
          {/* Queen Crown for Female */}
          <path 
            d="M25 65 L20 35 L35 45 L50 25 L65 45 L80 35 L75 65 Z" 
            fill="url(#goldGrad)" 
            stroke="#926B07" 
            strokeWidth="1"
          />
          <rect x="25" y="60" width="50" height="5" fill="#B8860B" />
          <circle cx="50" cy="25" r="3" fill="#E91E63" className="animate-pulse shadow-lg" />
          <circle cx="35" cy="45" r="2" fill="#fff" className="animate-pulse" />
          <circle cx="65" cy="45" r="2" fill="#fff" className="animate-pulse" />
        </>
      )}
    </svg>
  );
};

export const Dashboard: React.FC<Props> = ({ wallets = [], transactions = [], users = [], onOpenSettings, onRefresh }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeWalletTab, setActiveWalletTab] = useState<'main' | 'backup'>('main');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  
  // Butler State
  const activeUser = users[0];
  const butlerType = activeUser?.butlerPreference || ButlerType.MALE;
  const userGender = activeUser?.gender || UserGender.MALE;
  const aiBrain = StorageService.getAiBrain();
  
  const butlerQuote = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeValue = hours * 100 + minutes; // 13:30 -> 1330

    let timeKey: 'morning' | 'noon' | 'afternoon' | 'evening' = 'morning';

    if (timeValue >= 0 && timeValue <= 1130) {
      timeKey = 'morning';
    } else if (timeValue > 1130 && timeValue <= 1330) {
      timeKey = 'noon';
    } else if (timeValue > 1330 && timeValue <= 1700) {
      timeKey = 'afternoon';
    } else {
      timeKey = 'evening';
    }

    const availableQuotes = VI.butler.quotes[timeKey];
    const title = userGender === UserGender.FEMALE ? VI.butler.mistressLabel : VI.butler.masterLabel;
    const randomIdx = Math.floor(Math.random() * availableQuotes.length);
    return availableQuotes[randomIdx].replace(/{title}/g, title);
  }, [userGender]);

  // Prosperity AI State
  const [isProsperityOpen, setIsProsperityOpen] = useState(false);
  const [prosperityData, setProsperityData] = useState<ProsperityPlan | null>(null);
  const [isLoadingProsperity, setIsLoadingProsperity] = useState(false);

  const totalBalance = Array.isArray(wallets) ? wallets.reduce((acc, w) => acc + (w.balance || 0), 0) : 0;
  const mainWallet = wallets?.find(w => w.id === 'w1') || wallets?.[0];
  const backupWallet = wallets?.find(w => w.id === 'w2');

  const handleOpenProsperity = async () => {
      setIsProsperityOpen(true);
      if (!prosperityData) {
          setIsLoadingProsperity(true);
          const costs = StorageService.getFixedCosts();
          const projects = StorageService.getIncomeProjects();
          const goals = StorageService.getGoals();
          const result = await GeminiService.generateProsperityPlan(transactions, costs, projects, goals);
          setProsperityData(result);
          setIsLoadingProsperity(false);
      }
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
      
      {/* Header Area */}
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
        >
          <Settings size={22} className="animate-[spin_20s_linear_infinite]" />
        </button>
      </div>

      {/* Floating Wallet Card */}
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
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                             <p className="text-foreground/30 text-[11px] font-black tracking-widest uppercase">SỐ DƯ QUẢN LÝ</p>
                             <div className="flex items-center overflow-visible">
                                <p className={`font-[1000] tracking-tighter leading-tight transition-all duration-500 whitespace-nowrap ${activeWalletTab === 'backup' ? 'text-secondary' : 'text-foreground'} ${getDynamicFontSizeClass(activeBalance)}`}>
                                    {formatVND(activeBalance)}
                                </p>
                             </div>
                        </div>
                        {activeWalletTab === 'main' && mainWallet && (
                          <button 
                            onClick={() => setShowTransferModal(true)}
                            className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg neon-glow-primary active:scale-90 transition-all border-2 border-primary/20"
                          >
                            <ArrowRightLeft size={22} />
                          </button>
                        )}
                    </div>

                    {/* BUTLER SECTION */}
                    <div className="mt-8 pt-6 border-t border-foreground/5 flex items-center gap-5">
                         <div className="shrink-0 animate-float-coin w-20 h-20 flex items-center justify-center relative overflow-visible">
                             <SimpleButler type={butlerType} />
                             <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center shadow-lg ${aiBrain === 'llama' ? 'bg-secondary' : 'bg-primary'}`}>
                                 {aiBrain === 'llama' ? <Cpu size={12} className="text-white" /> : <Sparkles size={12} className="text-white" />}
                             </div>
                         </div>
                         <div className="flex-1">
                             <div className="relative glass-card bg-foreground/[0.03] p-4 rounded-2xl rounded-tl-none border-0 shadow-inner group">
                                 <p className="font-comic text-[16px] text-foreground font-bold leading-snug">
                                     {butlerQuote}
                                 </p>
                                 <div className="absolute top-0 left-[-8px] w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-foreground/[0.03] border-b-[8px] border-b-transparent"></div>
                                 <div className="absolute -bottom-2 -right-1">
                                     <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${aiBrain === 'llama' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                                         {aiBrain === 'llama' ? 'Llama Brain' : 'Gemini Brain'}
                                     </span>
                                 </div>
                             </div>
                         </div>
                    </div>
               </div>
          </div>
      </div>

      {/* Financial Health Assessment Block */}
      <div className="space-y-4 px-1">
          <div className="glass-card liquid-glass p-7 rounded-[2.5rem] border-0 shadow-xl bg-gradient-to-br from-surface/50 to-background flex flex-col gap-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
              
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
                          <HeartPulse size={24} />
                      </div>
                      <div>
                          <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em] mb-1">ĐÁNH GIÁ SỨC KHỎE</h3>
                          <p className="text-sm font-[900] text-foreground uppercase tracking-tight">Ổn định & Kỳ vọng</p>
                      </div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
                      <div className="absolute inset-0 border-4 border-primary rounded-full animate-pulse opacity-20"></div>
                      <span className="text-[12px] font-black text-primary">85</span>
                  </div>
              </div>

              <button 
                onClick={handleOpenProsperity}
                className="w-full bg-primary text-white py-5 rounded-[1.75rem] font-[1000] text-[11px] uppercase tracking-[0.3em] shadow-[0_15px_30px_rgba(139,92,246,0.4)] neon-glow-primary active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20"
              >
                TĂNG TỐC THỊNH VƯỢNG <Zap size={18} fill="currentColor" />
              </button>
          </div>
      </div>
      
      {/* Transaction History Block */}
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

      {/* PROSPERITY MODAL (AI DRIVEN) */}
      {isProsperityOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-3xl p-6 overflow-hidden">
              <div className="glass-card w-full max-md h-[90vh] flex flex-col rounded-[3.5rem] border-0 shadow-2xl bg-surface overflow-hidden relative animate-in zoom-in-95 duration-500">
                  <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-foreground/5">
                      <div>
                          <h3 className="text-xl font-[1000] text-foreground tracking-tighter uppercase leading-none">LỘ TRÌNH THỊNH VƯỢNG</h3>
                          <p className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.4em] mt-1.5 flex items-center gap-2">
                              <Sparkles size={10} className="text-primary" /> Mani AI Insights
                          </p>
                      </div>
                      <button onClick={() => setIsProsperityOpen(false)} className="p-3 bg-foreground/5 rounded-2xl hover:bg-foreground/10 text-foreground transition-all">
                          <X size={20} />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10 pb-20">
                      {isLoadingProsperity ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-8 py-20">
                              <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center neon-glow-primary animate-pulse relative overflow-hidden">
                                  <Zap size={48} fill="currentColor" />
                                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"></div>
                              </div>
                              <div className="text-center space-y-3">
                                  <p className="text-lg font-[900] text-foreground uppercase tracking-tight">AI ĐANG QUÉT DỮ LIỆU...</p>
                                  <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest max-w-[200px] leading-relaxed">Đang phân tích thói quen tiêu tiền vô tri của bạn</p>
                              </div>
                          </div>
                      ) : prosperityData ? (
                          <>
                              {/* Status Card */}
                              <div className="glass-card bg-gradient-to-br from-primary/10 to-transparent p-7 rounded-[2.5rem] border-0 text-center space-y-4">
                                  <div className="text-5xl mb-2">{prosperityData.statusEmoji}</div>
                                  <h4 className="text-2xl font-[1000] text-foreground tracking-tighter uppercase leading-tight">{prosperityData.statusTitle}</h4>
                                  <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden">
                                      <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${prosperityData.healthScore}%` }}></div>
                                  </div>
                                  <p className="text-xs font-bold text-foreground/60 leading-relaxed italic">"{prosperityData.summary}"</p>
                              </div>

                              {/* Savings Section */}
                              <div className="space-y-4">
                                  <h5 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2 flex items-center gap-2">
                                      <TrendingUp size={12} className="text-secondary" /> CHIẾN LƯỢC TIẾT KIỆM
                                  </h5>
                                  <div className="space-y-3">
                                      {prosperityData.savingsStrategies.map((s, i) => (
                                          <div key={i} className="glass-card bg-foreground/[0.03] p-5 rounded-[1.75rem] border-0 hover:bg-secondary/5 transition-all">
                                              <p className="text-[13px] font-[900] text-foreground uppercase tracking-tight mb-1">{s.title}</p>
                                              <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-tight leading-tight">{s.desc}</p>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              {/* Income Section */}
                              <div className="space-y-4">
                                  <h5 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2 flex items-center gap-2">
                                      <Activity size={12} className="text-primary" /> CHIẾN LƯỢC TĂNG THU
                                  </h5>
                                  <div className="space-y-3">
                                      {prosperityData.incomeStrategies.map((s, i) => (
                                          <div key={i} className="glass-card bg-foreground/[0.03] p-5 rounded-[1.75rem] border-0 hover:bg-primary/5 transition-all">
                                              <p className="text-[13px] font-[900] text-foreground uppercase tracking-tight mb-1">{s.title}</p>
                                              <p className="text-[11px] font-bold text-foreground/40 uppercase tracking-tight leading-tight">{s.desc}</p>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              {/* Bad Habit Section */}
                              <div className="space-y-4">
                                  <h5 className="text-[10px] font-black text-danger uppercase tracking-[0.3em] ml-2 flex items-center gap-2">
                                      <Ban size={12} /> CẢI THIỆN THÓI QUEN
                                  </h5>
                                  <div className="glass-card bg-danger/5 border-danger/10 p-6 rounded-[2rem] border relative overflow-hidden group">
                                      <div className="absolute top-0 right-0 p-4 text-danger opacity-10 rotate-12 group-hover:rotate-0 transition-all">
                                          <Ban size={48} />
                                      </div>
                                      <p className="text-sm font-[1000] text-danger uppercase tracking-tighter mb-2">BỎ NGAY: {prosperityData.badHabitToQuit.habit}</p>
                                      <p className="text-[11px] font-black text-danger/60 uppercase tracking-tight leading-relaxed italic">"{prosperityData.badHabitToQuit.why}"</p>
                                  </div>
                              </div>
                          </>
                      ) : (
                          <div className="text-center py-20 text-foreground/20 font-black uppercase text-xs">KHÔNG THỂ TẢI DỮ LIỆU</div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6">
              <div className="glass-card w-full max-sm rounded-[3rem] p-10 border-0 shadow-2xl bg-surface animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-10">
                      <h3 className="text-xl font-[1000] text-foreground tracking-tighter uppercase leading-none">TRÍCH LẬP QUỸ</h3>
                      <button onClick={() => setShowTransferModal(false)} className="p-2 bg-foreground/5 rounded-xl"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleQuickTransfer} className="space-y-8">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Số tiền chuyển</label>
                        <input 
                          type="number" autoFocus
                          className="w-full bg-foreground/5 text-primary text-3xl font-[1000] p-6 rounded-3xl focus:outline-none tracking-tighter"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="w-full bg-primary text-white py-6 rounded-[2rem] font-[1000] text-[11px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all">XÁC NHẬN CHUYỂN</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
