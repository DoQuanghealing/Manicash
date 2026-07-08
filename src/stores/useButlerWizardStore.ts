/* ═══ useButlerWizardStore — điều khiển màn "Làm quen quản gia" ═══
 * 'full' = onboarding lần đầu (đủ bước) · 'tier' = mở lại chỉ để chọn cấp độ
 * (nút "quản gia cần thông thái hơn" trong Hồ sơ) · 'closed' = ẩn.
 */
import { create } from 'zustand';

export type ButlerWizardMode = 'closed' | 'full' | 'tier';

interface ButlerWizardState {
  mode: ButlerWizardMode;
  open: (mode: 'full' | 'tier') => void;
  close: () => void;
}

export const useButlerWizardStore = create<ButlerWizardState>((set) => ({
  mode: 'closed',
  open: (mode) => set({ mode }),
  close: () => set({ mode: 'closed' }),
}));
