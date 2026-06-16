# Manicash — Claude Code Project Context

## Project Overview
Personal finance chat app (AI Money Chat) cho người dùng Việt Nam.
PWA + Android (Capacitor). Deployed trên Vercel + Firebase.

## Tech Stack
- Next.js 16.2.1 (App Router), React 19, TypeScript
- Firebase (Auth, Firestore, Admin SDK)
- Zustand v5 (state management, với persist)
- Dexie (IndexedDB local cache)
- Capacitor v8 (Android build)
- Tailwind CSS v4, Framer Motion, Lucide React
- PayOS (payment gateway VN)
- Groq API (AI chat backend - xem groqClient.ts)
- Howler.js (sound effects)

## Project Structure
src/
  app/          — Next.js App Router pages
    (app)/      — authenticated routes
    (auth)/     — login/register
    (public)/   — public pages
    api/        — API routes
  components/   — UI components
  stores/       — Zustand stores (useFinanceCoreStore, useChatHistoryStore, ...)
  lib/          — business logic
    aiMoneyChat/    — AI chat engine
    moneyBrain/     — financial analytics
    moneySync/      — Firestore sync
    monetization/   — PayOS, Pro features
  hooks/        — custom React hooks
  data/         — static data (categories, badges, quests)
  types/        — TypeScript types
  utils/        — utility functions

## Key Files
- src/stores/useFinanceCoreStore.ts — main finance state
- src/lib/aiMoneyChat/ — AI chat logic
- src/lib/moneyBrain/ — CFO analytics engine
- src/lib/moneySync/ — Firestore sync
- src/lib/firebaseAdmin.ts — server-side Firebase
- src/lib/groqClient.ts — Groq AI client
- src/proxy.ts — middleware proxy

## Commands
dev:      npm run dev
build:    npm run build
lint:     npm run lint
test:     npm run test (phase1 foundation)
test all: npm run test:ai-all
android:  npm run build:mobile

## Coding Rules
- TypeScript strict — không dùng `any` trừ khi thật sự cần
- Zustand stores: luôn dùng persist config từ src/stores/persistConfig.ts
- Firebase calls: server-side dùng firebaseAdmin, client-side dùng src/lib/firebase/
- AI chat flow: mọi thay đổi phải có test tương ứng trong tests/
- Không xóa sound files trong public/sounds/ — dùng cho gamification
- Path alias: @ = src/

## Windows/PowerShell Notes
- Shell là PowerShell, KHÔNG phải bash
- Path dùng backslash: src\stores\
- Dùng $HOME thay cho ~

## What NOT to do
- Không thay đổi capacitor.config.ts mà không báo trước
- Không xóa hoặc rename Zustand stores — breaking change lớn
- Không commit .env.local
- Không push lên remote mà không confirm
- Không thay đổi PayOS webhook URL trong production

## Deploy
- Vercel (auto deploy từ main branch)
- Android: build APK thủ công qua Android Studio
