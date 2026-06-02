# AI Cost Control Report

Date: 2026-06-02
Branch: `codex/ai-money-chat`

## Muc tieu

Hoan thanh Group 3 Phase 6: AI Cost & Pro Quota de route AI fallback khong the dot chi phi ngoai tam kiem soat.

## Da hoan thanh

- Them quota pure core:
  - `src/lib/aiMoneyChat/quotaCore.ts`
- Them quota Firestore charger:
  - `src/lib/aiMoneyChat/quota.ts`
- AI fallback route bat buoc:
  - server flag bat
  - co Groq key
  - user signed-in va verified ID token
  - quota con du
- Client fallback gui Firebase ID token qua `Authorization: Bearer <token>` neu co.
- Usage duoc ghi theo thang:
  - `users/{uid}/ai_usage/{YYYY-MM}`
- Moi AI fallback parse charge mac dinh 1 credit.
- Free monthly credits mac dinh 0.
- Pro monthly credits mac dinh 1500.
- Hard monthly credits mac dinh 1500.
- Them tests quota.

## Env moi

```env
AI_MONEY_CHAT_FREE_MONTHLY_CREDITS=0
AI_MONEY_CHAT_PRO_MONTHLY_CREDITS=1500
AI_MONEY_CHAT_HARD_MONTHLY_CREDITS=1500
AI_MONEY_CHAT_FALLBACK_PARSE_CREDITS=1
```

Env da co tu Phase 5:

```env
AI_MONEY_CHAT_AI_FALLBACK_ENABLED=false
AI_MONEY_CHAT_GROQ_MODEL=llama-3.3-70b-versatile
```

## User flows

Neu AI fallback server flag dang tat:

- API tra `disabled`.
- Khong auth.
- Khong charge credit.
- Khong goi AI.

Neu server flag bat:

- API yeu cau user co session + Firebase ID token hop le.
- API doc user profile tu Firestore.
- Free user bi chan vi limit mac dinh 0.
- Pro user duoc charge 1 credit neu con quota.
- Neu het quota, API tra `quota-exceeded` va khong goi Groq.

## Data logic

Quota plan:

- `tier: 'pro'` -> pro.
- `plan: 'premium'` -> pro neu chua het han.
- `isPremium: true` -> pro neu chua het han.
- Het han premium -> free.

Firestore usage doc:

```text
users/{uid}/ai_usage/{YYYY-MM}
```

Fields:

- `uid`
- `monthKey`
- `plan`
- `usedCredits`
- `fallbackParseCalls`
- `createdAt`
- `updatedAt`

## Tests

- `npm run test:ai-quota` pass.
- `npm run test:ai-fallback` pass.
- `npm run test:ai-memory` pass.
- `npm run test:ai-chat` pass.
- `npm run test` pass.
- `npm run build` pass.

## Ket qua

Phase 6 da dat deliverable: AI fallback co server-side quota guard va Pro gating co ban.

## Rui ro con lai

- Chua co payment/subscription verification that tu App Store/Google Play.
- Chua co UI hien credit con lai.
- Chua co route de client doc usage summary.
- Chua co rate limit rieng theo IP/uid ngoai quota.
- Firestore transaction charge truoc khi Groq call; neu Groq fail thi credit da bi tru. Day la quyet dinh bao ve chi phi, nhung co the can refund logic sau.

## Viec tiep theo

Group 4 Phase 7: Money Reaction Engine.

Neu muon hoan thien quota UX truoc Group 4, nen them:

- `/api/ai-money-chat/usage` de doc credits.
- UI hien credit con lai trong `/chat`.
- Admin/manual toggle Pro user.

