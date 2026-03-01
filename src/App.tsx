import React, { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { ToastProvider, useToast } from "./components/ToastProvider";
import { StorageService } from "./services/storageService";
import type { User } from "./types";

type AiHealth = "checking" | "online" | "fallback" | "offline";

function AppContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [aiHealth, setAiHealth] = useState<AiHealth>("checking");

  const { showToast } = useToast();

  // 🚀 Load users khi khởi động
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

  // 🧠 AI HEALTH CHECK khi app start
  useEffect(() => {
    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const groqKey = import.meta.env.VITE_GROQ_API_KEY;

      if (!geminiKey && !groqKey) {
        setAiHealth("offline");
        return;
      }

      if (geminiKey && groqKey) {
        setAiHealth("online");
      } else {
        setAiHealth("fallback");
      }
    } catch {
      setAiHealth("offline");
    }
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

      {/* 🌐 GLOBAL AI STATUS INDICATOR */}
      <div className="fixed bottom-6 right-6 z-[999]">
        <div
          className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl backdrop-blur-xl border
            ${
              aiHealth === "online"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : aiHealth === "fallback"
                ? "bg-warning/10 border-warning/30 text-warning"
                : aiHealth === "offline"
                ? "bg-danger/10 border-danger/30 text-danger"
                : "bg-primary/10 border-primary/30 text-primary"
            }
          `}
        >
          {aiHealth === "checking" && "AI: Checking..."}
          {aiHealth === "online" && "AI: Online"}
          {aiHealth === "fallback" && "AI: Limited Mode"}
          {aiHealth === "offline" && "AI: Offline"}
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
