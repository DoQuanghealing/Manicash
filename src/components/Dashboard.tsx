import React, { useMemo, useState } from "react";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  Rocket,
  Settings,
} from "lucide-react";

import type { Wallet, Transaction, User } from "../types";
import { formatVND } from "../utils/format";
import { DataGuard } from "../utils/dataGuard";
import { StorageService } from "../services/storageService";
import { CalendarView } from "./CalendarView";

interface Props {
  users?: User[];
  wallets?: Wallet[];
  transactions?: Transaction[];
}

const Dashboard: React.FC<Props> = ({
  users = [],
  wallets = [],
  transactions = [],
}) => {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [activeWalletTab, setActiveWalletTab] = useState<"main" | "backup">(
    "main"
  );

  const activeUser = users[0];

  const mainWallet = wallets.find((w) => w.id === "w1") || wallets[0];
  const backupWallet = wallets.find((w) => w.id === "w2");

  const totalBalance = useMemo(() => {
    return wallets.reduce(
      (acc, w) => acc + DataGuard.asNumber(w.balance),
      0
    );
  }, [wallets]);

  const activeBalance =
    activeWalletTab === "main"
      ? DataGuard.asNumber(mainWallet?.balance)
      : DataGuard.asNumber(backupWallet?.balance);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort(
        (a, b) =>
          DataGuard.asNumber(b.timestamp) -
          DataGuard.asNumber(a.timestamp)
      )
      .slice(0, 10);
  }, [transactions]);

  const aiBrain = StorageService.getAiBrain() || "gemini";

  return (
    <div className="space-y-8 pt-8">

      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-black">
            Tổng tài sản
          </p>
          <h1 className="text-3xl font-black tracking-tight">
            {formatVND(totalBalance)}
          </h1>
        </div>

        <div className="flex gap-3">
          <button className="p-3 bg-primary/10 text-primary rounded-2xl">
            <Rocket size={20} />
          </button>
          <button className="p-3 bg-surface text-foreground/50 rounded-2xl">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* ===== WALLET SWITCH ===== */}
      <div className="flex bg-surface rounded-2xl p-1">
        <button
          onClick={() => setActiveWalletTab("main")}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase ${
            activeWalletTab === "main"
              ? "bg-primary text-white"
              : "text-foreground/40"
          }`}
        >
          Ví chính
        </button>

        <button
          onClick={() => setActiveWalletTab("backup")}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase ${
            activeWalletTab === "backup"
              ? "bg-secondary text-white"
              : "text-foreground/40"
          }`}
        >
          Dự phòng
        </button>
      </div>

      {/* ===== ACTIVE BALANCE CARD ===== */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-surface to-background shadow-xl">
        <p className="text-xs uppercase tracking-widest text-foreground/30 font-bold">
          Số dư hiện tại
        </p>
        <h2 className="text-4xl font-black mt-2">
          {formatVND(activeBalance)}
        </h2>

        <div className="flex items-center gap-3 mt-6">
          <WalletIcon size={20} />
          <span className="text-xs uppercase font-bold tracking-widest">
            {activeWalletTab === "main"
              ? mainWallet?.name || "Ví chính"
              : backupWallet?.name || "Dự phòng"}
          </span>

          <div className="ml-auto text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles size={12} />
            {aiBrain.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ===== TRANSACTIONS ===== */}
      <div className="bg-surface rounded-3xl shadow-xl overflow-hidden">

        <div className="flex justify-between items-center p-6 border-b border-foreground/5">
          <h3 className="text-xs uppercase tracking-widest text-foreground/40 font-bold">
            Giao dịch gần đây
          </h3>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 rounded-xl text-xs ${
                viewMode === "list"
                  ? "bg-primary text-white"
                  : "text-foreground/40"
              }`}
            >
              List
            </button>

            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-2 rounded-xl text-xs ${
                viewMode === "calendar"
                  ? "bg-primary text-white"
                  : "text-foreground/40"
              }`}
            >
              Calendar
            </button>
          </div>
        </div>

        <div className="p-6 min-h-[200px]">

          {viewMode === "list" ? (
            recentTransactions.length > 0 ? (
              <div className="space-y-4">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {tx.category}
                      </p>
                      <p className="text-xs text-foreground/40">
                        {tx.description || "Không mô tả"}
                      </p>
                    </div>

                    <div
                      className={`font-black ${
                        tx.type === "income"
                          ? "text-secondary"
                          : "text-foreground"
                      }`}
                    >
                      {tx.type === "income" ? (
                        <ArrowUpRight size={16} className="inline" />
                      ) : (
                        <ArrowDownRight size={16} className="inline" />
                      )}
                      {formatVND(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-foreground/30 text-xs uppercase tracking-widest">
                Chưa có dữ liệu
              </div>
            )
          ) : (
            <CalendarView transactions={transactions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
