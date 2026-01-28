
import React, { useState, useEffect } from 'react';
import { TransactionType, Category, Wallet } from '../types';
import { X, ArrowRight, CheckCircle2, TrendingUp, TrendingDown, ArrowRightLeft, Plus, Wallet as WalletIcon, FileText, MoveRight } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import { ReflectionModal } from './ReflectionModal';
import { VI } from '../constants/vi';
import { formatVND } from '../utils/format';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  wallets: Wallet[];
}

export const TransactionForm: React.FC<Props> = ({ isOpen, onClose, onSubmit, wallets }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [category, setCategory] = useState<string>(Category.FOOD);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [reflectionMsg, setReflectionMsg] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAvailableCategories(StorageService.getCategories());
      setAmount('');
      setDescription('');
      setIsConfirming(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && wallets.length > 0) {
      if (!walletId || !wallets.find(w => w.id === walletId)) {
        setWalletId(wallets[0].id);
      }
      if (type === TransactionType.TRANSFER && (!toWalletId || toWalletId === walletId)) {
        const otherWallet = wallets.find(w => w.id !== walletId);
        if (otherWallet) setToWalletId(otherWallet.id);
      }
    }
  }, [isOpen, wallets, type, walletId]);

  if (!isOpen) return null;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    const numericAmount = parseFloat(amount);
    const selectedWallet = wallets.find(w => w.id === walletId);
    
    if (type === TransactionType.TRANSFER && walletId === toWalletId) {
      alert("Ví gửi và ví nhận phải khác nhau!");
      return;
    }

    if (selectedWallet && (type === TransactionType.EXPENSE || type === TransactionType.TRANSFER)) {
        if (numericAmount > selectedWallet.balance) {
            alert(VI.transaction.error.insufficientBalance);
            return;
        }
    }
    setIsConfirming(true);
  };

  const handleFinalSubmit = async () => {
    const finalWalletId = walletId || wallets[0]?.id;
    if (!finalWalletId) return;
    
    const data = {
      amount: parseFloat(amount),
      description,
      type,
      category: type === TransactionType.INCOME ? Category.INCOME : (type === TransactionType.TRANSFER ? Category.TRANSFER : category),
      walletId: finalWalletId,
      toWalletId: type === TransactionType.TRANSFER ? toWalletId : undefined,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    onSubmit(data);
    setAmount('');
    setDescription('');
    setIsConfirming(false);
    
    if (data.type === TransactionType.EXPENSE) {
       const msg = await GeminiService.generateTransactionComment(data);
       if (msg) {
         setReflectionMsg(msg);
         return;
       }
    }
    onClose();
  };

  const handleCategoryChange = (val: string) => {
    if (val === '__NEW__') setIsCatModalOpen(true);
    else setCategory(val);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const existing = availableCategories.find(c => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) setCategory(existing);
    else {
      const updatedList = StorageService.addCategory(trimmed);
      setAvailableCategories(updatedList);
      setCategory(trimmed);
    }
    setNewCategoryName('');
    setIsCatModalOpen(false);
  };

  const currentWalletName = wallets.find(w => w.id === walletId)?.name || 'Ví';
  const targetWalletName = wallets.find(w => w.id === toWalletId)?.name || 'Ví nhận';
  const displayCategory = type === TransactionType.INCOME ? VI.category['Income'] : (type === TransactionType.TRANSFER ? "Chuyển khoản nội bộ" : ((VI.category as any)[category] || category));
  const numericAmount = amount ? parseFloat(amount) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="w-full max-w-md glass-card liquid-glass rounded-t-[3rem] sm:rounded-[3.5rem] p-6 pb-safe-bottom border-0 shadow-2xl animate-in slide-in-from-bottom duration-500 bg-surface/95 max-h-[92vh] overflow-y-auto no-scrollbar">
          
          <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-xl font-[1000] text-foreground tracking-tighter uppercase leading-none">
                    {isConfirming ? "XÁC NHẬN" : "GIAO DỊCH MỚI"}
                </h2>
                <p className="text-[9px] font-black text-foreground/30 uppercase tracking-[0.3em] mt-1">Manicash Intelligence</p>
            </div>
            <button onClick={onClose} className="p-2 bg-foreground/5 rounded-2xl hover:text-primary transition-all">
              <X size={20} />
            </button>
          </div>

          {!isConfirming ? (
            <form onSubmit={handlePreSubmit} className="space-y-4">
              
              {/* Type Selector - Compacted */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: TransactionType.EXPENSE, label: 'CHI TIÊU', icon: TrendingDown, color: 'text-danger', bg: 'bg-danger/10', active: 'bg-danger text-white shadow-danger/20' },
                  { id: TransactionType.INCOME, label: 'THU NHẬP', icon: TrendingUp, color: 'text-secondary', bg: 'bg-secondary/10', active: 'bg-secondary text-white shadow-secondary/20' },
                  { id: TransactionType.TRANSFER, label: 'NỘI BỘ', icon: ArrowRightLeft, color: 'text-primary', bg: 'bg-primary/10', active: 'bg-primary text-white shadow-primary/20' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition-all duration-300 gap-1.5 border-2 ${
                      type === t.id 
                        ? `${t.active} border-transparent scale-105` 
                        : `bg-foreground/[0.03] border-foreground/[0.05] ${t.color}`
                    }`}
                  >
                    <t.icon size={20} strokeWidth={3} />
                    <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Amount Input - Compacted */}
              <div className="relative glass-card bg-foreground/[0.03] p-4 rounded-[2rem] border-0 shadow-inner group">
                <p className="text-[8px] font-black text-foreground/30 uppercase tracking-[0.2em] mb-1 ml-1">Số tiền muốn nhập</p>
                <div className="flex items-center justify-between">
                    <span className="text-2xl font-[900] text-foreground/20 tracking-tighter">₫</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      autoFocus
                      className="w-full bg-transparent text-3xl font-[1000] text-foreground tracking-tighter text-right focus:outline-none placeholder:text-foreground/5"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                  {type === TransactionType.EXPENSE && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Danh mục phân loại</label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar">
                         {availableCategories.filter(c => c !== Category.INCOME && c !== Category.TRANSFER).map((c) => (
                             <button
                                key={c}
                                type="button"
                                onClick={() => handleCategoryChange(c)}
                                className={`py-3 rounded-xl text-[10px] font-[800] uppercase tracking-tight transition-all border ${category === c ? 'bg-primary text-white border-transparent shadow-lg' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60'}`}
                             >
                                {(VI.category as any)[c] || c}
                             </button>
                         ))}
                         <button 
                            type="button"
                            onClick={() => setIsCatModalOpen(true)}
                            className="py-3 rounded-xl text-[10px] font-[800] uppercase tracking-tight bg-foreground/[0.02] border-2 border-dashed border-foreground/10 text-foreground/30"
                         >
                            + THÊM MỚI
                         </button>
                      </div>
                    </div>
                  )}

                  {type === TransactionType.TRANSFER ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Từ ví (Gửi)</label>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {wallets.map((w) => (
                                <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => setWalletId(w.id)}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex items-center gap-2 ${walletId === w.id ? 'bg-foreground text-background border-transparent shadow-xl' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60'}`}
                                >
                                    <WalletIcon size={14} />
                                    <p className="text-[10px] font-[900] uppercase tracking-tight">{w.name}</p>
                                </button>
                            ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Đến ví (Nhận)</label>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {wallets.map((w) => (
                                <button
                                    key={`to-${w.id}`}
                                    type="button"
                                    onClick={() => setToWalletId(w.id)}
                                    disabled={w.id === walletId}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex items-center gap-2 ${toWalletId === w.id ? 'bg-secondary text-white border-transparent shadow-xl' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60 disabled:opacity-30'}`}
                                >
                                    <CheckCircle2 size={14} />
                                    <p className="text-[10px] font-[900] uppercase tracking-tight">{w.name}</p>
                                </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Sử dụng ví</label>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                          {wallets.map((w) => (
                              <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => setWalletId(w.id)}
                                  className={`flex-shrink-0 px-5 py-3 rounded-xl border transition-all flex items-center gap-2.5 ${walletId === w.id ? 'bg-foreground text-background border-transparent shadow-xl' : 'bg-foreground/[0.03] border-foreground/[0.05] text-foreground/60'}`}
                              >
                                  <WalletIcon size={14} />
                                  <div className="text-left">
                                      <p className="text-[10px] font-[900] uppercase tracking-tight leading-none mb-0.5">{w.name}</p>
                                      <p className="text-[8px] font-bold opacity-60 leading-none">{formatVND(w.balance)}</p>
                                  </div>
                              </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-foreground/30 ml-2 tracking-[0.2em] uppercase">Mô tả giao dịch</label>
                    <div className="relative">
                        <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" />
                        <input
                          type="text"
                          placeholder="Ăn trưa, Mua sắm đồ dùng..."
                          className="w-full bg-foreground/[0.03] text-foreground p-4 pl-11 rounded-[1.25rem] font-[800] focus:ring-2 focus:ring-primary focus:outline-none text-xs uppercase tracking-tight border-0 shadow-inner"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                  </div>
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white font-[900] py-4.5 rounded-[1.75rem] shadow-2xl neon-glow-primary active:scale-[0.98] transition-all mt-2 flex justify-center items-center text-[10px] uppercase tracking-[0.4em] min-h-[56px]"
              >
                TIẾP TỤC <ArrowRight size={18} className="ml-2" />
              </button>
            </form>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
               <div className="glass-card bg-surface/95 border-0 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background rounded-full"></div>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-background rounded-full"></div>
                    
                    <div className="text-center space-y-1 mb-6">
                        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3 shadow-inner">
                            <CheckCircle2 size={24} />
                        </div>
                        <p className="text-foreground/30 font-black text-[9px] uppercase tracking-[0.4em]">Transaction Review</p>
                    </div>
                    
                    <div className="text-center py-4 border-y border-dashed border-foreground/10 mb-6">
                        <p className="text-4xl font-[1000] text-foreground tracking-tighter break-all">
                            {formatVND(numericAmount)}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">Loại</span>
                            <span className={`px-3 py-1.5 rounded-full font-[900] text-[9px] uppercase tracking-widest ${type === TransactionType.INCOME ? 'bg-secondary/10 text-secondary' : type === TransactionType.EXPENSE ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>
                                {VI.transaction.types[type]}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">Danh mục</span>
                            <span className="font-[900] text-foreground uppercase tracking-tight text-xs">{displayCategory}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">
                              {type === TransactionType.TRANSFER ? 'Từ ví' : 'Sử dụng ví'}
                            </span>
                            <span className="font-[900] text-foreground uppercase tracking-tight text-xs">{currentWalletName}</span>
                        </div>
                        {type === TransactionType.TRANSFER && (
                          <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">Đến ví</span>
                              <span className="font-[900] text-secondary uppercase tracking-tight text-xs flex items-center gap-1.5">
                                <MoveRight size={12} /> {targetWalletName}
                              </span>
                          </div>
                        )}
                        {description && (
                            <div className="flex justify-between items-start">
                                <span className="text-[9px] font-black text-foreground/30 uppercase tracking-widest pt-0.5">Mô tả</span>
                                <span className="font-[900] text-foreground uppercase tracking-tight text-xs text-right max-w-[160px] break-words">{description}</span>
                            </div>
                        )}
                    </div>
               </div>

               <div className="flex gap-3">
                   <button 
                       onClick={() => setIsConfirming(false)}
                       className="flex-1 py-5 glass-card bg-foreground/[0.05] text-foreground font-black rounded-[1.75rem] text-[9px] uppercase tracking-[0.3em] active:scale-95 transition-all border-0"
                   >
                       QUAY LẠI
                   </button>
                   <button 
                       onClick={handleFinalSubmit}
                       className="flex-[2] py-5 bg-secondary text-white rounded-[1.75rem] font-[1000] text-[11px] uppercase tracking-[0.3em] shadow-2xl neon-glow-secondary active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                   >
                       LƯU DỮ LIỆU <CheckCircle2 size={16} strokeWidth={3} />
                   </button>
               </div>
            </div>
          )}

        </div>
      </div>

      {isCatModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-6 animate-in zoom-in-95 duration-300">
           <div className="glass-card w-full max-sm rounded-[3rem] p-10 border-0 shadow-2xl bg-surface">
              <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                      <Plus size={32} />
                  </div>
                  <h3 className="text-xl font-[900] text-foreground tracking-tighter uppercase">{VI.transaction.newCategoryTitle}</h3>
              </div>
              <form onSubmit={handleCreateCategory} className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">{VI.transaction.categoryName}</label>
                      <input 
                          autoFocus
                          type="text"
                          className="w-full bg-foreground/[0.03] text-foreground p-6 rounded-2xl font-black focus:ring-2 focus:ring-primary focus:outline-none border-0 shadow-inner uppercase text-sm"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                  </div>
                  <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => { setIsCatModalOpen(false); setNewCategoryName(''); }}
                        className="flex-1 py-5 rounded-2xl font-black text-[10px] text-foreground/40 uppercase tracking-widest hover:text-foreground transition-all"
                      >
                          {VI.transaction.cancel}
                      </button>
                      <button 
                        type="submit"
                        disabled={!newCategoryName.trim()}
                        className="flex-[2] py-5 rounded-2xl font-[900] text-[10px] text-white bg-primary shadow-xl neon-glow-primary uppercase tracking-widest disabled:opacity-50"
                      >
                          {VI.transaction.create}
                      </button>
                  </div>
              </form>
           </div>
        </div>
      )}
      
      <ReflectionModal
        isOpen={!!reflectionMsg}
        onClose={() => { setReflectionMsg(null); onClose(); }}
        message={reflectionMsg || ''}
        title={VI.reflection.title}
        variant="success"
      />
    </>
  );
};
