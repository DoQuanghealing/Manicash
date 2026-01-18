import React, { useMemo, useState } from 'react';
import { User, Wallet } from '../types';
import { LS_KEYS } from '../constants';
import { X, Settings } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;

  users: User[];
  wallets: Wallet[];

  onSave: (nextUsers: User[], nextWallets: Wallet[]) => void;
  onReset: () => void;
};

function safeTrim(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

export const SettingsModal: React.FC<Props> = ({
  open,
  onClose,
  users,
  wallets,
  onSave,
  onReset,
}) => {
  const [u1Name, setU1Name] = useState(users[0]?.name || '');
  const [u2Name, setU2Name] = useState(users[1]?.name || '');

  const w1 = wallets.find(w => w.userId === 'u1') || wallets[0];
  const w2 = wallets.find(w => w.userId === 'u2') || wallets[1];

  const [w1Name, setW1Name] = useState(w1?.name || '');
  const [w2Name, setW2Name] = useState(w2?.name || '');

  // Khi mở modal lần đầu, sync state theo props (đỡ bị kẹt giá trị cũ)
  React.useEffect(() => {
    if (!open) return;
    setU1Name(users[0]?.name || '');
    setU2Name(users[1]?.name || '');
    const _w1 = wallets.find(w => w.userId === 'u1') || wallets[0];
    const _w2 = wallets.find(w => w.userId === 'u2') || wallets[1];
    setW1Name(_w1?.name || '');
    setW2Name(_w2?.name || '');
  }, [open, users, wallets]);

  const canSave = useMemo(() => {
    return (
      safeTrim(u1Name).length > 0 &&
      safeTrim(u2Name).length > 0 &&
      safeTrim(w1Name).length > 0 &&
      safeTrim(w2Name).length > 0
    );
  }, [u1Name, u2Name, w1Name, w2Name]);

  if (!open) return null;

  const handleSave = () => {
    if (!canSave) return;

    const nextUsers: User[] = [
      { ...users[0], name: safeTrim(u1Name) },
      { ...users[1], name: safeTrim(u2Name) },
    ];

    const nextWallets: Wallet[] = wallets.map(w => {
      if (w.id === w1?.id) return { ...w, name: safeTrim(w1Name) };
      if (w.id === w2?.id) return { ...w, name: safeTrim(w2Name) };
      return w;
    });

    // persist
    localStorage.setItem(LS_KEYS.USERS, JSON.stringify(nextUsers));
    localStorage.setItem(LS_KEYS.WALLETS, JSON.stringify(nextWallets));

    onSave(nextUsers, nextWallets);
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem(LS_KEYS.USERS);
    localStorage.removeItem(LS_KEYS.WALLETS);
    localStorage.removeItem(LS_KEYS.CURRENCY);
    onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 bg-surface border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Settings size={18} className="text-primary" />
            <h3 className="text-white font-bold">Cài đặt</h3>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} className="text-zinc-200" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Tên 2 người dùng</p>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Người 1</label>
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-primary/60"
                value={u1Name}
                onChange={(e) => setU1Name(e.target.value)}
                placeholder="Ví dụ: Anh Tín"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Người 2</label>
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-primary/60"
                value={u2Name}
                onChange={(e) => setU2Name(e.target.value)}
                placeholder="Ví dụ: Vợ"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Tên ví</p>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Ví người 1</label>
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-primary/60"
                value={w1Name}
                onChange={(e) => setW1Name(e.target.value)}
                placeholder="Ví dụ: Ví Anh"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-zinc-300">Ví người 2</label>
              <input
                className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-primary/60"
                value={w2Name}
                onChange={(e) => setW2Name(e.target.value)}
                placeholder="Ví dụ: Ví Vợ"
              />
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Tip: đổi tên xong mà vẫn mua linh tinh thì app không chịu trách nhiệm.
          </div>

          <div className="flex space-x-3">
            <button
              className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-200 rounded-2xl py-3 font-semibold"
              onClick={handleReset}
              type="button"
            >
              Reset mặc định
            </button>

            <button
              className={`flex-1 rounded-2xl py-3 font-semibold ${
                canSave ? 'bg-primary text-white hover:brightness-110' : 'bg-white/10 text-zinc-500 cursor-not-allowed'
              }`}
              onClick={handleSave}
              type="button"
              disabled={!canSave}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
