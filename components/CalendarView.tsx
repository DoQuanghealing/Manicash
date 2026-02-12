
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatCompactNumber } from '../utils/format';
import { AuthService } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { DataGuard } from '../utils/dataGuard';

interface Props {
  transactions: Transaction[]; // Fallback prop nếu không có Firebase
}

export const CalendarView: React.FC<Props> = ({ transactions: propTransactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dbTransactions, setDbTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!AuthService.isConfigured()) {
        setDbTransactions(propTransactions.map(DataGuard.sanitizeTransaction));
        return;
    }

    const db = AuthService.getDb();
    const currentUser = (AuthService as any).lastUid;

    if (db && currentUser) {
      setLoading(true);
      const docRef = doc(db, "userData", currentUser);
      
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        try {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const txs = data.duocash_transactions || [];
              // DATA GUARD: Sanitize real-time data
              setDbTransactions(txs.map(DataGuard.sanitizeTransaction));
            }
        } catch (e) {
            console.error("Calendar Snapshot Error:", e);
            setDbTransactions(propTransactions.map(DataGuard.sanitizeTransaction));
        } finally {
            setLoading(false);
        }
      }, (error) => {
        console.error("Calendar Firebase Error:", error);
        setLoading(false);
        setDbTransactions(propTransactions.map(DataGuard.sanitizeTransaction));
      });

      return () => unsubscribe();
    } else {
      setDbTransactions(propTransactions.map(DataGuard.sanitizeTransaction));
    }
  }, [propTransactions]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthData = useMemo(() => {
    const data: Record<number, { income: number; expense: number }> = {};
    
    dbTransactions.forEach(t => {
      try {
          const d = new Date(t.date);
          if (d.getMonth() === month && d.getFullYear() === year) {
            const date = d.getDate();
            if (!data[date]) data[date] = { income: 0, expense: 0 };
            
            if (t.type === TransactionType.INCOME) {
              data[date].income += DataGuard.asNumber(t.amount);
            } else if (t.type === TransactionType.EXPENSE) {
              data[date].expense += DataGuard.asNumber(t.amount);
            }
          }
      } catch { /* Bỏ qua giao dịch lỗi ngày tháng */ }
    });
    
    return data;
  }, [dbTransactions, month, year]);

  return (
    <div className="animate-in fade-in duration-300 relative font-sans">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-3xl">
          <Loader2 className="text-primary animate-spin" size={32} />
        </div>
      )}

      <div className="flex justify-between items-center mb-6 px-2">
        <button onClick={prevMonth} className="p-3 glass-card rounded-2xl text-foreground/50 hover:text-primary transition-all">
          <ChevronLeft size={20} />
        </button>
        <span className="font-black text-[13px] uppercase tracking-[0.2em] text-foreground">Tháng {month + 1} • {year}</span>
        <button onClick={nextMonth} className="p-3 glass-card rounded-2xl text-foreground/50 hover:text-primary transition-all">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
         {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
             <div key={d} className="text-[9px] text-foreground/20 font-black uppercase tracking-widest">{d}</div>
         ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`p-${i}`} className="aspect-square opacity-0"></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const daily = monthData[day] || { income: 0, expense: 0 };
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
            
            return (
                <div 
                  key={day} 
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-between py-1.5 border transition-all relative overflow-hidden ${
                    isToday 
                      ? 'bg-primary border-primary shadow-lg shadow-primary/20 scale-105 z-10' 
                      : 'bg-foreground/[0.03] border-foreground/5'
                  }`}
                >
                    <span className={`text-[9px] font-black leading-none mb-0.5 ${isToday ? 'text-white' : 'text-foreground/40'}`}>
                      {day}
                    </span>

                    <div className="flex flex-col items-center justify-center w-full px-0.5 flex-1 min-h-0 space-y-0.5">
                        {daily.income > 0 && (
                          <span className={`text-[8px] font-black leading-tight tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ${isToday ? 'text-white' : 'text-emerald-400'}`}>
                            {formatCompactNumber(daily.income)}
                          </span>
                        )}
                        {daily.expense > 0 && (
                          <span className={`text-[8px] font-black leading-tight tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ${isToday ? 'text-white/80' : 'text-orange-500'}`}>
                            {formatCompactNumber(daily.expense)}
                          </span>
                        )}
                        
                        {daily.income === 0 && daily.expense === 0 && (
                          <div className={`w-0.5 h-0.5 rounded-full ${isToday ? 'bg-white/20' : 'bg-foreground/5'}`}></div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>

      <div className="mt-6 flex justify-center gap-6 opacity-40">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
          <span className="text-[8px] font-black uppercase tracking-widest">Thu nhập</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
          <span className="text-[8px] font-black uppercase tracking-widest">Chi tiêu</span>
        </div>
      </div>
    </div>
  );
};
