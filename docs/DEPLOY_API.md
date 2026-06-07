# Deploy API lên Vercel (cho mobile app gọi)

> Bản mobile (Capacitor) chạy ở `https://localhost`, KHÔNG có `/api` cùng origin
> → phải gọi API đã deploy trên Vercel. Repo này VỪA là web app VỪA là API backend.

## Trạng thái
- ✅ Repo đã **link Vercel project "manicash"** (`.vercel/project.json`)
- ✅ Cron account-deletion đã cấu hình (`vercel.json` → `/api/account/deletion/cron` 20:00 UTC)
- ✅ CORS cho mobile đã có trong `src/proxy.ts` (allow `https://localhost`, `capacitor://localhost`)
- ✅ Build mặc định `npm run build` = web + API (Vercel tự chạy lệnh này)

## Cách deploy
**Cách 1 — Git (khuyến nghị):** push lên nhánh production (thường `main`) đã kết nối
GitHub → Vercel tự build & deploy. *(Hiện đang làm trên `codex/ai-money-chat`; khi
sẵn sàng release thì merge vào nhánh production.)*

**Cách 2 — Vercel CLI:**
```bash
npm i -g vercel
vercel --prod        # deploy production
```

⚠️ **KHÔNG set `BUILD_TARGET=mobile` trên Vercel** — Vercel phải build web/API
(có API routes + proxy), không phải static export.

## Env vars cần set trên Vercel (Project Settings → Environment Variables)

Lấy giá trị từ `.env.local` (local) — KHÔNG commit. Đánh dấu 🔒 = secret server-side:

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` … (6 biến) | Firebase client config (public) |
| `NEXT_PUBLIC_APP_URL` | URL production, vd `https://manicash.app` |
| 🔒 `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK |
| 🔒 `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin SDK |
| 🔒 `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin SDK — dán nguyên cả `\n` |
| 🔒 `GROQ_API_KEY` | AI CFO (`/api/cfo`, ai-money-chat) |
| 🔒 `CRON_SECRET` | Vercel Cron tự gửi `Authorization: Bearer $CRON_SECRET` → route cron check. **Bắt buộc** nếu không cron account-deletion fail 401 |
| `NEXT_PUBLIC_MONETIZATION_ENABLED` | `true`/`false` |
| `BILLING_ALLOW_MOCK` | **`false`** ở production |
| `AI_MONEY_CHAT_*` | Xem `.env.example` (model, credits) |
| `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED`, `NEXT_PUBLIC_SMS_WEBHOOK_ENABLED` | Feature flags |

❗ **KHÔNG set `NEXT_PUBLIC_API_BASE_URL` trên Vercel** — web phải gọi same-origin.
Biến này CHỈ dùng cho mobile build (xem dưới).

## Nối mobile → API
1. Lấy URL production: Vercel Dashboard → project manicash → Domains (vd
   `https://manicash.vercel.app` hoặc custom `https://manicash.app`).
2. Local: `cp .env.mobile.example .env.mobile` rồi điền:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://manicash.vercel.app
   ```
3. Build mobile: `npm run build:mobile` (script sẽ in `✓ API base URL (mobile): ...`
   nếu đã set; cảnh báo vàng nếu chưa) → `npx cap sync android`.

## Verify sau deploy
- Mở `https://<url>/legal/privacy` → trang hiện (route static OK)
- `https://<url>/api/cfo` POST thử (cần body hợp lệ) → trả JSON, không 404
- CORS: từ app mobile, request có header `Origin: https://localhost` → response có
  `Access-Control-Allow-Origin: https://localhost`
- Cron: Vercel Dashboard → project → Cron Jobs → thấy `/api/account/deletion/cron`
