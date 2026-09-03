/* ═══ Admin client helpers — Bearer auth + gate hook ═══
 * Dùng chung cho mọi trang trong route group (admin). Không còn key tĩnh:
 * mọi request đính ID token của tài khoản đang đăng nhập; server verify claim
 * `admin===true` + allowlist email qua requireAdmin.
 */
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { isAdminEmail } from '@/lib/adminEmails';

/* 'no-claim' tách riêng khỏi 'forbidden' CÓ CHỦ ĐÍCH.
 * Hai thứ này hỏng vì lý do khác hẳn nhau và cách chữa cũng khác:
 *   forbidden = email KHÔNG nằm trong allowlist → phải sửa mã nguồn
 *   no-claim  = email đúng nhưng CHƯA có Custom Claim → chạy scripts/grant-admin.mjs
 * Gộp làm một thì người bị chặn đọc "không có quyền" mà không biết phải làm gì —
 * đúng chỗ PO đã mất thời gian mò. */
export type AdminAuthState = 'checking' | 'anon' | 'forbidden' | 'no-claim' | 'admin';

/** ID token của user đang đăng nhập (tự refresh khi gần hết hạn). */
export async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

/** Header Authorization: Bearer cho request admin. `json=true` thêm Content-Type. */
export async function authHeaders(json = false): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  if (!token) return null;
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/**
 * Hook xác định quyền admin từ Custom Claims + allowlist email của tài khoản
 * đang đăng nhập. Trả 1 trong 4 trạng thái. Dùng ở AdminShell để gác cả route group.
 */
export function useAdminGate(): AdminAuthState {
  const [state, setState] = useState<AdminAuthState>('checking');

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user: User | null) => {
      if (!user) {
        setState('anon');
        return;
      }
      try {
        const result = await user.getIdTokenResult(true); // force refresh để đọc claim mới nhất
        if (!isAdminEmail(user.email)) {
          setState('forbidden');
          return;
        }
        setState(result.claims.admin === true ? 'admin' : 'no-claim');
      } catch {
        setState('forbidden');
      }
    });
    return () => unsub();
  }, []);

  return state;
}
