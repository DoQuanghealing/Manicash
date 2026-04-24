/* ═══ Wishlist Store — Danh sách mong muốn + Cooling Period ═══ */
'use client';

import { create } from 'zustand';

export type CoolingHours = 24 | 48 | 72 | 96 | 168;

export type WishlistStatus = 'cooling' | 'ready' | 'bought' | 'rejected';

export interface WishlistItem {
  id: string;
  name: string;
  price: number;
  reason: string;
  coolingHours: CoolingHours;
  createdAt: string;       // ISO string
  expiresAt: string;       // ISO string — when cooling period ends
  status: WishlistStatus;
  resolvedAt?: string;     // ISO string — when user bought or rejected
  dismissedFromDashboard?: boolean; // true after user acted on dashboard popup
}

/* ── 20 praise messages khi từ chối mua ── */
export const REJECT_PRAISE = [
  '💎 Bạn vừa chứng minh rằng ý chí mạnh hơn cám dỗ! Respect!',
  '🏆 Warren Buffett sẽ tự hào về bạn. Tiết kiệm hôm nay = tự do ngày mai!',
  '🔥 Cơn thèm mua hàng: 0 — Bạn: 1. Chiến thắng hoàn hảo!',
  '🚀 Mỗi lần nói "không" là một bước gần hơn đến tự do tài chính!',
  '⭐ Bạn không mua = bạn vừa TỰ TĂNG LƯƠNG cho chính mình!',
  '🎯 Người giàu không phải người kiếm nhiều — mà là người biết KHÔNG tiêu.',
  '💪 90% người sẽ bấm mua. Bạn thuộc 10% có kỷ luật thép!',
  '🧠 Não bộ bạn vừa thắng dopamine. Đó là sức mạnh thực sự!',
  '🏅 Chúc mừng! Bạn vừa tiết kiệm được một khoản đáng giá!',
  '✨ "Tôi không cần" — 4 chữ quyền lực nhất trong quản lý tài chính!',
  '🎖️ Biết mình không cần gì còn khó hơn biết mình muốn gì. Xuất sắc!',
  '🛡️ Bạn vừa bảo vệ ví tiền khỏi một cuộc tấn công. Chiến binh tài chính!',
  '🌟 Một quyết định nhỏ hôm nay, một tương lai lớn ngày mai!',
  '💰 Số tiền này sẽ sinh lời cho bạn thay vì nằm im trong kho của người khác.',
  '🧊 Cool down thành công! Bạn đã qua được bài test quan trọng nhất.',
  '🏋️ Cơ bắp tài chính của bạn vừa được tập luyện. Càng tập càng khỏe!',
  '🎓 Bài học hôm nay: Muốn ≠ Cần. Bạn đã tốt nghiệp xuất sắc!',
  '🌈 Thay vì sở hữu đồ vật, bạn sở hữu sự tự do. Đẹp hơn nhiều!',
  '⚡ Năng lượng quyết đoán +100! Bạn đang trở thành phiên bản tốt nhất!',
  '🎪 Cám dỗ biểu diễn xong rồi — và bạn chỉ ngồi xem mà không mua vé!',
];

interface WishlistState {
  items: WishlistItem[];

  // Actions
  addItem: (data: { name: string; price: number; reason: string; coolingHours: CoolingHours }) => WishlistItem;
  buyItem: (id: string) => void;
  rejectItem: (id: string) => void;
  dismissFromDashboard: (id: string) => void;
  removeItem: (id: string) => void;

  // Computed
  getCoolingItems: () => WishlistItem[];
  getReadyItems: () => WishlistItem[];
  getRejectedItems: () => WishlistItem[];
  getBoughtItems: () => WishlistItem[];
  getDashboardPopupItems: () => WishlistItem[];
  getTotalSaved: () => number;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],

  addItem: (data) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + data.coolingHours * 60 * 60 * 1000);
    const item: WishlistItem = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name,
      price: data.price,
      reason: data.reason,
      coolingHours: data.coolingHours,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'cooling',
    };
    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  buyItem: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: 'bought' as const, resolvedAt: new Date().toISOString(), dismissedFromDashboard: true } : i
      ),
    })),

  rejectItem: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, status: 'rejected' as const, resolvedAt: new Date().toISOString(), dismissedFromDashboard: true } : i
      ),
    })),

  dismissFromDashboard: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, dismissedFromDashboard: true } : i
      ),
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  getCoolingItems: () => {
    const now = Date.now();
    return get().items.filter((i) => i.status === 'cooling' && new Date(i.expiresAt).getTime() > now);
  },

  getReadyItems: () => {
    const now = Date.now();
    return get().items.filter(
      (i) => (i.status === 'cooling' && new Date(i.expiresAt).getTime() <= now) || i.status === 'ready'
    );
  },

  getRejectedItems: () => get().items.filter((i) => i.status === 'rejected'),

  getBoughtItems: () => get().items.filter((i) => i.status === 'bought'),

  getDashboardPopupItems: () => {
    const now = Date.now();
    return get().items.filter(
      (i) =>
        i.status === 'cooling' &&
        new Date(i.expiresAt).getTime() <= now &&
        !i.dismissedFromDashboard
    );
  },

  getTotalSaved: () =>
    get()
      .items.filter((i) => i.status === 'rejected')
      .reduce((sum, i) => sum + i.price, 0),
}));
