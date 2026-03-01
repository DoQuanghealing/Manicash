import React, { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { ToastProvider } from "./components/ToastProvider";
import { StorageService } from "./services/storageService";
import { User } from "./types";
import { useToast } from "./components/ToastProvider";

function AppContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [aiStatus, setAiStatus] = useState<
    "checking" | "online" | "fallback" | "offline"
  >("checking");

  const { showToast } = useToast();

  // 🚀 Load users
  useEffect(() => {
    try {
      const storedUsers = StorageService.getUsers?.() || [];
      setUsers(storedUsers);
    } catch (err) {
      console.error("Load users error:", err);
      setUsers([]);
    } finally {
      setIsReady(true);
    }
  }, []);

  // 🧠 AI HEALTH CHECK khi app khởi động
  useEffect(() => {
    const checkAI = async () => {
      try {
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;

        if (!geminiKey && !groqKey) {
          setAiStatus("offline");
          return;
        }

        if (geminiKey && groqKey) {
          setAiStatus("online");
        } else {
          setAiStatus("fallback");
        }
      } catch (err) {
        setAiStatus("offline");
      }
    };

    checkAI();
  }, []);

  const handleLoginSuccess = () => {
    const storedUsers = StorageService.getUsers?.() || [];
    setUsers(storedUsers);
    showToast("Đăng nhập thành công", "success");
  };

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-pulse text-sm font-bold uppercase tracking-widest">
          Đang khởi động hệ thống...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* 🌐 AI STATUS INDICATOR GLOBAL */}
      <div className="fixed bottom-6 right-6 z-[999]">
        <div
          className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl backdrop-blur-xl border
            ${
              aiStatus === "online"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : aiStatus === "fallback"
                ? "bg-warning/10 border-warning/30 text-warning"
                : aiStatus === "offline"
                ? "bg-danger/10 border-danger/30 text-danger"
                : "bg-primary/10 border-primary/30 text-primary"
            }
          `}
        >
          {aiStatus === "checking" && "AI: Checking..."}
          {aiStatus === "online" && "AI: Online"}
          {aiStatus === "fallback" && "AI: Limited Mode"}
          {aiStatus === "offline" && "AI: Offline"}
        </div>
      </div>

      {users.length === 0 ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Layout users={users} />
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
