# Phú Vương 🐉 + Mở rộng AI — Roadmap chi tiết

> Master roadmap biến quản gia từ **phản ứng → chủ động → cố vấn → tự chủ**, gated theo
> tier/credit/đạo đức. Nền: `BUTLER_PHU_VUONG_SCRIPT.md` (kịch bản) · `ETHICS_CHARTER.md`
> (consent) · `FINANCIAL_DNA_SPEC.md` (bài test tâm lý tiền) · `AI_EXPANSION_RESEARCH.html` (tầm nhìn).
>
> **Nguyên tắc:** mỗi phase là 1 lát cắt dọc chạy được + test; logic ở `moneyBrain`/`aiMoneyChat`
> (pure, test được), KHÔNG nhồi vào component; không để đầu mối thừa.

## Bản đồ 6 tầng năng lực → phase

| Tầng | Năng lực | Trạng thái | Phase |
|---|---|---|---|
| 1–2 | Ghi sổ + Bộ não CFO | ✅ chạy | — |
| 3 | La bàn năng lực (survey + engine) | ⚠️ có engine, chưa nối persona tâm lý | PV-3 |
| 4 | Báo cáo Oracle | ❌ (growthOrientation đang để trống) | PV-3 |
| 5 | Coaching chủ động | ❌ | **PV-2** |
| 6 | Quản gia tự chủ | ❌ tương lai | PV-6 |

Tier: 🪶 Bình dân · 👑 Thông thái · 🐉 **Phú Vương** (đã có, mở cho Free) · 💠 **Pro Plus** (PV-5).

---

## ✅ PV-1 — Nền Phú Vương (ĐÃ SHIP, commit `d6ce825`)
`ButlerTier += 'sovereign'` · `useSovereignInviteStore` · consent scope `sovereign` · `SovereignInvite`
(3 bước) · `sovereignArchetype` · `ButlerSettingsCard`. Chỉ ghi consent flag, chưa bật money sync.

---

## 🔨 PV-2 — Đề xuất chủ động (Coaching engine) · *ưu tiên 1, không chờ ai*

**Mục tiêu:** Phú Vương "sống" — quản gia tự đẩy gợi ý đúng lúc thay vì đợi hỏi. Đây là *phần
thưởng thật* của tier (hiện nâng lên xong chưa khác gì Thông thái).

**Tái dùng:** `earningPlanner.ts` (gợi ý việc tăng thu) · `moneyBrain` (over-budget, bill, quỹ, streak)
· `prismSuggestions.ts` (chat suggestion) · `accountStatus.ts` (đã có lý do + action).

| # | Việc | File (dự kiến) |
|---|---|---|
| 1 | **Engine sinh gợi ý** thuần: gom tín hiệu (số dư âm, vượt ngân sách, bill sắp tới, quỹ mỏng, chưa có thu thêm, streak) → danh sách `Suggestion{id,type,priority,title,body,action}` | `lib/aiMoneyChat/coach/suggestionEngine.ts` (mới) |
| 2 | **Ưu tiên + khử trùng + cooldown**: mỗi loại 1 lần/khoảng; không lặp cái vừa bỏ qua | trong engine + store |
| 3 | **Store trạng thái**: đã hiện/accept/dismiss + mốc thời gian (localStorage, account boundary) | `stores/useCoachSuggestionStore.ts` (mới) |
| 4 | **Card mềm trong chat** (accept/bỏ qua) — *luôn xin phép, không tự chạy* | `chat/_components/CoachSuggestionCard.tsx` (mới) |
| 5 | **Gate tier**: chỉ `sovereign` mới nhận đề xuất chủ động | đọc `useSettingsStore.butlerTier` |
| 6 | Accept → điều hướng/tạo nhiệm vụ (vd earning task, mở /ledger) | nối action như `accountStatus` |
| 7 | **Test** engine (ưu tiên, cooldown, dedup, gate) | `tests/coach-suggestion-engine.test.ts` |

**Ranh giới:** đề xuất = card, **không** tự thực thi thay đổi tiền (đúng `ETHICS_CHARTER §1.6`). Bỏ
qua → lùi, không nài. **PO chốt:** vị trí hiện card (đầu chat / banner Tổng quan?), tần suất tối đa/ngày.

---

## 🧭 PV-3 — Financial DNA + Oracle · *ưu tiên 2 (chi tiết ở `FINANCIAL_DNA_SPEC.md`)*

**Mục tiêu:** bài test năng lực + thói quen + **tâm lý tiền** → persona → giải pháp + nâng tầm tư duy.
Lấp `growthOrientation` (đang để 50) = hoàn tất tầng 4 (Oracle).

**Tái dùng:** `capacityEngine` (FDS/TAS/IPS/MMS) · `capacitySurvey` · `CapacitySurveyCard` ·
`aiQuotaPolicy` (feature `report`, credit) · pattern `cfoNarration` (system-prompt + validate + cache).

| Bước | Việc | Gate | File |
|---|---|---|---|
| **B1** | Bộ câu trắc nghiệm A (thói quen+thái độ) + **persona mapping deterministic** (5 nhóm money-script) → teaser 0 token thay/bổ sung Bước 1 lời mời | 0 token | `lib/aiMoneyChat/prism/dna/personaEngine.ts` + `dnaQuestions.ts` (mới) |
| **B2** | Phần **viết tự do** (2–3 câu) + **consent tách bạch** (câu chữ khoá ở spec §4) + lưu | Phú Vương | `dna/DnaReflectionCard.tsx` + `stores/useFinancialDnaStore.ts` |
| **B3** | **Phân tích LLM** (đọc A+B) → Oracle 4 phần (persona · mạnh/mù · 2-3 giải pháp · nâng tư duy) | **credit** (Pro quota) | `api/ai-money-chat/dna-oracle/route.ts` + prompt/validate |
| **B4** | Lưu `users/{uid}/financial_dna` · nút **xoá riêng** · ghi `growthOrientation` ngược vào capacity · xoá khi xoá tài khoản | — | wire + `exportUserData`/deletion |
| **B5** | **Test**: persona mapping · consent gate · schema output · xoá sạch | — | `tests/dna-persona.test.ts` … |

**Đạo đức (bắt buộc):** không phán xét · disclaimer "không phải tư vấn đầu tư/chẩn đoán" · dấu hiệu
khủng hoảng → giọng nâng đỡ. **PO chốt:** duyệt bộ câu A + 3 câu B · **lưu raw phần viết hay chỉ lưu
bản phân tích** (an toàn hơn) · Free tốn 1 credit/lần hay khoá hẳn sau Pro Plus.

---

## 🔄 PV-4 — Money sync per-user · *chờ PO bàn kỹ*

**Mục tiêu:** bật đồng bộ dữ liệu hành vi cho Phú Vương (đa thiết bị + quản gia "nhớ").

**Tái dùng:** toàn bộ money sync đã build (Phase 6B-2E) — 5 store, `users/{uid}/money/state`, LWW+append.

| # | Việc |
|---|---|
| 1 | Gate kép: `NEXT_PUBLIC_MONEY_SYNC_ENABLED` **AND** `sovereignConsent` (không bật đại trà) |
| 2 | Bật sync khi tier=sovereign; tắt/giữ local khi hạ cấp |
| 3 | **Hydrate `butlerTier` từ server** khi đăng nhập máy mới (hiện per-device) |
| 4 | Smoke test tài khoản phụ trước (checklist `MONEY_SYNC_ACTIVATION.md`) |

**PO chốt (chặn phase này):** có bật money sync không, phạm vi dữ liệu, câu chữ consent tầng 3
(dữ liệu tài chính nhạy cảm — NĐ 13/2023, xem `ETHICS_CHARTER §3`).

---

## 💠 PV-5 — Monetization: Pro Plus

**Mục tiêu:** sau khi Free đã "nghiện" Phú Vương → tách năng lực cao cấp lên gói **Pro Plus**.

| # | Việc |
|---|---|
| 1 | Thêm tier billing `pro_plus` (mở rộng `resolveAiMoneyPlan`/entitlement) |
| 2 | Chuyển Oracle đầy đủ / coaching không giới hạn / (money sync?) sang Pro Plus |
| 3 | SKU PayOS + trang bán (mở rộng `/upgrade` + `PricingCards`) |
| 4 | Quota mới cho Pro Plus (`aiQuotaPolicy`) |

**PO chốt:** giá Pro Plus · năng lực nào miễn phí / nào khoá · thời điểm ra mắt.

---

## 🤖 PV-6 — Quản gia tự chủ (tương lai/nghiên cứu)
Agent nhiều bước + tool-use (tự lập kế hoạch, xin phép từng bước) · **Coach handoff** (nút gửi báo
cáo → coach người thật của PO, app không xử lý thanh toán) · CV PDF public slug. Phụ thuộc PV-3 + PV-5.

---

## Xuyên suốt (mọi phase)
- **Đạo đức/consent:** mọi tầng sâu theo `ETHICS_CHARTER`; hành động phải xin phép.
- **Credit/quota:** mọi lượt LLM đi qua `aiQuotaPolicy` + cache (chống đốt token).
- **Test:** mỗi engine pure phải có test trong `tests/` (rule CLAUDE.md).
- **Verify trước push:** `tsc` · `npm run build` · `test:ai-all` · lint.

## Thứ tự đề xuất
**PV-2 → PV-3 (B1→B5) → PV-4 (khi PO chốt) → PV-5 → PV-6.**
PV-2 làm trước vì: không chờ quyết định nào, giá trị cao nhất (biến tier thành thật), tái dùng nhiều.

## Bảng quyết định PO đang chờ
| Phase | Câu hỏi |
|---|---|
| PV-2 | Vị trí card đề xuất · tần suất tối đa/ngày |
| PV-3 | Duyệt bộ câu · lưu raw phần viết? · Free tốn credit hay khoá Pro Plus |
| PV-4 | Bật money sync không · câu chữ consent tầng 3 |
| PV-5 | Giá Pro Plus · ranh giới free/khoá |
