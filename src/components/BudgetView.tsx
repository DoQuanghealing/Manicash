import React, { useState, useEffect } from 'react';
import { Budget, Category, FixedCost, Wallet, AllocationSetting } from '../types';
import { CATEGORY_COLORS } from '../constants'; 
import { VI } from '../constants/vi';
import { formatVND, formatNumberInput, parseNumberInput } from '../utils/format';
import { 
  Plus, Trash2, Save, X, Edit3, Calculator, 
  Wallet as WalletIcon, ArrowRight, Clock, Percent, 
  ReceiptText, BarChart3, Calendar 
} from 'lucide-react';
import { StorageService } from '../services/storageService';

interface Props {
  budgets: Budget[];
  getSpent: (category: Category) => number;
  onUpdateBudgets: (newBudgets: Budget[]) => void;
  fixedCosts: FixedCost[];
  onPayFixedCost: (cost: FixedCost) => void;
  onRefresh: () => void;
}

export const BudgetView: React.FC<Props> = ({ budgets, getSpent, onUpdateBudgets, fixedCosts = [], onPayFixedCost, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'flexible' | 'fixed'>('flexible');
  const [isEditingFlexible, setIsEditingFlexible] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>([]);
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [allocationSource, setAllocationSource] = useState('');
  const [allocationConfig, setAllocationConfig] = useState<AllocationSetting[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [editingFixedCost, setEditingFixedCost] = useState<any>(null);

  useEffect(() => {
    if (isEditingFlexible) setLocalBudgets(JSON.parse(JSON.stringify(budgets)));
  }, [isEditingFlexible, budgets]);

  useEffect(() => {
    if (isAllocationOpen) {
      const w = StorageService.getWallets();
      setWallets(w);
      if (w.length > 0) setAllocationSource(w[0].id);
      const currentConfig = StorageService.getAllocationConfig();
      const goals = StorageService.getGoals();
      const newConfig: AllocationSetting[] = [
        ...fixedCosts.map(c => ({ itemId: c.id, type: 'COST' as const, percentage: currentConfig.find(s => s.itemId === c.id)?.percentage || 0, isEnabled: true })),
        ...goals.map(g => ({ itemId: g.id, type: 'GOAL' as const, percentage: currentConfig.find(s => s.itemId === g.id)?.percentage || 0, isEnabled: true }))
      ];
      setAllocationConfig(newConfig);
    }
  }, [isAllocationOpen, fixedCosts]);

  const handleSaveFixedCost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numericAmount = parseNumberInput(String(editingFixedCost.amount || '0'));
    const data: FixedCost = { ...editingFixedCost, amount: numericAmount };
    await StorageService.addFixedCost(data);
    setIsFixedModalOpen(false);
    onRefresh();
  };

  const totalFlexibleLimit = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalFixedAmount = fixedCosts.reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="p-6 space-y-8 pt-12 pb-32">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black uppercase">{VI.budget.title}</h2>
        <div className="flex space-x-3">
          <button onClick={() => setIsAllocationOpen(true)} className="glass-card p-4 text-secondary"><Percent size={20} /></button>
          <button onClick={() => setIsEditingFlexible(!isEditingFlexible)} className="glass-card p-4 text-primary"><Edit3 size={20} /></button>
        </div>
      </div>

      <div className="flex glass-card p-1">
        <button onClick={() => setActiveTab('flexible')} className={`flex-1 py-4 rounded-2xl font-bold ${activeTab === 'flexible' ? 'bg-primary text-white' : 'text-foreground/40'}`}>CHI TIÊU</button>
        <button onClick={() => setActiveTab('fixed')} className={`flex-1 py-4 rounded-2xl font-bold ${activeTab === 'fixed' ? 'bg-primary text-white' : 'text-foreground/40'}`}>HÓA ĐƠN</button>
      </div>

      {activeTab === 'flexible' ? (
        <div className="space-y-4">
          <div className="glass-card p-7 bg-primary/10">
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Tổng ngân sách</p>
            <h3 className="text-3xl font-black">{formatVND(totalFlexibleLimit)}</h3>
          </div>
          {budgets.map(b => (
            <div key={b.category} className="glass-card p-6">
              <div className="flex justify-between items-center">
                <span className="font-bold uppercase">{(VI.category as any)[b.category]}</span>
                <span className="font-black text-primary">{formatVND(b.limit)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-card p-7 bg-secondary/10">
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Tổng hóa đơn</p>
            <h3 className="text-3xl font-black">{formatVND(totalFixedAmount)}</h3>
          </div>
          {fixedCosts.map(c => (
            <div key={c.id} className="glass-card p-6">
              <h4 className="font-black uppercase">{c.title}</h4>
              <p className="text-2xl font-bold text-primary">{formatVND(c.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
