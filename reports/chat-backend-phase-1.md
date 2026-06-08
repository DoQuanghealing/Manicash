# Chat Backend Upgrade — Phase 1 Report (Intent Router Foundation)

Date: 2026-06-07
Branch: `codex/ai-money-chat`
Author: Claude Code (Execution)
Reviewer: Selena (Architect)

## Mục tiêu

Xây móng định tuyến cho hệ thống chat hybrid: tạo cấu trúc `src/lib/aiMoneyChat/intent/`
và bộ classifier rule-based 4-tier (Tier 1 regex + Tier 2 keyword scoring), tích hợp
proxy ngược `parseMoneyText` để KHÔNG làm gãy luồng nhập liệu giao dịch hiện có.

## Đã hoàn thành

- 12 `ChatIntentType` (10 classifiable + `FOLLOW_UP` + `UNKNOWN`).
- Bộ classifier deterministic, **0 token**, không bao giờ throw.
- Công thức chấm điểm đúng spec đã chốt với Architect:
  `score = min(1, (hits/keywords.length + mustMatchBoost) * weight)`, `mustMatchBoost = 0.4`.
- Ánh xạ confidence: `>=0.7 high`, `>=0.4 medium`, còn lại `low`.
- Slot extraction cho `LOG_TRANSACTION` qua `parseMoneyText` (proxy ngược, có try/catch).
- Test suite 27 case, **27/27 PASS**. Lint sạch (exit 0). Không regression parser/foundation.

## Files changed

| File | Loại | Mô tả |
|---|---|---|
| `src/lib/aiMoneyChat/intent/types.ts` | NEW | `ChatIntentType` (12), `IntentConfidence`, `IntentPipeline`, `ChatReplySource`, `ChatReplyUiKind`, interface `ChatIntent`, `ChatReply`, `LogTransactionSlots`. |
| `src/lib/aiMoneyChat/intent/intentPatterns.ts` | NEW | `IntentPattern`, mảng `INTENT_PATTERNS` (10 pattern), `STOP_WORDS`, helper `getPatternPipeline()`. |
| `src/lib/aiMoneyChat/intent/intentClassifier.ts` | NEW | `normalize()`, `tokenize()`, `classifyIntent()`. |
| `src/lib/aiMoneyChat/intent/intentRouter.ts` | NEW | `routeIntent()` + slot extraction switch-case. |
| `tests/ai-money-intent.test.ts` | NEW | 27 test case (normalize/tokenize/classify/route). |
| `package.json` | EDIT | thêm script `test:ai-intent`. |

> Không sửa bất kỳ file hiện có nào ngoài `package.json` (chỉ thêm 1 dòng script).
> `parser.ts`, `useFinanceStore`, các handler cũ — **không đụng tới**.

## Quyết định kiến trúc cần Architect lưu ý

1. **Fold dấu ASCII cho keyword/regex.** `normalize()` fold dấu tiếng Việt (NFD strip + `đ→d`)
   GIỐNG `parser.ts`, nên keyword viết không dấu. Lý do: người Việt chat thường gõ không dấu;
   cách này khớp cả "tiền điện" lẫn "tien dien". (Khác với skeleton trong doc — doc giữ dấu;
   đã đổi cho đồng bộ codebase + robust hơn.)

2. **Bug đã phát hiện & vá: collision `tới`/`tôi`.** Cả hai fold ra `toi`. Ban đầu `toi` nằm
   trong `STOP_WORDS` → câu "mục tiêu mua xe **tới đâu**" bị nuốt mất "tới đâu" → GOAL rớt
   confidence. Đã **bỏ `toi` khỏi STOP_WORDS** (có comment cảnh báo). Không ảnh hưởng intent
   khác vì không keyword nào chỉ là `toi`.

3. **`pipeline` sống ở pattern, không nhúng vào type.** Cùng intent vẫn đổi pipeline runtime
   được (Phase sau: confidence thấp → đẩy LLM). `ChatIntent.pipeline` chỉ là "khuyến nghị".

4. **`FOLLOW_UP` chưa có pattern.** Theo thiết kế: detect bằng heuristic ("tại sao", "đó",
   "nó"...) tại `/api/chat` route ở **Phase 4**, không phải bằng keyword scoring.

5. **`LOG_TRANSACTION` nâng confidence theo parser.** Classifier hiểu nông (chỉ keyword);
   parser hiểu sâu (amount + category). Router lấy `maxConfidence(classifier, parser)` để
   "mua trứng 30k" (classifier medium) → high nhờ parser. Không làm sai các intent khác.

## Test Report — 12 câu thoại tiếng Việt sinh hoạt

Chạy: `npm run test:ai-intent`

| # | Câu nhập | Intent (argmax) | Score | Confidence | Hits |
|---|---|---|---|---|---|
| 1 | mua trứng 30k | `LOG_TRANSACTION` | 0.567 | medium → **high** (parser) | mua + digit |
| 2 | nhận lương 20tr | `LOG_TRANSACTION` | 0.733 | high | nhan, luong |
| 3 | tôi còn bao nhiêu tiền | `QUERY_BALANCE` | 0.475 | medium | con bao nhieu, bao nhieu tien |
| 4 | tiền điện đóng chưa | `QUERY_BILL_STATUS` | 0.600 | medium | regex dong…chua + dien |
| 5 | tiết kiệm tháng này được bao nhiêu | `QUERY_SAVINGS` | 0.500 | medium | tiet kiem |
| 6 | tháng này còn bao nhiêu để xài | `QUERY_SAFE_TO_SPEND` | 0.855 | high | regex con…xai + de xai |
| 7 | hôm nay tôi có việc gì | `QUERY_TASKS_TODAY` | 0.450 | medium | hom nay, viec gi |
| 8 | mục tiêu mua xe tới đâu rồi | `QUERY_GOAL_PROGRESS` | 0.450 | medium | muc tieu, toi dau |
| 9 | lên báo cáo CFO tháng này | `CFO_REPORT` | 0.550 | medium | bao cao, cfo |
| 10 | phân tích năng lực tài chính của tôi | `ANALYZE_FINANCE` | 0.500 | medium | phan tich, nang luc tai chinh |
| 11 | gợi ý cắt giảm chi tiêu | `ADVICE_CUT_SPENDING` | 0.500 | medium | cat giam, goi y |
| 12 | asdkfj qwerty | `UNKNOWN` | 0.000 | low | — |

**Argmax đúng 12/12.** Không câu hợp lệ nào rớt `low` (chỉ UNKNOWN là low — đúng kỳ vọng).

## Data logic

- `normalize`: lowercase → NFD strip dấu → `đ→d` → bỏ `.,!?;:()[]{}"'’` → collapse ws → trim.
- `tokenize`: split space, lọc `STOP_WORDS`.
- `classifyIntent`: argmax score qua `INTENT_PATTERNS`; mustMatch fail ⇒ loại pattern;
  0 hit & không mustMatch ⇒ loại; câu rỗng ⇒ UNKNOWN.
- `routeIntent`: `LOG_TRANSACTION` → `parseMoneyText` slot; intent khác → `slots = {}`.

## Tests

- `npm run test:ai-intent` → 27/27 PASS.
- `npm run test:ai-chat` (parser, regression) → PASS.
- `npm run test` (foundation, regression) → PASS.
- `npx eslint src/lib/aiMoneyChat/intent/ tests/ai-money-intent.test.ts` → exit 0.

## Rủi ro còn lại

- Công thức `keywordRatio = hits/total` **phạt danh sách keyword dài** → buộc giữ list ngắn
  (2-5 từ). Nếu muốn phủ rộng phrasing hơn mà vẫn confidence cao, Phase sau có thể cân nhắc
  đổi sang absolute scoring hoặc tách "core keyword" vs "alias". **Cần Architect quyết.**
- Chưa có Tier 3 (memory re-classify) và Tier 4 (LLM fallback) — đúng phạm vi Phase 1.
- Ambiguity giữa `CFO_REPORT`/`ANALYZE_FINANCE`/`ADVICE_CUT_SPENDING` khi câu chứa nhiều
  keyword chéo — argmax hiện ổn nhưng chưa test câu lai. Sẽ bổ sung khi vào Phase 3.

## Việc tiếp theo (Phase 2)

- `src/app/api/chat/route.ts` (endpoint POST duy nhất) — wire `LOG_TRANSACTION` trước.
- `aggregation/snapshotBuilder.ts` bản rút gọn (wallets/bills).
- Handlers deterministic: `handleQueryBalance`, `handleQueryBill`, `handleQueryTasks`…
- In-memory cache 5 phút.
