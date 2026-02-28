import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Transaction, TransactionType, User, ProsperityPlan, ButlerType, UserGender, Category, Rank } from '../types';
import { ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, Settings, Calendar, List, ShieldCheck, TrendingUp, AlertTriangle, Target, Zap, X, Sparkles, ArrowRightLeft, MoveRight, PartyPopper, HeartPulse, ChevronRight, Activity, Ban, Bot, Loader2, Cpu, Rocket, CheckCircle2, Trophy, Coins, ArrowRight, Clock, MessageSquareQuote, Medal, Award, Diamond } from 'lucide-react';
import { CATEGORY_COLORS } from '../constants';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { CalendarView } from './CalendarView';
import { StorageService } from '../services/storageService';
import { AiService } from '../services/aiService';
import { AuthService } from '../services/firebase';
import { DataGuard } from '../utils/dataGuard';

interface Props {
  wallets: Wallet[];
  transactions: Transaction[];
  users: User[];
  onOpenSettings: () => void;
  onRefresh: () => void;
  onOpenFuture: () => void;
}

const SimpleButler = ({ type }: { type: ButlerType }) => {
  return (
    <div className="w-full h-full relative group">
      <svg width="80" height="80" viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl transition-transform duration-500 group-hover:scale-110">
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
        <ellipse cx="50" cy="85" rx="35" ry="10" fill="url(#goldGrad)" opacity="0.3" />
        {type === ButlerType.MALE ? (
          <g>
            {/* Suit/Tuxedo body */}
            <path d="M50 20 L80 45 L70 85 L30 85 L20 45 Z" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
            {/* Shirt */}
            <path d="M50 20 L60 35 L50 50 L40 35 Z" fill="#fff" />
            {/* Bowtie */}
            <path d="M45 35 L55 35 L52 40 L55 45 L45 45 L48 40 Z" fill="#000" />
            {/* Head */}
            <circle cx="50" cy="15" r="10" fill="#f5d0c5" />
            {/* Hair */}
            <path d="M40 12 Q50 2 60 12 L60 15 Q50 10 40 15 Z" fill="#2c1e1a" />
          </g>
        ) : (
          <g>
            {/* Dress body */}
            <path d="M50 20 L85 85 L15 85 Z" fill="url(#goldGrad)" stroke="#926B07" strokeWidth="1" />
            {/* Waist */}
            <rect x="40" y="45" width="20" height="5" fill="#fff" opacity="0.5" />
            {/* Head */}
            <circle cx="50" cy="15" r="10" fill="#f5d0c5" />
            {/* Long Hair */}
            <path d="M40 15 Q30 30 35 50 M60 15 Q70 30 65 50" stroke="#4a3728" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M40 12 Q50 2 60 12" fill="#4a3728" />
            {/* Crown */}
            <path d="M42 5 L50 -2 L58 5 L50 2 Z" fill="#FFD700" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const Dashboard: React.FC<Props> = ({ wallets = [], transactions = [], users = [], onOpenSettings, onRefresh, onOpenFuture }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeWalletTab, setActiveWalletTab] = useState<'main' | 'backup'>('main');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');

  const [isAllocationSuccessOpen, setIsAllocationSuccessOpen] = useState(false);
  const [allocationSuccessQuote, setAllocationSuccessQuote] = useState('');
  const [successAmount, setSuccessAmount] = useState(0);

  const activeUser = users[0];
  const butlerType = activeUser?.butlerPreference || ButlerType.MALE;
  const butlerName = butlerType === ButlerType.MALE
    ? (activeUser?.maleButlerName || VI.butler.maleName)
    : (activeUser?.femaleButlerName || VI.butler.femaleName);
  const userGender = activeUser?.gender || UserGender.MALE;
  const aiBrain = StorageService.getAiBrain();

  const butlerQuote = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeValue = hours * 100 + minutes;
    let timeKey: 'morning' | 'noon' | 'afternoon' | 'evening' = 'morning';
    if (timeValue >= 0 && timeValue <= 1130) timeKey = 'morning';
    else if (timeValue > 1130 && timeValue <= 1330) timeKey = 'noon';
    else if (timeValue > 1330 && timeValue <= 1700) timeKey = 'afternoon';
    else timeKey = 'evening';
    const availableQuotes = VI.butler.quotes[timeKey];
    const title = userGender === UserGender.FEMALE ? VI.butler.mistressLabel : VI.butler.masterLabel;
    const randomIdx = Math.floor(Math.random() * availableQuotes.length);
    return availableQuotes[randomIdx].replace(/{title}/g, title);
  }, [userGender]);

  const [isProsperityOpen, setIsProsperityOpen] = useState(false);
  const [prosperityData, setProsperityData] = useState<ProsperityPlan | null>(null);
  const [isLoadingProsperity, setIsLoadingProsperity] = useState(false);
  const [currentBrainForData, setCurrentBrainForData] = useState<'gemini' | 'llama' | null>(null);

  const totalBalance = useMemo(() => {
    const total = Array.isArray(wallets)
      ? wallets.reduce((acc, w) => acc + DataGuard.asNumber(w.balance), 0)
      : 0;
    console.log("[Dashboard] Calculated total balance:", total, "from wallets:", wallets);
    return total;
  }, [wallets]);

  const mainWallet = useMemo(() => wallets?.find(w => w.id === 'w1') || wallets?.[0], [wallets]);
  const backupWallet = useMemo(() => wallets?.find(w => w.id === 'w2'), [wallets]);

  useEffect(() => {
    // Đảm bảo dữ liệu luôn mới nhất khi vào Dashboard
    console.log("[Dashboard] Refreshing data, current wallets:", wallets);
    onRefresh();
  }, []);

  const handleOpenProsperity = async () => {
    setIsProsperityOpen(true);
    if (!prosperityData || currentBrainForData !== aiBrain) {
      setIsLoadingProsperity(true);
      const result = await AiService.generateProsperityPlan(transactions, StorageService.getFixedCosts(), StorageService.getIncomeProjects(), StorageService.getGoals());
      setProsperityData(result);
      setCurrentBrainForData(aiBrain);
      setIsLoadingProsperity(false);
    }
  };

  const createConfetti = () => {
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];
    for (let i = 0; i < 40; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.width = Math.random() * 8 + 4 + 'px';
      confetti.style.height = confetti.style.width;
      confetti.style.animationDelay = Math.random() * 2 + 's';
      confetti.style.animationDuration = Math.random() * 2 + 3 + 's';
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 4500);
    }
  };

  const handleQuickTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ FIX: parse theo chuẩn toàn app (không dùng replace + parseFloat)
    const numericAmount = parseNumberInput(transferAmount);

    if (!numericAmount || numericAmount <= 0 || !mainWallet) {
      alert("Vui lòng nhập số tiền hợp lệ!");
      return;
    }

    // ✅ FIX: so sánh số dư an toàn (tránh balance dạng string/dirty)
    const mainBalance = DataGuard.asNumber(mainWallet.balance);
    if (numericAmount > mainBalance) {
      alert("Số dư Ví chính không đủ để thực hiện trích lập!");
      return;
    }

    const success = await StorageService.transferFunds(mainWallet.id, 'w2', numericAmount, 'Trích lập quỹ thủ công');
    if (success) {
      const currentUser = AuthService.getAuth()?.currentUser;
      if (currentUser) {
        AuthService.logBehavior('manual_fund_allocation', { amount: numericAmount, from: mainWallet.name, to: 'Backup Fund' }, currentUser.email || '', currentUser.uid);
      }
      const celebrationQuotes = [
        'Cậu chủ đang đầu tư cho tương lai đấy à? Khá khen cho sự kỷ luật này! 💎',
        'Ví dự phòng lại dày thêm một chút, tôi bắt đầu thấy nể Cậu rồi. 🏰',
        'Tích tiểu thành đại, đường tới phi cơ riêng không còn xa! 🚀',
        'Sự kỷ luật này thật quyến rũ, Cậu chủ định làm tỷ phú thật sao? 👑',
        'Một bước đi thông minh! Cái ví của Người vừa nở một nụ cười mãn nguyện đấy. 😊',
        'Người vừa gieo một hạt giống giàu có, tôi sẽ chăm sóc nó thật tốt. 🌱',
        'Thật đáng kinh ngạc! Người đã vượt qua cám dỗ chi tiêu để tích lũy. 🦾',
        'Dòng tiền đang chảy đúng hướng. Tương lai của Người đang sáng dần lên! 🌅',
        'Tự do tài chính không còn là giấc mơ nếu Người cứ tiếp tục như thế này. 🕊️',
        'Cảm ơn Người đã không tiêu hết số tiền này vào những thứ vô bổ! 🤵‍♂️'
      ];
      const randomQuote = celebrationQuotes[Math.floor(Math.random() * celebrationQuotes.length)];
      setSuccessAmount(numericAmount);
      setAllocationSuccessQuote(randomQuote);
      setTransferAmount('');
      setShowTransferModal(false);
      setIsAllocationSuccessOpen(true);
      createConfetti();
      onRefresh();
    } else {
      alert("Đã có lỗi xảy ra, vui lòng thử lại!");
    }
  };

  const recentTransactions = Array.isArray(transactions)
    ? [...transactions].sort((a, b) => DataGuard.asNumber(b.timestamp) - DataGuard.asNumber(a.timestamp)).slice(0, 15)
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

  const activeBalance = activeWalletTab === 'main' ? DataGuard.asNumber(mainWallet?.balance) : DataGuard.asNumber(backupWallet?.balance);
  console.log("[Dashboard] Active balance:", activeBalance, "Active tab:", activeWalletTab, "Main wallet balance:", mainWallet?.balance);
  const gamification = StorageService.getGamificationState();

  return (
    <div className="space-y-8 pt-8 animate-in fade-in duration-1000">
      <div className="flex justify-between items-center px-1 relative z-50">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg neon-glow-${gamification.rank.toLowerCase()} bg-surface shrink-0 relative group`}>
            {gamification.rank === Rank.IRON && <Medal size={24} className="text-slate-400" />}
            {gamification.rank === Rank.BRONZE && <Medal size={24} className="text-orange-600" />}
            {gamification.rank === Rank.SILVER && <Medal size={24} className="text-slate-300" />}
            {gamification.rank === Rank.GOLD && <Medal size={24} className="text-gold" />}
            {gamification.rank === Rank.PLATINUM && <Award size={24} className="text-cyan-400" />}
            {gamification.rank === Rank.EMERALD && <Award size={24} className="text-emerald-400" />}
            {gamification.rank === Rank.DIAMOND && <Diamond size={24} className="text-blue-400 animate-pulse" />}

            {/* XP Circle Overlay */}
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-surface shadow-lg">
              <Zap size={10} className="text-white fill-current" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-foreground/40 text-[10px] font-extrabold tracking-[0.2em] uppercase leading-relaxed">Quản trị tài chính</h1>
            <div className={`font-black text-foreground tracking-tight filter drop-shadow-sm transition-all duration-300 ${getDynamicFontSizeClass(totalBalance, true)}`}>
              {formatVND(totalBalance)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenFuture} className="p-4 glass-card bg-primary/10 rounded-[1.5rem] text-primary hover:bg-primary/20 transition-all active:scale-90 border-0 shadow-xl relative z-[60]">
            <Rocket size={22} className="animate-pulse" />
          </button>
          <button onClick={onOpenSettings} className="p-4 glass-card bg-surface/80 rounded-[1.5rem] text-foreground/40 hover:text-primary transition-all active:scale-90 border-0 shadow-xl relative z-[60]">
            <Settings size={22} className="animate-[spin_20s_linear_infinite]" />
          </button>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="p-1.5 glass-card bg-gradient-to-r from-primary/20 via-surface/40 to-secondary/20 rounded-[2rem] shadow-2xl border-0">
          <div className="flex relative">
            <button onClick={() => setActiveWalletTab('main')} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined flex items-center justify-center gap-3 ${activeWalletTab === 'main' ? 'bg-primary text-white shadow-xl neon-glow-primary' : 'text-foreground/40 hover:text-foreground/60'}`}>
              <WalletIcon size={14} /> {mainWallet?.name?.toUpperCase() || 'VÍ CHÍNH'}
            </button>
            <button onClick={() => setActiveWalletTab('backup')} className={`relative z-10 flex-1 py-4 text-[11px] font-bold rounded-[1.5rem] transition-all uppercase tracking-refined flex items-center justify-center gap-3 ${activeWalletTab === 'backup' ? 'bg-secondary text-white shadow-xl neon-glow-secondary' : 'text-foreground/40 hover:text-foreground/60'}`}>
              <ShieldCheck size={14} /> {backupWallet?.name?.toUpperCase() || "DỰ PHÒNG"}
            </button>
          </div>
        </div>

        <div className={`glass-card liquid-glass rounded-[3rem] p-10 relative overflow-hidden group transition-all duration-700 border-0 shadow-2xl ${activeWalletTab === 'main' ? 'bg-gradient-to-br from-primary/20 via-surface/60 to-primary/5' : 'bg-gradient-to-br from-secondary/20 via-surface/60 to-secondary/5'}`}>
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-foreground/30 text-[11px] font-bold tracking-[0.1em] uppercase">Số dư quản lý</p>
                <p className={`font-black tracking-tight leading-tight transition-all duration-500 whitespace-nowrap ${activeWalletTab === 'backup' ? 'text-secondary' : 'text-foreground'} ${getDynamicFontSizeClass(activeBalance)}`}>
                  {formatVND(activeBalance)}
                </p>
              </div>
              {activeWalletTab === 'main' && (
                <button onClick={() => setShowTransferModal(true)} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg neon-glow-primary active:scale-95 transition-all border-2 border-primary/20">
                  <ArrowRightLeft size={22} />
                </button>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-foreground/5 flex items-center gap-5">
              <div className="shrink-0 animate-float-coin w-20 h-20 flex items-center justify-center relative">
                <SimpleButler type={butlerType} />
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center shadow-lg ${aiBrain === 'llama' ? 'bg-secondary' : 'bg-primary'}`}>
                  {aiBrain === 'llama' ? <Cpu size={12} className="text-white" /> : <Sparkles size={12} className="text-white" />}
                </div>
              </div>
              <div className="flex-1">
                <div className="relative glass-card bg-foreground/[0.03] p-4 rounded-2xl rounded-tl-none border-0 shadow-inner group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em]">{butlerName}</span>
                    <div className="h-[1px] flex-1 bg-primary/10"></div>
                  </div>
                  <p className="font-comic text-[16px] text-foreground font-bold leading-relaxed">{butlerQuote}</p>
                  <div className="absolute top-0 left-[-8px] w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-foreground/[0.03] border-b-[8px] border-b-transparent"></div>
                  <div className="absolute -bottom-2 -right-1">
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${aiBrain === 'llama' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                      {aiBrain === 'llama' ? 'Llama Brain' : 'Gemini Brain'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-1">
        <div className="glass-card liquid-glass p-7 rounded-[2.5rem] border-0 shadow-xl bg-gradient-to-br from-surface/50 to-background flex flex-col gap-6 relative overflow-hidden group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
              <HeartPulse size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em] mb-1">Đánh giá sức khỏe</h3>
              <p className="text-[14px] font-semibold text-foreground uppercase tracking-tight">Ổn định & Kỳ vọng</p>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
              <div className="absolute inset-0 border-4 border-primary rounded-full animate-pulse opacity-20"></div>
              <span className="text-[14px] font-black text-primary">85</span>
            </div>
          </div>
          <button onClick={handleOpenProsperity} className="w-full bg-primary text-white py-3 rounded-[1.5rem] font-extrabold text-[10px] uppercase tracking-refined shadow-[0_10px_20px_rgba(139,92,246,0.3)] neon-glow-primary active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20">
            Tăng tốc thịnh vượng <Zap size={16} fill="currentColor" />
          </button>
        </div>
      </div>

      {/* Prosperity Modal - UPGRADED TO LORD DIAMOND MISSION STYLE */}
      {isProsperityOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4 overflow-hidden">
          <div className="glass-card w-full max-w-[420px] h-[85vh] sm:h-[90vh] flex flex-col rounded-[3.5rem] border-0 shadow-2xl bg-surface overflow-hidden animate-in zoom-in-95 duration-500 relative">

            {/* Decorative Background Blob */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] -mr-16 -mt-16 opacity-40"></div>

            <div className="p-8 pb-4 flex justify-between items-center shrink-0 border-b border-foreground/5 bg-surface/80 backdrop-blur-md z-10">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight uppercase leading-none">LỘ TRÌNH THỊNH VƯỢNG</h3>
                <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                  <Bot size={12} className="text-primary" /> {butlerName} Analysis
                </p>
              </div>
              <button onClick={() => setIsProsperityOpen(false)} className="p-3 bg-foreground/5 rounded-2xl hover:bg-foreground/10 text-foreground transition-all"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 sm:p-8 space-y-12 pb-12">
              {isLoadingProsperity ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8 py-20">
                  <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center neon-glow-primary animate-pulse">
                    <Zap size={48} fill="currentColor" />
                  </div>
                  <div className="text-center space-y-3">
                    <p className="text-lg font-bold text-foreground uppercase tracking-tight">AI đang quét dòng tiền...</p>
                    <p className="text-[10px] font-medium text-foreground/30 uppercase tracking-widest text-center mx-auto">Đang chuẩn bị báo cáo xéo xắt</p>
                  </div>
                </div>
              ) : prosperityData ? (
                <>
                  {/* Header Card */}
                  <div className="glass-card bg-gradient-to-br from-primary/10 via-surface/40 to-transparent p-8 rounded-[3rem] border-0 text-center space-y-6 shadow-inner relative overflow-hidden group">
                    <div className="text-6xl mb-2 filter drop-shadow-xl">{prosperityData.statusEmoji}</div>
                    <h4 className="text-2xl font-[1000] text-foreground tracking-tighter uppercase leading-tight px-2">{prosperityData.statusTitle || "ĐẠI PHÚ HÀO TIỀM NĂNG"}</h4>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">Năng lực tích lũy</span>
                        <span className="text-[11px] font-black text-primary">{prosperityData.healthScore}/100</span>
                      </div>
                      <div className="h-3 w-full bg-foreground/5 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${prosperityData.healthScore}%` }}></div>
                      </div>
                    </div>

                    <div className="relative p-5 bg-foreground/[0.03] rounded-2xl border border-foreground/5 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-primary uppercase tracking-widest">Góp ý thu chi:</p>
                        <p className="font-comic text-[14px] text-foreground font-bold leading-relaxed italic">
                          "{prosperityData.spendingVsIncomeFeedback}"
                        </p>
                      </div>
                      <div className="h-[1px] bg-foreground/5"></div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-secondary uppercase tracking-widest">Ghi nhận thu nhập:</p>
                        <p className="font-comic text-[14px] text-foreground font-bold leading-relaxed italic">
                          "{prosperityData.incomeRecognition}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BLOCK 1: NHIỆM VỤ HÀNG NGÀY */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 ml-2">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
                        <Target size={20} />
                      </div>
                      <h5 className="text-[11px] font-black text-foreground/40 uppercase tracking-[0.2em]">3 NHIỆM VỤ CHIẾN LƯỢC</h5>
                    </div>
                    <div className="space-y-4">
                      {prosperityData.dailyTasks.map((s, i) => (
                        <div key={i} className="glass-card bg-surface border border-foreground/5 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-all"></div>
                          <p className="text-[14px] font-black text-foreground uppercase tracking-tight mb-2">{s.title}</p>
                          <p className="text-[12px] font-medium text-foreground/50 leading-relaxed">{s.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bad Habit Alert */}
                  {prosperityData.badHabitToQuit && (
                    <div className="p-6 bg-warning/5 rounded-[2.5rem] border border-warning/10 flex gap-4 items-start">
                      <AlertTriangle size={20} className="text-warning shrink-0 mt-1" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-warning uppercase tracking-widest">BÁO ĐỘNG THÓI QUEN</p>
                        <p className="text-[13px] font-bold text-foreground/80">{prosperityData.badHabitToQuit.habit}</p>
                        <p className="text-[11px] font-medium text-foreground/40 leading-relaxed-tight italic">{prosperityData.badHabitToQuit.why}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Button moved inside scroll */}
                  <div className="pt-4 pb-4">
                    <button
                      onClick={() => setIsProsperityOpen(false)}
                      className="w-full bg-primary text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-xl neon-glow-primary border border-white/10"
                    >
                      TUÂN LỆNH QUẢN GIA ✨
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Existing other parts... */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border-0 shadow-xl relative z-10">
        <div className="p-7 border-b border-foreground/5 flex justify-between items-center bg-foreground/[0.02]">
          <h3 className="font-bold text-[10px] uppercase tracking-refined text-foreground/40">Nhật ký dữ liệu</h3>
          <div className="flex glass-card p-1.5 rounded-2xl bg-foreground/5 border-0">
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><List size={18} /></button>
            <button onClick={() => setViewMode('calendar')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-primary text-white neon-glow-primary' : 'text-foreground/30'}`}><Calendar size={18} /></button>
          </div>
        </div>
        <div className="min-h-[200px] p-4">
          {viewMode === 'list' ? (
            <div className="space-y-4">
              {recentTransactions.length > 0 ? recentTransactions.map((tx) => {
                const txDate = new Date((tx as any).createdAt || tx.date);
                const timeStr = txDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
                const dateStr = txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const catLabel = tx.type === TransactionType.TRANSFER ? 'Nội bộ' : ((VI.category as any)[tx.category] || tx.category);

                return (
                  <div key={tx.id} className="flex items-center justify-between p-5 rounded-[2rem] hover:bg-foreground/[0.04] transition-all group active:scale-[0.98] border border-transparent hover:border-foreground/5 shadow-sm mb-1">
                    <div className="flex items-center space-x-5 flex-1 min-w-0">
                      <div className="w-12 h-12 shrink-0 rounded-[1.25rem] flex items-center justify-center text-white transition-all group-hover:rotate-6 shadow-lg" style={{ background: tx.type === TransactionType.INCOME ? 'linear-gradient(135deg, #10b981, #064e3b)' : tx.type === TransactionType.TRANSFER ? 'linear-gradient(135deg, #8b5cf6, #4c1d95)' : `linear-gradient(135deg, ${CATEGORY_COLORS[tx.category] || '#64748b'}, #00000044)` }}>
                        {tx.type === TransactionType.INCOME ? <ArrowUpRight size={20} strokeWidth={3} /> : tx.type === TransactionType.TRANSFER ? <ArrowRightLeft size={20} strokeWidth={3} /> : <ArrowDownRight size={20} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col space-y-1.5">
                        <div className="flex justify-between items-center w-full gap-2">
                          <p className="font-black text-foreground text-[14px] uppercase tracking-tight truncate leading-tight">
                            {catLabel}
                          </p>
                          <span className={`font-black text-[16px] tracking-tighter shrink-0 whitespace-nowrap leading-tight ${tx.type === TransactionType.INCOME ? 'text-secondary' : tx.type === TransactionType.TRANSFER ? 'text-primary' : 'text-foreground'}`}>
                            {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.TRANSFER ? '⇄' : '-'}{formatVND(tx.amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-foreground/40 font-bold uppercase tracking-widest leading-none">
                          <div className="flex items-center gap-1"><Calendar size={10} strokeWidth={3} className="text-warning" /> {dateStr}</div>
                          <div className="flex items-center gap-1"><Clock size={10} strokeWidth={3} /> {timeStr}</div>
                        </div>
                        <p className="text-[10px] text-foreground/30 font-semibold truncate leading-none italic tracking-refined">
                          {tx.description || 'Không có mô tả'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-20 text-center text-foreground/20 font-bold uppercase text-[10px] tracking-widest leading-relaxed">Chưa có dữ liệu</div>
              )}
            </div>
          ) : (
            <div className="p-2"><CalendarView transactions={transactions} /></div>
          )}
        </div>
      </div>

      {showTransferModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-6">
          <div className="glass-card w-full max-w-[360px] rounded-[3.5rem] p-10 border-0 shadow-2xl bg-surface animate-in zoom-in-95 relative">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-[1000] text-foreground tracking-tighter uppercase leading-none">Trích lập quỹ</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-2 bg-foreground/5 rounded-2xl hover:bg-foreground/10 text-foreground transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleQuickTransfer} className="space-y-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Số tiền chuyển</label>
                <div className="relative glass-card bg-foreground/[0.03] p-6 rounded-[2.5rem] border-0 shadow-inner group">
                  <div className="flex items-center justify-between gap-4">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      placeholder="0"
                      className="w-full bg-transparent text-primary text-3xl font-[1000] tracking-refined focus:outline-none border-0 text-left placeholder:opacity-20"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(formatNumberInput(e.target.value))}
                    />
                    <span className="text-xl font-black text-primary/40 tracking-widest shrink-0">đ</span>
                  </div>
                </div>
                <p className="text-[9px] font-bold text-foreground/20 italic px-2 uppercase tracking-wide">Số dư sẽ được chuyển tức thì sang Quỹ dự phòng.</p>
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-white py-6 rounded-[2.25rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(139,92,246,0.3)] neon-glow-primary active:scale-90 transition-all border border-white/20"
              >
                XÁC NHẬN CHUYỂN
              </button>
            </form>
          </div>
        </div>
      )}

      {isAllocationSuccessOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4 animate-in fade-in duration-500 overflow-hidden">
          <div className="glass-card w-[92%] max-w-[420px] mx-auto rounded-[3.5rem] px-6 py-10 sm:p-12 text-center border-0 shadow-2xl bg-gradient-to-br from-secondary/10 via-surface to-background relative overflow-hidden animate-in zoom-in-95 duration-500 box-border">
            <div className="absolute top-0 left-0 w-full h-2.5 bg-gradient-to-r from-emerald-400 via-secondary to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <div className="space-y-10 relative z-10">
              <div className="flex justify-center items-end gap-3 h-32 relative">
                <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center shadow-lg transform -rotate-12 animate-bounce">
                  <Trophy size={28} />
                </div>
                <div className="w-24 h-24 bg-secondary text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl neon-glow-secondary z-20 animate-pulse">
                  <PartyPopper size={50} strokeWidth={2.5} />
                </div>
                <div className="w-18 h-18 bg-emerald-100/10 text-emerald-400 rounded-2xl flex items-center justify-center shadow-lg transform rotate-12 animate-bounce delay-300">
                  <Coins size={36} />
                </div>
              </div>
              <div className="space-y-5">
                <div className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 border border-secondary/20 mb-2">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.5em] animate-pulse">TRÍCH LẬP THÀNH CÔNG</h3>
                </div>
                <h4 className="text-2xl sm:text-3xl font-[1000] text-foreground tracking-tighter uppercase leading-tight drop-shadow-sm">AN TÂM TÍCH LŨY</h4>
                <div className="px-4">
                  <p className="font-comic text-xl text-foreground font-bold leading-relaxed-tight italic opacity-90 tracking-refined px-[15px]">
                    "{allocationSuccessQuote}"
                  </p>
                </div>
              </div>
              <div className="glass-card bg-foreground/[0.04] p-6 sm:p-8 rounded-[3rem] border-0 shadow-inner relative overflow-hidden">
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest mb-1 relative z-10">SỐ TIỀN VỪA CẤT GIỮ</p>
                <p className="text-3xl sm:text-4xl font-[1000] text-secondary tracking-tighter relative z-10 neon-glow-secondary-text break-words overflow-wrap-anywhere">
                  {formatVND(successAmount)}
                </p>
                <div className="absolute inset-0 bg-gradient-to-tr from-secondary/5 via-transparent to-primary/5"></div>
              </div>
              <button
                onClick={() => setIsAllocationSuccessOpen(false)}
                className="w-full bg-secondary text-white font-[1000] py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.4em] shadow-[0_25px_50px_rgba(16,185,129,0.5)] neon-glow-secondary active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20"
              >
                TIẾP TỤC TĂNG TỐC <ArrowRight size={22} />
              </button>
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-secondary/20 rounded-full blur-3xl"></div>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      )}
    </div>
  );
};