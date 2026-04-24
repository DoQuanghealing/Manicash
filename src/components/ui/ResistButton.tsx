/* ═══ ResistButton — "Tôi đã nhịn chi tiêu" (x2 XP) ═══ */
'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudio } from '@/hooks/useAudio';
import { getButlerMessage } from '@/data/butlerMessages';
import { useSettingsStore } from '@/stores/useSettingsStore';
import './ResistButton.css';

interface ResistButtonProps {
  onResist?: (xpEarned: number) => void;
}

const BASE_XP = 25;

export default function ResistButton({ onResist }: ResistButtonProps) {
  const [showResult, setShowResult] = useState(false);
  const [butlerMsg, setButlerMsg] = useState('');
  const { play } = useAudio();
  const butlerName = useSettingsStore((s) => s.butlerName);

  const handleResist = useCallback(() => {
    const xpEarned = BASE_XP * 2; // x2 XP for discipline

    // Play reward sound
    play('resist');

    // Get butler praise
    const msg = getButlerMessage('resist', butlerName);
    setButlerMsg(msg.text);
    setShowResult(true);

    // Callback for XP management
    onResist?.(xpEarned);

    // Reset after 3 seconds
    setTimeout(() => setShowResult(false), 3000);
  }, [onResist, play, butlerName]);

  return (
    <div className="resist-btn-wrapper">
      <AnimatePresence mode="wait">
        {showResult ? (
          <motion.div
            key="result"
            className="resist-result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className="resist-result-emoji">🛡️✨</p>
            <p className="resist-result-text">Kỷ luật THÉP!</p>
            <p className="resist-result-xp">+{BASE_XP * 2} XP (x2 kỷ luật bonus)</p>
            <p className="resist-result-butler">🎩 {butlerMsg}</p>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            className="resist-btn"
            onClick={handleResist}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            id="resist-button"
          >
            <span className="resist-btn-icon">🛡️</span>
            <span>Tôi đã nhịn chi tiêu!</span>
            <span className="resist-btn-xp">+{BASE_XP * 2} XP</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
