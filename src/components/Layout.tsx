import React, { useState } from "react";
import {
  LayoutDashboard,
  PieChart,
  Target,
  Sparkles,
  Plus,
} from "lucide-react";

import { VI } from "../constants/vi";

// 🔥 Import pages theo kiến trúc mới
import Dashboard from "./Dashboard";
import BudgetView from "./BudgetView";
import InvestmentGoal from "./InvestmentGoal";
import InsightPage from "../features/insight/InsightPage";

interface LayoutProps {
  users: any[];
}

type TabKey = "dashboard" | "budgets" | "goals" | "insights";

const NavItem = ({
  icon: Icon,
  label,
  active,
  onClick,
}: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative ${
      active
        ? "text-primary"
        : "text-foreground/20 hover:text-foreground/40"
    }`}
  >
    <div
      className={`p-2 rounded-2xl transition-all ${
        active ? "bg-primary/10 scale-110" : ""
      }`}
    >
      <Icon size={22} strokeWidth={active ? 3 : 2} />
    </div>
    <span className="text-[7px] font-[900] uppercase tracking-[0.2em] whitespace-nowrap">
      {label}
    </span>
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ users }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");

  const handleAddTransaction = () => {
    // bạn có thể mở modal sau này
    console.log("Add transaction clicked");
  };

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard users={users} />;

      case "budgets":
        return <BudgetView />;

      case "goals":
        return <InvestmentGoal />;

      case "insights":
        return <InsightPage users={users} />;

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-background text-foreground overflow-hidden">

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative z-10 pt-safe-top pb-4">
        <div className="max-w-md mx-auto min-h-full px-4">
          {renderPage()}
        </div>
      </main>

      {/* ================= NAVIGATION ================= */}
      <nav className="h-[85px] w-full shrink-0 relative z-[100] bg-transparent pb-safe-bottom">
        <div className="max-w-md mx-auto h-full relative">

          {/* Background SVG */}
          <div className="absolute inset-x-0 bottom-0 h-[100px] pointer-events-none">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 100"
              preserveAspectRatio="none"
              className="drop-shadow-[0_-15px_35px_rgba(139,92,246,0.12)]"
            >
              <path
                d="M0,30 L155,30 C165,30 170,30 175,35 C185,45 185,75 200,75 C215,75 215,45 225,35 C230,30 235,30 245,30 L400,30 L400,100 L0,100 Z"
                fill="rgba(var(--surface), 0.85)"
                className="backdrop-blur-3xl"
              />
              <path
                d="M0,30 L155,30 C165,30 170,30 175,35 C185,45 185,75 200,75 C215,75 215,45 225,35 C230,30 235,30 245,30 L400,30"
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />
            </svg>
          </div>

          {/* Interactive Layer */}
          <div className="relative h-full grid grid-cols-5 items-center px-4">

            <NavItem
              icon={LayoutDashboard}
              label={VI.nav.dashboard}
              active={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
            />

            <NavItem
              icon={PieChart}
              label={VI.nav.budgets}
              active={activeTab === "budgets"}
              onClick={() => setActiveTab("budgets")}
            />

            {/* Center Add Button */}
            <div className="flex items-center justify-center -mt-10 relative z-[110]">
              <div className="relative p-[1.5px] rounded-full bg-white/20 shadow-[0_10px_30px_-5px_rgba(139,92,246,0.3)] active:scale-95 transition-all">
                <button
                  onClick={handleAddTransaction}
                  className="bg-primary text-white rounded-full p-5 relative overflow-hidden group border border-white/30 shadow-inner"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-black/10 opacity-60"></div>
                  <Plus size={30} strokeWidth={4} className="relative z-10" />
                  <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] group-hover:left-[200%] transition-all duration-1000 ease-in-out"></div>
                </button>
              </div>
            </div>

            <NavItem
              icon={Target}
              label={VI.nav.goals}
              active={activeTab === "goals"}
              onClick={() => setActiveTab("goals")}
            />

            <NavItem
              icon={Sparkles}
              label={VI.nav.insights}
              active={activeTab === "insights"}
              onClick={() => setActiveTab("insights")}
            />
          </div>
        </div>
      </nav>
    </div>
  );
};
