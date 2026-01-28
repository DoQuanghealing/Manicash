import React, { ReactNode } from 'react';
import { LayoutDashboard, PlusCircle, PieChart, Target, Sparkles, Plus } from 'lucide-react';
import { VI } from '../constants/vi';

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddTransaction: () => void;
}

const NavItem = ({ id, icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-all duration-300 z-10 ${
      active ? 'text-primary' : 'text-foreground/20 hover:text-foreground/40'
    }`}
  >
    <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-primary/10 scale-110' : ''}`}>
      <Icon size={22} strokeWidth={active ? 3 : 2} />
    </div>
    <span className="text-[7px] font-[900] uppercase tracking-[0.2em]">{label}</span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, onAddTransaction }) => {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-['Be_Vietnam_Pro']">
      
      {/* 1. Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-safe-top">
        <div className="max-w-md mx-auto min-h-full relative px-4 flex flex-col">
            
            {/* Nội dung Dashboard/Budgets sẽ hiện ở đây */}
            <div className="flex-1">
              {children}
            </div>

            {/* SỬA TẠI ĐÂY: Bổ sung Footer High-tech vào cuối nội dung cuộn */}
            <footer className="mt-20 mb-10 py-10 border-t border-white/5 text-center flex flex-col items-center gap-4">
               <div className="flex items-center gap-2 text-[9px] font-black text-foreground/20 uppercase tracking-[0.3em]">
                  <Sparkles size={14} className="text-primary/40" />
                  <span>App được tạo bởi Đỗ Dương Quang</span>
               </div>
               
               {/* Một chút trang trí để footer trông sang trọng hơn */}
               <div className="w-10 h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded-full"></div>
            </footer>
        </div>
      </main>

      {/* 2. High-Tech Navigation Bar (Giữ nguyên logic của bạn) */}
      <nav className="fixed bottom-0 left-0 right-0 h-[90px] pb-safe-bottom z-[150] pointer-events-none">
        <div className="max-w-md mx-auto h-full relative pointer-events-auto">
          {/* SVG Background... (Giữ nguyên phần SVG cũ của bạn) */}
          <div className="absolute inset-0">
            <svg width="100%" height="90" viewBox="0 0 400 90" preserveAspectRatio="none" className="drop-shadow-[0_-10px_25px_rgba(0,0,0,0.1)]">
              <path 
                d="M0,20 L155,20 C165,20 170,20 175,25 C185,35 185,65 200,65 C215,65 215,35 225,25 C230,20 235,20 245,20 L400,20 L400,90 L0,90 Z" 
                fill="rgb(15, 23, 42)" // Đã đổi sang màu nền tối để tiệp màu với High-tech
                className="backdrop-blur-3xl"
              />
            </svg>
          </div>

          <div className="relative h-full grid grid-cols-5 items-center px-4 pt-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label={VI.nav.dashboard} active={activeTab === 'dashboard'} onClick={() => onTabChange('dashboard')} />
            <NavItem id="budgets" icon={PieChart} label={VI.nav.budgets} active={activeTab === 'budgets'} onClick={() => onTabChange('budgets')} />
            
            <div className="flex items-center justify-center -mt-8">
              <button 
                  onClick={onAddTransaction}
                  className="bg-primary text-white rounded-full p-5 shadow-[0_15px_30px_-5px_rgba(139,92,246,0.6)] transition-all hover:scale-110 active:scale-90 border-[4px] border-[#020617] relative overflow-hidden group"
              >
                  <Plus size={32} strokeWidth={3} />
              </button>
            </div>

            <NavItem id="goals" icon={Target} label={VI.nav.goals} active={activeTab === 'goals'} onClick={() => onTabChange('goals')} />
            <NavItem id="insights" icon={Sparkles} label={VI.nav.insights} active={activeTab === 'insights'} onClick={() => onTabChange('insights')} />
          </div>
        </div>
      </nav>
    </div>
  );
};
