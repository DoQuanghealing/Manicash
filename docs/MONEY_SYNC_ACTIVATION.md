# Bật Cloud Money Sync (Phase 6B-2E) — Checklist

> Toàn bộ code đã xong và đang nằm sau feature flag **mặc định TẮT**. App hiện
> tại hành xử y như trước. Tài liệu này là 3 bước thủ công để kích hoạt — phần
> chỉ **bạn** làm được (cần tài khoản Firebase / Vercel của bạn).

## ⚠️ Trước khi bật — đọc kỹ
- Khi bật, app sẽ **tự pull dữ liệu remote và apply vào 5 store khi đăng nhập**,
  rồi **tự push** mỗi khi có thay đổi (debounce ~2.5s).
- **Test bằng 1 tài khoản phụ/thử trước**, KHÔNG dùng tài khoản chính có dữ liệu
  thật, cho tới khi xác nhận sync chạy đúng.
- Nếu lỗi (rules chưa deploy, mất mạng…) → ghi vào outbox và thử lại; KHÔNG làm
  hỏng dữ liệu local (apply có rollback + suppression guard).

## Bước 1 — Deploy Firestore rules (BẮT BUỘC, làm trước)
Rules đã được cập nhật trong `firestore.rules` (đã thêm `match /money/{docId}` cho
owner). Phải deploy thì client mới được đọc/ghi `users/{uid}/money/state`.

**Cách A — Firebase CLI:**
```bash
npm i -g firebase-tools     # nếu chưa có
firebase login              # đăng nhập tài khoản sở hữu project
firebase deploy --only firestore:rules
```

**Cách B — Firebase Console:**
Firebase Console → Firestore Database → Rules → dán nội dung `firestore.rules` →
**Publish**.

> Kiểm tra: project phải bật **Cloud Firestore (Native mode)**. App đã dùng
> Firestore cho `finance_core` nên gần như chắc chắn đã bật.

## Bước 2 — Bật feature flag
**Local (`.env.local`):**
```
NEXT_PUBLIC_MONEY_SYNC_ENABLED=true
```
**Production (Vercel):** Project → Settings → Environment Variables → thêm
`NEXT_PUBLIC_MONEY_SYNC_ENABLED = true` (Production + Preview) → Redeploy.

> Vì là biến `NEXT_PUBLIC_*` (nhúng lúc build), phải **restart dev** / **redeploy**
> sau khi đổi.

## Bước 3 — Smoke test (E2E thật)
1. Đăng nhập **tài khoản thử** trên Tab A → ghi 1–2 giao dịch.
2. Mở Tab B (hoặc thiết bị khác) cùng tài khoản → đăng nhập → dữ liệu pull về.
3. Ghi thêm ở Tab B → quay lại Tab A → thay đổi đồng bộ (sau debounce / reload).
4. Tắt mạng → ghi giao dịch → bật mạng lại → kiểm tra tự flush (reconnect).
5. Firebase Console → Firestore → `users/{uid}/money/state` phải xuất hiện với
   `version` tăng dần.

## Bạn cần cấp gì cho tôi?
**Không cần secret nào.** Tôi đã có repo. 3 bước trên đều nằm trong tài khoản
Firebase/Vercel của bạn nên chỉ bạn thao tác được. Tôi hỗ trợ bằng cách:
- Đã thêm rule + flag + tài liệu này (repo-side).
- Sau khi bạn bật, gửi tôi log lỗi (Console/devtools) nếu có để tôi debug.
- Nếu muốn, tôi có thể tự sửa `.env.local` thêm dòng flag (nói "bật flag local").

## Rollback (nếu cần tắt)
Đặt lại `NEXT_PUBLIC_MONEY_SYNC_ENABLED=false` + restart/redeploy. Rules để lại
vô hại (chỉ cho phép owner đọc/ghi doc của chính mình).
