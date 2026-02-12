
import React, { useState, useEffect } from 'react';
import { X, Rocket, PlayCircle, Heart, Sparkles, Send, CheckCircle2, Loader2, Star, Trophy, ArrowRight, Zap, GraduationCap, LayoutPanelLeft } from 'lucide-react';
import { AuthService } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
}

export const FutureRoadmap: React.FC<Props> = ({ isOpen, onClose, userEmail, userId }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('manicash_roadmap_registered');
    if (saved === 'true') {
      setIsAlreadyRegistered(true);
    }
  }, []);

  if (!isOpen) return null;

  const handleRegisterAll = async () => {
    if (isAlreadyRegistered) {
      setStatus('success');
      return;
    }

    setStatus('loading');
    
    // Ghi nhận sự quan tâm tổng thể tới Roadmap
    const success = await AuthService.logFutureLead('full_roadmap_2025', userEmail, userId);
    
    if (success) {
      localStorage.setItem('manicash_roadmap_registered', 'true');
      setIsAlreadyRegistered(true);
      setStatus('success');
    } else {
      setStatus('idle');
      alert("Hệ thống bận, vui lòng thử lại sau!");
    }
  };

  const roadmapItems = [
    {
      title: 'Manicash E-Learning',
      desc: 'Nền tảng học tập tài chính tinh gọn với các video ngắn 60 giây, giúp Người nắm vững mindset thịnh vượng chỉ trong vài phút mỗi ngày.',
      icon: GraduationCap,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      title: 'Mindfulness & Energy',
      desc: 'Cân bằng cảm xúc và năng lượng tiền bạc thông qua chuông thiền định kỳ và các bài tập thở khoa học tích hợp ngay trong app.',
      icon: Heart,
      color: 'text-secondary',
      bg: 'bg-secondary/10'
    },
    {
      title: 'CFO AI Pro+',
      desc: 'Nâng cấp bộ não tài chính với khả năng dự báo dòng tiền 12 tháng và gợi ý các kênh đầu tư tối ưu dựa trên thói quen chi tiêu.',
      icon: Zap,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-3xl px-6 animate-in fade-in duration-300">
      
      <div className="glass-card w-full max-w-[400px] rounded-[3.5rem] p-0 border-0 shadow-2xl animate-in zoom-in-95 duration-500 bg-surface/95 relative overflow-hidden flex flex-col max-h-[85vh]">
        
        {status !== 'success' ? (
          <>
            {/* Header Trang trí */}
            <div className="relative h-32 shrink-0 overflow-hidden bg-gradient-to-br from-primary via-purple-600 to-primary">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Rocket size={32} className="mb-2 animate-bounce" />
                    <h3 className="text-xl font-[1000] uppercase tracking-[0.2em]">Roadmap 2025</h3>
                </div>
                <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all text-white">
                    <X size={20} />
                </button>
            </div>

            {/* Nội dung Roadmap */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-6 space-y-8">
              <div className="text-center space-y-2 px-2">
                <p className="text-[11px] font-black text-foreground/30 uppercase tracking-[0.2em] leading-relaxed">
                  Kiến tạo lối sống thịnh vượng
                </p>
                <p className="text-[13px] font-bold text-foreground/70 leading-relaxed italic">
                  "Chúng tôi không chỉ xây dựng công cụ, chúng tôi kiến tạo hành trình tự do cho Người."
                </p>
              </div>

              <div className="space-y-6">
                {roadmapItems.map((item, idx) => (
                  <div key={idx} className="flex gap-5 group">
                    <div className={`w-14 h-14 shrink-0 ${item.bg} ${item.color} rounded-[1.25rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon size={24} />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <h4 className="text-[14px] font-[1000] text-foreground uppercase tracking-tight leading-none">{item.title}</h4>
                      <p className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide leading-[1.7]">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Nút Đăng Ký Duy Nhất */}
            <div className="p-8 pt-4 bg-surface/50 backdrop-blur-md border-t border-foreground/5 shrink-0">
              <button
                onClick={handleRegisterAll}
                disabled={status === 'loading'}
                className="w-full bg-primary text-white font-[1000] py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.3em] shadow-[0_20px_40px_rgba(139,92,246,0.3)] neon-glow-primary active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20"
              >
                {status === 'loading' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Send size={18} /> Đăng ký nhận lộ trình
                  </>
                )}
              </button>
              <p className="text-[9px] font-bold text-foreground/20 text-center uppercase tracking-widest mt-4">
                Tham gia cộng đồng sớm nhất để nhận đặc quyền Pro
              </p>
            </div>
          </>
        ) : (
          /* MÀN HÌNH CHÚC MỪNG RỰC RỠ */
          <div className="p-10 text-center space-y-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-secondary/20 blur-[60px] rounded-full animate-pulse"></div>
                <div className="w-28 h-28 bg-secondary text-white rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl neon-glow-secondary relative z-10 animate-bounce">
                    <Trophy size={56} strokeWidth={2.5} />
                </div>
            </div>
            
            <div className="space-y-4">
                <div className="inline-block px-5 py-2 rounded-full bg-secondary/10 border border-secondary/20">
                    <h3 className="text-[11px] font-black text-secondary uppercase tracking-[0.5em] animate-pulse">ĐÃ GHI DANH</h3>
                </div>
                <h4 className="text-3xl font-[1000] text-foreground tracking-tighter uppercase leading-none px-2">
                    Chúc mừng Người đã đăng ký thành công!
                </h4>
                <div className="px-4">
                    <p className="font-comic text-xl text-foreground font-bold leading-relaxed italic opacity-90">
                        "Lord Diamond đã ghi lại tên Người trong danh sách khách mời danh dự của tương lai thịnh vượng."
                    </p>
                </div>
            </div>

            <div className="glass-card bg-foreground/[0.04] p-6 rounded-[2.5rem] border-0 shadow-inner">
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest leading-relaxed">
                    Người sẽ là một trong những người đầu tiên trải nghiệm các tính năng độc quyền này ngay khi ra mắt.
                </p>
            </div>

            <button 
                onClick={onClose}
                className="w-full bg-foreground text-background font-[1000] py-6 rounded-[2.25rem] text-[12px] uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
                TUÂN LỆNH QUẢN GIA <CheckCircle2 size={18} />
            </button>

            {/* Decorative Stars */}
            <Star size={24} className="absolute top-10 left-10 text-secondary opacity-20 animate-spin" />
            <Sparkles size={32} className="absolute bottom-10 right-10 text-primary opacity-20 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
};
