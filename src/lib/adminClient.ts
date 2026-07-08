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

export type AdminAuthState = 'checking' | 'anon' | 'forbidden' | 'admin';

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
        const ok = result.claims.admin === true && isAdminEmail(user.email);
        setState(ok ? 'admin' : 'forbidden');
      } catch {
        setState('forbidden');
      }
    });
    return () => unsub();
  }, []);

  return state;
}
