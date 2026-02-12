
import React, { useState, useEffect } from 'react';
import { TransactionType, Category, Wallet, FixedCost, UserGender, ButlerType } from '../types';
import { X, ArrowRight, CheckCircle2, TrendingUp, TrendingDown, ArrowRightLeft, Plus, Wallet as WalletIcon, FileText, MoveRight, Sparkles, Heart, ReceiptText, Loader2, PartyPopper, ShieldCheck, Trophy, Star, MessageCircle } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { getRandomSarcasm } from '../constants/sarcasm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  wallets: Wallet[];
}

const analytics = {
    logEvent: (name: string, params?: any) => {
      console.log(`[Analytics Event] ${name}:`, params);
    }
};

const LordDiamondAvatar = () => (
  <div className="relative w-24 h-24 mx-auto mb-4 group">
    <div className="absolute inset-0 bg-[#00FF7F]/20 rounded-full blur-xl group-hover:bg-[#00FF7F]/40 transition-all duration-500 animate-pulse"></div>
    <div className="relative bg-white/10 backdrop-blur-md border-2 border-[#00FF7F]/30 rounded-full w-full h-full flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(0,255,127,0.2)]">
      <svg width="60" height="60" viewBox="0 0 100 100" className="drop-shadow-lg">
        <defs>
          <linearGradient id="butlerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#4fc3f7', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#01579b', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <path d="M50 15 L75 35 L50 70 L25 35 Z" fill="url(#butlerGrad)" stroke="#fff" strokeWidth="0.5" />
        <path d="M50 15 L60 35 L50 70 L40 35 Z" fill="rgba(255,255,255,0.3)" />
        <path d="M25 35 L75 35 L60 25 L40 25 Z" fill="rgba(255,255,255,0.2)" />
        <circle cx="35" cy="25" r="1.5" fill="#00FF7F" className="animate-pulse" />
        <circle cx="65" cy="30" r="1" fill="#00FF7F" className="animate-pulse" />
      </svg>
    </div>
  </div>
);

export const TransactionForm: React.FC<Props> = ({ isOpen, onClose, onSubmit, wallets }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>(Category.FOOD);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [toBillId, setToBillId] = useState('');
  const [internalMode, setInternalMode] = useState<'wallet' | 'bill'>('wallet');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [randomMsg, setRandomMsg] = useState('');

  const activeUser = StorageService.getUsers()[0];
  const userTitle = activeUser?.gender === UserGender.FEMALE ? VI.butler.mistressLabel : VI.butler.masterLabel;

  useEffect(() => {
    if (isOpen) {
      setAvailableCategories(StorageService.getCategories());
      setFixedCosts(StorageService.getFixedCosts());
      setAmount('');
      setDescription('');
      setIsConfirming(false);
      setIsSubmitting(false);
      setRandomMsg('');
      setInternalMode('wallet');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && wallets.length > 0) {
      if (!walletId || !wallets.find(w => w.id === walletId)) {
        setWalletId(wallets[0].id);
      }
    }
  }, [isOpen, wallets]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isSubmitting) {
        analytics.logEvent('transaction_abandoned', { 
            category: category || 'shopping',
            type: type,
            amount: parseNumberInput(amount)
        });
    }
    onClose();
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    const numericAmount = parseNumberInput(amount);
    const selectedWallet = wallets.find(w => w.id === walletId);
    
    if (type === TransactionType.TRANSFER) {
        if (internalMode === 'wallet' && walletId === toWalletId) {
            alert("Ví gửi và ví nhận phải khác nhau!");
            return;
        }
    }

    if (selectedWallet && (type === TransactionType.EXPENSE || type === TransactionType.TRANSFER)) {
        if (numericAmount > selectedWallet.balance) {
            alert(VI.transaction.error.insufficientBalance);
            return;
        }
    }

    // Chọn câu thoại mỉa mai ngẫu nhiên từ Lord Diamond
    if (type === TransactionType.EXPENSE) {
      setRandomMsg(getRandomSarcasm(category));
    } else if (type === TransactionType.INCOME) {
      const msgs = VI.transaction.confirmation.incomeMessages;
      setRandomMsg(msgs[Math.floor(Math.random() * msgs.length)]);
    } else {
      setRandomMsg("Chuyển tiền nội bộ à? Cậu định giấu quỹ đen sang ví khác phải không? 🧐");
    }

    setIsConfirming(true);
  };

  const handleFinalSubmit = () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const finalWalletId = walletId || wallets[0]?.id;
    if (!finalWalletId) {
      setIsSubmitting(false);
      return;
    }
    
    const numericAmountValue = parseNumberInput(amount);
    const txData: any = {
      amount: numericAmountValue,
      description,
      type,
      category: type === TransactionType.INCOME ? Category.INCOME : (type === TransactionType.TRANSFER ? Category.TRANSFER : category),
      walletId: finalWalletId,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };

    try {
      if (type === TransactionType.TRANSFER && internalMode === 'bill') {
          StorageService.depositToBill(finalWalletId, toBillId, numericAmountValue, description);
      } else if (type === TransactionType.TRANSFER && internalMode === 'wallet') {
          StorageService.transferFunds(finalWalletId, toWalletId, numericAmountValue, description);
      } else {
          StorageService.addTransaction(txData);
      }
      
      onSubmit(txData); 
      onClose();
    } catch (err) {
      console.error("Final submit error:", err);
      alert("Đã xảy ra lỗi khi lưu giao dịch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatNumberInput(e.target.value));
  };

  const currentWalletName = wallets.find(w => w.id === walletId)?.name || 'Ví';
  const displayCategory = type === TransactionType.INCOME ? VI.category['Income'] : (type === TransactionType.TRANSFER ? (internalMode === 'bill' ? 'Nạp hóa đơn' : 'Chuyển ví nội bộ') : ((VI.category as any)[category] || category));
  const numericAmount = parseNumberInput(amount);

  return (
    <>
      <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="w-full max-w-md glass-card liquid-glass rounded-t-[3rem] sm:rounded-[3.5rem] p-8 pb-safe-bottom border-0 shadow-2xl animate-in slide-in-from-bottom duration-500 bg-surface/95 max-h-[92vh] overflow-y-auto no-scrollbar">
          
          <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-xl font-black text-foreground tracking-tight uppercase leading-none">
                    {isConfirming ? "Xác nhận từ Lord Diamond" : "Giao dịch mới"}
                </h2>
                <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-[0.2em] mt-1.5">Mani Intelligence Core</p>
            </div>
            <button onClick={handleClose} className="p-3 bg-foreground/5 rounded-2xl hover:bg-foreground/10 hover:text-primary transition-all">
              <X size={20} />
            </button>
          </div>

          {!isConfirming ? (
            <form onSubmit={handlePreSubmit} className="space-y-6">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: TransactionType.EXPENSE, label: 'CHI TIÊU', icon: TrendingDown, color: 'text-danger', active: 'bg-danger text-white shadow-danger/20' },
                  { id: TransactionType.INCOME, label: 'THU NHẬP', icon: TrendingUp, color: 'text-secondary', active: 'bg-secondary text-white shadow-secondary/20' },
                  { id: TransactionType.TRANSFER, label: 'NỘI BỘ', icon: ArrowRightLeft, color: 'text-primary', active: 'bg-primary text-white shadow-primary/20' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center justify-center py-4 rounded-[1.75rem] transition-all duration-300 gap-2 border-2 ${
                      type === t.id 
                        ? `${t.active} border-transparent scale-105` 
                        : `bg-foreground/[0.03] border-foreground/[0.05] ${t.color}`
                    }`}
                  >
                    <t.icon size={20} strokeWidth={3} />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative glass-card bg-foreground/[0.03] p-6 rounded-[2rem] border-0 shadow-inner group">
                <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-refined mb-2 ml-1">Số tiền muốn nhập</p>
                <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-foreground/20 tracking-tight">₫</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      autoFocus
                      className="w-full bg-transparent text-4xl font-black text-foreground tracking-tight text-right focus:outline-none placeholder:text-foreground/5"
                      value={amount}
                      onChange={handleAmountChange}
                      required
                    />
                </div>
              </div>

              {/* Category & Wallet Fields */}
              <div className="grid grid-cols-1 gap-5">
                  {type === TransactionType.EXPENSE && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Danh mục phân loại</label>
                      <div className="grid grid-cols-2 gap-2.5 max-h-40 overflow-y-auto no-scrollbar pb-1">
                         {availableCategories.filter(c => c !== Category.INCOME && c !== Category.TRANSFER).map((c) => (
                             <button
                                key={c}
                                type="button"
                                onClick={() => setCategory(c)}
                                className={`py-4 px-4 rounded-2xl text-[12px] font-bold uppercase tracking-tight transition-all border ${category === c ? 'bg-primary text-white border-transparent shadow-lg' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60'}`}
                             >
                                {(VI.category as any)[c] || c}
                             </button>
                         ))}
                         <button 
                            type="button"
                            onClick={() => setIsCatModalOpen(true)}
                            className="py-4 rounded-2xl text-[12px] font-bold uppercase tracking-tight bg-foreground/[0.02] border-2 border-dashed border-foreground/10 text-foreground/30"
                         >
                            + Thêm mới
                         </button>
                      </div>
                    </div>
                  )}

                  {/* Wallet Selection */}
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Sử dụng ví</label>
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                          {wallets.map((w) => (
                              <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => setWalletId(w.id)}
                                  className={`flex-shrink-0 px-6 py-4 rounded-2xl border transition-all flex items-center gap-3 ${walletId === w.id ? 'bg-foreground text-background border-transparent shadow-xl' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60'}`}
                              >
                                  <WalletIcon size={16} />
                                  <div className="text-left">
                                      <p className="text-[12px] font-bold uppercase tracking-tight leading-none mb-1">{w.name}</p>
                                      <p className="text-[10px] font-medium opacity-60 leading-none">{formatVND(w.balance)}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-refined uppercase">Mô tả giao dịch</label>
                    <div className="relative">
                        <FileText size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20" />
                        <input
                          type="text"
                          placeholder="Ăn trưa, Mua sắm đồ dùng..."
                          className="w-full bg-foreground/[0.03] text-foreground p-5 pl-12 rounded-[1.5rem] font-semibold focus:ring-2 focus:ring-primary focus:outline-none text-[14px] uppercase border-0 shadow-inner"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                  </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-[0_20px_40px_rgba(139,92,246,0.3)] neon-glow-primary active:scale-[0.98] transition-all mt-4 flex justify-center items-center text-[12px] uppercase tracking-[0.3em] min-h-[64px]"
              >
                Tiếp tục <ArrowRight size={20} className="ml-3" />
              </button>
            </form>
          ) : (
            /* Confirmation Screen - UPGRADED TO LORD DIAMOND GLASSMORPHISM */
            <div className="space-y-8 animate-in zoom-in-95 fade-in duration-500 pb-4">
               <LordDiamondAvatar />
               
               <div className="relative glass-card bg-white/10 backdrop-blur-2xl border-2 border-[#00FF7F]/40 rounded-[3rem] p-8 shadow-[0_20px_60px_rgba(0,255,127,0.15)] overflow-hidden">
                    {/* Decorative Glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF7F]/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    
                    <div className="text-center space-y-6 relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00FF7F]/10 border border-[#00FF7F]/30 mb-2">
                             <MessageCircle size={14} className="text-[#00FF7F]" />
                             <span className="text-[#00FF7F] font-black text-[10px] uppercase tracking-[0.2em]">Lord Diamond says:</span>
                        </div>
                        
                        <div className="p-6 bg-white/5 rounded-[2.5rem] border border-white/10 shadow-inner">
                            <p className="font-comic text-2xl text-foreground font-bold leading-relaxed-tight italic text-center">
                                "{randomMsg}"
                            </p>
                        </div>
                        
                        <div className="py-6 border-y border-dashed border-white/10">
                            <p className="text-4xl font-black text-[#00FF7F] tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,127,0.3)]">
                                {formatVND(numericAmount)}
                            </p>
                            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-2">{displayCategory} • {currentWalletName}</p>
                        </div>
                    </div>
               </div>

               <div className="flex gap-4">
                   <button 
                       onClick={() => setIsConfirming(false)}
                       disabled={isSubmitting}
                       className="flex-1 py-6 glass-card bg-foreground/[0.05] text-foreground font-black rounded-[2rem] text-[11px] uppercase tracking-refined active:scale-95 transition-all border-0 disabled:opacity-50"
                   >
                       CÂN NHẮC LẠI
                   </button>
                   <button 
                       onClick={handleFinalSubmit}
                       disabled={isSubmitting}
                       className="flex-[2] bg-[#00FF7F] text-black rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(0,255,127,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-2 border-white/20"
                   >
                       {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <>TUÂN LỆNH QUẢN GIA ✨</>}
                   </button>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* NEW CATEGORY MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-8 animate-in zoom-in-95 duration-300">
           <div className="glass-card w-full max-w-sm rounded-[3rem] p-12 border-0 shadow-2xl bg-surface text-center">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2.25rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <span className="text-4xl">✨</span>
              </div>
              <h3 className="text-xl font-black text-foreground tracking-tight uppercase mb-8">{VI.transaction.newCategoryTitle}</h3>
              <form onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = newCategoryName.trim();
                  if (!trimmed) return;
                  const updatedList = await StorageService.addCategory(trimmed);
                  setAvailableCategories(updatedList);
                  setCategory(trimmed);
                  setNewCategoryName('');
                  setIsCatModalOpen(false);
              }} className="space-y-8">
                  <div className="space-y-2 text-left">
                      <label className="text-[10px] font-bold text-foreground/30 ml-2 tracking-widest uppercase">{VI.transaction.categoryName}</label>
                      <input autoFocus type="text" className="w-full bg-foreground/[0.03] text-foreground p-6 rounded-2xl font-bold focus:ring-2 focus:ring-primary focus:outline-none border-0 shadow-inner uppercase text-[14px]" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                  </div>
                  <div className="flex gap-4">
                      <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 py-5 rounded-2xl font-black text-[11px] text-foreground/40 uppercase tracking-widest hover:text-foreground">Hủy</button>
                      <button type="submit" disabled={!newCategoryName.trim()} className="flex-[2] py-5 rounded-2xl font-black text-[11px] text-white bg-primary shadow-xl neon-glow-primary uppercase tracking-widest disabled:opacity-50">Tạo</button>
                  </div>
              </form>
           </div>
        </div>
      )}
    </>
  );
};
