# Kế hoạch: Công việc + Ghi chú cho "Nhiệm vụ kiếm tiền"

> File công việc chính. Phiên mới: đọc file này + `docs/ARCHITECTURE.md` trước khi làm gì.
> Tạo 2026-10-08. Cập nhật mục "Trạng thái" mỗi khi xong một bước.

## Trạng thái hiện tại
- [~] Bước 0 — ĐANG LÀM (2026-10-08)
  - [x] 0.1 PO kiểm Vercel: Money Sync prod **TẮT** (2026-10-08).
  - [x] 0.2 PO quyết: **làm Đợt 1 trước**, bật sync là việc riêng làm sau (thiết kế v2 sẵn cho sync) ·
        ghi chú bản đầu **chỉ trên máy** (+ nút xuất file; cấu trúc sẵn để thêm mây sau).
  - [x] 0.3 Spec Đợt 1 `docs/SPEC_DOT_1_THU_VIEN_MAU.md` — **PO DUYỆT 2026-10-08**. Q1–Q4 PO chưa trả lời → dùng mặc định:
        Q1 giữ giá · Q2 tiền vào ví, chưa góp mục tiêu · Q3 đổi tên "Tài sản nhàn rỗi" · Q4 chat "khách chưa trả" để Đợt 2.
        Phát hiện: bấm "Xong" hiện KHÔNG tạo giao dịch thu + ghi actual = expected; task thiếu `updatedAt` (lỗi gộp sync).
  - [x] 0.4 4 mẫu thử `docs/design-probes/thu-vien-mau/so-sanh-4-mau.html` — **PO chọn D (2026-10-09)**.
- [~] **Đợt 1 — ĐANG LÀM**, nhánh `feat/earning-tasks-dot1` — **ĐÃ PUSH 2026-10-10** (`ffc0a3b`, PO cho phép). CHƯA mở PR, CHƯA merge.
  - [x] Tầng dữ liệu + logic (chưa đụng UI): `EarningTask` v2 (stage/updatedAt/khách/hẹn trả/incomeTxnId/templateId,
        trường optional + `getTaskStage` suy từ completedAt) · store v2 + `migrateTasksState` · `markWorkDone`/`undoMarkWorkDone` ·
        `completeTask` chặn lần 2 · `src/lib/tasks/receiveTaskPayment.ts` (giao dịch thu + XP + popup + undo exact,
        tổng khách nợ, số ngày trễ hẹn) · chat COMPLETE_EARNING_TASK đi chung đường + undo gỡ giao dịch ·
        CFO không tính "Chờ thanh toán" là trễ · `src/data/earningTemplates.ts` 34 mẫu + xếp theo La bàn.
        Test `npm run test:earning-tasks` 20/20 (đã gắn vào `test:ai-all`). ai-all/ai-money/money-sync/moneybrain xanh;
        `test:ai-persistence` còn 1 FAIL **có sẵn từ trước** ("finance rehydrate", fail cả trên code gốc).
  - [~] UI — **PO chọn mẫu D (2026-10-09)**, đã dựng (chưa commit): `EarningIdeasSheet` · `TaskSettleSheet`
        (Xong việc → nhận luôn / chờ thanh toán / hẹn lại) · `TaskUndoToast` · `TaskCard` mẫu D theo giai đoạn ·
        form 3 trường + "Thêm chi tiết" · dòng "Khách còn nợ" (bấm để lọc) · trạng thái rỗng 6 chủ đề.
        Nút "Xong" giờ đi `receiveTaskPayment`. Commit `ffc0a3b`.
  - [x] Redteam CODE: vòng 1 CHƯA ĐẠT (2 HIGH: CFO/chat đếm "Chờ thanh toán" là trễ) → sửa `27d8f30`;
        vòng 2 **ĐẠT** → sửa nốt MEDIUM/LOW `21c3d6f`. 31/31 test Đợt 1. Đã push.
  - [~] Redteam GIAO DIỆN: đang chạy (dev server cổng 54596).
  - ⚠️ TRƯỚC KHI BẬT MONEY SYNC: gộp giao dịch chưa có "bia mộ" → giao dịch đã Hoàn tác có thể sống lại
        từ cloud → nhận lại thành thu 2 lần. Cần `deletedTxnIds` đồng bộ theo (lỗi cũ, Đợt 1 làm lộ rõ).
  - Còn để lại: bẫy focus trong sheet (mới có trả focus).
        Trang xem thử tạm `src/app/(public)/zz-dot1-preview/` (chế độ giả lập, chỉ dev) — **KHÔNG commit, xoá khi xong**.
        ⚠️ Bộ chống spam IP trong RAM của dev server có thể chặn localhost khi tải trang dev nhiều → khởi động lại server.
- `main` = `0b0e19a` (PR #38 đã lên prod).

## Mục tiêu
Làm tab **Money → Nhiệm vụ kiếm tiền** sinh động hơn bằng công việc + ghi chú, lấy cảm hứng
từ app lịch/việc cần làm mà PO gửi ảnh (21 ảnh, 2026-10-08).

**Luật vàng:** mọi công việc và ghi chú phải DẪN VỀ TIỀN. Không biến ManiCash thành app to-do chung chung.

**Vòng lõi:**
```
Mẫu ý tưởng → Đang làm → Chờ thanh toán → Đã nhận tiền → tự ghi thu nhập → đổ vào Mục tiêu
```
"Chờ thanh toán" (khách còn nợ) là điểm khác biệt đắt nhất.

## Hiện trạng code liên quan
- Kiểu `EarningTask` ở `src/types/task.ts`: name, expectedAmount, actualAmount, startDate,
  endDate, subTasks, aiEval (có `suggestedPriceRange`), deletedAt/deleteReason.
- Store `src/stores/useTaskStore.ts`, key `manicash.tasks.v1`, version 1.
- UI: `src/app/(app)/money/_components/` — MoneyContent (tab Money/CFO), TaskCard,
  TaskFormModal, TaskEvalPanel, TaskOverdueDialog, HallOfFame.
- Có sẵn để tái dùng: La bàn năng lực (`CapacitySurveyCard`, `sovereignArchetype`),
  nhắc 21h (`DailyCheckinReminderGuard`), `useQuestStore`, bộ Fluent Emoji (MIT).

## Học gì / bỏ gì từ app mẫu
| Học | Bỏ / để sau |
|---|---|
| Thư viện mẫu theo chủ đề màu (giá trị nhất) | Mèo mascot — bản quyền của họ, dùng quản gia + Fluent Emoji |
| Thẻ "Hôm nay · N việc · %" + dải 7 ngày | Form ~15 trường → chỉ 3 trường bắt buộc, còn lại gập "Thêm chi tiết" |
| Việc mặc định Mở ngày / Đóng ngày | 4 kiểu xem lịch → để đợt 4 |
| Sổ tay có bìa | |

---

## Bước 0 — Điều kiện trước (làm TRƯỚC khi code)
1. **PO kiểm Vercel:** Settings → Environment Variables → Production →
   `NEXT_PUBLIC_MONEY_SYNC_ENABLED` = ? (Money Sync là gì: xem `docs/ARCHITECTURE.md` tầng 3.)
   - Nếu TẮT: nhiệm vụ/ghi chú chỉ nằm trên máy. PO quyết: bật đồng bộ trước, hay chấp nhận.
2. PO quyết: ghi chú có cần **sao lưu lên mây** từ đầu không.
3. Viết **spec đợt 1** (dữ liệu, màn hình, chữ trên giao diện, 30–36 mẫu ý tưởng) → PO duyệt.
4. Dùng agent `landing-decorator` dựng **4 mẫu thử** cho khối trọng tâm (thẻ chủ đề thư viện
   mẫu) → PO chọn phong cách. **Chưa đụng code UI khi PO chưa ra lệnh.**

## Đợt 1 — Thư viện mẫu + khép vòng việc → tiền (~3–4 ngày)
- [ ] **Thư viện ý tưởng kiếm tiền**: 6 chủ đề màu — Bán hàng online · Nhận việc tự do ·
      Dạy kèm · Thanh lý đồ cũ · Làm thêm cuối tuần · Tiền nhàn rỗi. Mỗi chủ đề 5–6 mẫu,
      mỗi mẫu = việc có sẵn checklist + khung giá gợi ý + thời gian thường mất. Bấm + là tạo.
      Dữ liệu tĩnh ở `src/data/`. Gợi ý theo La bàn năng lực nếu người dùng đã làm khảo sát.
- [ ] **Trạng thái "Chờ thanh toán"** + trường người trả tiền (khách).
- [ ] **Bấm Xong → "Nhận được bao nhiêu?"** → một chạm tạo giao dịch thu + XP + quản gia khen;
      lệch so với kỳ vọng thì lưu để CFO phân tích.
- [ ] **Migrate `useTaskStore` v1 → v2** (thêm trường mới) + test migrate như các store lõi.
- [ ] Dòng tổng "Khách còn nợ X từ N việc" trên tab Money.

## Đợt 2 — Thẻ Hôm nay (~3–4 ngày)
- [ ] Thẻ Hôm nay: dải 7 ngày + vòng % + gom bước checklist có hạn hôm nay.
- [ ] 2 thói quen mặc định "Mở ngày: xem hôm nay kiếm gì" / "Đóng ngày: ghi thu chi" (nối nhắc 21h).
- [ ] Nhiệm vụ: lặp lại · nhắc nhở · ghim · link (Facebook/Shopee).
- [ ] Cắm vào `useQuestStore` + `useTaskStore`. KHÔNG tạo hệ nhiệm vụ thứ ba.

## Đợt 3 — Sổ tay kiếm tiền (~4–5 ngày)
- [ ] Dựng lớp IndexedDB bằng Dexie (chưa có sẵn). KHÔNG lưu ghi chú vào localStorage (~5MB).
- [ ] Mẫu ghi chú: Ghi chú khách hàng · Ý tưởng kiếm tiền (nút "biến thành nhiệm vụ") · Báo giá ·
      Bài học sau mỗi việc.
- [ ] Gắn ghi chú vào nhiệm vụ. Bìa sổ để chọn.
- [ ] Mã PIN khoá sổ (tài khoản có thể bị dùng chung).
- [ ] Nếu sao lưu mây: mỗi ghi chú 1 document `users/{uid}/notes/{noteId}`, ảnh lên Firebase
      Storage. KHÔNG nhét vào `money/state` (trần 1MB).
- [ ] **Ghi chú KHÔNG BAO GIỜ vào CRM/snapshot** — thông báo đồng ý đã hứa "Không lấy ghi chú".
      Quản gia muốn đọc ghi chú thì người dùng tự bấm cho phép mỗi lần.

## Đợt 4 — Để sau, chỉ làm khi số liệu cho thấy cần
- [ ] Lịch tháng hiện tiền dự kiến về theo ngày.

## Chỉ số đo
- % người dùng mới tạo việc đầu tiên trong 7 ngày.
- % việc đi tới "Đã nhận tiền".
- Tổng tiền "Chờ thanh toán" người dùng ghi.

## Luật làm việc (bắt buộc)
- Không push / merge khi PO chưa đồng ý. Commit message tiếng Anh, ngắn.
- Không đụng code giao diện khi PO chưa ra lệnh. Đổi UI trông thấy được → cho PO xem ảnh TRƯỚC khi merge.
- "Thu gọn" không phải "xoá hết": ràng buộc tự đặt mà đòi xoá NỘI DUNG thì dừng lại hỏi.
- Trước khi dùng biến CSS: `grep -c -- "--tên:"` xem có tồn tại. Token thật: `--c-*`.
- Phần tử là `motion.div` thì KHÔNG canh giữa bằng `transform` (Framer ghi đè) → dùng `margin-inline:auto`.
- Mọi nơi sinh giao dịch giữ id dạng `txn-${Date.now()}-${rand}` (usageMetrics đọc mốc từ id).
- Store mới phải dùng `simulationAwareStorage` + `persistConfig`.
- Thay đổi luồng AI chat phải có test trong `tests/`.

## Việc treo từ phiên trước (không thuộc dự án này)
- PO kiểm Admin → CRM hành vi đã có dòng của `doduongquang8686@` chưa (sau PR #38).
- PO tự thử giả lập hai tab để xác nhận cách ly.
- Thư mục `src/app/(public)/xem-thu-chi/` untracked — PO chưa cho xoá.
- 2 cảnh báo lint có sẵn ở `SovereignInvite.tsx:101` (setState trong effect).
- Bảo mật nhẹ: cookie `manicash-session` không ký (xem ARCHITECTURE mục 3).
