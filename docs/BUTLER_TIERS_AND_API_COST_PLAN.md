# Quản gia 3 cấp (mô hình Mercedes) + Phương án chi phí API zero-leak

> Trạng thái: **DRAFT chờ PO duyệt** · 2026-07-15
> Nguyên tắc: **1 codebase full-option = Phú Vương**; cấp dưới = tắt công tắc (feature flag), KHÔNG fork code.
> Nền: `PHU_VUONG_BUILD_ROADMAP.md` · `ETHICS_CHARTER.md` · `UNIFIED_ROADMAP.md` §3 (pricing) · code thật đã rà 2026-07-15.

---

## 1. Triết lý "Mercedes" — 1 build, mở khóa bằng tiền

- **Mọi tính năng đều nằm trong build** (kể cả bản Free tải về). Khác biệt duy nhất: hàm `hasFeature(level, key)` trả true/false.
- Tính năng bị khóa **vẫn hiện trên UI** với 🔒 + nút "Nâng quản gia" → FOMO tự nhiên, không cần landing page riêng cho từng tính năng.
- **Cơ chế "ghế sưởi có sẵn":** bộ nhớ/trí nhớ HỌC từ cấp 1 (âm thầm ghi local), nhưng chỉ **HIỂN THỊ + SỬ DỤNG** từ cấp 2–3. Ngày nâng cấp, quản gia lập tức "đã hiểu mình" → wow-moment tức thì:
  > *"Ta đã âm thầm ghi nhớ 23 thói quen của cậu chủ. Mở khóa để ta phục vụ đúng ý."*

### Bộ công tắc trung tâm (file mới)

`src/lib/monetization/butlerFeatures.ts` — **một nguồn sự thật duy nhất**, client + server dùng chung (isomorphic, như moneyBrain):

```ts
export type ButlerLevel = 1 | 2 | 3;

/** Cấp tối thiểu để mở tính năng. Đổi số = đổi gói, không đổi code nơi khác. */
export const FEATURE_MIN_LEVEL = {
  // Cấp 1 — công cụ
  'chat.query.basic': 1,      // số dư, chi hôm nay, bill status
  'bills.remind.basic': 1,    // guardian: CHỈ nhắc bill
  'txn.log': 1, 'budget.manual': 1, 'goals.basic': 1,

  // Cấp 2 — cá nhân hóa
  'memory.chips': 2,          // chip ghi nhanh từ thói quen (P3)
  'memory.category': 2,       // áp luật keyword→danh mục khi parse
  'chat.followup': 2,         // ngữ cảnh hội thoại (conversationStore)
  'guardian.full': 2,         // đủ 5 loại cảnh báo (không chỉ bill)
  'cfo.ai': 2,                // CFO narration AI (quota)
  'llm.rescue': 2,            // cứu intent mù mờ bằng Groq 8B
  'chat.deep': 2,             // tư vấn sâu (quota)

  // Cấp 3 — Phú Vương (full option)
  'coach.proactive': 3,       // CoachSuggestionCard (PV-2, đã ship)
  'care.companion': 3,        // 10 kịch bản chăm sóc + minigame (0đ, §9)
  'task.eval': 3,             // AI đánh giá nhiệm vụ kiếm tiền (§8)
  'task.completion.watch': 3, // theo dõi khả năng hoàn thành (deterministic)
  'query.full': 3,            // hỏi gì cũng truy xuất (cross-period + LLM-with-snapshot)
  'dna.oracle': 3,            // Financial DNA + Oracle (PV-3)
  'sync.multiDevice': 3,      // money sync per-user (PV-4)
} as const;

export function hasFeature(level: ButlerLevel, f: keyof typeof FEATURE_MIN_LEVEL): boolean {
  return level >= FEATURE_MIN_LEVEL[f];
}
```

**Resolve level:** `butlerLevel = min(levelFromBilling(entitlement), userChosenTier)` — user được *chọn xuống* (thích quản gia trầm lặng) nhưng không *chọn lên* quá gói đã trả. Server resolve từ entitlement (nguồn sự thật), client mirror để render.

---

## 2. Ma trận 3 cấp

| | 🪶 **Cấp 1 — Tập sự** (Free) | 👑 **Cấp 2 — Thông thái** (Pro 49k) | 🐉 **Cấp 3 — Phú Vương** (Pro Plus, đề xuất 99k) |
|---|---|---|---|
| **Định vị 1 câu** | Máy tính biết nói + nhắc bill | Quản gia hiểu ý, nhớ thói quen | Cố vấn riêng: chủ động, thấu hiểu, hài hước |
| Ghi thu/chi, ngân sách, mục tiêu | ✅ | ✅ | ✅ |
| Hỏi số liệu offline (số dư, chi tiêu, bill) | ✅ cơ bản | ✅ đầy đủ | ✅ đầy đủ + cross-period ("so tháng này với 3 tháng trước") |
| Nhắc bill | ✅ | ✅ | ✅ |
| Guardian (5 loại cảnh báo chủ động) | 🔒 chỉ bill | ✅ | ✅ |
| Chip ghi nhanh từ thói quen (P3) | 🔒 (vẫn học ngầm) | ✅ | ✅ |
| Luật keyword→danh mục tự áp (memory) | 🔒 (vẫn học ngầm) | ✅ | ✅ |
| Hội thoại có ngữ cảnh (follow-up) | 🔒 | ✅ | ✅ |
| Báo cáo CFO | bản deterministic | + AI narration (quota) | + AI narration sâu + action plan |
| Tư vấn sâu AI | 🔒 (8 lượt/tháng nếm thử) | ✅ 15/ngày | ✅ 30/ngày |
| **Đề xuất chủ động (Coach card)** | 🔒 | 🔒 *(hiện teaser mờ)* | ✅ |
| **Chăm sóc + hài hước + minigame** (§9) | 🔒 | 🔒 | ✅ (0đ API) |
| **AI đánh giá nhiệm vụ kiếm tiền** (§8) | 🔒 | 5 lượt/tháng nếm thử | ✅ 30/tháng |
| Theo dõi khả năng hoàn thành nhiệm vụ | 🔒 | 🔒 | ✅ (deterministic 0đ) |
| Financial DNA + Oracle | 🔒 | 🔒 | ✅ (2/tháng) |
| Đồng bộ đa thiết bị (money sync) | 🔒 | 🔒 | ✅ (PV-4, sau consent) |
| La Bàn Năng Lực `/nangluc` | ✅ (mồi phễu) | ✅ | ✅ + Oracle nhận xét |

**Map hiện trạng → kế hoạch:**
- `butlerTier` trong `useSettingsStore` hiện là 'basic'/'wise'/'sovereign' per-device, tự chọn → chuyển thành **persona hiển thị**, còn **quyền năng** đọc từ `butlerLevel` (billing).
- Phú Vương đang **mở cho Free (FOMO)** → giữ nguyên đến khi PV-5 (Pro Plus) ra mắt, sau đó: user Free đang ở sovereign được **14 ngày thông báo + trial**, hết trial rơi về cấp theo gói. (PO xác nhận.)
- `CoachSuggestionCard` gate `tier==='sovereign'` → đổi thành `hasFeature(level,'coach.proactive')`.

---

## 3. Bảng định tuyến API — "gọi model nào, khi nào"

> Nguyên tắc bất biến: **client KHÔNG BAO GIỜ tự quyết gọi LLM**. Mọi lượt đi qua server: quota (Firestore transaction, per-day AND per-month) → cache → mới gọi.

| # | Tình huống | Model | Điều kiện gọi | Cache | Trần token (in/out) |
|---|---|---|---|---|---|
| 0 | Tra cứu số liệu, lệnh hành động, care script, minigame | **KHÔNG GỌI** | — | — | — |
| 1 | Intent mù mờ (router trả UNKNOWN, câu có vẻ về tiền) | **Groq Llama-3.1-8B-instant** | level≥2 + quota rescue | 24h theo text chuẩn hóa | 400 / 120 |
| 2 | Tư vấn sâu / follow-up LLM | **GPT-4o-mini** | quota deep + session 30' | session | 3.500 / 700 |
| 3 | CFO narration | **GPT-4o-mini** | quota CFO + fingerprint MISS | 2 tầng theo (tháng, hash data) — đã có | 4.000 / 900 |
| 4 | Đánh giá nhiệm vụ (§8) | **GPT-4o-mini** | level 3 (Pro nếm thử 5/th) + hash task MISS | per-task hash, chỉ gọi lại khi task ĐỔI | 1.200 / 450 |
| 5 | DNA Oracle (PV-3) | **GPT-4o-mini** | level 3 + credit, 1 lần/phiên khảo sát | per survey hash | 3.000 / 800 |
| 6 | Failover khi OpenAI sập | Groq Llama-3.3-70B | tự động, ≤1 retry | như dòng gốc | như dòng gốc |

**Vì sao 4o-mini là model chính cho việc "sâu":** rẻ hơn Groq 70B ~2,7 lần (bảng §4) và tiếng Việt mượt hơn; Groq chỉ giữ 2 vai: **8B-instant** cho phân loại (gần như 0đ) và **70B** làm phao cứu sinh khi OpenAI down. (Khớp quyết định Q5 roadmap, làm rõ thêm: parse dùng 8B chứ không phải 70B → rẻ hơn ~50 lần.)

**Prompt caching OpenAI:** xếp phần TĨNH (system prompt + luật) lên ĐẦU prompt, phần động (snapshot) xuống cuối → input lặp lại được discount ~50%. Quy ước bắt buộc khi viết prompt.

---

## 4. Bảng giá & trần chi phí mỗi lượt (tỷ giá 26.000đ/USD, đệm sẵn)

| Model | Input /1M tok | Output /1M tok |
|---|---|---|
| GPT-4o-mini | $0,15 (~3,9đ/1k) | $0,60 (~15,6đ/1k) |
| Groq 8B-instant | $0,05 (~1,3đ/1k) | $0,08 (~2,1đ/1k) |
| Groq 70B (failover) | $0,59 (~15,3đ/1k) | $0,79 (~20,5đ/1k) |

**Trần chi phí MỖI LƯỢT** (không thể vượt — vì input bị budgeter cắt, output bị `max_tokens` chặn ở API):

| Loại lượt | Tính | **Trần** |
|---|---|---|
| Rescue 8B | 400 in + 120 out | **1đ** |
| Tư vấn sâu | 3.500 in + 700 out | **25đ** |
| CFO narration | 4.000 in + 900 out | **30đ** |
| Đánh giá nhiệm vụ | 1.200 in + 450 out | **12đ** |
| DNA Oracle | 3.000 in + 800 out | **25đ** |
| Failover 70B (≤3% lưu lượng) | 3.500 in + 700 out | 68đ |

→ **Chi phí kế hoạch cho 1 lượt "sâu": 30đ** (đã trộn 3% failover + đệm 15%). Con số 100đ/lượt trong roadmap cũ là siêu thận trọng — vẫn giữ làm trần báo cáo tài chính.

---

## 5. Quota theo cấp + chi phí worst-case (mô phỏng)

**Double-cap là chìa khóa:** mọi quota có trần NGÀY *và* trần THÁNG. Trần ngày chống burst; trần tháng chốt hóa đơn. User "abuser" tối đa chỉ tốn = trần tháng × trần lượt — **toán học chặn, không phải hy vọng**.

| | 🪶 Free | 👑 Pro 49k | 🐉 Phú Vương 99k* |
|---|---|---|---|
| Tư vấn sâu | 8/tháng (≤1/ngày) | 15/ngày · **trần 200/tháng** | 30/ngày · **trần 500/tháng** |
| CFO AI | 1/tháng | 3/ngày · trần 30/tháng | 5/ngày · trần 60/tháng |
| Rescue 8B | 3/ngày | 10/ngày | 20/ngày |
| Đánh giá nhiệm vụ | — | 5/tháng | 30/tháng |
| DNA Oracle | — | — | 2/tháng |
| **Chi phí WORST/user/tháng** | **~360đ** | **~7.300đ (15% giá)** | **~17.800đ (18% giá)** |
| **Chi phí EXPECTED** (median dùng ~25% quota) | ~110đ | ~1.900đ | ~5.500đ |
| **Margin API worst-case** | (phễu) | **≥ 85%** | **≥ 82%** |

*Giá Phú Vương 99k là đề xuất — PO chốt (phương án khác: 79k nếu muốn phổ cập, 129k nếu định vị sang).

**Mô phỏng 1.000 user** (800 Free · 150 Pro · 50 PV):
- Doanh thu: 150×49k + 50×99k = **12,3tr/tháng**
- Chi phí API expected ≈ 0,84tr (6,8%) · worst tuyệt đối ≈ 2,4tr (19,5%)
- → Margin API **80–93%** trong MỌI kịch bản, kể cả toàn bộ user đốt hết quota.

**Credit pack** (đã chốt 20k=40 · 40k=100 · 100k≈300/th): giá bán 333–500đ/lượt vs trần 30đ → margin ≥ 91% kể cả worst. Không cần chỉnh.

---

## 6. Zero-leak — 8 chốt chặn (mỗi đồng bị chặn ở đâu)

1. **Server-side quota** — Firestore transaction per-day + per-month (double-cap). Client chỉ hiển thị optimistic. *(Điều kiện cứng M1 — phải xong TRƯỚC khi bật monetization; hiện chưa server-enforce đủ.)*
2. **`max_tokens` per loại lượt** (bảng §4) — API enforce, không thể vượt.
3. **Input budgeter** — snapshot digest có ngân sách token cố định; KHÔNG BAO GIỜ gửi giao dịch thô. Test CI đo size prompt: prompt phình → test đỏ.
4. **Cache 3 tầng** — CFO fingerprint (đã có) · per-task hash (mới) · rescue 24h theo text.
5. **Lượt lỗi không trừ user** (grace) nhưng VẪN đếm vào breaker; retry tối đa 1 lần.
6. **Circuit breaker toàn cục** — bộ đếm chi tiêu API/ngày toàn nền tảng ở Firestore; vượt `max(50.000đ, 3%×MRR/30)` → degrade về offline + cache, thông báo "quản gia đang bảo trì não bộ", alert admin. Kèm kill-switch env (pattern đã có).
7. **`ai_usage` log từng lượt** `{model, tokensIn, tokensOut, costVnd, feature, uid}` → đối soát hóa đơn OpenAI/Groq hằng tuần. Leak nếu có = lộ trong ≤7 ngày. (Đồng thời là data R&D cho hồ sơ doanh nghiệp.)
8. **CI simulation test** (§7) — đổi prompt/quota làm vỡ ngân sách → build đỏ, không lên được prod.

---

## 7. Mô phỏng liên tục — `tests/ai-cost-simulation.test.ts`

Test chạy trong CI, dùng **chính engine quota thật** (không mock logic):

- **5 persona:** ghost (0 msg) · casual (2 msg/ngày) · regular (8) · power (20) · **abuser (200 lần thử/ngày)**.
- Mô phỏng 30 ngày × 3 cấp × 5 persona (seed cố định, deterministic).
- Đếm số lượt LỌT QUA quota engine theo loại → chi phí = Σ (lượt × trần §4).
- **Assert:** Free ≤ 500đ · Pro ≤ 8.000đ · PV ≤ 20.000đ / user / tháng; abuser bị 429 đúng chỗ, chi phí == trần (bounded).
- Mọi thay đổi prompt (đổi token budget), quota, hay pricing constant đều chạy lại mô phỏng → **"tối ưu liên tục bằng mô phỏng" thành cơ chế tự động**, không phải lời hứa.

Vòng lặp vận hành: `ai_usage` thật (tuần) ⟷ số mô phỏng → lệch >20% thì chỉnh giả định persona → chỉnh quota nếu cần.

---

## 8. Tính năng mới: AI đánh giá nhiệm vụ kiếm tiền (Cấp 3)

**Luồng:** user tạo/sửa nhiệm vụ → nút "🧠 Quản gia thẩm định" (hoặc auto khi task quá hạn + user bấm "Chia giúp ta" ở care script #7).

- **Input** (≤1.200 tok): tên nhiệm vụ, tiền kỳ vọng, deadline, subtasks hiện có, kỹ năng từ khảo sát năng lực, tỷ lệ hoàn thành lịch sử (từ store).
- **Output JSON** (≤450 tok, validate schema): `{feasibility: 0-100, missingSubtasks: string[], risks: string[], suggestedPriceRange?, oneLineCoach}`.
- **Cache:** hash(tên + tiền + subtasks) lưu ngay trên task → sửa task mới gọi lại. Trần 12đ/lượt.
- **Tách deterministic/AI đúng chuẩn nhà:** *điểm khả năng hoàn thành* tính bằng moneyBrain (tỷ lệ hoàn thành lịch sử, tiến độ subtask vs ngày còn lại) = **0đ, cập nhật realtime**; AI chỉ làm phần "gợi ý nhiệm vụ phụ còn thiếu + rủi ro" = gọi 1 lần có cache.

---

## 9. "Care Companion" — 10 kịch bản chăm sóc (Cấp 3 · 0đ API)

> Toàn bộ deterministic: trigger tính từ snapshot + đồng hồ local, thoại là template có sẵn, minigame là animation client (framer-motion). **Không một token nào.** Ràng buộc ETHICS_CHARTER: tối đa **1 kịch bản/ngày**, mỗi kịch bản cooldown ≥3 ngày, bỏ qua = lùi không nài, không chen khi user đang thao tác. Xưng hô theo `sovereignArchetype` (cậu chủ/cô chủ/ngài).

| # | ID | Trigger (offline) | Kịch bản + tương tác |
|---|---|---|---|
| 1 | `sad-guard` | Chi ăn uống/giải trí đột biến sau 22h | *"Hôm nay tên sở khanh nào làm cô chủ không vui hay sao mà quên mất vượng tài rồi?"* → nút **(Xử lý sở khanh cho ta / Không có gì)** → chọn Xử lý: con gián 🪳 chạy ngang màn hình, tap để đập 🩴💥 → *"Dám làm cô chủ ta buồn. Xứng đáng nha con gián."* |
| 2 | `ghost-3d` | 3 ngày không ghi chép | *"Ba ngày cậu chủ không đụng sổ sách. Tên 'Lười Biếng' nào đã bắt cóc cậu chủ của ta?"* → **(Đập hắn / Ta bận thật mà 😅)** → minigame đập 3 chạm → *"Hắn khai rồi: mai cậu chủ ghi chép lại. Ta lập biên bản đấy nhé 📜"* |
| 3 | `payday-guard` | ≤48h sau ngày lương đã chi >30% | *"Lương về 2 ngày đã bay 30%… tiền chạy nhanh hơn cả ta đuổi. Cho ta dựng hàng rào ngân sách nhé?"* → **(Đặt rào / Kệ ta 😎)** → Đặt rào: mở flow set budget |
| 4 | `streak-save` | 23h chưa ghi, streak ≥5 sắp gãy | *"Chuỗi 12 ngày của cậu chủ đang run rẩy bên bờ vực. Ta không muốn viết cáo phó cho nó đâu 🕯️"* + chip ghi nhanh từ habit |
| 5 | `bill-mosquito` | Bill quá hạn ≥2 ngày | *"Con muỗi 'Tiền điện' vo ve 2 ngày rồi, mỗi lần hút 250.000đ máu."* → **(Đập nó = đi thanh toán / Nuôi thêm hôm nữa)** → đập: 🦟💥 confetti → mở flow mark-paid (vẫn phải confirm) |
| 6 | `goal-cheer` | Mục tiêu chạm mốc 50% | *"Nửa đường rồi! Quỹ 'iPhone' đã 50%. Ta ướp sẵn sâm-panh ảo 🍾 — nửa còn lại ta cá cậu chủ xong trong X tuần."* |
| 7 | `task-nudge` | Nhiệm vụ kiếm tiền trễ ≥3 ngày | *"Nhiệm vụ 'Viết content' trễ 3 ngày. Deadline không đập được như con gián đâu, cậu chủ."* → **(Chia giúp ta / Hoãn thêm)** → Chia: gọi Đánh giá nhiệm vụ (§8, có cache) |
| 8 | `comeback` | Quay lại sau ≥7 ngày vắng | *"Cậu chủ! Ta lau bụi két sắt mỗi ngày chờ người về. Kể ta nghe hôm nay tiêu gì nào ☕"* |
| 9 | `night-owl` | Ghi chi tiêu sau 0h | *"0h17 mà còn 'trà sữa 45k'? Ví tiền và sức khỏe của cậu chủ đang rủ nhau thức khuya đấy 🌙"* |
| 10 | `sunday-report` | Chủ nhật 19–21h | *"Tuần này tiêu X, kiếm Y — đội 'Kiếm' đang thắng/thua. Muốn nghe chiến thuật tuần sau không?"* → **(Nghe / Tuần sau)** → Nghe: có quota → deep call; hết quota → bản deterministic |

**File dự kiến:** `src/lib/aiMoneyChat/care/careScripts.ts` (pure, test được) + `careTriggers.ts` (đọc snapshot → script nào nổ) + `stores/useCareStore.ts` (cooldown, dismissed, account-boundary) + `components/butler/CareCard.tsx` + minigame `SquashCritter.tsx`. Test: `tests/care-triggers.test.ts` (trigger đúng/cooldown/1-per-day/không nổ trên account trống — tránh vết xe P4 báo động giả).

---

## 10. Thứ tự triển khai đề xuất

1. **T1 — `butlerFeatures.ts` + resolve level từ entitlement** (nền Mercedes; đổi gate CoachSuggestionCard sang hasFeature). Nhỏ, mở đường mọi thứ.
2. **T2 — Quota server-enforce double-cap + `ai_usage` log** (chốt chặn #1, #7 — điều kiện bật tiền).
3. **T3 — CI simulation test** (chốt #8) — viết TRƯỚC khi thêm tính năng AI mới.
4. **T4 — Care Companion** (0đ, giá trị cảm xúc cao nhất/chi phí thấp nhất, làm Phú Vương "sống").
5. **T5 — Đánh giá nhiệm vụ** (lượt AI mới đầu tiên chạy trên nền quota đã siết).
6. **T6 — PV-5 Pro Plus SKU + migration Free-sovereign** (khi PO chốt giá).

## 11. Quyết định chờ PO

| # | Câu hỏi | Đề xuất của em |
|---|---|---|
| 1 | Giá Phú Vương/Pro Plus | **99k/tháng** (margin ≥82% worst; 79k nếu muốn phổ cập) |
| 2 | Free-sovereign hiện tại xử lý sao khi PV-5 ra | Giữ đến PV-5 → báo 14 ngày + trial → rơi về gói |
| 3 | Quota số (bảng §5) | Duyệt như bảng, chỉnh được bằng env |
| 4 | Free nếm thử tư vấn sâu | "8 lượt/tháng" nói thẳng (minh bạch, không mập mờ 1/ngày) |
| 5 | 10 kịch bản care — giọng điệu | Duyệt/biên tập thoại §9 (nhất là #1 sở khanh 😄) |
| 6 | Đánh giá nhiệm vụ cho Pro (cấp 2) nếm 5/tháng? | Có — mồi lên cấp 3 |
