# Spec Đợt 1 — Thư viện mẫu + khép vòng Việc → Tiền

> Trạng thái: **NHÁP, chờ PO duyệt** (2026-10-08). Kế hoạch tổng: `docs/PLAN_CONG_VIEC_GHI_CHU.md`.
> Quyết định Bước 0 đã chốt: Money Sync prod **TẮT** → làm Đợt 1 trước, dữ liệu vẫn sống trên máy,
> nhưng thiết kế để khi bật sync thì chạy đúng. Ghi chú (Đợt 3) bản đầu **chỉ trên máy**.

## 0. Hai phát hiện khi đọc code (lý do Đợt 1 quan trọng)
1. **Vòng việc → tiền hiện ĐANG HỞ.** Bấm "Xong" ở `MoneyContent.tsx:96` ghi `actualAmount = expectedAmount`
   (không hỏi nhận thật bao nhiêu) và **không tạo giao dịch thu nào**. Tiền kiếm từ nhiệm vụ không vào
   số dư, không vào báo cáo, không vào mục tiêu. Lệnh chat `COMPLETE_EARNING_TASK` cũng vậy.
2. **Nhiệm vụ không có `updatedAt`.** Bộ gộp đồng bộ (`moneySync/merge.ts` → `pickTimestamp`) lấy
   `updatedAt → completedAt → createdAt`. Sửa nhiệm vụ trên 2 máy thì bản cũ có thể thắng. v2 thêm
   `updatedAt` để khi bật sync không bị lỗi này.

## 1. Phạm vi
**Làm:** thư viện 34 mẫu (6 chủ đề) · trạng thái "Chờ thanh toán" + tên khách · hộp "Nhận được bao nhiêu?"
tạo giao dịch thu thật · migrate store v1→v2 · dòng tổng "Khách còn nợ" · sửa lệnh chat cho khớp.
**Không làm (để đợt sau):** thẻ Hôm nay, lặp lại/nhắc nhở, ghi chú, lịch, nhận tiền nhiều lần (trả góp),
tự đổ tiền vào mục tiêu (xem câu hỏi mở Q2).

## 2. Dữ liệu

### 2.1 `EarningTask` v2 (`src/types/task.ts`) — chỉ THÊM trường, không đổi nghĩa trường cũ
```ts
export type TaskStage = 'doing' | 'awaiting_payment' | 'paid';

interface EarningTask {
  // ...toàn bộ trường v1 giữ nguyên...
  stage: TaskStage;            // v2. 'paid' ⇔ completedAt có giá trị (giữ HallOfFame/getTotalEarned chạy y cũ)
  updatedAt: string;           // v2. ISO, đổi ở MỌI thao tác sửa → bộ gộp sync chọn đúng bản mới
  payerName?: string;          // v2. Tên khách/người trả, tự do, ≤ 60 ký tự
  paymentDueDate?: string;     // v2. Hẹn ngày khách trả (tuỳ chọn)
  workDoneAt?: string;         // v2. Lúc bấm "Xong việc" (vào Chờ thanh toán)
  incomeTxnId?: string;        // v2. id giao dịch thu đã tạo — để hoàn tác xoá đúng giao dịch
  templateId?: string;         // v2. Mẫu gốc (đo chỉ số "mẫu nào ra tiền")
}
```
`completedAt` giữ nghĩa **"đã nhận tiền"** (vòng khép).

### 2.2 Migrate v1 → v2 (`STORE_VERSIONS.tasks` 1 → 2)
| Nhiệm vụ v1 | Thành v2 |
|---|---|
| có `completedAt` | `stage='paid'`, `updatedAt=completedAt` |
| có `deletedAt` | `stage='doing'` (giữ nguyên `deletedAt`, vẫn bị ẩn như cũ) |
| còn lại | `stage='doing'`, `updatedAt=createdAt` |

⚠️ **KHÔNG tạo bù giao dịch thu cho nhiệm vụ cũ** — người dùng có thể đã tự ghi tay → tạo bù là đếm đôi.
Test migrate theo mẫu các store lõi: dữ liệu rỗng, hỏng, v1 đủ 3 loại, chạy migrate 2 lần không đổi.

### 2.3 Trạng thái hiển thị (thay `getTaskStatus`)
| stage | Điều kiện | Nhãn | Phạt trễ |
|---|---|---|---|
| doing | trước `startDate` | Sắp tới | — |
| doing | trong hạn | Đang làm | — |
| doing | quá `endDate` | Trễ hạn | như cũ (hộp lý do, −15 XP) |
| awaiting_payment | chưa tới/không có `paymentDueDate` | Chờ thanh toán | **không** |
| awaiting_payment | quá `paymentDueDate` | Khách trễ hẹn | **không** (lỗi khách, không phạt người dùng) |
| paid | | Đã nhận tiền | — |

### 2.4 Đồng bộ (khi sau này bật)
Nhiệm vụ đã nằm trong `money/state` → trường mới tự đi theo. Cần: `serialize.ts` đọc được v1 lẫn v2 từ
cloud (máy cũ chưa cập nhật đẩy v1 lên) → chạy cùng hàm migrate khi đọc. Có test.
`payerName` là **dữ liệu cá nhân bên thứ ba** → KHÔNG đưa vào `metric_snapshots`/CRM (kiểm
`MetricSnapshotCollector` chỉ đếm số lượng, không lấy chuỗi).

### 2.5 Mẫu ý tưởng (`src/data/earningTemplates.ts`, dữ liệu tĩnh)
```ts
interface EarningTemplate {
  id: string;                 // 'sell-preorder-snacks' — KHÔNG đổi sau khi phát hành
  themeId: EarningThemeId;
  emoji: string;              // Fluent Emoji có sẵn
  name: string;
  priceRange: { min: number; max: number; unit: 'lượt' | 'buổi' | 'ca' | 'ngày' | 'tháng' | 'đợt' | 'bộ' | 'trang' };
  typicalDays: number;        // đặt endDate = hôm nay + typicalDays
  steps: string[];            // 3–5 bước → subTasks
  incomeCategory: 'freelance' | 'business' | 'other-in';  // danh mục thu khi nhận tiền
  skills: string[];           // id trong SKILL_OPTIONS → gợi ý theo La bàn năng lực
}
```
Bấm + trên mẫu → mở form đã điền sẵn (tên, tiền kỳ vọng = **giữa khung giá**, hạn, checklist) → người
dùng sửa được → Lưu. Không tạo thẳng không qua form (tránh rác).

## 3. Màn hình & luồng (chỉ mô tả; hình thức thị giác chốt ở Bước 0.4)

### 3.1 Thư viện mẫu
- Lối vào: nút **"✨ Gợi ý việc kiếm tiền"** cạnh nút tạo nhiệm vụ ở tab Money; và trạng thái rỗng
  (chưa có nhiệm vụ nào) hiện thẳng 6 chủ đề.
- Mở dạng sheet: hàng chip 6 chủ đề → danh sách thẻ mẫu (emoji · tên · "150–500k/bộ · ~2 ngày" · nút +).
- Đã làm khảo sát La bàn: chủ đề hợp nhất lên đầu + nhãn **"Hợp với bạn"**. Chưa làm: thứ tự mặc định
  + một dòng mời "Làm khảo sát 1 phút để gợi ý đúng hơn" (không chặn).

### 3.2 Form nhiệm vụ — 3 trường bắt buộc
Tên việc · Kỳ vọng nhận (đ) · Hạn xong. Gập trong **"Thêm chi tiết"**: Khách/người trả · Ngày bắt đầu
(mặc định hôm nay) · Hẹn ngày trả tiền · Checklist.

### 3.3 Thẻ nhiệm vụ theo giai đoạn
- **Đang làm:** nút chính **"Xong việc"** → hỏi nhanh 2 lựa chọn:
  `Đã nhận tiền luôn` (→ 3.4) · `Khách chưa trả` (→ Chờ thanh toán, đặt `workDoneAt`).
- **Chờ thanh toán:** nhãn vàng, dòng "Khách: Chị Lan · hẹn 15/10", nút **"Đã nhận tiền"** (→ 3.4),
  nút phụ "Nhắc lại sau" (chỉ đổi hẹn ngày).

### 3.4 Hộp "Nhận được bao nhiêu?"
- Ô tiền điền sẵn số kỳ vọng, chọn ví nhận (mặc định ví chính; có tiền mặt), danh mục thu theo mẫu
  (sửa được), ngày nhận = hôm nay (lùi tối đa 30 ngày — luật sẵn có của `addTransaction`).
- Bấm **Ghi nhận** = một chạm làm 4 việc: tạo giao dịch thu (`txn-<ms>-<rand>`, ghi chú
  "Nhiệm vụ: <tên>") · `stage='paid'` + `completedAt` + `actualAmount` + `incomeTxnId` · cộng XP
  TASK_COMPLETE (một lần) · confetti + quản gia khen.
- Lệch ≥ 20% so với kỳ vọng: quản gia nói một câu (thấp: "Lần sau báo giá cao hơn chút nhé";
  cao: "Khách trả hơn mong đợi 👏"). Cả 2 số đều đã lưu → CFO đọc được về sau.
- **Hoàn tác** (toast 5 giây + undo chat): xoá đúng giao dịch `incomeTxnId`, trả XP, về lại stage trước.

### 3.5 Dòng tổng trên tab Money
**"Khách còn nợ 1.250.000đ từ 3 việc"** (cộng `expectedAmount` các việc Chờ thanh toán). Bấm → lọc danh
sách chỉ còn việc Chờ thanh toán. 0 việc thì ẩn dòng.

### 3.6 Chat
Lệnh `COMPLETE_EARNING_TASK` đi qua **cùng một hàm** nhận tiền như 3.4 (tạo giao dịch thu + undo đúng).
Có test trong `tests/` (luật dự án). Thêm hiểu câu "khách chưa trả" → đưa vào Chờ thanh toán — **để Q4**.

## 4. Chữ trên giao diện (bản nháp)
| Chỗ | Chữ |
|---|---|
| Nút mở thư viện | ✨ Gợi ý việc kiếm tiền |
| Tiêu đề sheet | Hôm nay kiếm thêm bằng gì? |
| Chú thích giá | Giá tham khảo, tuỳ khu vực và tay nghề |
| Nhãn gợi ý | Hợp với bạn |
| Nút xong | Xong việc |
| Câu hỏi | Khách trả tiền chưa? → **Đã nhận tiền luôn** / **Khách chưa trả** |
| Hộp nhận tiền | Nhận được bao nhiêu? · Vào ví · Ghi nhận |
| Toast | Đã ghi +350.000đ vào ví chính · Hoàn tác |
| Dòng tổng | Khách còn nợ {X} từ {N} việc |
| Nhãn trễ | Khách trễ hẹn {n} ngày |
| Rỗng | Chưa có việc nào. Chọn một ý tưởng bên dưới, 30 giây là bắt đầu. |

## 5. Thư viện mẫu — 34 mẫu, 6 chủ đề
Giá là khung tham khảo thị trường VN, **PO kiểm lại cho hợp người dùng của mình**.

### 🛍️ Bán hàng online (6) — thu: `business`
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 1 | 🍪 Bán đồ ăn vặt nhận đặt trước | 300k–1,5tr/đợt | 3 | Chốt menu + giá vốn · Đăng bài nhận đặt · Thu cọc khi chốt đơn · Làm & giao · Thu nốt tiền |
| 2 | 🌹 Bán hàng theo dịp (20/10, Trung thu, Tết) | 500k–3tr/đợt | 10 | Chọn 1 món theo dịp · Hỏi giá 2 nguồn hàng · Đăng bài trước dịp 7 ngày · Chốt đơn + cọc · Giao đúng ngày |
| 3 | 🧶 Bán đồ handmade | 200k–1tr/đợt | 7 | Làm 5–10 mẫu · Chụp ảnh nền sáng · Đăng Facebook/Shopee · Trả lời tin nhắn trong ngày · Đóng gói & giao |
| 4 | 📦 Nhận đặt hàng hộ từ nguồn quen | 300k–2tr/đợt | 7 | Chọn 1 nguồn tin cậy · Giá bán = vốn + ship + lãi · Đăng 3 bài · Thu cọc 50% · Giao & thu đủ |
| 5 | 🏪 Mở gian Shopee/TikTok Shop 1 món chủ lực | 500k–3tr/tháng | 14 | Chọn 1 sản phẩm · Đăng ký gian · Đăng sản phẩm có ảnh thật · Làm 1 clip ngắn · Đơn đầu tiên |
| 6 | 🌵 Bán sen đá / cây cảnh nhỏ | 200k–800k/đợt | 14 | Nhân giống hoặc nhập 20 chậu · Chụp ảnh từng chậu · Đăng nhóm cây cảnh · Hẹn giao |

### 💻 Nhận việc tự do (6) — thu: `freelance`
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 7 | 🎨 Thiết kế bài đăng / banner cho shop nhỏ | 150k–500k/bộ | 2 | Hỏi rõ yêu cầu + màu thương hiệu · Gửi 2 phương án · Sửa tối đa 2 lần · Giao file · Thu tiền |
| 8 | ✍️ Viết gói 10 caption bán hàng | 300k–1tr/bộ | 3 | Đọc trang khách · Viết 2 bài mẫu cho duyệt · Viết đủ 10 · Giao & thu tiền |
| 9 | 🎬 Dựng video ngắn cho quán | 200k–700k/lượt | 2 | Nhận cảnh quay · Dựng bản nháp · Sửa 1 lần · Xuất đúng khổ dọc · Thu tiền |
| 10 | 📊 Nhập liệu / làm bảng Excel | 200k–800k/lượt | 2 | Chốt mẫu đầu ra · Làm 10% gửi khách duyệt · Làm hết · Kiểm lỗi · Thu tiền |
| 11 | 🌐 Dịch tài liệu Anh–Việt | 80k–150k/trang | 3 | Báo giá theo trang · Thu cọc · Dịch · Soát lại 1 lượt · Giao & thu nốt |
| 12 | 📸 Chụp ảnh sản phẩm cho shop | 300k–1,5tr/buổi | 1 | Chốt số sản phẩm + phong cách · Chuẩn bị nền & đèn · Chụp · Chỉnh màu · Giao ảnh & thu tiền |

### 📚 Dạy kèm (5) — thu: `freelance`
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 13 | ✏️ Gia sư Toán/Văn cấp 1–2 | 1,2–2tr/tháng | 30 | Chốt lịch với phụ huynh · Kiểm tra đầu vào · Lộ trình 4 tuần · Báo kết quả cuối tháng · Thu học phí |
| 14 | 🗣️ Kèm tiếng Anh giao tiếp online 1-1 | 1,5–3tr/tháng | 30 | Buổi thử miễn phí 20 phút · Chốt mục tiêu · Lịch 8 buổi · Thu học phí đầu tháng |
| 15 | 🎸 Dạy guitar/ukulele/piano cơ bản | 1,2–2,5tr/tháng | 30 | Chuẩn bị giáo trình 8 buổi · Tìm 1 học viên quen · Dạy · Quay clip tiến bộ gửi học viên · Thu học phí |
| 16 | 🎯 Luyện thi phần mình giỏi (IELTS/TOEIC…) | 2–4tr/khoá | 30 | Chọn đúng 1 kỹ năng · Soạn đề luyện · Mở nhóm 3–5 người · Thi thử cuối khoá · Thu học phí |
| 17 | 💻 Dạy tin học văn phòng cho người lớn | 500k–1,5tr/khoá | 14 | Soạn 5 buổi (Word, Excel, Zalo, email) · Tìm học viên qua người quen · Dạy · Thu tiền |

### ♻️ Thanh lý đồ cũ (6) — thu: `other-in`
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 18 | 👕 Thanh lý quần áo không mặc | 200k–1tr/đợt | 7 | Lọc đồ không mặc 6 tháng · Giặt, là · Chụp ảnh treo · Đăng nhóm pass đồ · Giao/hẹn gặp |
| 19 | 📱 Bán lại điện thoại/laptop cũ | 1–8tr/lượt | 7 | Sao lưu, xoá dữ liệu, đăng xuất mọi tài khoản · Xem giá 3 nơi · Chụp ảnh + ghi lỗi trung thực · Gặp nơi đông người, nhận đủ tiền mới giao |
| 20 | 📖 Pass sách / giáo trình cũ | 100k–500k/đợt | 7 | Gom sách · Chụp gáy sách thành 1 ảnh · Đăng nhóm sách cũ · Giao |
| 21 | 🍼 Bán đồ em bé đã dùng (xe đẩy, nôi…) | 300k–2tr/đợt | 7 | Vệ sinh sạch · Chụp ảnh đủ góc · Đăng nhóm mẹ bỉm · Hẹn xem hàng · Thu tiền |
| 22 | 🏠 Thanh lý đồ gia dụng khi chuyển nhà | 500k–3tr/đợt | 10 | Lập danh sách + giá · Đăng 1 bài gộp · Ưu tiên khách tự chở · Thu tiền |
| 23 | 🗞️ Bán ve chai, giấy, lon | 50k–200k/lượt | 1 | Phân loại giấy/nhựa/kim loại · Gọi người thu mua · Cân & nhận tiền |

### ⏰ Làm thêm cuối tuần (6) — thu: `freelance`
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 24 | 🎉 Phục vụ tiệc cưới / sự kiện | 200k–400k/ca | 2 | Vào nhóm tuyển ca · Đăng ký ca · Chuẩn bị đồng phục · Làm ca · Nhận tiền cuối ca |
| 25 | 🛵 Chạy giao hàng / xe công nghệ cuối tuần | 300k–700k/ngày | 2 | Kiểm tra xe + giấy tờ · Chọn khung giờ cao điểm · Chạy · Ghi thu sau khi trừ xăng & phí app |
| 26 | 🐶 Trông trẻ / trông nhà / chăm thú cưng hộ | 150k–400k/ngày | 2 | Chốt việc cụ thể + giờ · Lưu số người nhà · Làm · Gửi ảnh cập nhật · Nhận tiền |
| 27 | 🧹 Dọn nhà theo giờ | 80k–120k/giờ | 1 | Chốt số giờ + việc · Mang dụng cụ cần · Làm · Khách kiểm · Nhận tiền |
| 28 | 🛒 PG/PB, phát mẫu thử ở siêu thị | 250k–500k/ca | 2 | Ứng tuyển qua nhóm việc · Học thông tin sản phẩm · Làm ca · Nhận tiền |
| 29 | 🍳 Phụ bếp / phụ quán | 200k–350k/ca | 2 | Hỏi quán quen gần nhà · Chốt ca · Làm · Nhận tiền |

### 🔑 Tài sản nhàn rỗi (5) — thu: `other-in` · *đề xuất đổi tên từ "Tiền nhàn rỗi" — xem Q3*
| # | Mẫu | Giá | Ngày | Các bước |
|---|---|---|---|---|
| 30 | 🛏️ Cho thuê phòng trống / ở ghép | 1,5–4tr/tháng | 14 | Dọn & chụp phòng · Đăng tin có giá rõ · Hợp đồng ngắn + cọc · Khai báo tạm trú · Thu tiền tháng đầu |
| 31 | 📷 Cho thuê đồ ít dùng (máy ảnh, lều, váy dạ hội) | 100k–500k/lượt | 3 | Chụp ảnh + ghi tình trạng · Đặt tiền cọc · Biên bản giao/nhận · Kiểm đồ khi trả · Nhận tiền |
| 32 | 🏍️ Cho thuê chỗ để xe / kho nhỏ | 200k–600k/tháng | 7 | Đo chỗ · Hỏi hàng xóm/khu trọ gần · Thoả thuận giờ ra vào · Thu tiền tháng |
| 33 | 🗂️ Bán file mẫu làm một lần bán nhiều lần (Canva, Excel) | 50k–1tr/tháng | 14 | Làm 1 mẫu thật tốt · Đăng lên 1 kênh bán · Viết hướng dẫn dùng · Đơn đầu tiên |
| 34 | 🌄 Bán ảnh/video tự chụp lên kho ảnh | 50k–500k/tháng | 14 | Chọn 20 ảnh đẹp nhất · Đăng ký 1 kho ảnh · Gắn từ khoá · Theo dõi lượt bán |

### Gợi ý theo La bàn năng lực (kỹ năng → chủ đề lên đầu)
`sales, marketing, handcraft` → Bán hàng online · `writing, design, coding, video, finance` → Nhận việc tự do ·
`teaching, language, counsel` → Dạy kèm · `ops` → Làm thêm cuối tuần. Thanh lý đồ cũ + Tài sản nhàn rỗi
luôn hiện (không cần kỹ năng). Trong chủ đề, mẫu có `skills` trùng nhiều nhất lên trước.

## 6. Kỹ thuật & test
- File mới: `src/data/earningTemplates.ts`, `src/lib/tasks/receiveTaskPayment.ts` (hàm nhận tiền dùng
  chung cho UI + chat, thuần, dễ test).
- Sửa: `src/types/task.ts`, `src/stores/useTaskStore.ts` (v2, migrate, `markWorkDone`,
  `receivePayment`, `updatedAt` ở mọi setter), `persistConfig.ts` (version), `clientActionExecutor.ts`,
  `moneySync/serialize.ts` (đọc v1), các component trong `money/_components/` (**chỉ khi PO ra lệnh UI**).
- Test (`tests/`): migrate v1→v2 · nhận tiền tạo đúng 1 giao dịch + XP 1 lần · undo xoá đúng giao dịch ·
  bấm 2 lần không tạo 2 giao dịch · chat COMPLETE_EARNING_TASK đi đúng đường mới · serialize đọc v1 ·
  dữ liệu mẫu hợp lệ (id duy nhất, min ≤ max, 3–5 bước, `skills` thuộc SKILL_OPTIONS, đủ 6 chủ đề).
- `npm run test:ai-all`, `tsc`, `lint`, `build` sạch trước khi xin PO xem ảnh.

## 7. Câu hỏi mở cho PO
- **Q1 — Giá mẫu:** khung giá ở mục 5 tôi ước theo thị trường; anh sửa giá nào thấy lệch.
- **Q2 — Đổ vào Mục tiêu:** Đợt 1 tiền vào **ví**; người dùng tự góp vào mục tiêu như hiện nay.
  Hay muốn hộp nhận tiền có thêm ô "Góp ngay ___ vào mục tiêu ___"? (thêm ~0,5 ngày)
- **Q3 — Tên chủ đề 6:** "Tiền nhàn rỗi" dễ hiểu nhầm thành gửi tiết kiệm/đầu tư (mà app không tư vấn đầu tư).
  Đề xuất **"Tài sản nhàn rỗi"** — cho đồ/chỗ/file đang để không đẻ ra tiền. Đồng ý không?
- **Q4 — Chat "khách chưa trả":** cho chat hiểu luôn câu kiểu "xong job logo rồi mà khách chưa trả" ở Đợt 1,
  hay để Đợt 2? (thêm parser + test, ~0,5 ngày)
