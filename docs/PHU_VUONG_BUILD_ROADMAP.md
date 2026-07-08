# Phú Vương 🐉 — Roadmap triển khai

> Biến kịch bản (`BUTLER_PHU_VUONG_SCRIPT.md`) + hiến chương (`ETHICS_CHARTER.md`) thành code.
> Nguyên tắc: **ship lát cắt dọc an toàn trước**, KHÔNG đụng money-sync engine (PO còn bàn) —
> chỉ ghi **consent flag**; sync thật vẫn gated bởi `NEXT_PUBLIC_MONEY_SYNC_ENABLED`.

## Tài sản đã có sẵn (tái dùng, không viết lại)
- **Capacity engine** `prism/capacity/*`: `buildCapacityComponents → computeCapacity → classifyCapacity`
  (trả nhãn nhóm nghề: Chuyên gia Số / Nhà Khai vấn / Sáng tạo Nội dung / Kỹ sư Vận hành).
- **Khảo sát** `CapacitySurveyCard` + `useCapacitySurveyStore` (skills + giờ rảnh).
- **Consent** `/api/telemetry/consent` (analyticsConsent) — mở rộng thêm scope `sovereign`.
- **Trigger data** `useAuthStore.user.streak / rank / xp`.
- **earningPlanner.ts** — sẵn cho tầng 5 (đề xuất việc tăng thu).

---

## P1 — Lát cắt dọc (SHIP NGAY, đang làm)

| # | Việc | File |
|---|---|---|
| 1 | `ButlerTier` += `'sovereign'` | `stores/useSettingsStore.ts` |
| 2 | Store mở/đóng lời mời (độc lập với onboarding) | `stores/useSovereignInviteStore.ts` (mới) |
| 3 | Consent scope `sovereign` (ghi `sovereignConsent`; grant ⇒ analyticsConsent=true) | `api/telemetry/consent/route.ts` |
| 4 | Map kỹ năng → nhóm nghề (teaser Bước 2, tự chứa, 0 phụ thuộc finance) | `lib/butler/sovereignArchetype.ts` (mới) |
| 5 | Modal 3 bước (khen → La bàn → mời + 6 ý) | `components/butler/SovereignInvite.tsx` (mới) |
| 6 | Tự kích hoạt: tier=wise & streak≥14 & chưa sovereign & cooldown 14 ngày | trong SovereignInvite (useEffect) |
| 7 | Thẻ Hồ sơ: hiện trạng thái Phú Vương + nâng/hạ | `profile/_components/ButlerSettingsCard.tsx` |
| 8 | Mount modal | `app/(app)/layout.tsx` |

**Ranh giới P1:** chỉ set `butlerTier='sovereign'` + `sovereignConsent=true` (server). **KHÔNG** bật
money sync thật, **KHÔNG** đổi env flag. Đề xuất chủ động (card) = P2.

Verify: `tsc --noEmit` · `npm run build` · lint phần mới.

---

## P2 — Đồng hành sâu (chờ PO chốt money sync)
- Bật **money sync per-user** khi sovereign (gate = env flag AND sovereignConsent). Test tài khoản phụ trước.
- **Hàng đợi card đề xuất** (accept/dismiss) trong chat — nối `earningPlanner` + quest gợi ý; luôn "xin phép".
- Hydrate `butlerTier` từ server khi đăng nhập máy mới (hiện tier là per-device).

## P3 — Oracle & tương lai (Pro Plus)
- Báo cáo Oracle 4 phần (GPT-4o-mini, credit) — nối `capacityEngine` growthOrientation.
- CV PDF, Coach handoff, tách gói **Pro Plus**.

---

## Kiểm thử thực tế (PO + nhóm test)
1. Tài khoản có streak ≥ 14 & tier Thông thái → tự hiện lời mời.
2. Chạy hết 3 bước → tier = Phú Vương, Hồ sơ hiện 🐉.
3. Từ chối "để sau" → không hiện lại trong 14 ngày.
4. Hạ cấp ở Hồ sơ → `sovereignConsent=false`.
5. Xoá tài khoản → xoá sạch (đã có luồng, `sovereignConsent` nằm trên `users/{uid}`).
