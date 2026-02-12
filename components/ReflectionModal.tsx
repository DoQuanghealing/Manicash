
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, Loader2, Heart, Zap, Ghost, Trash2 } from 'lucide-react';
import { VI } from '../constants/vi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  category?: string;
  title?: string;
  variant?: 'danger' | 'success';
  isLoading?: boolean;
}

export const ReflectionModal: React.FC<Props> = ({ isOpen, onClose, message, category, title, variant = 'danger', isLoading = false }) => {
  const [shouldShake, setShouldShake] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const displayTitle = title || VI.reflection.defaultTitle;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-3xl px-6 animate-in fade-in duration-500">
      <div className={`glass-card w-full max-w-sm rounded-[3.5rem] p-10 border-0 shadow-2xl transition-all duration-500 relative overflow-hidden ${shouldShake ? 'animate-sarcasm-shake' : ''} ${isDanger ? 'bg-gradient-to-br from-danger/10 to-background' : 'bg-gradient-to-br from-primary/10 to-background'}`}>
        
        {/* Decorative background emoji */}
        <div className="absolute top-[-10%] right-[-10%] opacity-10 rotate-12 scale-150 pointer-events-none">
            {isDanger ? <Ghost size={120} /> : <Zap size={120} />}
        </div>

        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
          <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative transition-transform hover:scale-110 active:rotate-6 ${isDanger ? 'bg-danger text-white shadow-danger/30' : 'bg-primary text-white shadow-primary/30'}`}>
            {isLoading ? (
              <Loader2 size={40} className="animate-spin opacity-50" />
            ) : (
              isDanger ? <AlertTriangle size={48} strokeWidth={2.5} /> : <Sparkles size={48} strokeWidth={2.5} />
            )}
            
            {isLoading && (
              <div className="absolute inset-0 border-4 border-white/20 rounded-[2.5rem] animate-ping opacity-20"></div>
            )}
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-foreground tracking-tight uppercase leading-none">{displayTitle}</h3>
            {isDanger && category && !isLoading && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-danger/20 text-danger border border-danger/20">
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                  Vượt hạn mức <span className="underline italic">{(VI.category as any)[category] || category}</span>
                </p>
              </div>
            )}
          </div>

          <div className="glass-card bg-foreground/[0.04] p-8 rounded-[2.5rem] w-full border-0 shadow-inner group relative">
            <div className="absolute -top-3 -left-3">
                <span className="text-4xl">🗨️</span>
            </div>
            <p className="font-comic text-xl text-foreground font-bold leading-relaxed-tight italic">
              {isLoading ? "Đang lục lại sổ nợ..." : `"${message}"`}
            </p>
          </div>
          
          <div className="flex w-full flex-col gap-3 pt-4">
            {!isLoading && (
              isDanger ? (
                <>
                  <button 
                    onClick={onClose}
                    className="w-full bg-danger text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-danger/20 active:scale-95 transition-all border border-white/20"
                  >
                    TÔI SẼ SỐNG TIẾT KIỆM HƠN 😭
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full py-4 text-foreground/30 text-[10px] font-black uppercase tracking-widest hover:text-foreground transition-colors"
                  >
                    Hết tiền rồi nhưng vẫn YOLO
                  </button>
                </>
              ) : (
                 <button 
                    onClick={onClose}
                    className="w-full bg-primary text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all border border-white/20"
                  >
                    TUÂN LỆNH QUẢN GIA ✨
                  </button>
              )
            )}
            
            {isLoading && (
              <div className="w-full h-16 bg-foreground/5 rounded-[2rem] animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
