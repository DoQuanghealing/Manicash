
import React, { useState, useEffect } from 'react';
import { User, Wallet, Transaction, IncomeProject } from '../types';
import { VI } from '../constants/vi';
import { X, ShieldCheck, Wallet as WalletIcon, Trash2, AlertTriangle, Banknote, Sun, Moon, RefreshCw, Eraser, CheckCircle2, LogOut, Mail, User as UserIcon, FileSpreadsheet, Download } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { AuthService } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  wallets: Wallet[];
  onSave: (updatedUsers: User[], updatedWallets: Wallet[]) => void;
  onRefresh: () => void;
  currentUser: any; 
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, users, wallets, onSave, onRefresh, currentUser }) => {
  const [userName, setUserName] = useState('');
  const [mainWalletName, setMainWalletName] = useState('');
  const [mainWalletBalance, setMainWalletBalance] = useState('');
  const [backupWalletName, setBackupWalletName] = useState('');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');
  
  const [confirmType, setConfirmType] = useState<'balance' | 'full' | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (users.length > 0) setUserName(users[0].name);
      const w1 = wallets.find(w => w.id === 'w1') || wallets[0];
      const w2 = wallets.find(w => w.id === 'w2') || wallets[1];
      if (w1) { setMainWalletName(w1.name); setMainWalletBalance(String(w1.balance)); }
      if (w2) setBackupWalletName(w2.name);
      setCurrentTheme(StorageService.getTheme());
    }
  }, [isOpen, users, wallets]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUsers = [...users];
    if (userName.trim()) updatedUsers[0] = { ...updatedUsers[0], name: userName.trim() };
    const updatedWallets = JSON.parse(JSON.stringify(wallets));
    const w1Idx = updatedWallets.findIndex((w: Wallet) => w.id === 'w1');
    if (w1Idx !== -1) {
        if (mainWalletName.trim()) updatedWallets[w1Idx].name = mainWalletName.trim();
        if (mainWalletBalance.trim()) updatedWallets[w1Idx].balance = parseFloat(mainWalletBalance) || 0;
    }
    const w2Idx = updatedWallets.findIndex((w: Wallet) => w.id === 'w2');
    if (w2Idx !== -1 && backupWalletName.trim()) updatedWallets[w2Idx].name = backupWalletName.trim();
    onSave(updatedUsers, updatedWallets);
    onClose();
  };

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất tài khoản này?")) {
      try {
        await AuthService.logout();
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }
  };

  const handleExportCSV = () => {
    const txs = StorageService.getTransactions();
    const projects = StorageService.getIncomeProjects();
    const completedProjects = projects.filter(p => p.status === 'completed');

    let csvContent = "\uFEFF";
    csvContent += "--- NHẬT KÝ THU CHI ---\n";
    csvContent += "Ngày,Loại,Danh mục,Số tiền,Mô tả,Ví\n";
    txs.forEach(tx => {
      const date = new Date(tx.date).toLocaleDateString('vi-VN');
      const type = VI.transaction.types[tx.type];
      const cat = (VI.category as any)[tx.category] || tx.category;
      const walletName = wallets.find(w => w.id === tx.walletId)?.name || "";
      csvContent += `${date},${type},${cat},${tx.amount},"${tx.description || ""}",${walletName}\n`;
    });
    csvContent += "\n";
    csvContent += "--- DỰ ÁN TĂNG THU NHẬP ĐÃ HOÀN THÀNH ---\n";
    csvContent += "Tên dự án,Doanh thu thực tế,Ngày hoàn thành,Mô tả\n";
    completedProjects.forEach(p => {
      const endDate = p.endDate || "N/A";
      csvContent += `"${p.name}",${p.expectedIncome},${endDate},"${p.description}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Manicash_Report_${new Date().toLocaleDateString('vi-VN')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeReset = () => {
    if (confirmType === 'full') StorageService.resetFull();
    else if (confirmType === 'balance') StorageService.resetBalancesOnly();
    setConfirmType(null);
    onRefresh();
    onClose();
    alert("Dữ liệu đã được cập nhật về trạng thái yêu cầu.");
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(newTheme);
    StorageService.setTheme(newTheme);
    if (newTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-3xl px-6 animate-in fade-in duration-300">
        <div className="glass-card w-full max-w-sm rounded-[3rem] border-0 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] overflow-hidden bg-surface">
          
          <div className="flex justify-between items-center p-8 pb-4 shrink-0 relative z-10 bg-surface/50 backdrop-blur-md">
            <h2 className="text-2xl font-[1000] text-foreground tracking-tighter uppercase leading-none">CÀI ĐẶT</h2>
            <button onClick={onClose} className="p-3 bg-foreground/5 rounded-2xl hover:bg-foreground/10 text-foreground transition-all">
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-4 space-y-10">
            {/* User Profile Section */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2">Tài khoản kết nối</h3>
                <div className="glass-card bg-foreground/[0.03] p-6 rounded-[2rem] border-0 shadow-inner space-y-4">
                    <div className="flex items-center gap-4">
                        <img 
                          src={currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.displayName}`} 
                          className="w-12 h-12 rounded-2xl shadow-lg border-2 border-primary/20"
                          alt="Avatar"
                        />
                        <div className="overflow-hidden">
                            <p className="text-sm font-black text-foreground uppercase tracking-tight truncate">{currentUser?.displayName || 'Người dùng'}</p>
                            <p className="text-[10px] font-bold text-foreground/30 truncate uppercase">{currentUser?.email || 'Chế độ Demo'}</p>
                        </div>
                    </div>
                    <button 
                      type="button"
                      onClick={handleLogout}
                      className="w-full py-4 bg-danger/10 text-danger rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-danger hover:text-white transition-all cursor-pointer"
                    >
                        <LogOut size={16} /> Đăng xuất tài khoản
                    </button>
                </div>
            </div>

            {/* Export Section */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2">Dữ liệu tài chính</h3>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full glass-card bg-gradient-to-r from-emerald-500/10 to-secondary/10 p-6 rounded-[2rem] border-0 shadow-inner group flex items-center gap-5 hover:scale-[1.02] active:scale-95 transition-all text-left"
                >
                    <div className="w-12 h-12 rounded-2xl bg-secondary text-white flex items-center justify-center shadow-lg neon-glow-secondary">
                        <FileSpreadsheet size={22} />
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-foreground uppercase tracking-widest leading-none mb-1">{VI.settings.export}</p>
                        <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-tight">{VI.settings.exportDesc}</p>
                    </div>
                    <Download size={16} className="ml-auto text-foreground/20 group-hover:text-secondary transition-colors" />
                </button>
            </div>

            <form onSubmit={handleSave} id="settings-form" className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên hiển thị nội bộ</label>
                <div className="flex items-center space-x-4 bg-foreground/5 p-5 rounded-[1.75rem] border border-foreground/5 shadow-inner">
                    <span className="text-3xl filter drop-shadow-lg">{users[0]?.avatar || '😎'}</span>
                    <input
                        type="text"
                        className="w-full bg-transparent text-foreground font-black focus:outline-none uppercase text-sm tracking-tight"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />
                </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Giao diện</label>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={`w-full flex items-center justify-between p-6 rounded-[2rem] border transition-all ${currentTheme === 'dark' ? 'bg-primary/10 border-primary/20 shadow-lg' : 'bg-secondary/10 border-secondary/20 shadow-lg'}`}
                  >
                      <div className="flex items-center gap-4">
                          {currentTheme === 'dark' ? <Moon size={22} className="text-primary" /> : <Sun size={22} className="text-secondary" />}
                          <span className="font-black text-foreground uppercase tracking-widest text-[11px]">{currentTheme === 'dark' ? 'DARK MODE' : 'LIGHT MODE'}</span>
                      </div>
                      <div className={`w-14 h-7 rounded-full relative transition-all ${currentTheme === 'dark' ? 'bg-primary' : 'bg-secondary'}`}>
                          <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${currentTheme === 'dark' ? 'left-8' : 'left-1'}`}></div>
                      </div>
                  </button>
              </div>

              <div className="space-y-6 pt-2 border-t border-foreground/5">
                  <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">Hệ thống ví</h3>
                  <div className="space-y-4">
                      <div className="bg-foreground/[0.03] p-6 rounded-[2rem] border border-foreground/5 space-y-4 shadow-inner">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">Ví giao dịch</label>
                          <input
                              type="text"
                              className="bg-transparent text-foreground font-[900] text-right focus:outline-none text-xs uppercase"
                              value={mainWalletName}
                              onChange={(e) => setMainWalletName(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-4 border-t border-foreground/5 pt-4">
                            <Banknote size={20} className="text-primary opacity-40" />
                            <input
                                type="number"
                                className="w-full bg-transparent text-foreground font-[900] text-2xl focus:outline-none tracking-tighter"
                                value={mainWalletBalance}
                                onChange={(e) => setMainWalletBalance(e.target.value)}
                            />
                        </div>
                      </div>

                      <div className="bg-foreground/[0.03] p-6 rounded-[2rem] border border-foreground/5 shadow-inner flex items-center justify-between">
                        <label className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">Ví dự trữ</label>
                        <input
                            type="text"
                            className="bg-transparent text-foreground font-[900] text-right focus:outline-none uppercase text-sm tracking-tight"
                            value={backupWalletName}
                            onChange={(e) => setBackupWalletName(e.target.value)}
                        />
                      </div>
                  </div>
              </div>
            </form>

            <div className="pt-10 space-y-4 border-t border-foreground/5">
                <h3 className="text-[10px] font-black text-danger uppercase tracking-[0.3em] ml-2">Vùng nguy hiểm</h3>
                <div className="grid grid-cols-1 gap-3 pb-6">
                    <button type="button" onClick={() => setConfirmType('balance')} className="w-full p-6 bg-amber-500/10 rounded-[2rem] border border-amber-500/20 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500"><Eraser size={20} /></div>
                        <div><p className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Reset số dư</p></div>
                    </button>
                    <button type="button" onClick={() => setConfirmType('full')} className="w-full p-6 bg-danger/10 rounded-[2rem] border border-danger/20 flex items-center gap-4">
                        <div className="p-3 bg-danger/10 rounded-xl text-danger"><Trash2 size={20} /></div>
                        <div><p className="text-[11px] font-black text-danger uppercase tracking-widest">Xóa sạch toàn bộ</p></div>
                    </button>
                </div>
            </div>
          </div>

          <div className="p-8 pt-4 bg-surface/50 backdrop-blur-md shrink-0">
              <button
                  type="submit"
                  form="settings-form"
                  className="w-full bg-primary text-white font-[1000] py-6 rounded-[2rem] text-[12px] uppercase tracking-[0.4em] shadow-2xl neon-glow-primary active:scale-95 transition-all"
              >
                  LƯU THAY ĐỔI
              </button>
          </div>
        </div>
      </div>

      {confirmType && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-xl px-8 animate-in zoom-in-95 duration-300">
           <div className="glass-card w-full max-sm rounded-[2.5rem] p-10 border-2 border-danger/20">
              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-danger/10 text-danger rounded-[2rem] flex items-center justify-center mx-auto"><AlertTriangle size={40} /></div>
                 <h3 className="text-2xl font-[900] text-foreground tracking-tighter uppercase">XÁC NHẬN</h3>
                 <p className="text-xs font-bold text-foreground/50 uppercase tracking-tight">Hành động này không thể hoàn tác.</p>
                 <div className="flex flex-col gap-3 pt-4">
                    <button type="button" onClick={executeReset} className="w-full py-6 bg-danger text-white rounded-[1.75rem] font-[900] text-[11px] uppercase tracking-[0.3em]">TÔI ĐỒNG Ý</button>
                    <button type="button" onClick={() => setConfirmType(null)} className="w-full py-5 text-foreground/40 font-black text-[10px] uppercase tracking-[0.3em]">HỦY BỎ</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
};
