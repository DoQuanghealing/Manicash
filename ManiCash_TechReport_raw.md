**ManiCash**

Báo cáo kỹ thuật toàn diện

Hiện trạng • Bug • Điểm mù • Road map nâng cấp Chat

+------------+------------------------------+
| **Ngày**   | **Stack**                    |
|            |                              |
| 14/06/2026 | Next.js 16 • Firebase • Groq |
+------------+------------------------------+

**1. Tổng quan kiến trúc**

ManiCash là ứng dụng quản lý tài chính cá nhân tiếng Việt kèm gamification. Stack: **Next.js 16 App Router, React 19, TypeScript, Firebase (Auth + Firestore), Zustand, Tailwind CSS v4.**

**1.1 Sơ đồ luồng dữ liệu chính**

+-------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------+
| **Client (Zustand)**                | **clientSnapshot**                                                                                                                    | **/api/chat (Server)**                                                                                                                     | **Groq / OpenAI**                                                                                           |
+-------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------+
| -   useFinanceStore (giao dịch, ví) | buildClientSnapshot() đóng gói toàn bộ state Zustand thành JSON chuẩn. Gồm: ví, giao dịch, bill, task, goal, budget, lịch sử 3 tháng. | routeIntent() phân loại ý định (22 loại). dispatch() gọi handler tương ứng. Snapshot được validate + build thành MonthlyFinancialSnapshot. | LLM chỉ nhận context pack JSON đã tính sẵn. Mọi con số do moneyBrain tính. LLM chỉ diễn giải, không sửa số. |
|                                     |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
| -   useBudgetStore (ngân sách)      |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
|                                     |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
| -   useGoalsStore (mục tiêu)        |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
|                                     |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
| -   useTaskStore (nhiệm vụ)         |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
|                                     |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
| -   useAuthStore (user + XP)        |                                                                                                                                       |                                                                                                                                            |                                                                                                             |
+-------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------+

**1.2 Các API endpoints**

  ---------------------------------- ------------------- ---------------------------------------------------------------------------------------------
  **Endpoint**                       **Vai trò**         **Ghi chú**
  /api/chat                          Chat chính          Gateway duy nhất: routeIntent → dispatch → 22 handler. Phase 2--5 hoàn chỉnh.
  /api/cfo                           CFO legacy          Vẫn chạy cho CFOInsightCard. Có 2 path: snapshot mới (moneyBrain) và legacy (flat numbers).
  /api/ai-money-chat/parse           AI Fallback Parse   Groq phân loại giao dịch khi parser local thấp confidence. Có quota gate.
  /api/ai-money-chat/cfo-narration   CFO Narration       Groq sinh narration cho CFOInsightCard. Có cache fingerprint.
  /api/auth/session                  Session check       Kểm tra Firebase session cookie.
  /api/sms-webhook                   SMS Banking         Nhận SMS từ app mobile → parse giao dịch auto (ACB, MB, VCB\...).
  /api/billing/verify                Billing             Xác minh thanh toán, cấp quyền Pro.
  /api/account/deletion              Xóa tài khoản       Soft delete + cron dọn dẹt sau 30 ngày.
  ---------------------------------- ------------------- ---------------------------------------------------------------------------------------------

**2. Phân tích Chat & CFO Flow**

Mời tin nhắn trong chat chạy qua pipeline 5 tầng: **client local parse → intent router → handler → moneyBrain engine → LLM (nếu cần).**

**2.1 Luồng nhập liệu giao dịch**

  ---------- ------------------------ ----------------------------------------------------------------------------- -------------------------------------------------
  **Bước**   **Component**            **Thực hiện**                                                                 **Ghi chú kỹ thuật**
  **1**      parseInput()             Tách luồng: LOG\_TRANSACTION (có số) → draft card; còn lại → askAssistant()   detectEarningIntent() kiểm trước earning plan
  **2**      parseMoneyText()         Parser local regex/keyword bóc số tiền + danh mục                             Không gọi mạng, 0 token, \<1ms
  **3**      applyMemoryToIntent()    Sửa danh mục dựa trên lịch sử sửa của user (LocalStorage)                     Không gọi mạng
  **4**      AI Fallback (tùy chọn)   Nếu confidence thấp → gọi /api/ai-money-chat/parse (Groq)                     Cần AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED=true
  **5**      Draft Confirm Card       Hiển thị form xác nhận cho user sửa trước khi lưu                             Không tự động save
  **6**      handleConfirmDraft()     recordConfirmedMoneyIntent() → Zustand store → Firestore sync                 XP engine fire ở đây
  ---------- ------------------------ ----------------------------------------------------------------------------- -------------------------------------------------

**2.2 Luồng truy vấn & CFO Report**

Kết quả: mọi câu hỏi (số dư, hóa đơn, nhiệm vụ, CFO) đi qua /api/chat. Server xây dựng MonthlyFinancialSnapshot từ clientSnapshot được gửi kèm, tính tất cả số liệu deterministic, sau đó LLM chỉ viết text diễn giải.

-   CFO Report flow: clientSnapshot → toMoneySnapshotV1 → buildCFOContextPack → runCFOAnalysis (LLM) → composeMarkdown

-   Context pack bao gồm: health score 6 thành phần, cashflow, bills, budget, behavior anomalies (z-score), goals at risk, earning tasks, 3-month history

-   LLM nhận JSON đã tính sẵn, chỉ sinh: summary, diagnosis, risks, opportunities, actionPlan7Days, quickWins

-   Follow-up (tại sao? cắt thế nào?): tái dùng snapshot từ conversationStore (30 phút TTL), không re-aggregate DB

**2.3 Truy xuất dữ liệu: một chiều client → server**

**Điểm mấu chốt:** Server không chủ động đọc Firestore mỗi request chat. Client đóng gói toàn bộ state Zustand thành clientSnapshot, POST lên server. Server chỉ đọc Firestore khi clientSnapshot không được gửi (fallback Firestore) và khi đó chỉ lấy được số dư ví, không có giao dịch/ngân sách/mục tiêu.

**3. Bugs & Vấn đề kỹ thuật**

  ---------- ------------ ----------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------
  **ID**     **Mức độ**   **File**                                  **Mô tả**                                                                                                                                                                 **Hướng sửa**
  **B-01**   **HIGH**     snapshotBuilder.ts:456                    safeToSpend tính sai: monthlyBudgetTotal - expense - totalDue. Bỏ qua carryOver (dư tháng trước), goalContributions. Kết quả khác moneyBrain.safeToSpend.ts.              Dùng getSafeToSpendBreakdown() từ moneyBrain thay vì tính lại. Trước mắt truyền carryOver vào buildFromClient.
  **B-02**   **HIGH**     requestAuth.ts:7                          Yêu cầu CẢ HAI cookie manicash-session VÀ Bearer token. Một trong hai thiếu → 401 im lặng. Môi trường mà cookie không tồn tại (API call từ mobile) sẽ luôn fail.          Bỏ điều kiện cookie check hoặc cho phép chỉ cần Bearer token được verify thành công.
  **B-03**   **HIGH**     snapshotBuilder.ts conversationStore.ts   In-memory cache (Map) sẽ mất khi Vercel cold start. snapshotBuilder TTL 5 phút, conversationStore TTL 30 phút --- cả hai chỉ hoạt động nếu cùng 1 instance server.        Chuyển sang Vercel KV / Upstash Redis. Conversation store cách ly cho mỗi phông (sessionId là UUID trên client, ổn).
  **B-04**   **MEDIUM**   intentRouter.ts                           Router chỉ extract slot cho LOG\_TRANSACTION. 14 intent truy vấn Phase 2 (QUERY\_INCOME, QUERY\_UPCOMING\_BILLS\...) không có slot extraction. Handler tự đọc snapshot.   Hiện đã đủ cho Phase 2. Nâng cấp khi cần slot cụ thể (tháng cụ thể, danh mục cụ thể).
  **B-05**   **MEDIUM**   /api/chat/route.ts                        Không có rate-limit riêng cho endpoint. Mỗi request đều có Firestore transaction (200-400ms) --- chỉ chần qua quota, dễ bị spam.                                          Thêm rate-limit middleware (Upstash Ratelimit) trước quota check. Tối đa 10 req/phút/IP cho free users.
  **B-06**   **MEDIUM**   AiMoneyChatContent.tsx                    Không có context lịch sử hội thoại trong clientSnapshot. Mửi lượt chat gửi context hoàn toàn mới. LLM không biết user đã hỏi gì trước (chỉ follow-up mới có session).     Hạn chế by design (tiết kiệm token). Cân nhắc truyền 2-3 turns trước vào clientSnapshot cho intent FOLLOW\_UP.
  **B-07**   **LOW**      cfoNarrationCache.ts                      Cache CFO narration lưu trên Firestore (users/{uid}/narration\_cache). Nếu user xoá account, cache không tự động dịn.                                                     Thêm xóa cache trong account deletion cron.
  **B-08**   **LOW**      groqClient.ts                             getCFONarrative dùng hard-code model \"llama-3.3-70b-versatile\" thay vì đọc env AI\_MONEY\_CHAT\_GROQ\_MODEL.                                                            Sửa: model: process.env.AI\_MONEY\_CHAT\_GROQ\_MODEL \|\| \"llama-3.3-70b-versatile\"
  ---------- ------------ ----------------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ----------------------------------------------------------------------------------------------------------------------

**4. Điểm mù (Blind Spots)**

Những lỗ hổng tính năng đã có code nhưng không được kết nối hoàn chỉnh, hoặc thiếu khả năng quan trọng:

**4.1 Chat không có API Key thẫt → mọi thứ fallback deterministic**

+-----------------------------------------------------------------------------------------+----------------------------------------------------------------------------+
| **Hiện tại (nếu không có OPENAI\_API\_KEY + GROQ\_API\_KEY)**                           | **Sau khi có API key**                                                     |
|                                                                                         |                                                                            |
| -   /api/chat: các query deterministic vẫn trả kết quả đúng                             | -   LLM\_PROVIDER=openai + OPENAI\_API\_KEY: primary OpenAI, fallback Groq |
|                                                                                         |                                                                            |
| -   CFO\_REPORT / ANALYZE\_FINANCE: trả fallback deterministic (không có LLM diễn giải) | -   LLM\_PROVIDER=groq + GROQ\_API\_KEY: primary Groq, fallback OpenAI     |
|                                                                                         |                                                                            |
| -   AI Fallback Parse: bị tắt (AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED=false mặc định)   | -   Bật AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED=true cho parse              |
|                                                                                         |                                                                            |
| -   CFO Narration: bị tắt tương tự                                                      | -   Quota (Firestore) tự động charge, có cả free và Pro plan               |
+-----------------------------------------------------------------------------------------+----------------------------------------------------------------------------+

**4.2 Những tính năng có code nhưng chưa kết nối**

-   SMS Webhook (NEXT\_PUBLIC\_SMS\_WEBHOOK\_ENABLED=false mặc định): parser sẵn sàng cho ACB, MB, VCB, TPBank, VPBank, Techcombank, Sacombank - chưa expose cho user.

-   MoneySync (NEXT\_PUBLIC\_MONEY\_SYNC\_ENABLED=false): module đồng bộ Firestore đa thiết bị hoàn chỉnh (syncController, outboxPersistence, firestoreRemoteAdapter) nhưng đang tắt.

-   Chat không nhớ lịch sử conversation giữa các phiên (session chỉ sống 30 phút in-memory). Follow-up sau khi re-open app sẽ không hoạt động.

-   Long-term profile (longTermProfile.ts): LLM có thể ghi note hệ thống dạng \[profile: \...\] vào Firestore, nhưng chưa có UI để user xem/xóa profile này.

-   UI chỉ render message dạng text/markdown. Các kiểu ChatReplyUiKind (cfo-card, follow-up-buttons, confirm-transaction) có trong type nhưng AiMoneyChatContent chưa render payload tương ứng.

-   Action Protocol (Phase 4A): server có thể gửi actionRequest (chuyển quỹ, xóa giao dịch), client có executeMoneyActionOnClient nhưng chưa test production edge cases (action concurrent, undo quá hạn).

**4.3 LLM \"mù\" - không thấy được**

-   Giao dịch ở tháng khác: clientSnapshot chỉ đóng gói giao dịch tháng hiện tại. History chỉ là aggregate chi theo danh mục 3 tháng trước (không có giao dịch cụ thể).

-   Tag gọi budget theo danh mục cụ thể: nếu user hỏi \"táng cafe tháng trước bao nhiêu\" mà không có trong history snapshot thì LLM không trả được.

-   Giao dịch được đánh dấu ⚠️ (flagged per-transaction): logic flagging có trong /api/cfo legacy path nhưng không có trong chat flow.

-   Thông tin ngân hàng thực (SMS): chưa kết nối. Mọi câu hỏi \"tài khoản ngân hàng còn bao nhiêu\" trả lời dựa trên số user tự nhập.

**5. Road map nâng cấp Chat (siêu nâng cấp)**

Chat đã có nền móng vững. Cần 4 giai đoạn để mở ra trải nghiệm **chat tài chính đầy đủ nhất Việt Nam**.

+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+
| **Phase**   | **Mục tiêu**                  | **Việc cần làm**                                                                              |
+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+
| **Phase A** | **Kết nối API Key + Sửa bug** | -   B-01: Sửa safeToSpend trong snapshotBuilder dùng getSafeToSpendBreakdown()                |
|             |                               |                                                                                               |
| **P0**      |                               | -   B-02: Sửa requestAuth chỉ cần Bearer token (bỏ cookie requirement)                        |
|             |                               |                                                                                               |
|             |                               | -   B-08: Sửa groqClient.ts dùng env model                                                    |
|             |                               |                                                                                               |
|             |                               | -   Cấu hình .env.local: GROQ\_API\_KEY + OPENAI\_API\_KEY + LLM\_PROVIDER=groq               |
|             |                               |                                                                                               |
|             |                               | -   Bật AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED=true                                           |
|             |                               |                                                                                               |
|             |                               | -   Test toàn bộ intent flow với LLM thật                                                     |
+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+
| **Phase B** | **Nạng cấp UI Chat**          | -   Render CFO card (cfo-card) vào UI khi server gửi kind=\"cfo-card\"                        |
|             |                               |                                                                                               |
| **P1**      |                               | -   Render follow-up buttons (follow-up-buttons): \"Giải thích thêm\", \"Kế hoạch tuần\"      |
|             |                               |                                                                                               |
|             |                               | -   Message streaming (ReadableStream) thay vì đợi full response                              |
|             |                               |                                                                                               |
|             |                               | -   Typing indicator chính xác hơn (hiển khi đang fetch, tắt khi xong)                        |
|             |                               |                                                                                               |
|             |                               | -   Cải thiện Markdown renderer: support bảng, có highlight number                            |
+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+
| **Phase C** | **Mở tính năng SMS & Sync**   | -   Bật SMS Webhook (NEXT\_PUBLIC\_SMS\_WEBHOOK\_ENABLED=true)                                |
|             |                               |                                                                                               |
| **P1**      |                               | -   Hướng dẫn user cài Tasker/Shortcut gửi SMS bàn khoản                                      |
|             |                               |                                                                                               |
|             |                               | -   Bật MoneySync (NEXT\_PUBLIC\_MONEY\_SYNC\_ENABLED=true) sau khi deploy Firestore rules    |
|             |                               |                                                                                               |
|             |                               | -   Test sync đa thiết bị (merge conflict)                                                    |
|             |                               |                                                                                               |
|             |                               | -   Xử lý B-03: chuyển snapshot cache + conversation store sang Upstash Redis                 |
+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+
| **Phase D** | **Chat thông minh hơn**       | -   Chat memory dài hạn: lưu session id vào localStorage, server load lại từ Redis            |
|             |                               |                                                                                               |
| **P2**      |                               | -   Multi-turn context: truyền 3-5 turns trước vào prompt cho mọi query (không chỉ follow-up) |
|             |                               |                                                                                               |
|             |                               | -   Giao dịch tháng cũ: expose API lấy history transactions theo tháng cụ thể khi user hỏi    |
|             |                               |                                                                                               |
|             |                               | -   Proactive insights: LLM push cảnh báo khi phát hiện anomaly                               |
|             |                               |                                                                                               |
|             |                               | -   Voice input (Web Speech API) cho mobile                                                   |
|             |                               |                                                                                               |
|             |                               | -   Rate limiting (Upstash Ratelimit) - giải quyết B-05                                       |
+-------------+-------------------------------+-----------------------------------------------------------------------------------------------+

**6. Environment Variables để chat hoạt động**

Các biến bắt buộc để mở khóa LLM chat:

  ---------------------------------------- ------------------- -----------------------------------------------------------------------------
  **Variable**                             **Quan trọng**      **Mô tả**
  GROQ\_API\_KEY                           **BẮt buộc**        Dùng cho CFO narrative (legacy) + LLM fallback + AI parse
  OPENAI\_API\_KEY                         **Khuyến nghị**     Primary LLM cho /api/chat CFO\_REPORT (gpt-4o-mini)
  LLM\_PROVIDER                            **Khuyến nghị**     \"openai\" (mặc định) hoặc \"groq\". Đặt \"groq\" nếu chỉ có GROQ\_API\_KEY
  AI\_MONEY\_CHAT\_AI\_FALLBACK\_ENABLED   **BẮt buộc**        Đặt =true để bật AI parse cho giao dịch khó
  NEXT\_PUBLIC\_AI\_MONEY\_CHAT\_ENABLED   **Mặc định true**   Bàt chat UI. Không cần đặt trừ khi muốn tắt
  MANICASH\_LICENSE\_KEY                   **Production**      BẮt buộc ở production (\>= 8 ky tự)
  NEXT\_PUBLIC\_MONEY\_SYNC\_ENABLED       **Tuy chọn**        Đặt =true sau khi deploy Firestore rules
  NEXT\_PUBLIC\_SMS\_WEBHOOK\_ENABLED      **Tuy chọn**        Đặt =true khi muốn bật SMS banking auto-import
  ---------------------------------------- ------------------- -----------------------------------------------------------------------------

**7. Tóm tắt để hiểu nhanh**

  ------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **✌️ Điểm mạnh**    Kiến trúc chat Phạse 1--5 đã hoàn chỉnh về mặt code. moneyBrain engine tính deterministic, LLM chỉ diễn giải. 22 intent types. Action protocol có confirm + undo.
  **⚠️ Bug chính**    safeToSpend tính sai (B-01). requestAuth bỏ lỡ mobile (B-02). In-memory cache không bền vững trên serverless (B-03).
  **🔵 Điểm mù lớn**   Chat đang chạy mà không có LLM thật (nếu không có API key). UI không render CFO card/follow-up buttons từ server. SMS webhook có code nhưng tắt.
  **🚀 Ưu tiên \#1**   Cấu hình GROQ\_API\_KEY + OPENAI\_API\_KEY, sửa B-01 và B-02. Chat sẽ thông minh ngay sau đó.
  **🚀 Ưu tiên \#2**   Thêm streaming response + render CFO card UI → trải nghiệm cảm giác như chat thật.
  **🚀 Ưu tiên \#3**   Upstash Redis cho conversation store + snapshot cache → follow-up hoạt động ổn định trên serverless.
  ------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------

Báo cáo này được tạo bởng ManiCash Cowork Agent --- 14/06/2026
