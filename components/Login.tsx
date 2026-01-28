
import React, { useState } from 'react';
import { AuthService } from '../services/firebase';
import { Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await AuthService.loginWithGoogle();
    } catch (error) {
      alert("Hệ thống chưa cấu hình Firebase. Vui lòng liên hệ quản trị viên để thiết lập API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 bg-background overflow-hidden">
      {/* Background Blobs */}
      <div className="ai-bg-blob bg-primary top-[-100px] right-[-100px] opacity-20"></div>
      <div className="ai-bg-blob bg-secondary bottom-[-100px] left-[-100px] opacity-20"></div>

      <div className="w-full max-w-sm glass-card liquid-glass rounded-[3.5rem] p-10 text-center relative z-10 border-0 shadow-2xl space-y-12">
        <div className="space-y-4">
          <div className="w-24 h-24 bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl neon-glow-gold animate-bounce">
            <BrandLogo size={64} color="white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-[1000] text-foreground tracking-tighter uppercase leading-none">Manicash</h1>
            <p className="text-[11px] font-[800] text-foreground/50 uppercase tracking-tight">Quản trị tài chính thông minh</p>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white text-black font-[1000] py-6 rounded-[2rem] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 text-[12px] uppercase tracking-[0.2em] relative overflow-hidden group border-0"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                Kết nối với Google
              </>
            )}
            <div className="absolute inset-0 bg-gold/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          
          <div className="flex items-center justify-center gap-2 text-[9px] font-black text-foreground/20 uppercase tracking-widest pt-2">
            <Lock size={10} />
            Dữ liệu được bảo mật bởi Firebase
          </div>
        </div>

        <div className="glass-card bg-foreground/[0.03] p-6 rounded-[2.5rem] border-0 text-left">
           <div className="flex items-center gap-3 text-amber-500 mb-4">
              <ShieldCheck size={18} />
              <span className="text-[11px] font-black uppercase tracking-widest">4 nguyên lý tài chính</span>
           </div>
           <ul className="text-[10px] font-bold text-foreground/50 leading-relaxed uppercase tracking-tight space-y-2">
              <li className="flex gap-2"><span>1.</span> <span>Biết được mình dùng tiền thế nào</span></li>
              <li className="flex gap-2"><span>2.</span> <span>Tối ưu thu nhập và chi tiêu</span></li>
              <li className="flex gap-2"><span>3.</span> <span>Mục tiêu lớn nào khiến mình phải tăng thu nhập</span></li>
              <li className="flex gap-2"><span>4.</span> <span>Kế hoạch tăng thu nhập là gì?</span></li>
           </ul>
        </div>

        <div className="flex items-center justify-center gap-2 text-[9px] font-black text-foreground/20 uppercase tracking-widest">
            <Sparkles size={12} />
            App được tạo bởi Đỗ Dương Quang
        </div>
      </div>
    </div>
  );
};
