/* ═══ Trạng thái cửa sổ bán hàng (mở/đóng) — mở từ bất kỳ đâu (ProGate, nút Nâng cấp) ═══ */
'use client';

import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics/events';

interface PricingModalState {
  isOpen: boolean;
  /** Nguồn mở (analytics). */
  source: string;
  open: (source?: string) => void;
  close: () => void;
}

export const usePricingModalStore = create<PricingModalState>((set) => ({
  isOpen: false,
  source: 'unknown',
  open: (source = 'unknown') => {
    trackEvent('upgrade_view', { source });
    set({ isOpen: true, source });
  },
  close: () => set({ isOpen: false }),
}));
