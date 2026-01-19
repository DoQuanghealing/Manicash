import React, { useState, useEffect } from 'react';
import { Wallet, Transaction, TransactionType, User } from '../types';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Wallet as WalletIcon, Settings, Calendar, List, User as UserIcon, ShieldCheck, CheckCircle2, TrendingUp, AlertTriangle, Target, Zap, X } from 'lucide-react';
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
}

export const Dashboard: React.FC<Props> = ({ wallets, transactions, users, onOpenSettings }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [activeWalletTab, setActiveWalletTab] = useState<'main' | 'backup'>('main');
  
  // Auto Deduct State (for Backup Tab)
  const [autoDeductPercent, setAutoDeductPercent] = useState(0);
  const [autoDeductEnabled, setAutoDeductEnabled] = useState(false);

  // Mission Modal State
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);

  useEffect(() => {
    setAutoDeductPercent(StorageService.getAutoDeductPercent());
    setAutoDeductEnabled(StorageService.getAutoDeductEnabled());
    calculateMissions();
  }, [transactions]); // Recalculate missions when transactions change

  const handleSaveAutoDeduct = (percent: number, enabled: boolean) => {
      setAutoDeductPercent(percent);
      setAutoDeductEnabled(enabled);
      StorageService.setAutoDeductPercent(percent);
      StorageService.setAutoDeductEnabled(enabled);
  };

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  // Today's Stats Logic
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(t => new Date(t.date).toDateString() === today);
  
  const todayIncome = todayTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);
    
  const todayExpense = todayTransactions
    .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER)
    .reduce((sum, t) => sum + t.amount, 0);

  // Status & Praise Logic
  const monthlyIncome = transactions
    .filter(t => t.type === TransactionType.INCOME && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + t.amount, 0);
  
  let statusIcon = <TrendingUp size={24} className="text-emerald-400" />;
  let statusMessage = VI.dashboard.encouragement.status.good;
  
  if (monthlyExpense > monthlyIncome && monthlyIncome > 0) {
      statusIcon = <AlertTriangle size={24} className="text-red-400" />;
      statusMessage = VI.dashboard.encouragement.status.danger;
  } else if (monthlyExpense > monthlyIncome * 0.8) {
      statusIcon = <AlertTriangle size={24} className="text-amber-400" />;
      statusMessage = VI.dashboard.encouragement.status.warning;
  } else if (monthlyIncome > monthlyExpense * 2) {
      statusIcon = <Zap size={24} className="text-yellow-400" />;
      statusMessage = VI.dashboard.encouragement.status.great;
  }

  // Calculate Missions
  const calculateMissions = () => {
      const ms = [];
      
      // 1. Projects
      const projects = StorageService.getIncomeProjects();
      projects.filter(p => p.status === 'in_progress').forEach(p => {
          const incomplete = p.milestones.filter(m => !m.isCompleted).length;
          if (incomplete > 0) {
              ms.push({
                  type: 'project',
                  text: `${VI.dashboard.encouragement.missions.projectPrefix} ${incomplete} ${VI.dashboard.encouragement.missions.projectSuffix} "${p.name}" ${VI.dashboard.encouragement.missions.projectEarn} ${formatVND(p.expectedIncome)}`
              });
          }
      });

      // 2. Fixed Costs
      const costs = StorageService.getFixedCosts();
      costs.forEach(c => {
          const needed = c.amount - c.allocatedAmount;
          if (needed > 0) {
              ms.push({
                  type: 'cost',
                  text: `${VI.dashboard.encouragement.missions.costNeeded} ${formatVND(needed)} ${VI.dashboard.encouragement.missions.for} "${c.title}"`,
                  sub: `${VI.dashboard.encouragement.missions.deadline} ${new Date(c.nextDueDate).toLocaleDateString('vi-VN')}`
              });
          }
      });

      setMissions(ms);
  };

  // Recent Activity List Logic
  const recentTransactions = transactions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const mainWallet = wallets.find(w => w.id === 'w1') || wallets[0];
  const backupWallet = wallets.find(w => w.id === 'w2');

  return (
    <div className="p-4 space-y-6 pt-6">
      
      {/* Header / Net Worth (Global Family Wealth) */}
      <div className="flex justify-between items-start px-1">
        <div className="space-y-1">
          <h1 className="text-zinc-400 text-sm font-medium tracking-wide uppercase">{VI.dashboard.netWorth}</h1>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white tracking-tight">{formatVND(totalBalance)}</span>
          </div>
        </div>
        <button 
          onClick={onOpenSettings}
          className="p-3 bg-white/5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors border border-white/5"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Wallet Tabs */}
      <div>
          <div className="flex p-1 bg-black/30 rounded-xl border border-white/5 mb-4">
              <button 
                onClick={() => setActiveWalletTab('main')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeWalletTab === 'main' ? 'bg-surfaceHighlight text-white shadow' : 'text-zinc-500'}`}
              >
                  <WalletIcon size={16} /> {VI.dashboard.tabs.main}
              </button>
              <button 
                onClick={() => setActiveWalletTab('backup')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeWalletTab === 'backup' ? 'bg-surfaceHighlight text-emerald-400 shadow' : 'text-zinc-500'}`}
              >
                  <ShieldCheck size={16} /> {VI.dashboard.tabs.backup}
              </button>
          </div>

          {activeWalletTab === 'main' ? (
               /* Main Wallet Card */
               <div className="border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden bg-gradient-to-br from-surfaceHighlight to-surface">
                    <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-2xl bg-primary/10 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-black/30 text-primary">
                                <WalletIcon size={20} />
                            </div>
                            <span className="font-bold text-white text-lg">{mainWallet?.name}</span>
                        </div>
                        <p className="text-zinc-400 text-xs mb-1 font-medium tracking-wide uppercase">{VI.dashboard.availableBalance}</p>
                        <p className="text-4xl font-bold text-white tracking-tight">{formatVND(mainWallet?.balance || 0)}</p>
                    </div>
               </div>
          ) : (
               /* Backup Wallet Card & Settings */
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="border border-emerald-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden bg-gradient-to-br from-zinc-800 to-black">
                        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-2xl bg-emerald-500/10 pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                                    <ShieldCheck size={20} />
                                </div>
                                <span className="font-bold text-white text-lg">{backupWallet?.name || "Quỹ dự phòng"}</span>
                            </div>
                            <p className="text-zinc-400 text-xs mb-1 font-medium tracking-wide uppercase">{VI.dashboard.availableBalance}</p>
                            <p className="text-4xl font-bold text-emerald-400 tracking-tight">{formatVND(backupWallet?.balance || 0)}</p>
                        </div>
                    </div>

                    {/* Auto Deduct Config Block */}
                    <div className="bg-emerald-900/10 border border-emerald-500/10 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-emerald-400">{VI.dashboard.backup.configTitle}</h3>
                            <button 
                                onClick={() => handleSaveAutoDeduct(autoDeductPercent, !autoDeductEnabled)}
                                className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${autoDeductEnabled ? 'bg-emerald-500 text-white' : 'bg-white/10 text-zinc-500'}`}
                            >
                                {autoDeductEnabled ? VI.dashboard.backup.on : VI.dashboard.backup.off}
                            </button>
                        </div>
                        
                        <p className="text-xs text-zinc-500 mb-4">{VI.dashboard.backup.desc}</p>
                        
                        <div className={`space-y-2 transition-opacity ${autoDeductEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="flex justify-between text-xs text-zinc-400 font-medium">
                                <span>{VI.dashboard.backup.autoLabel}</span>
                                <span className="text-white">{autoDeductPercent}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="50" 
                                step="1"
                                value={autoDeductPercent}
                                onChange={(e) => handleSaveAutoDeduct(Number(e.target.value), autoDeductEnabled)}
                                className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                        </div>
                    </div>
               </div>
          )}
      </div>

      {/* Encouragement & Mission Block */}
      <div className="bg-surface border border-white/10 rounded-3xl p-5 flex items-center justify-between relative overflow-hidden">
          {/* Decorative Gradient Line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500 opacity-50"></div>
          
          <div className="flex-1">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{VI.dashboard.encouragement.title}</h3>
              <div className="flex items-center gap-2">
                  {statusIcon}
                  <span className="text-sm font-bold text-white leading-tight max-w-[150px]">{statusMessage}</span>
              </div>
          </div>
          
          <button 
            onClick={() => setShowMissionModal(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 border border-white/5"
          >
              <Target size={18} className="text-primary" />
              <span>{VI.dashboard.encouragement.btnMission}</span>
              {missions.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center -ml-1">
                      {missions.length}
                  </span>
              )}
          </button>
      </div>

      {/* Daily Summary Widget */}
      <div className="bg-surface border border-white/5 rounded-3xl p-5 shadow-lg relative">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">{VI.dashboard.todaySummary}</h3>
        <div className="flex space-x-6">
            <div>
                <span className="text-xs text-emerald-500 block mb-0.5">{VI.dashboard.income}</span>
                <span className="text-lg font-bold text-white">{formatVND(todayIncome)}</span>
            </div>
            <div className="w-px bg-white/10 h-10"></div>
            <div>
                <span className="text-xs text-danger block mb-0.5">{VI.dashboard.expense}</span>
                <span className="text-lg font-bold text-white">{formatVND(todayExpense)}</span>
            </div>
        </div>
      </div>

      {/* Activity / Calendar Toggle Section */}
      <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white">
                {viewMode === 'list' ? VI.dashboard.recentActivity : VI.dashboard.viewMode.calendar}
            </h3>
            <div className="flex bg-black/20 rounded-lg p-1">
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    <List size={16} />
                </button>
                <button 
                    onClick={() => setViewMode('calendar')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500'}`}
                >
                    <Calendar size={16} />
                </button>
            </div>
        </div>
        
        <div className="min-h-[300px]">
            {viewMode === 'list' ? (
                <div>
                    {recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                            <div className="flex items-center space-x-4">
                                <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
                                    style={{ backgroundColor: tx.type === TransactionType.INCOME ? '#10b981' : CATEGORY_COLORS[tx.category] || '#64748b' }}
                                >
                                    {tx.type === TransactionType.INCOME ? <ArrowUpRight size={18} /> : 
                                     tx.type === TransactionType.TRANSFER ? <RefreshCw size={16} /> :
                                     <ArrowDownRight size={18} />}
                                </div>
                                <div>
                                    <p className="font-semibold text-zinc-200 text-sm">{tx.description}</p>
                                    <p className="text-xs text-zinc-500">{new Date(tx.date).toLocaleDateString()} • {VI.category[tx.category] || tx.category}</p>
                                </div>
                            </div>
                            <span className={`font-mono font-medium text-sm ${tx.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-zinc-100'}`}>
                                {tx.type === TransactionType.INCOME ? '+' : '-'}{formatVND(tx.amount)}
                            </span>
                        </div>
                    ))}
                    {recentTransactions.length === 0 && (
                        <div className="p-8 text-center text-zinc-500 text-sm">{VI.dashboard.noTransactions}</div>
                    )}
                    {recentTransactions.length > 0 && (
                         <div className="p-3 text-center border-t border-white/5">
                             <button className="text-xs text-primary font-medium">{VI.dashboard.viewAll}</button>
                         </div>
                    )}
                </div>
            ) : (
                <div className="p-2">
                    <CalendarView transactions={transactions} />
                </div>
            )}
        </div>
      </div>

      {/* MISSION MODAL */}
      {showMissionModal && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                       <div className="flex items-center gap-2">
                           <Target size={24} className="text-primary" />
                           <h3 className="text-xl font-bold text-white">{VI.dashboard.encouragement.modalTitle}</h3>
                       </div>
                       <button onClick={() => setShowMissionModal(false)} className="p-2 bg-white/5 rounded-full">
                           <X size={20} />
                       </button>
                  </div>
                  
                  <div className="space-y-3">
                      {missions.length === 0 && (
                          <div className="text-center py-8 text-zinc-500">
                              <CheckCircle2 size={48} className="mx-auto mb-3 opacity-30 text-emerald-500" />
                              <p>{VI.dashboard.encouragement.missions.empty}</p>
                          </div>
                      )}
                      
                      {missions.map((m, idx) => (
                          <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex gap-3">
                              <div className={`mt-0.5 ${m.type === 'project' ? 'text-indigo-400' : 'text-amber-400'}`}>
                                  {m.type === 'project' ? <Zap size={18} /> : <AlertTriangle size={18} />}
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-white">{m.text}</p>
                                  {m.sub && <p className="text-xs text-zinc-500 mt-1">{m.sub}</p>}
                              </div>
                          </div>
                      ))}
                  </div>

                  <button 
                    onClick={() => setShowMissionModal(false)}
                    className="w-full bg-white/10 text-white font-bold py-4 rounded-xl mt-6 hover:bg-white/20 transition-colors"
                  >
                      {VI.reflection.received}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};