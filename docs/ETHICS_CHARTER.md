# ManiCash — Hiến chương Đạo đức Dữ liệu (Ethics Charter)

> Cơ sở đạo đức + pháp lý cho **mọi tầng consent** của ManiCash — đặc biệt tầng sâu
> (money sync, khảo sát năng lực, tư vấn nghề, tầng chữa lành sau này). Bắt buộc đọc
> trước khi bật bất kỳ tính năng nào chạm dữ liệu tài chính hành vi.
>
> Nền câu chữ người dùng: `docs/DATA_FOR_GROWTH.md`. Kịch bản tier sâu: `docs/BUTLER_PHU_VUONG_SCRIPT.md`.
> Ràng buộc pháp lý VN: **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu cá nhân.

---

## 1. Nguyên tắc bất biến

1. ✅ **Chỉ dữ liệu trong app** — số liệu người dùng tự nhập/tự thao tác. Không hơn.
2. ❌ **Không đời tư:** không tin nhắn, danh bạ, vị trí, ảnh, micro, không nghe lén.
3. ❌ **Không dữ liệu sâu trong máy**, không đụng tín dụng/ngân hàng thật.
4. 🔒 **Ẩn danh & tổng hợp** khi dùng cho R&D. **Không bán dữ liệu.**
5. 🎚️ **Tự nguyện & thu hồi được:** bật = người dùng chủ động đồng ý; tắt/xoá bất cứ lúc nào;
   app vẫn chạy đủ khi từ chối, chỉ mất phần gợi ý cá nhân hoá.
6. 🙋 **Hành động phải xin phép:** quản gia KHÔNG BAO GIỜ tự thực thi thay đổi dữ liệu/tiền —
   mọi đề xuất là card mềm, người dùng bấm đồng ý mới chạy.

---

## 2. Phân loại dữ liệu & mức nhạy cảm

| Nhóm | Ví dụ | Nhạy cảm | Consent tối thiểu |
|---|---|---|---|
| **Vận hành cơ bản** | Giao dịch, danh mục, số dư (lưu để app chạy) | Thấp | Không cần (chức năng cốt lõi) |
| **Tổng hợp R&D** | Health score/ngày, streak, snapshot ẩn danh | Trung bình | Tier **Thông thái** (`analyticsConsent`) |
| **Hành vi đồng bộ** | Money sync đa thiết bị (thu/chi/ngân sách/mục tiêu theo uid) | **Cao** (NĐ 13/2023) | Tier **Phú Vương** (opt-in per-user) |
| **Năng lực & nghề** | Khảo sát kỹ năng, thời gian rảnh, nguồn thu | **Cao** | Tier **Phú Vương** + đồng ý khảo sát riêng |

> Từ "Hành vi đồng bộ" trở xuống = **dữ liệu cá nhân nhạy cảm** theo NĐ 13/2023 → cần
> **đồng ý rõ ràng, tách bạch, có thể rút lại**.

---

## 3. Ba tầng consent (ánh xạ vào tier quản gia)

- **Tầng 1 — Vận hành:** ngầm định (không có = app không chạy). Minh bạch trong Chính sách.
- **Tầng 2 — Cá nhân hoá tổng hợp:** = bật tier **Thông thái**. Ẩn danh, dùng cho gợi ý + R&D
  "người dùng tốt lên". Không hồi tố. (`/api/telemetry/consent`).
- **Tầng 3 — Đồng hành sâu:** = bật tier **Phú Vương**. Gồm money sync + khảo sát năng lực.
  Câu chữ + 6 cam kết đã khoá ở `BUTLER_PHU_VUONG_SCRIPT.md §3`. Mỗi năng lực chủ động vẫn
  phải **xin phép từng lần** (nguyên tắc §1.6).

Mỗi tầng **tách bạch**: đồng ý tầng 2 không tự kéo theo tầng 3. Rút tầng 3 không mất tầng 2.

---

## 4. Quyền của người dùng (NĐ 13/2023)

- **Xem/biết** dữ liệu nào đang được lưu (trang minh bạch trong Hồ sơ).
- **Rút đồng ý** bất cứ lúc nào → dừng thu ngay, không phạt tính năng cốt lõi.
- **Xoá:** xoá tài khoản → xoá sạch (snapshot, money sync doc, capacity report). Đã có ở
  luồng xoá tài khoản hiện tại — mở rộng cho doc mới của Phú Vương.
- **Mang đi (portability):** export dữ liệu người dùng (đã có `exportUserData`).
- **Không bị quyết định tự động gây hại:** mọi đề xuất chỉ là gợi ý, người dùng toàn quyền.

---

## 5. Ranh giới tuyệt đối

- **Không bán / không chia sẻ** dữ liệu cá nhân cho bên thứ ba.
- **DuongQuang.Academy** chỉ deep-link/read-only — **không** đẩy dữ liệu tài chính người dùng sang.
- **Không** dùng dữ liệu nhạy cảm để quảng cáo nhắm mục tiêu bên ngoài.
- **Không** suy luận/lưu thông tin ngoài phạm vi tài chính-trong-app (sức khoẻ, chính trị, tôn giáo…).
- Tầng "chữa lành" tương lai (dữ liệu cảm xúc/tâm lý tiền bạc) = **nhạy cảm nhất** → phải có
  consent riêng + review đạo đức trước khi xây.

---

## 6. Quản trị & minh bạch

- **Audit log** (`admin_audit`) cho mọi thao tác admin chạm dữ liệu người dùng.
- **Ẩn danh hoá** ở tầng R&D: tách định danh khỏi số liệu phân tích.
- **Tối thiểu hoá:** chỉ thu field thật sự cần cho gợi ý; không thu "để dành".
- **Rà soát định kỳ** hiến chương này khi thêm tính năng chạm dữ liệu mới.

---

## 7. Cam kết một câu (cho người dùng)

> *"ManiCash chỉ dùng chính số liệu bạn ghi trong app — để giúp bạn tiến bộ và nhận gợi ý
> đúng. Không đời tư, không nghe lén, không bán dữ liệu. Bạn tắt hoặc xoá bất cứ lúc nào."*
