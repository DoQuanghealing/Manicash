/* ═══ useSovereignInviteStore — điều khiển màn "Mời nâng cấp Phú Vương" ═══
 * Độc lập với useButlerWizardStore (làm quen quản gia) để 2 luồng không giẫm nhau.
 * 'open' = đang hiện lời mời 3 bước · 'closed' = ẩn.
 */
import { create } from 'zustand';

export type SovereignInviteMode = 'closed' | 'open';

interface SovereignInviteState {
  mode: SovereignInviteMode;
  open: () => void;
  close: () => void;
}

export const useSovereignInviteStore = create<SovereignInviteState>((set) => ({
  mode: 'closed',
  open: () => set({ mode: 'open' }),
  close: () => set({ mode: 'closed' }),
}));
