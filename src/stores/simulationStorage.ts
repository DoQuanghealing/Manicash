/* ═══ Kho lưu cho chế độ GIẢ LẬP — lớp chắn giữa store và localStorage ═══
 *
 * VÌ SAO PHẢI CÓ FILE NÀY:
 * Bản demo cũ (/xem-thu-chi) dùng `persist.setOptions({ storage: mem })` SAU KHI
 * store đã khởi tạo. Lúc đó store đã đọc localStorage rồi, và mọi lượt ghi xảy ra
 * TRƯỚC khi tráo đều rơi xuống đĩa. Đó chính là khe hở đã làm mất dữ liệu thật.
 *
 * Cách làm ở đây khác về bản chất: không tráo kho, mà đặt một lớp chắn ngay tại
 * chỗ store đọc/ghi. Mỗi lượt get/set/remove đều hỏi lại cờ giả lập TẠI THỜI ĐIỂM
 * ĐÓ. Đang giả lập thì localStorage KHÔNG BAO GIỜ bị chạm tới — không phải "ghi
 * rồi dọn", mà là không ghi.
 *
 * VÌ SAO CỜ Ở sessionStorage CHỨ KHÔNG localStorage:
 *   · Đóng tab là cờ chết → không thể quên bật qua đêm rồi hôm sau tưởng mất tiền.
 *   · Không lây sang tab khác → mở tab thứ hai vẫn là tài khoản thật, dùng bình thường.
 *   · Không đồng bộ đi đâu → không có đường nào để cờ này lọt sang máy khác.
 *
 * VÌ SAO KHÔNG ĐỂ NGƯỜI DÙNG THƯỜNG BẬT ĐƯỢC:
 * Cờ chỉ được đặt từ trang /admin/simulate, vốn nằm sau cổng admin (Custom Claim
 * + allowlist email, verify phía server). Người dùng thường không có đường nào tới.
 */
'use client';

const FLAG_KEY = 'manicash.simulation.active';

/** Kho tạm trong RAM. Mất khi tải lại trang — đúng ý đồ. */
const memory = new Map<string, string>();

function safeSession(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Trình duyệt chặn site data (cửa sổ riêng tư, thiết lập chặn) → coi như không giả lập.
    return null;
  }
}

/** Đang ở chế độ giả lập hay không. Hỏi lại mỗi lượt, KHÔNG cache. */
export function isSimulationActive(): boolean {
  return safeSession()?.getItem(FLAG_KEY) === '1';
}

/**
 * Bật giả lập. Trả về false nếu không bật được (trình duyệt chặn site data) —
 * phía gọi PHẢI kiểm và báo cho người dùng, đừng seed dữ liệu khi chưa chắc đã
 * cách ly được, vì lúc đó seed sẽ chảy xuống đĩa.
 */
export function activateSimulation(): boolean {
  const s = safeSession();
  if (!s) return false;
  try {
    s.setItem(FLAG_KEY, '1');
    return s.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Tắt giả lập và xoá sạch kho tạm. Phía gọi nên tải lại trang ngay sau đó. */
export function exitSimulation(): void {
  memory.clear();
  try {
    safeSession()?.removeItem(FLAG_KEY);
  } catch {
    /* im lặng */
  }
}

/**
 * Kho mà mọi store persist đi qua.
 *
 * ⚠️ Ba hàm dưới đây đều hỏi `isSimulationActive()` NGAY TRONG THÂN HÀM, không
 * đọc một biến đã tính sẵn. Nếu tính trước một lần rồi dùng lại thì lúc bật/tắt
 * giả lập giữa phiên sẽ có lượt ghi rơi sai kho — đúng loại lỗi mà bản cũ mắc.
 */
export const simulationAwareStorage: Storage = {
  getItem(key: string): string | null {
    if (isSimulationActive()) return memory.get(key) ?? null;
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (isSimulationActive()) {
      memory.set(key, value);
      return;
    }
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {
      /* hết quota / bị chặn — không được làm app vỡ */
    }
  },

  removeItem(key: string): void {
    if (isSimulationActive()) {
      memory.delete(key);
      return;
    }
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      /* im lặng */
    }
  },

  /* ⚠️ CỐ Ý KHÔNG cài `clear()` thật: zustand không dùng, mà để nó hoạt động là
   * mở sẵn một đường xoá trắng localStorage của người dùng. Ba hàm trên là toàn
   * bộ những gì persist cần. */
  clear(): void {
    if (isSimulationActive()) memory.clear();
    // Không giả lập: KHÔNG làm gì. Xoá dữ liệu thật phải đi qua
    // clearLocalPersistence.ts, nơi có kiểm soát riêng.
  },

  key(): string | null {
    return null;
  },

  get length(): number {
    return isSimulationActive() ? memory.size : 0;
  },
};
