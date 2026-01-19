import React, { useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatVND } from '../utils/format';

interface Props {
  transactions: Transaction[];
}

export const CalendarView: React.FC<Props> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Helper to aggregate data per day
  const getDailyData = (day: number) => {
    const targetDateStr = new Date(year, month, day).toDateString(); // Simple comparison
    
    const dailyTx = transactions.filter(t => new Date(t.date).toDateString() === targetDateStr);
    
    const income = dailyTx
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expense = dailyTx
      .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER)
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense };
  };

  const renderDays = () => {
    const days = [];
    // Padding for start of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`pad-${i}`} className="h-24 bg-transparent"></div>);
    }
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const { income, expense } = getDailyData(day);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

      days.push(
        <div key={day} className={`h-24 border border-white/5 p-1 flex flex-col items-center justify-between relative ${isToday ? 'bg-white/5 rounded-lg' : ''}`}>
          <span className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-zinc-500'}`}>{day}</span>
          <div className="flex flex-col items-center gap-0.5 w-full">
            {income > 0 && (
                <span className="text-[10px] text-emerald-400 font-medium truncate w-full text-center">
                    +{formatVND(income).replace('₫', '')}
                </span>
            )}
            {expense > 0 && (
                <span className="text-[10px] text-danger font-medium truncate w-full text-center">
                    -{formatVND(expense).replace('₫', '')}
                </span>
            )}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-full"><ChevronLeft size={20} /></button>
        <span className="font-bold text-lg capitalize">
            Tháng {month + 1}, {year}
        </span>
        <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-full"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
         {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
             <div key={d} className="text-xs text-zinc-500 font-bold">{d}</div>
         ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {renderDays()}
      </div>
    </div>
  );
};