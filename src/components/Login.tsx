
import React, { useState } from 'react';
import { AuthService } from '../services/firebase';
import { Sparkles, ShieldCheck, AlertTriangle, X, Zap } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LoginProps {
  onBypass?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBypass }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await AuthService.loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    // Gi giả lập độ trễ nạp dữ liệu
    setTimeout(async () => {
      await AuthService.loginGuest();
      setIsLoading(false);
      if (onBypass) onBypass();
    }, 800);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-background overflow-hidden font-sans">
      {/* Background Blobs - Cải thiện thẩm mỹ nền */}
      <div className="ai-bg-blob bg-primary top-[-100px] right-[-100px] opacity-10"></div>
      <div className="ai-bg-blob bg-secondary bottom-[-100px] left-[-100px] opacity-10"></div>

      <div className="w-full max-w-sm glass-card liquid-glass rounded-[3.5rem] p-10 text-center relative z-10 border-0 shadow-2xl space-y-10 animate-in fade-in zoom-in duration-700 tracking-[0.02em]">
        
        {/* Error Toast */}
        {error && (
          <div className="absolute top-4 left-4 right-4 animate-in slide-in-from-top duration-300 z-50">
             <div className="bg-danger/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
                <AlertTriangle size={20} className="shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-[0.02em] text-left flex-1 leading-tight">{error}</p>
                <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                  <X size={16} />
                </button>
             </div>
          </div>
        )}

        {/* Logo & Header Section - Tăng kích thước logo 15% (w-24 -> w-28) */}
        <div className="space-y-6 pt-2">
          <div className="w-28 h-28 bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-xl animate-bounce">
            <BrandLogo size={74} color="white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase leading-none">Manicash</h1>
            <p className="text-[11px] font-extrabold text-foreground/50 uppercase tracking-[0.1em]">Quản trị tài chính thông minh</p>
          </div>
        </div>

        {/* Buttons Section - Đồng nhất kiểu chữ và hiệu ứng đơn giản */}
        <div className="space-y-4">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white text-black font-black py-6 rounded-[2rem] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-4 text-[12px] uppercase tracking-[0.02em] relative overflow-hidden hover:brightness-110 border-0 disabled:opacity-70"
          >
            {isLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-black/10 border-t-black rounded-full animate-spin"></div>
                <span className="text-[10px]">Đang xử lý...</span>
              </div>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                Kết nối với Google
              </>
            )}
          </button>
          
          <button
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full bg-primary/10 text-primary font-black py-5 rounded-[1.75rem] active:scale-95 transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.02em] border-2 border-primary/20 hover:bg-primary/20 disabled:opacity-50"
          >
            <Zap size={16} className="fill-current" /> Trải nghiệm Demo
          </button>

          <button
            onClick={() => onBypass && onBypass()}
            className="w-full bg-foreground/5 text-foreground/40 font-black py-3 rounded-[1.25rem] active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] border border-foreground/10 hover:bg-foreground/10"
          >
            Bypass Login (Dev Only)
          </button>
        </div>

        {/* Principles Section - Tối ưu khoảng cách dòng (leading-relaxed ~ 1.6) */}
        <div className="glass-card bg-foreground/[0.03] p-7 rounded-[2.5rem] border-0 text-left shadow-inner">
           <div className="flex items-center gap-3 text-amber-500 mb-5">
              <ShieldCheck size={20} />
              <span className="text-[12px] font-black uppercase tracking-widest">4 nguyên lý tài chính</span>
           </div>
           <ul className="text-[11px] font-bold text-foreground/60 leading-[1.65] uppercase tracking-[0.02em] space-y-3">
              <li className="flex gap-3"><span className="text-amber-500/50">01.</span> <span>Biết được mình dùng tiền thế nào</span></li>
              <li className="flex gap-3"><span className="text-amber-500/50">02.</span> <span>Tối ưu thu nhập và chi tiêu</span></li>
              <li className="flex gap-3"><span className="text-amber-500/50">03.</span> <span>Mục tiêu lớn thúc đẩy thu nhập</span></li>
              <li className="flex gap-3"><span className="text-amber-500/50">04.</span> <span>Kế hoạch hành động cụ thể</span></li>
           </ul>
        </div>

        {/* Footer Text - Đẩy lên cách mép card khoảng 24px (pb-6) */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em] pb-6">
            <Sparkles size={12} className="animate-pulse" />
            Manicash v1.2 • AI Core 3.0
        </div>
      </div>
    </div>
  );
};
