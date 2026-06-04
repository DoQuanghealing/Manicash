# ManiCash — Production Setup (AI + Monetization)

Tài liệu này liệt kê chính xác việc cần làm để bật AI và thu phí trên production.
Code đã sẵn sàng; phần còn lại là cấu hình env + deploy Firestore rules.

## 1. Environment variables (Vercel → Project → Settings → Environment Variables)

### Firebase (client)
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...   # bật Analytics (tuỳ chọn)
```

### Firebase Admin (server)
```
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### AI (Groq)
```
GROQ_API_KEY=...                          # BẮT BUỘC để AI fallback + CFO narration chạy
AI_MONEY_CHAT_GROQ_MODEL=llama-3.3-70b-versatile
```

### Feature flags
```
NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true    # hiện tab/CTA chat + cho phép parse
AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true    # cho phép gọi Groq (fallback + narration)
NEXT_PUBLIC_SMS_WEBHOOK_ENABLED=false     # ẩn SMS Banking cho v1; bật khi Phase 7 sẵn sàng
```

### Quota / chi phí AI (mặc định đã an toàn)
```
AI_MONEY_CHAT_FREE_MONTHLY_CREDITS=0      # Free: không có credit AI
AI_MONEY_CHAT_PRO_MONTHLY_CREDITS=1500    # Pro: 1500 credit/tháng
AI_MONEY_CHAT_HARD_MONTHLY_CREDITS=1500   # hard cap tuyệt đối
AI_MONEY_CHAT_FALLBACK_PARSE_CREDITS=1
AI_MONEY_CHAT_CFO_NARRATION_CREDITS=8
```

### Monetization
```
NEXT_PUBLIC_MONETIZATION_ENABLED=true     # BẬT khi billing đã sẵn sàng (xem mục 3)
BILLING_ALLOW_MOCK=false                  # PHẢI false trên production
```

## 2. Deploy Firestore Security Rules

Rules ở `firestore.rules` (cấu hình `firebase.json`). Deploy:

```bash
npm i -g firebase-tools
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

Rules đảm bảo:
- Client KHÔNG tự ghi được `tier`/`plan`/`isPremium`/`premiumExpiresAt` (chống tự cấp Pro).
- `ai_usage`, `cfo_narration`, `recent_msgs`, `account_deletion_requests`: Admin SDK only.
- `finance_core`, profile: chỉ chủ sở hữu.
- `pending_transactions`: chủ đọc + xoá; chỉ server tạo.
- `webhook_tokens/{uid}`: chủ đọc; chỉ server ghi.

## 3. Thứ tự go-live an toàn

1. Set toàn bộ env Firebase + `GROQ_API_KEY`.
2. Deploy Firestore rules.
3. Bật AI: `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED=true`, `AI_MONEY_CHAT_AI_FALLBACK_ENABLED=true`. Redeploy.
4. Smoke test: /chat parse, AI fallback (câu khó), /report → "Hỏi Lord Diamond".
5. Khi Google Play Billing xong (xem `reports/monetization-p0-report.md`): bật `NEXT_PUBLIC_MONETIZATION_ENABLED=true`. Trước bước này mọi user là Pro (demo) — bật lên sẽ enforce Free/Pro.

## 4. Kiểm tra nhanh khi flag tắt (mặc định)
- `NEXT_PUBLIC_AI_MONEY_CHAT_ENABLED` unset → tab/CTA chat ẩn, /report vẫn chạy (local narration).
- Thiếu `GROQ_API_KEY` → AI fallback + narration tự về bản local, không lỗi.
- `NEXT_PUBLIC_MONETIZATION_ENABLED` unset → mọi user Pro (không khoá tính năng).
