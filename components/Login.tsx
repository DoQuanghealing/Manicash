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
      alert("Hệ thống đang bảo trì hoặc chưa cấu hình Firebase. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-[#020617] overflow-hidden">
      {/* Hiệu ứng nền Blur High-tech */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-purple-600/20 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-emerald-600/20 blur-[100px] rounded-full"></div>

      <div className="w-full max-w-[340px] relative z-10 flex flex-col items-center">
        {/* Logo Phần Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#facc15] rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.3)] mb-6 animate-pulse">
            <BrandLogo size={48} color="white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none mb-1">Manicash</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quản trị tài chính thông minh</p>
        </div>

        {/* Nút Đăng nhập Google - Tối ưu hiển thị */}
        <div className="w-full space-y-4 mb-10">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full h-16 bg-white hover:bg-gray-100 text-black font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 text-[13px] uppercase tracking-widest relative overflow-hidden group border-0"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
            ) : (
              <>
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  className="w-5 h-5 object-contain flex-shrink-0" 
                  alt="Google" 
                />
                <span>Kết nối với Google</span>
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <Lock size={12} />
            <span>Dữ liệu được bảo mật bởi Firebase</span>
          </div>
        </div>

        {/* Bảng 4 nguyên lý tài chính - Glassmorphism */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] text-left mb-8">
          <div className="flex items-center gap-3 text-amber-500 mb-4">
            <ShieldCheck size={20} />
            <span className="text-[11px] font-black uppercase tracking-widest">4 nguyên lý tài chính</span>
          </div>
          <ul className="text-[11px] font-bold text-gray-300 leading-relaxed uppercase tracking-tight space-y-3">
            <li className="flex gap-3"><span className="text-amber-500">1.</span> <span>Biết được mình dùng tiền thế nào</span></li>
            <li className="flex gap-3"><span className="text-amber-500">2.</span> <span>Tối ưu thu nhập và chi tiêu</span></li>
            <li className="flex gap-3"><span className="text-amber-500">3.</span> <span>Mục tiêu lớn nào khiến mình phải tăng thu nhập</span></li>
            <li className="flex gap-3"><span className="text-amber-500">4.</span> <span>Kế hoạch tăng thu nhập là gì?</span></li>
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">
          <Sparkles size={12} />
          <span>App được tạo bởi Đỗ Dương Quang</span>
        </div>
      </div>
    </div>
  );
};
