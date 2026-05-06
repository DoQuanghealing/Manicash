# PENDING FEATURES — manicash

## SMS Webhook follow-ups

### 1. Verify real bank SMS samples
The 7 bank parsers are implemented from mainstream/public SMS formats and marked `VERIFIED: NO`.
Before beta launch, collect real income + expense SMS samples for VCB, TCB, MB, TPBank, VPBank, ACB, and Sacombank, then add parser unit fixtures.

### 2. Firestore TTL for webhook dedupe
The webhook stores dedupe hashes under `webhook_tokens/{uid}/recent_msgs/{hash}` with `expireAt`.
Firebase TTL must be enabled manually in Firebase Console for that field; without TTL, dedupe still works but old hashes are not auto-cleaned.

### 3. Rate limiting deferred
The current webhook validates token + optional messageId dedupe, but the per-user `>60 requests/minute` rate limit is not enforced yet.
Add a lightweight Firestore counter or managed rate limit before public rollout.

### 4. Production token contract
Current token format is `mc_` + 32 random bytes encoded as base64url. If the product spec needs `mc_<32 hex chars>`, rotate the generator and update setup docs before users create tokens.

### 5. Demo mode limitation
SMS Webhook requires Firebase Auth + Firestore + Firebase Admin env vars. Demo/local users without Firebase auth will see no pending transactions and token generation will fail gracefully.

## ✅ Completed (verified today)
- [x] XP wire-through — all 11 actions wired
- [x] Toast UI — XPToastHost via xp_granted event  
- [x] Demo data quirks — profile init in handleDevBypass

## 🚧 Pre-launch checklist (DO before public release)
- [ ] Remove DEV BYPASS LOGIN button + handleDevBypass function
- [ ] Remove demo-user-123 hardcoded profile
- [ ] Audit env-based dev flags

## 📋 Still pending  
- [ ] SMS templates — only 3 banks (VCB/VPBank/TPBank)
- [ ] SMS parser robustness with diverse formats
- [ ] Firestore TTL for webhook dedupe
- [ ] Rate limiting deferred
- [ ] Production token contract
- [ ] Demo mode limitation cho SMS webhook

## Architecture

### 7. Cross-store calls (`useAuthStore.getState().awardXP()` từ trong store khác)
Pattern này dùng trong:
- `useGoalsStore.addFundsToGoal`
- `useDashboardStore.addFundContribution`
- `useFinanceStore.addTransaction`
- `useBudgetStore.checkAndRollover`
- `useMissionStore.completeMission`

Hoạt động OK với Zustand vì mỗi store là singleton. Nhưng làm test khó hơn (không thể mock dễ). Future: cân nhắc event bus hoặc inject awardXP qua param khi store cần test.
