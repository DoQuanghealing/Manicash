/* ═══ AI Money Chat — Long-Term Profile (Phase 5) ═══
 * Trí nhớ dài hạn: chuỗi text nén siêu nhỏ (< ~100 tokens) về thói quen tài chính
 * hệ thống của user. Lưu Firestore `users/{uid}/state/aiProfile`.
 *
 * Pipeline:
 *  - LLM tự gắn tag [profile: ...] ở cuối báo cáo khi thấy pattern hệ thống.
 *  - extractProfileNote() bóc tag; stripProfileNote() xóa khỏi message hiển thị.
 *  - saveAiProfile() lưu; readAiProfile() nạp lại ở turn đầu.
 *
 * Firestore I/O bọc try/catch -> không bao giờ làm gãy luồng chat (degrade về null).
 */

const PROFILE_TAG = /\[profile:\s*([^\]]+)\]/i;
const MAX_NOTE_LENGTH = 280; // ~< 100 tokens tiếng Việt

/** Bóc nội dung note hệ thống từ tag [profile: ...]. Null nếu không có. */
export function extractProfileNote(content: string): string | null {
  if (typeof content !== 'string') return null;
  const match = content.match(PROFILE_TAG);
  if (!match) return null;
  const note = match[1].trim().slice(0, MAX_NOTE_LENGTH);
  return note.length > 0 ? note : null;
}

/** Xóa tag [profile: ...] khỏi nội dung để KHÔNG hiển thị cho người dùng. */
export function stripProfileNote(content: string): string {
  if (typeof content !== 'string') return '';
  return content
    .replace(PROFILE_TAG, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Đọc profile dài hạn từ Firestore. Trả null nếu chưa có / lỗi / thiếu env. */
export async function readAiProfile(uid: string): Promise<string | null> {
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    const snap = await getAdminDb().doc(`users/${uid}/state/aiProfile`).get();
    if (!snap.exists) return null;
    const note = snap.data()?.note;
    return typeof note === 'string' && note.length > 0 ? note : null;
  } catch {
    return null; // firebase chưa cấu hình / lỗi -> degrade im lặng
  }
}

/** Lưu profile dài hạn (merge). Nuốt lỗi để không ảnh hưởng trải nghiệm chat. */
export async function saveAiProfile(uid: string, note: string): Promise<void> {
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  if (!trimmed) return;
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin');
    const { FieldValue } = await import('firebase-admin/firestore');
    await getAdminDb()
      .doc(`users/${uid}/state/aiProfile`)
      .set({ note: trimmed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('[longTermProfile] save failed:', error);
  }
}
