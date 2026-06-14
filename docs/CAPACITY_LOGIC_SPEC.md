# CAPACITY_LOGIC_SPEC — Weighted Scoring 4 chỉ số năng lực (M4)

> Nguồn: Manus AI "Đặc Tả Thuật Toán Hệ Số Trọng Số" v1.0. Dùng cho **M4 (Sản phẩm 2 — Năng lực)**. Bản chuẩn hóa cuối sẽ tinh chỉnh theo dữ liệu thực thu từ M1–M3.

## Triết lý
Không dùng ngưỡng cứng (binary). Mỗi chỉ số = tổng các thành phần × trọng số, chuẩn hóa 0–100. **80% deterministic (backend), 20% AI** (chỉ phần nhận xét cuối). Phân nhóm theo **phân phối điểm** (nhận diện Hybrid).

Công thức: `S = Σ (sᵢ × wᵢ)`, với `sᵢ` chuẩn hóa 0–100.

## 4 chỉ số & trọng số thành phần

### FDS — Kỷ luật tài chính
| Thành phần | Trọng số | Nguồn |
|---|---|---|
| Logging Consistency | 40% | tỉ lệ ngày có ghi giao dịch / 30 ngày |
| Budget Adherence | 30% | tỉ lệ danh mục không vượt ngân sách |
| Goal Commitment | 20% | tần suất nạp tiền vào Mục tiêu lớn |
| Streak Maintenance | 10% | chuỗi ngày dùng app liên tục |

### TAS — Nhạy bén công nghệ
| Thành phần | Trọng số | Nguồn |
|---|---|---|
| AI Interaction | 50% | tần suất dùng Chat + lệnh `/` |
| Feature Exploration | 30% | số tính năng nâng cao đã dùng (CFO, SMS Sync, Export) |
| Onboarding Speed | 20% | thời gian hoàn thành 7 onboarding quest |

### IPS — Tiềm năng thu nhập
| Thành phần | Trọng số | Nguồn |
|---|---|---|
| Skill Diversity | 40% | số kỹ năng khai báo (survey) |
| Earning Task Completion | 40% | tỉ lệ hoàn thành Earning Task |
| Free Time Availability | 20% | quỹ thời gian rảnh (survey) |

### MMS — Tư duy thịnh vượng
| Thành phần | Trọng số | Nguồn |
|---|---|---|
| Emergency Fund Ratio | 40% | quỹ khẩn cấp / chi tiêu tháng |
| Investment Mindset | 30% | tần suất xem báo cáo CFO + phân tích |
| Growth Orientation | 30% | đánh giá AI qua câu hỏi tư vấn trong chat |

## Ma trận phân loại nghề (theo phân phối điểm)
| Nhóm | Primary | Secondary |
|---|---|---|
| Sáng tạo Nội dung | TAS > 70 | IPS > 50 |
| Chuyên gia Số | FDS > 70 | TAS > 60 |
| Nhà Khai vấn | MMS > 70 | FDS > 60 |
| Kỹ sư Vận hành | TAS > 80 | FDS > 70 |

**Hybrid:** vd TAS=75 & MMS=75 → "Nhà Khai vấn Công nghệ" (Tech-enabled Coach) — khách tiềm năng nhất cho gói Coach AI Automation.

## Tích hợp backend
- **M1–M2:** gom raw qua `activity_log` + finance store (schema activity nhẹ: key hành động + timestamp).
- **M3:** thêm counter AI Interaction + slash command.
- **M4:** script tính định kỳ (tuần) → lưu `users/{uid}/capacity_report`.

## Cần thêm khi vào M4
- Field survey: kỹ năng khai báo, thời gian rảnh (consent NĐ 13/2023).
- Counter: feature-exploration, onboarding-speed, CFO-report-views, AI-interaction (một phần từ activity M2/M3).
- Engine deterministic + radar SVG + classification + AI Oracle (20% nhận xét).
</content>
