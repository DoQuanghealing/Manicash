
import React from 'react';
import { AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
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
  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const displayTitle = title || VI.reflection.defaultTitle;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-2xl px-6 animate-in fade-in duration-300">
      <div className={`glass-card w-full max-w-sm rounded-[2.5rem] p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-300 ${isDanger ? 'bg-gradient-to-br from-danger/5 to-background' : 'bg-gradient-to-br from-primary/5 to-background'}`}>
        
        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl relative ${isDanger ? 'bg-danger/10 text-danger shadow-danger/20' : 'bg-primary/10 text-primary shadow-primary/20'}`}>
            {isLoading ? (
              <Loader2 size={36} className="animate-spin text-primary opacity-50" />
            ) : (
              isDanger ? <AlertTriangle size={36} /> : <Sparkles size={36} />
            )}
            
            {/* Hiệu ứng xung quanh khi đang load */}
            {isLoading && (
              <div className="absolute inset-0 border-4 border-primary/20 rounded-[2rem] animate-ping opacity-20"></div>
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-[1000] text-foreground tracking-tighter uppercase">{displayTitle}</h3>
            {isDanger && category && !isLoading && (
              <p className="text-foreground/40 text-[11px] font-black uppercase tracking-widest">
                {VI.reflection.exceeded} <span className="text-danger">{(VI.category as any)[category] || category}</span>
              </p>
            )}
          </div>

          <div className={`glass-card bg-foreground/[0.03] p-6 rounded-[1.75rem] w-full border-0 transition-all duration-500 ${isLoading ? 'opacity-50 blur-[2px]' : 'opacity-100 blur-0'}`}>
            <p className="font-comic text-lg text-foreground font-bold leading-snug">
              {isLoading ? "..." : `"${message}"`}
            </p>
          </div>
          
          <div className="flex w-full gap-3 pt-2">
            {!isLoading && (
              isDanger ? (
                <>
                  <button 
                    onClick={onClose}
                    className="flex-1 glass-card bg-foreground/5 text-foreground py-4 rounded-2xl text-xs font-black uppercase tracking-widest border-0 transition-all active:scale-95"
                  >
                    {VI.reflection.guilt}
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 bg-danger text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-danger/20 active:scale-95 transition-all"
                  >
                    {VI.reflection.yolo}
                  </button>
                </>
              ) : (
                 <button 
                    onClick={onClose}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                  >
                    {VI.reflection.received}
                  </button>
              )
            )}
            
            {/* Nút giả khi đang load để tránh layout shift */}
            {isLoading && (
              <div className="flex-1 h-12 bg-foreground/5 rounded-2xl animate-pulse"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
