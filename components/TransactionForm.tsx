import React, { useState, useEffect } from 'react';
import { TransactionType, Category, Wallet } from '../types';
import { X, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const [reflectionMsg, setReflectionMsg] = useState<string | null>(null);
  
  // Confirmation State
  const [isConfirming, setIsConfirming] = useState(false);

  // Custom Category State
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setAvailableCategories(StorageService.getCategories());
      setAmount('');
      setDescription('');
      setIsConfirming(false);
    }
  }, [isOpen]);

  // Ensure a valid wallet is selected
  useEffect(() => {
    if (isOpen && wallets.length > 0) {
      setWalletId(prev => {
        // If no wallet selected, or selected wallet doesn't exist anymore, select the first one
        if (!prev || !wallets.find(w => w.id === prev)) {
          return wallets[0].id;
        }
        return prev;
      });
    }
  }, [isOpen, wallets]);

  if (!isOpen) return null;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) {
        // Optional: Add visual feedback for missing amount
        return;
    }
    // Wallet check shouldn't fail due to useEffect, but good for safety
    if (!walletId && wallets.length > 0) {
        setWalletId(wallets[0].id);
    }
    
    setIsConfirming(true);
  };

  const handleFinalSubmit = async () => {
    // Safety fallback
    const finalWalletId = walletId || wallets[0]?.id;
    if (!finalWalletId) return;

    const data = {
      amount: parseFloat(amount),
      description,
      type,
      category: type === TransactionType.INCOME ? Category.INCOME : category,
      walletId: finalWalletId,
      date: new Date().toISOString(),
      timestamp: Date.now()
    };

    onSubmit(data);
    
    // Reset internal state
    setAmount('');
    setDescription('');
    setIsConfirming(false);

    // If it's an expense, try to show a quick reflection before closing
    if (data.type === TransactionType.EXPENSE) {
       const msg = await GeminiService.generateTransactionComment(data);
       if (msg) {
         setReflectionMsg(msg);
         return; // Don't close yet, waiting for user to dismiss reflection
       }
    }

    onClose();
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__NEW__') {
      setIsCatModalOpen(true);
    } else {
      setCategory(val);
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    const existing = availableCategories.find(c => c.toLowerCase() === trimmed.toLowerCase());
    
    if (existing) {
      setCategory(existing);
    } else {
      const updatedList = StorageService.addCategory(trimmed);
      setAvailableCategories(updatedList);
      setCategory(trimmed);
    }
    
    setNewCategoryName('');
    setIsCatModalOpen(false);
  };

  const currentWalletName = wallets.find(w => w.id === walletId)?.name || 'Ví';
  const displayCategory = type === TransactionType.INCOME ? VI.category['Income'] : ((VI.category as any)[category] || category);
  const numericAmount = amount ? parseFloat(amount) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-md bg-surface border-t border-white/10 sm:border rounded-t-2xl sm:rounded-2xl p-6 pb-safe-bottom animate-in slide-in-from-bottom duration-200">
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">
                {isConfirming ? VI.transaction.confirmation.title : VI.transaction.title}
            </h2>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          {!isConfirming ? (
            /* --- INPUT FORM --- */
            <form onSubmit={handlePreSubmit} className="space-y-4">
              
              {/* Amount Input */}
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={VI.transaction.placeholderAmount}
                  autoFocus
                  className="w-full bg-black/20 text-3xl font-bold text-white px-4 py-4 rounded-xl border border-white/10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-right pr-12"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xl font-bold">₫</span>
              </div>

              {/* Type Selector */}
              <div className="grid grid-cols-3 gap-2 bg-black/20 p-1 rounded-xl">
                {(Object.values(TransactionType) as TransactionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                      type === t ? 'bg-surfaceHighlight text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {VI.transaction.types[t] || t}
                  </button>
                ))}
              </div>

              {/* Category Selector (only if expense) */}
              {type === TransactionType.EXPENSE && (
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 ml-1">{VI.transaction.category}</label>
                  <select
                    value={category}
                    onChange={handleCategoryChange}
                    className="w-full bg-surfaceHighlight text-white p-3 rounded-xl border border-white/5 focus:outline-none"
                  >
                    {availableCategories.filter(c => c !== Category.INCOME && c !== Category.TRANSFER).map((c) => (
                      <option key={c} value={c}>
                          {(VI.category as any)[c] || c}
                      </option>
                    ))}
                    <option value="__NEW__" className="font-bold text-primary">{VI.transaction.addCategory}</option>
                  </select>
                </div>
              )}

              {/* Wallet Selector */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 ml-1">{VI.transaction.wallet}</label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-surfaceHighlight text-white p-3 rounded-xl border border-white/5 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({formatVND(w.balance)})</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 ml-1">{VI.transaction.description}</label>
                <input
                  type="text"
                  placeholder={VI.transaction.placeholderDesc}
                  className="w-full bg-surfaceHighlight text-white p-3 rounded-xl border border-white/5 focus:outline-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all mt-4 flex justify-center items-center"
              >
                {VI.transaction.save} <ArrowRight size={18} className="ml-2" />
              </button>
            </form>
          ) : (
            /* --- CONFIRMATION VIEW --- */
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
               
               <div className="text-center space-y-2">
                   <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                       <AlertCircle size={24} />
                   </div>
                   <p className="text-zinc-400 text-sm">{VI.transaction.confirmation.message}</p>
                   
                   <div className="py-6 border-y border-white/10">
                       <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{VI.transaction.confirmation.checkAmount}</p>
                       <p className="text-4xl font-bold text-white tracking-tight break-all">
                           {formatVND(numericAmount)}
                       </p>
                   </div>
               </div>

               <div className="space-y-3 bg-white/5 p-4 rounded-2xl">
                   <h4 className="text-xs font-bold text-zinc-400 uppercase">{VI.transaction.confirmation.checkDetail}</h4>
                   <div className="flex justify-between text-sm">
                       <span className="text-zinc-500">{VI.transaction.types[type]}</span>
                       <span className="text-white font-medium">{displayCategory}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                       <span className="text-zinc-500">{VI.transaction.wallet}</span>
                       <span className="text-white font-medium">{currentWalletName}</span>
                   </div>
                   {description && (
                       <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">{VI.transaction.description}</span>
                           <span className="text-white font-medium truncate max-w-[150px]">{description}</span>
                       </div>
                   )}
               </div>

               <div className="flex space-x-3 pt-2">
                   <button 
                       onClick={() => setIsConfirming(false)}
                       className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                   >
                       {VI.transaction.confirmation.backBtn}
                   </button>
                   <button 
                       onClick={handleFinalSubmit}
                       className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center"
                   >
                       <CheckCircle2 size={18} className="mr-2" />
                       {VI.transaction.confirmation.confirmBtn}
                   </button>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Category Modal (Keep outside transition container) */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200">
           <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-white mb-4">{VI.transaction.newCategoryTitle}</h3>
              <form onSubmit={handleCreateCategory}>
                  <div className="space-y-2 mb-6">
                      <label className="text-xs text-zinc-400 ml-1">{VI.transaction.categoryName}</label>
                      <input 
                          autoFocus
                          type="text"
                          className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                  </div>
                  <div className="flex space-x-3">
                      <button 
                        type="button"
                        onClick={() => { setIsCatModalOpen(false); setNewCategoryName(''); }}
                        className="flex-1 py-3 rounded-xl font-medium text-zinc-400 bg-white/5 hover:bg-white/10"
                      >
                          {VI.transaction.cancel}
                      </button>
                      <button 
                        type="submit"
                        disabled={!newCategoryName.trim()}
                        className="flex-1 py-3 rounded-xl font-medium text-white bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {VI.transaction.create}
                      </button>
                  </div>
              </form>
           </div>
        </div>
      )}
      
      {/* Reflection Overlay */}
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