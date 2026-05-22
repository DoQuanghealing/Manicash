# Profile Dashboard — Plan refactor & root-cause bug "không lưu được"

## 1. Root cause của bug "lưu rồi vẫn quên"

```ts
// useAuthStore.updateUserProfile
updateUserProfile: (updates) => {
  const user = get().user;
  if (!user) return;   // ← silently no-op nếu user null
  ...
}
```

**Khi nào `user` null?**
- User truy cập `/profile` mà chưa bypass login (không set demo mode)
- Firebase auth listener chưa fire xong
- `setUserProfile(null)` được gọi từ logout
- Bất kỳ trạng thái nào mà profile chưa được hydrate

**Triệu chứng user thấy:**
- Modal hiện "Chưa đăng nhập — số liệu hiển thị mặc định"
- User vẫn fill form được
- Click Save → silently nothing happens
- Modal đóng → User tưởng đã lưu
- Mở lại → form trống (vì store vẫn null)
- Avatar không update vì store không thay đổi

**Tại sao guard `if (!user) return` lại có?**
- Để tránh ghi đè state khi chưa load
- Nhưng quên case "user CREATE profile lần đầu"

## 2. Fix root cause

`updateUserProfile` cần handle 2 mode:
1. **Update existing user** — như cũ, spread + safeUpdates
2. **Create user lần đầu** — nếu null, build minimal UserProfile từ updates + defaults

```ts
updateUserProfile: (updates) => {
  const existing = get().user;
  if (!existing) {
    // Create new — user mới setup profile lần đầu
    set({
      user: {
        uid: 'anon-' + Date.now(),
        displayName: updates.displayName ?? '',
        email: updates.email ?? '',
        photoURL: updates.photoURL ?? null,
        rank: 'iron',
        xp: 0,
        streak: 0,
        lastActiveDate: getDateKey(new Date()),
        resistCount: 0,
        totalResistSaved: 0,
        isPremium: false,
        plan: 'free',
        premiumExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        birthDate: updates.birthDate,
        birthTime: updates.birthTime,
        yearOfBirth: updates.yearOfBirth,
      },
    });
    return;
  }
  // ... existing logic for update
}
```

## 3. UI cleanup — Profile Dashboard

### Vấn đề hiện tại
- Hero hiện avatar + tên + XP + rank + nút Sửa hồ sơ
- **DƯỚI** hero là card thông tin riêng biệt (email, ngày sinh, mệnh)
- Khi info empty, card thay bằng button "Bấm Sửa hồ sơ để bổ sung..." → **trùng lặp** với nút "Sửa hồ sơ" đã có ở hero

### Refactor target
- Gộp info **INTO** hero — không tách thành card riêng
- Empty state inline trong hero ("chưa có info" hint subtle, không phải button to)
- Xóa redundant empty button
- Hero giữ 1 nguồn truth duy nhất cho identity

### Layout mới
```
┌─ Hero Card (gộp identity + info) ──────────────┐
│ ╭──────╮                                       │
│ │ Avatar│  Tên hiển thị              [✏ Sửa]   │
│ ╰──────╯  0 XP / 500 XP                        │
│           ▓▓▓▓▓░░░░░░               [Rank 🛡]  │
│  ┌─────────────────────────────────────────┐   │
│  │ 📧 email · 📅 6/7/1994 (31t)            │   │
│  │ 🕐 22:30 · ✨ Giáp Tuất / Sơn Đầu Hỏa   │   │
│  └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

## 4. Liên kết bản mệnh (Bát Tự)

`getBanMenh(yearOfBirth)` đã có:
- Can (Giáp/Ất/...) — 10
- Chi (Tý/Sửu/...) — 12
- Nạp âm ngũ hành (Kim/Mộc/Thủy/Hỏa/Thổ)
- Tên đầy đủ (vd "Sơn Đầu Hỏa")

`birthDate` có cả tháng + ngày + giờ → có thể tính Bát Tự 4 trụ:
- Trụ Năm (Can Chi năm)
- Trụ Tháng
- Trụ Ngày
- Trụ Giờ (cần giờ sinh)

Hiện tại chỉ tính Trụ Năm. Mở rộng sau khi data ổn.

**Hiện ưu tiên:**
- Đảm bảo `yearOfBirth` được derive đúng từ `birthDate` trong store
- Hiển thị mệnh năm trong info card
- Future: thêm "Lá số Bát Tự đầy đủ" trong feature phong thủy

## 5. Cấu trúc ngầm tránh bug

### Single source of truth cho identity
- `useAuthStore.user` là duy nhất
- ProfileEditModal hydrate 1 lần khi mở (snapshot)
- ProfileContent đọc trực tiếp từ store (subscribed)
- KHÔNG có duplicate state về user info

### Field ownership
| Field | Owner | Write path |
|-------|-------|------------|
| displayName | user | updateUserProfile |
| email | user | updateUserProfile (note: KO nên đè lên Firebase auth email) |
| photoURL | user | updateUserProfile |
| birthDate | user | updateUserProfile |
| birthTime | user | updateUserProfile |
| yearOfBirth | derived | auto từ birthDate trong store |
| xp, rank, streak | user (read-only từ modal) | awardXP, updateStreak |

### Flow khi save
1. Modal collect form data
2. handleSave → validate
3. updateUserProfile(updates)
4. Store hoặc UPDATE existing user, hoặc CREATE new user
5. user state mới triggered re-render mọi subscriber
6. ProfileContent re-render với data mới
7. Modal đóng

### Anti-patterns đã fix
- ✅ Bỏ `user` khỏi useEffect deps để tránh re-hydrate trên store update
- ✅ Bỏ `!!user` từ canSave để tránh false-blocked button
- ✅ Diagnostic message hiển thị blocker rõ ràng

### Còn cần fix
- ✅ `updateUserProfile` handle null user → create new
- ✅ Move info INTO hero, không card riêng
- ✅ Xóa empty state button trùng lặp

## 6. Roadmap

### Phase 1 ✅ DONE — Fix bug + UI
- [x] `updateUserProfile` handle null user → create new
- [x] Gộp info card vào hero (4 chip inline dưới XP bar)
- [x] Xóa empty state purple box

### Phase 2 ✅ DONE — Bát Tự đầy đủ
- [x] `src/lib/batTu.ts`: tính 4 trụ Can-Chi từ birthDate + birthTime
  * `getYearPillar(year)` — anchor 1984 = Giáp Tý
  * `getMonthPillar(year, month)` — Ngũ Hổ Độn rule
  * `getDayPillar(date)` — 60-day cycle, anchor 1900-01-31 = Giáp Tý
  * `getHourPillar(hour, dayCan)` — Ngũ Thử Độn rule
  * Mỗi trụ có Can/Chi/Nạp âm/Mệnh ngũ hành
- [x] `BatTuCard` UI — 4 cột pillar grid với highlight Trụ Ngày
  * Header: tên mệnh chính + trait phú quý
  * Empty state cho Trụ Giờ nếu chưa nhập → click → mở edit modal
  * Footer giải thích Bát Tự
- [x] Mount trong ProfileContent dưới hero

### Phase 3 (later) — Identity polish
- [ ] Verify Firebase email không bị overwrite khi user edit
- [ ] Sync birthDate sang Firestore khi non-demo
- [ ] Lưu ý tiết khí: chuyển sang dùng lịch âm/tiết khí cho biên tháng
  (phong thủy chuẩn). Hiện dùng tháng dương lịch — đủ phổ thông.
