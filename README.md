<p align="center">
  <img src="public/butler-avatar.png" width="80" height="80" alt="ManiCash" style="border-radius: 20px;" />
</p>

<h1 align="center">ManiCash 💎</h1>

<p align="center">
  <strong>Quản lý tài chính cá nhân thông minh — Gamified Personal Finance for Gen Z Vietnam</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange?logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/Zustand-State%20Mgmt-purple" alt="Zustand" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## ✨ Features

### 💰 Core Financial Management
- **6-Account System** — Ví chính, Quỹ Bill, Dự phòng, Mục tiêu, Đầu tư, Giáo dục
- **Safe-to-Spend** — Tính toán "số dư an toàn" real-time dựa trên thu/chi/ngân sách/bill
- **Fixed Bills Tracker** — Quản lý bill cố định hàng tháng, nhắc hạn tự động
- **Budget Categories** — Thiết lập ngưỡng chi tiêu theo danh mục, cảnh báo vượt ngân sách
- **Auto-Split** — Chia tiền tự động vào 3 ví theo tỷ lệ tùy chỉnh

### 🎮 Gamification Engine
- **XP System** — Tích XP qua ghi sổ, tiết kiệm, nhịn chi tiêu, duy trì streak
- **Rank Progression** — Thăng hạng từ Tân Binh → Kim Cương với mỗi mốc XP
- **Daily Streak** — Chuỗi ngày liên tiếp ghi chép tài chính
- **BreathGate** — Bài tập thở 30s trước chi tiêu lớn (>3 triệu), thưởng XP khi nhịn
- **Wishlist Cooling** — Hệ thống "suy nghĩ lại" với thời gian chờ trước khi mua

### 🤖 AI Butler (Lord Diamond)
- **Proactive Notifications** — Nhắc bill, nhắc tiết kiệm, nhắc sức khỏe theo giờ
- **CFO Intelligence** — Phân tích sức khỏe tài chính với Health Score (5 sub-scores)
- **Smart Suggestions** — Gợi ý tăng thu nhập, cắt giảm chi tiêu, tối ưu nguồn lực
- **Monthly Report** — Báo cáo cuối tháng tự động với rollover ngân sách

### 📱 SMS Webhook (PRO)
- **Auto-detect Banking SMS** — Parse tin nhắn từ 7 ngân hàng VN (VCB, TCB, MB...)
- **Pending Transactions** — Xác nhận/từ chối giao dịch phát hiện từ SMS
- **Zero Manual Input** — Tự động ghi thu/chi từ SMS banking

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| State Management | Zustand (localStorage persistence) |
| Authentication | Firebase Auth (Google Sign-in) |
| Database | Firebase Firestore |
| Styling | Vanilla CSS + CSS Variables (Dark/Light mode) |
| Animation | Framer Motion |
| AI | Groq (Llama 3.3 70B) for CFO reports |
| Icons | Lucide React |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase project (Auth + Firestore)
- Groq API key (optional, for AI CFO)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/manicash.git
cd manicash

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

| Variable | Description |
|----------|------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin project ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin service account email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin private key (PEM format) |
| `GROQ_API_KEY` | Groq API key for AI CFO (optional) |

---

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── (app)/                # Authenticated app routes
│   │   ├── overview/         # Dashboard (Safe-to-Spend, bills, income)
│   │   ├── input/            # Transaction input
│   │   ├── ledger/           # Transaction history
│   │   ├── goals/            # Wishlist + Tasks
│   │   └── money/            # CFO Intelligence
│   ├── api/                  # API routes (SMS webhook, CFO, auth)
│   └── login/                # Login page
├── components/
│   ├── layout/               # AppHeader, BottomNav
│   └── ui/                   # FloatingButler, BreathGate, TransactionInput...
├── stores/                   # Zustand stores (finance, budget, auth, wishlist, tasks)
├── hooks/                    # Custom hooks (useSafeBalance, useBudgetAlert...)
├── data/                     # Static data (butler messages, ranks, categories)
├── lib/                      # Utilities (xpEngine, cfoHealthScore, firebase config)
├── types/                    # TypeScript type definitions
└── utils/                    # Helper functions (formatCurrency, dateUtils)
```

---

## 🎨 Design Philosophy

- **Mobile-first** — Designed as a mobile shell (430px max-width) centered on desktop
- **Glassmorphism** — Semi-transparent backgrounds with backdrop blur
- **Dark/Light Mode** — Full theme support via CSS custom properties
- **Micro-animations** — Spring-based transitions with Framer Motion
- **Vietnamese-first** — All UI text in Vietnamese, VND currency formatting

---

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with 💎 by <strong>ManiCash Team</strong>
</p>
