import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { VI } from '../constants/vi';
import { X, ShieldCheck } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onSave: (updatedUsers: User[]) => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, users, onSave }) => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (users.length > 0) setUserName(users[0].name);
    }
  }, [isOpen, users]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save User Name
    if (userName.trim()) {
       const updatedUsers = [...users];
       updatedUsers[0] = { ...updatedUsers[0], name: userName.trim() };
       onSave(updatedUsers);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-sm rounded-3xl p-6 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{VI.settings.title}</h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* User Profile */}
          <div className="space-y-1">
            <label className="text-xs text-zinc-500 ml-1">{VI.settings.user1}</label>
            <div className="flex items-center space-x-2">
                <span className="text-2xl">{users[0]?.avatar || '👤'}</span>
                <input
                    type="text"
                    className="w-full bg-black/20 text-white p-3 rounded-xl border border-white/10 focus:border-primary focus:outline-none"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                />
            </div>
          </div>

          <div className="pt-2">
            <button
                type="submit"
                className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all"
            >
                {VI.settings.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};