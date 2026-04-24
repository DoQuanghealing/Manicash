/* ═══ Input Content — Client Component with TransactionInput + ResistButton ═══ */
'use client';

import TransactionInput from '@/components/ui/TransactionInput';
import ResistButton from '@/components/ui/ResistButton';

export default function InputContent() {
  const handleResist = (xpEarned: number) => {
    console.log(`Resist earned ${xpEarned} XP!`);
    // Will connect to Zustand XP store in later phase
  };

  return (
    <div className="stack stack-md">
      <TransactionInput />
      <ResistButton onResist={handleResist} />
    </div>
  );
}
