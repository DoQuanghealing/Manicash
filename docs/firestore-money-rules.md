# Firestore Security Rules — Money Sync (Phase 6B-2A)

Path: `users/{uid}/money/state`

## Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Money state document ─────────────────────────────────────────────────
    // Path: users/{uid}/money/state
    // User chỉ đọc/ghi data của chính uid — không cross-user access.
    match /users/{uid}/money/state {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }

    // ── Legacy finance_core (Phase 6B-2A chưa migrate, giữ nguyên) ──────────
    match /users/{uid}/finance_core/state {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }

    // ── Default: deny everything else ───────────────────────────────────────
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Invariants enforced

| Rule | Đảm bảo |
|------|---------|
| `request.auth != null` | Unauthenticated clients không thể đọc/ghi |
| `request.auth.uid == uid` | User A không đọc/ghi data của user B |
| Default deny | Mọi path khác bị chặn |

## Notes

- Rules KHÔNG validate document schema — validation xảy ra ở client (serialize/deserialize).
- Server-side Cloud Functions không cần rules này nếu dùng Admin SDK (bypass rules).
- Khi scale lên sub-collections (transactions, audit riêng), extend rules tương ứng.
- `finance_core` giữ nguyên để không break existing data trong Phase 6B-2A.
  Migration sang `money/state` sẽ được xử lý ở Phase 6B-3.
