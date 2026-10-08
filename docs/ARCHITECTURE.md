# Kiến trúc ManiCash (đối chiếu code ngày 2026-10-08, `main` = `0b0e19a`)

## 1. Bức tranh tổng thể

```
┌───────────────── THIẾT BỊ NGƯỜI DÙNG ─────────────────┐
│  Web (PWA)  hoặc  Android (Capacitor = web tĩnh đóng gói) │
│  React 19 + Next.js 16 (App Router) — giao diện         │
│  34 Zustand store  ──persist──►  localStorage (mỗi máy)  │
│  Bộ não tài chính chạy NGAY TRÊN MÁY:                    │
│    moneyBrain (CFO, health score, safe-to-spend)        │
│    aiMoneyChat/prism (chat offline, 16 handler)         │
│  Service worker (offline + cache)                       │
└───────────┬───────────────────────────────┬────────────┘
            │ Firebase Auth                 │ fetch + Bearer ID token
            ▼                               ▼
┌─────────────────────┐   ┌──────────────── VERCEL ────────────────┐
│ Firebase            │◄──│ 29 API route                           │
│  Auth · Firestore   │   │  proxy.ts: rate-limit, ban, chặn route │
│  (rules: chủ sở hữu │   │  firebase-admin                        │
│   tự đọc/ghi)       │   │  2 cron: xoá TK 20:00 · dọn 03:30      │
└─────────────────────┘   └───┬──────────┬──────────┬─────────────┘
                              ▼          ▼          ▼
                            PayOS    Pool LLM     Upstash Redis
                                   Cerebras→Groq   (chống lạm dụng)
                                     →Agnes
```

Nguyên tắc nền:
1. **Local-first** — tiền, ngân sách, mục tiêu, nhiệm vụ sống ở localStorage từng máy.
   Server **không bao giờ tự thực hiện** thao tác tiền.
2. **Server chỉ làm 4 việc:** gọi AI · nhận thanh toán · admin/CRM · chống lạm dụng.
3. **Mobile là web tĩnh** (`BUILD_TARGET=mobile` → `output: 'export'`, API route bị gỡ).
   App điện thoại gọi API Vercel qua `apiUrl()`. ⇒ Không dùng Server Component/Action cho tính năng người dùng.

## 2. Bốn tầng

### Tầng 1 — Giao diện `src/app`
| Nhóm | Có gì | Cổng chặn |
|---|---|---|
| `(app)` | overview · ledger · chat · goals · money · input · profile · report · settings · upgrade | `AuthGuard` (máy) + `proxy.ts` |
| `(admin)` | 8 module admin | email allowlist **và** Custom Claim, kiểm ở server |
| `(auth)` `(public)` | đăng nhập, trang công khai | không |

`(app)/layout.tsx` gắn ~20 host chạy nền (rollover tháng, nhắc 21h, quản gia, XP toast,
MetricSnapshotCollector, ConsentUpdateNotice…).

### Tầng 2 — Trạng thái `src/stores` (34 store)
| Nhóm | Store | Lưu |
|---|---|---|
| Lõi tiền (có version, `persistConfig.ts`) | finance · budget · goals · **tasks** · auth · audit · dashboard · walletBank | localStorage `manicash.*.v1` |
| Trò chơi hoá | quest · mission · badge · reward · transactionHabit | localStorage |
| Quản gia/AI | settings · aiMoneyMemory · financialDna · care · coachSuggestion · capacitySurvey · chatHistory | localStorage |
| Phiên | butlerWizard · sovereignInvite · pricingModal · hydration… | bộ nhớ |

- 17 store có lưu đều đi qua `simulationAwareStorage` (giả lập không ghi xuống đĩa).
- Đăng xuất / xoá TK → `clearLocalMoneyPersistence()`.
- ⚠️ **Dexie có trong package.json nhưng CHƯA file nào dùng.** IndexedDB phải dựng mới.
- ⚠️ Hai hệ nhiệm vụ song song: `useMissionStore` (cũ, 3 mission) và `useQuestStore` (mới, onboarding + daily).

### Tầng 3 — Đồng bộ đám mây `src/lib/moneySync` ("Money Sync")
**Nó làm gì:** sao lưu dữ liệu tiền từ máy lên Firestore và kéo về máy khác.
- BẬT: đổi điện thoại / xoá dữ liệu trình duyệt / đăng nhập máy khác → dữ liệu vẫn còn.
- TẮT: dữ liệu CHỈ nằm trên máy đó. Mất máy = mất dữ liệu.

Chi tiết:
- 1 document gộp `users/{uid}/money/state` (tiền, ngân sách, mục tiêu, nhiệm vụ, audit). Trần Firestore **1MB/document**.
- Outbox + gộp xung đột (giao dịch nối thêm; số đơn bản mới thắng) + device ID.
- Bật/tắt bằng biến `NEXT_PUBLIC_MONEY_SYNC_ENABLED`. Máy local = `true`.
  Ghi chú trong `src/lib/admin/directory.ts` nói **prod đang TẮT** — CHƯA kiểm chứng trên Vercel.
- Khởi chạy ở `MoneySyncRuntimeProvider` → `useMoneySyncRuntime`.

### Tầng 4 — Server `src/app/api` (29 route)
| Nhóm | Route | Firestore |
|---|---|---|
| AI | `chat`, `ai-money-chat/{parse,cfo-narration,dna-oracle,task-eval}`, `cfo` | `ai_usage`, `ai_usage_log`, `ai_spend_daily`, `financial_dna` |
| Thanh toán | `payos/{create-link,webhook,status,confirm-webhook}`, `billing/{trial,verify}` | `payment_intents`, `payments_index`, `grant_events`, `trial_ledger`, `device_ledger` |
| Admin/CRM | `admin/*` (9), `telemetry/{consent,snapshot}` | `metric_snapshots`, `admin_audit` |
| Vận hành | `cron/purge`, `account/deletion(+cron)`, `sms-webhook` | `app_errors`, `abuse_*`, `account_deletion_requests` |

LLM: pool OpenAI-compatible `src/lib/aiMoneyChat/llm/chatProvider.ts`, thứ tự `AI_LLM_POOL`
(Cerebras → Groq → Agnes), nghẽn thì nhảy nhà kế, hết pool → câu trả lời tất định 0đ.

## 3. Xác thực
- **Thật:** API kiểm `Bearer ID token` bằng `verifyIdToken` (`src/lib/requestAuth.ts`); Firestore rules chủ sở hữu.
- **Chỉ là cửa giao diện:** cookie `manicash-session` = uid trần, KHÔNG ký, máy tự gửi
  (`api/auth/session`); `manicash-rank` không httpOnly. `proxy.ts` chỉ dùng để chuyển hướng
  và khoá khoá học theo rank → tự sửa được.
- **Luật:** không bao giờ dựa vào cookie để cho phép đọc/ghi dữ liệu.
