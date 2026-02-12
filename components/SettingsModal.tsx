
import React, { useState, useEffect } from 'react';
import { User, Wallet, Transaction, IncomeProject, ButlerType, UserGender } from '../types';
import { VI } from '../constants/vi';
import { X, ShieldCheck, Wallet as WalletIcon, Trash2, AlertTriangle, Banknote, Sun, Moon, RefreshCw, Eraser, CheckCircle2, LogOut, Mail, User as UserIcon, FileSpreadsheet, Download, Heart, Sparkles, Loader2, Key, Cpu, Zap, Eye, EyeOff, Info } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { AuthService } from '../services/firebase';
import { formatNumberInput, parseNumberInput } from '../utils/format';

const CURRENT_VERSION = "1.0.0";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  wallets: Wallet[];
  onSave: (updatedUsers: User[], updatedWallets: Wallet[]) => void;
  onRefresh: () => void;
  currentUser: any; 
}

const SimpleButlerSVG = ({ type }: { type: ButlerType }) => (
  <svg width="60" height="60" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="goldGradSet" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#FFD700', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#B8860B', stopOpacity: 1 }} />
      </linearGradient>
      <linearGradient id="diamondGradSet" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#4fc3f7', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#01579b', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="85" rx="30" ry="8" fill="url(#goldGradSet)" opacity="0.6" />
    {type === ButlerType.MALE ? (
      <path d="M50 25 L70 40 L50 75 L30 40 Z" fill="url(#diamondGradSet)" stroke="#fff" strokeWidth="0.5" />
    ) : (
      <path d="M30 70 L25 45 L38 55 L50 35 L62 55 L75 45 L70 70 Z" fill="url(#goldGradSet)" stroke="#926B07" strokeWidth="1" />
    )}
  </svg>
);

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, users, wallets, onSave, onRefresh, currentUser }) => {
  const [userName, setUserName] = useState('');
  const [mainWalletName, setMainWalletName] = useState('');
  const [mainWalletBalance, setMainWalletBalance] = useState('');
  const [backupWalletName, setBackupWalletName] = useState('');
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [userGender, setUserGender] = useState<UserGender>(UserGender.MALE);
  const [butlerPref, setButlerPref] = useState<ButlerType>(ButlerType.MALE);
  const [maleButlerName, setMaleButlerName] = useState('');
  const [femaleButlerName, setFemaleButlerName] = useState('');
  const [aiBrain, setAiBrain] = useState<'gemini' | 'llama'>('gemini');
  
  const [confirmType, setConfirmType] = useState<'balance' | 'full' | null>(null);
  
  // Version check state
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);
  const [versionPopup, setVersionPopup] = useState<{isOpen: boolean, type: 'up_to_date' | 'outdated', quote?: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (users.length > 0) {
        setUserName(users[0].name);
        setUserGender(users[0].gender || UserGender.MALE);
        setButlerPref(users[0].butlerPreference || ButlerType.MALE);
        setMaleButlerName(users[0].maleButlerName || 'Lord Diamond');
        setFemaleButlerName(users[0].femaleButlerName || 'Queen Crown');
      }
      const w1 = wallets.find(w => w.id === 'w1') || wallets[0];
      const w2 = wallets.find(w => w.id === 'w2') || wallets[1];
      if (w1) { 
        setMainWalletName(w1.name); 
        setMainWalletBalance(formatNumberInput(w1.balance)); 
      }
      if (w2) setBackupWalletName(w2.name);
      setCurrentTheme(StorageService.getTheme());
      setIsSimpleMode(StorageService.getSimpleMode());
      setAiBrain(StorageService.getAiBrain());
    }
  }, [isOpen, users, wallets]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUsers = [...users];
    if (userName.trim()) {
      updatedUsers[0] = { 
        ...updatedUsers[0], 
        name: userName.trim(),
        gender: userGender,
        butlerPreference: butlerPref,
        maleButlerName: maleButlerName.trim(),
        femaleButlerName: femaleButlerName.trim()
      };
    }
    const updatedWallets = JSON.parse(JSON.stringify(wallets));
    const w1Idx = updatedWallets.findIndex((w: Wallet) => w.id === 'w1');
    if (w1Idx !== -1) {
        if (mainWalletName.trim()) updatedWallets[w1Idx].name = mainWalletName.trim();
        updatedWallets[w1Idx].balance = parseNumberInput(mainWalletBalance);
    }
    const w2Idx = updatedWallets.findIndex((w: Wallet) => w.id === 'w2');
    if (w2Idx !== -1 && backupWalletName.trim()) updatedWallets[w2Idx].name = backupWalletName.trim();
    
    StorageService.setAiBrain(aiBrain);
    onSave(updatedUsers, updatedWallets);
    onClose();
  };

  const handleVersionCheck = async () => {
    setIsCheckingVersion(true);
    const latest = await AuthService.checkAppVersion();
    setIsCheckingVersion(false);

    if (latest && latest !== CURRENT_VERSION) {
      setVersionPopup({ isOpen: true, type: 'outdated' });
    } else {
      const randomQuote = VI.version.quotes[Math.floor(Math.random() * VI.version.quotes.length)];
      setVersionPopup({ isOpen: true, type: 'up_to_date', quote: randomQuote });
    }
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

  const toggleSimpleMode = () => {
    const newVal = !isSimpleMode;
    setIsSimpleMode(newVal);
    StorageService.setSimpleMode(newVal);
    if (newVal) document.documentElement.classList.add('simple-mode');
    else document.documentElement.classList.remove('simple-mode');
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMainWalletBalance(formatNumberInput(e.target.value));
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
            {/* User Info Section */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2">Tài khoản</h3>
                <div className="glass-card bg-foreground/[0.03] p-5 rounded-[2rem] border-0 shadow-inner flex items-center gap-4">
                    <img src={currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.displayName}`} className="w-10 h-10 rounded-xl" alt="User" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-foreground uppercase truncate">{currentUser?.displayName}</p>
                        <p className="text-[8px] font-bold text-foreground/30 truncate uppercase">{currentUser?.email}</p>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-danger/40 hover:text-danger transition-colors"><LogOut size={16} /></button>
                </div>
            </div>

            {/* AI Brain Selection */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2">Hệ thống AI (Bộ não)</h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button"
                        onClick={() => setAiBrain('gemini')}
                        className={`p-5 rounded-[2.25rem] border transition-all flex flex-col items-center gap-3 relative overflow-hidden ${aiBrain === 'gemini' ? 'bg-primary/10 border-primary shadow-lg' : 'bg-foreground/5 border-foreground/5 opacity-50'}`}
                    >
                        <div className={`p-3 rounded-2xl ${aiBrain === 'gemini' ? 'bg-primary text-white neon-glow-primary' : 'bg-foreground/10 text-foreground/20'}`}>
                            <Sparkles size={24} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Google Gemini<br/>(Gốc)</span>
                        {aiBrain === 'gemini' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>}
                    </button>
                    <button 
                        type="button"
                        onClick={() => setAiBrain('llama')}
                        className={`p-5 rounded-[2.25rem] border transition-all flex flex-col items-center gap-3 relative overflow-hidden ${aiBrain === 'llama' ? 'bg-secondary/10 border-secondary shadow-lg' : 'bg-foreground/5 border-foreground/5 opacity-50'}`}
                    >
                        <div className={`p-3 rounded-2xl ${aiBrain === 'llama' ? 'bg-secondary text-white neon-glow-secondary' : 'bg-foreground/10 text-foreground/20'}`}>
                            <Cpu size={24} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">Meta Llama<br/>(Tối ưu)</span>
                        {aiBrain === 'llama' && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-secondary rounded-full animate-pulse"></div>}
                    </button>
                </div>
            </div>

            {/* Chế độ hiển thị & Hiệu năng */}
            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em] ml-2">Hiển thị & Hiệu năng</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className={`w-full flex items-center justify-between p-5 rounded-[1.75rem] border transition-all ${currentTheme === 'dark' ? 'bg-primary/10 border-primary/20' : 'bg-secondary/10 border-secondary/20'}`}
                  >
                      <div className="flex items-center gap-4">
                          {currentTheme === 'dark' ? <Moon size={18} className="text-primary" /> : <Sun size={18} className="text-secondary" />}
                          <span className="font-black text-foreground uppercase tracking-widest text-[10px]">{currentTheme === 'dark' ? 'CHẾ ĐỘ TỐI' : 'CHẾ ĐỘ SÁNG'}</span>
                      </div>
                      <div className={`w-12 h-6 rounded-full relative transition-all ${currentTheme === 'dark' ? 'bg-primary' : 'bg-secondary'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentTheme === 'dark' ? 'left-7' : 'left-1'}`}></div>
                      </div>
                  </button>

                  <button
                    type="button"
                    onClick={toggleSimpleMode}
                    className={`w-full flex items-center justify-between p-5 rounded-[1.75rem] border transition-all ${isSimpleMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-foreground/5 border-foreground/5'}`}
                  >
                      <div className="flex items-center gap-4">
                          {isSimpleMode ? <EyeOff size={18} className="text-amber-500" /> : <Eye size={18} className="text-foreground/30" />}
                          <div className="text-left">
                            <span className="font-black text-foreground uppercase tracking-widest text-[10px]">CHẾ ĐỘ ĐƠN GIẢN</span>
                            <p className="text-[7px] font-bold text-foreground/30 uppercase">Tắt Blur & Animation</p>
                          </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full relative transition-all ${isSimpleMode ? 'bg-amber-500' : 'bg-foreground/20'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isSimpleMode ? 'left-7' : 'left-1'}`}></div>
                      </div>
                  </button>
                </div>
            </div>

            {/* General Settings Form Area */}
            <form onSubmit={handleSave} id="settings-form" className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-foreground/30 ml-2 tracking-widest uppercase">Tên hiển thị nội bộ</label>
                <div className="flex items-center space-x-4 bg-foreground/5 p-4 rounded-[1.75rem] border border-foreground/5 shadow-inner">
                    <input
                        type="text"
                        className="w-full bg-transparent text-foreground font-black focus:outline-none uppercase text-sm tracking-tight"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />
                </div>
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
                                type="text"
                                inputMode="numeric"
                                className="w-full bg-transparent text-foreground font-[900] text-2xl focus:outline-none tracking-tighter"
                                value={mainWalletBalance}
                                onChange={handleBalanceChange}
                            />
                        </div>
                      </div>
                  </div>
              </div>
            </form>

            {/* Export, Reset and VERSION CHECK */}
            <div className="space-y-4 pt-6 border-t border-foreground/5">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.3em]">Dữ liệu & Hệ thống</h3>
                
                {/* Version Check Button */}
                <button 
                  onClick={handleVersionCheck} 
                  disabled={isCheckingVersion}
                  className="w-full p-5 bg-primary/10 rounded-2xl flex items-center justify-between group border border-primary/20"
                >
                    <div className="flex items-center gap-3 text-primary">
                        {isCheckingVersion ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        <div className="text-left">
                            <span className="text-[10px] font-black uppercase tracking-widest">{VI.version.checkBtn}</span>
                            <p className="text-[8px] font-bold opacity-60 uppercase">Phiên bản {CURRENT_VERSION}</p>
                        </div>
                    </div>
                    <Info size={16} className="text-primary opacity-30" />
                </button>

                <button onClick={handleExportCSV} className="w-full p-5 bg-foreground/5 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet size={18} className="text-secondary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Xuất CSV</span>
                    </div>
                    <Download size={16} className="text-foreground/20" />
                </button>
                
                <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => setConfirmType('balance')} className="w-full p-4 bg-danger/5 text-danger rounded-xl text-[9px] font-black uppercase tracking-widest border border-danger/10">Reset số dư</button>
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

      {/* VERSION NOTIFICATION POPUP */}
      {versionPopup && versionPopup.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-xl px-8 animate-in fade-in zoom-in duration-300">
            <div className="glass-card w-full max-w-sm rounded-[3rem] p-10 border-0 shadow-2xl bg-surface/90 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6">
                    <button onClick={() => setVersionPopup(null)} className="text-foreground/30 hover:text-foreground"><X size={20}/></button>
                </div>
                
                <div className="text-center space-y-8">
                    <div className={`w-20 h-20 rounded-[2.25rem] flex items-center justify-center mx-auto shadow-xl ${versionPopup.type === 'up_to_date' ? 'bg-[#00FF7F]/10 text-[#00FF7F]' : 'bg-warning/10 text-warning'}`}>
                        {versionPopup.type === 'up_to_date' ? <CheckCircle2 size={40} /> : <RefreshCw size={40} className="animate-spin-slow" />}
                    </div>
                    
                    <div className="space-y-4">
                        <h3 className={`text-2xl font-black tracking-tighter uppercase ${versionPopup.type === 'up_to_date' ? 'text-[#00FF7F]' : 'text-warning'}`}>
                            {versionPopup.type === 'up_to_date' ? VI.version.upToDate : VI.version.outdated}
                        </h3>
                        
                        <div className="glass-card bg-foreground/[0.03] p-6 rounded-[2rem] border-0 shadow-inner">
                            <p className={`font-comic text-xl leading-relaxed italic ${versionPopup.type === 'up_to_date' ? 'text-foreground' : 'text-foreground/70'}`}>
                                {versionPopup.type === 'up_to_date' ? `"${versionPopup.quote}"` : VI.version.newVersionFound}
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={() => versionPopup.type === 'up_to_date' ? setVersionPopup(null) : window.location.reload()}
                        className={`w-full py-5 rounded-[2rem] font-[1000] text-[11px] uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 ${versionPopup.type === 'up_to_date' ? 'bg-[#00FF7F] text-white' : 'bg-warning text-white'}`}
                    >
                        {versionPopup.type === 'up_to_date' ? 'Đã hiểu' : 'Tải lại ngay'}
                    </button>
                </div>
            </div>
        </div>
      )}

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
