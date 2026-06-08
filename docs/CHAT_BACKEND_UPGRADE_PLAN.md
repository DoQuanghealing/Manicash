# ManiCash 2.0 — Chat Backend Upgrade Plan

> Tài liệu kiến trúc nâng cấp backend cho `/chat`: từ "nhập liệu giao dịch" → "trợ lý tài chính truy vấn + phân tích".
> Last updated: 2026-06-07. Branch: `codex/ai-money-chat`.

## 0. Bối cảnh & mục tiêu

### Hiện trạng
- `/chat` hôm nay chỉ chạy **một use case**: parse câu nhập liệu (`mua trà sữa 50k`) → `ParsedMoneyIntent` → confirm card → ghi `useFinanceStore`.
- Có sẵn `parseMoneyText()` (local NLP), `/api/ai-money-chat/parse` (Groq fallback), `useAiMoneyMemoryStore` (memory rules), `/api/cfo` (health score + narrative).
- Dữ liệu: **Firestore** (server of truth) + **Zustand stores** (client cache: `useFinanceStore`, `useBudgetStore`, `useGoalsStore`, `useTaskStore`, `useBudgetStore`).

### Mục tiêu nâng cấp
Cho phép user hỏi:

| Loại câu hỏi | Ví dụ | Đường xử lý |
|---|---|---|
| **Nhập liệu** | `mua trứng 30k`, `nhận lương 20tr` | Local parser → confirm → ghi DB |
| **Truy vấn số liệu thô** | `tháng này còn bao nhiêu tiền`, `tiền điện đóng chưa`, `tiết kiệm tháng này được bao nhiêu` | **Deterministic** — query Firestore/store, format trả lời, **không gọi LLM** |
| **Liệt kê nhiệm vụ** | `hôm nay tôi có việc gì`, `nhiệm vụ kiếm tiền tuần này` | **Deterministic** — quét `useTaskStore` + `Money` items |
| **Phân tích / tư vấn** | `phân tích năng lực tài chính`, `báo cáo CFO tháng`, `gợi ý cắt giảm`, `tại sao mục ăn uống lại lố` | **Stochastic** — aggregate data → LLM với context nén |

### Nguyên tắc thiết kế
1. **Hybrid first**: Deterministic xử lý 70-80% câu hỏi để giảm chi phí AI và tăng độ chính xác (số liệu không bao giờ sai).
2. **Context nén**: Khi cần LLM, chỉ gửi **JSON summary đã aggregate**, không gửi raw transactions.
3. **Conversation state**: Lưu ngắn hạn báo cáo CFO mới sinh để follow-up không phải re-aggregate.
4. **Hard cap chi phí**: Quota credit per user/month (đã có sẵn `useAiMoneyMemoryStore` + `quotaCore.ts`).

---

## Phần 1 — Intent Router & Hybrid Pipeline

### 1.1 Cấu trúc thư mục đề xuất

```
src/
├── lib/
│   └── aiMoneyChat/
│       ├── parser.ts                    # CÓ SẴN — parse câu nhập liệu giao dịch
│       ├── taxonomy.ts                  # CÓ SẴN — danh mục
│       ├── categoryKeywords.ts          # CÓ SẴN — keyword → categoryId
│       ├── memory/
│       │   └── useAiMoneyMemoryStore.ts # CÓ SẴN — financial memory rules
│       │
│       ├── intent/                      # MỚI
│       │   ├── types.ts                 # ChatIntent union + Slot types
│       │   ├── intentRouter.ts          # Entry point, gọi classifier rồi dispatch
│       │   ├── intentClassifier.ts      # Rule-based + light NLP scoring
│       │   ├── intentPatterns.ts        # Regex + keyword bag cho từng intent
│       │   └── intentRouter.test.ts
│       │
│       ├── handlers/                    # MỚI — mỗi intent một handler
│       │   ├── handleLogTransaction.ts  # đã có logic, chỉ wrap lại
│       │   ├── handleQueryBalance.ts    # "còn bao nhiêu tiền"
│       │   ├── handleQueryBill.ts       # "tiền điện đóng chưa"
│       │   ├── handleQuerySavings.ts    # "tiết kiệm tháng này"
│       │   ├── handleQueryTasks.ts      # "hôm nay tôi có việc gì"
│       │   ├── handleQueryBudget.ts     # "còn bao nhiêu tiền để xài"
│       │   ├── handleCFOReport.ts       # call LLM với context aggregate
│       │   ├── handleAdvice.ts          # call LLM gợi ý cắt giảm
│       │   └── handleFollowUp.ts        # follow-up trên CFO report cached
│       │
│       ├── aggregation/                 # MỚI — Phần 2
│       │   ├── snapshotBuilder.ts       # build MonthlyFinancialSnapshot
│       │   ├── billsSnapshot.ts
│       │   ├── goalsSnapshot.ts
│       │   ├── categorySnapshot.ts
│       │   └── snapshotBuilder.test.ts
│       │
│       └── llm/                         # MỚI — Phần 3
│           ├── systemPrompts.ts         # Lord Diamond persona
│           ├── promptBuilder.ts         # ghép context + history + user query
│           ├── llmClient.ts             # wrapper Groq, retry, telemetry
│           └── conversationStore.ts     # short-term session cache
│
├── app/
│   └── api/
│       └── chat/                        # MỚI — endpoint duy nhất cho /chat
│           └── route.ts                 # POST { message, sessionId } → reply
│
└── stores/
    └── useChatSessionStore.ts           # MỚI — client mirror của conversation cache
```

> **Lưu ý**: Phần CFO hiện tại (`/api/cfo`, `/api/ai-money-chat/cfo-narration`) **vẫn tồn tại** để phục vụ `/report`. Endpoint mới `/api/chat` sẽ **gọi lại** các service aggregation chứ không trùng lặp logic.

---

### 1.2 Phân loại intent — chiến lược

Bài học từ ngành: **đừng dùng LLM để classify intent khi rule-based đủ tốt**. Mỗi lần classify bằng LLM tốn ~9 VND và mất 500-800ms. Rule-based + memory layer cho ManiCash sẽ cover **>90%** câu hỏi.

#### Tier 1 — Regex/keyword (fast path, 0ms)
Match những intent rõ ràng nhất:

| Intent | Pattern | Ví dụ |
|---|---|---|
| `LOG_TRANSACTION` | có amount + verb chi/thu (`mua`, `trả`, `nhận`, `chi`, `thanh toán`) | `mua trà sữa 50k`, `nhận lương 20tr` |
| `QUERY_BALANCE` | `(còn\|còn lại\|số dư).*(bao nhiêu\|mấy)?(tiền)?` | `tôi còn bao nhiêu tiền` |
| `QUERY_BILL_STATUS` | `(tiền\|hóa đơn\|bill).*(đóng\|trả\|thanh toán).*(chưa\|rồi)?` | `tiền điện đóng chưa` |
| `QUERY_SAVINGS` | `tiết kiệm.*(tháng\|tuần\|năm)`, `để dành được` | `tiết kiệm tháng này được bao nhiêu` |
| `QUERY_TASKS_TODAY` | `(hôm nay\|today).*(việc\|nhiệm vụ\|task)` | `hôm nay tôi có việc gì` |
| `QUERY_SAFE_TO_SPEND` | `còn.*(xài\|tiêu\|chi).*(tháng\|tuần)`, `xài thoải mái` | `tháng này còn bao nhiêu để xài` |
| `QUERY_GOAL_PROGRESS` | `(mục tiêu\|goal).*(tới đâu\|còn bao nhiêu)` | `mục tiêu mua xe tới đâu rồi` |
| `CFO_REPORT` | `(báo cáo\|report).*(cfo\|tài chính\|tháng)` | `lên báo cáo CFO tháng` |
| `ANALYZE_FINANCE` | `(phân tích\|đánh giá).*(tài chính\|năng lực)` | `phân tích năng lực tài chính của tôi` |
| `ADVICE_CUT_SPENDING` | `(gợi ý\|cắt giảm\|tiết kiệm thêm)` | `gợi ý cắt giảm chi tiêu` |

#### Tier 2 — Slot extraction (vẫn deterministic)
Sau khi xác định intent, extract slot bằng regex/lookup:

```ts
// Ví dụ QUERY_BILL_STATUS:
//   "tiền điện đóng chưa" → { billCategory: "electricity" }
//   "internet trả chưa"   → { billCategory: "internet" }
const BILL_KEYWORDS: Record<string, string> = {
  điện: 'electricity', internet: 'internet', nước: 'water',
  thuê: 'rent', xe: 'transport',
};
```

#### Tier 3 — Memory-aware re-classify
Nếu Tier 1 match nhiều intent (ambiguous), tham khảo `useAiMoneyMemoryStore` xem user trước đây chỉnh sửa similar phrase thành intent nào.

#### Tier 4 — LLM fallback (chỉ khi confidence < 0.5)
Chỉ những câu thật sự mơ hồ mới gọi Groq classifier — và phải **gate bằng quota**.

---

### 1.3 Code skeleton (TypeScript)

#### `src/lib/aiMoneyChat/intent/types.ts`

```ts
export type ChatIntentType =
  // Deterministic
  | 'LOG_TRANSACTION'
  | 'QUERY_BALANCE'
  | 'QUERY_BILL_STATUS'
  | 'QUERY_SAVINGS'
  | 'QUERY_SAFE_TO_SPEND'
  | 'QUERY_TASKS_TODAY'
  | 'QUERY_GOAL_PROGRESS'
  | 'QUERY_TOP_CATEGORIES'
  // Stochastic (LLM)
  | 'CFO_REPORT'
  | 'ANALYZE_FINANCE'
  | 'ADVICE_CUT_SPENDING'
  | 'FOLLOW_UP'              // tiếp nối báo cáo trước đó
  // Khác
  | 'UNKNOWN';

export type IntentConfidence = 'high' | 'medium' | 'low';

export type ChatIntent = {
  type: ChatIntentType;
  confidence: IntentConfidence;
  /** Score raw (0..1) để debug và quyết định fallback. */
  score: number;
  /** Slot đã trích xuất (mỗi intent có shape riêng). */
  slots: Record<string, unknown>;
  /** Câu gốc đã normalize. */
  normalizedText: string;
  /** Lý do classifier chọn intent này (debug only). */
  reason?: string;
};

export type ChatReply = {
  /** Tin nhắn đã render sẵn (markdown). */
  message: string;
  /** Cờ UI: confirmation card, chart, suggestion buttons... */
  ui?: {
    kind: 'confirm-transaction' | 'cfo-card' | 'follow-up-buttons' | 'none';
    payload?: unknown;
  };
  /** Telemetry. */
  meta: {
    intent: ChatIntentType;
    source: 'deterministic' | 'llm' | 'llm-cached';
    latencyMs: number;
    tokensUsed?: number;
  };
};
```

#### `src/lib/aiMoneyChat/intent/intentPatterns.ts`

```ts
import type { ChatIntentType } from './types';

type IntentPattern = {
  type: ChatIntentType;
  /** Regex bắt buộc match — nếu trống thì chỉ dựa vào keywords. */
  mustMatch?: RegExp[];
  /** Keyword bag — mỗi keyword match cộng 1 điểm. */
  keywords: string[];
  /** Trọng số intent — intent càng đặc thù càng cao. */
  weight: number;
  /** Loại intent (để router quyết định gọi LLM hay không). */
  pipeline: 'deterministic' | 'llm';
};

export const INTENT_PATTERNS: IntentPattern[] = [
  {
    type: 'LOG_TRANSACTION',
    mustMatch: [/\d+\s*(k|nghìn|tr|triệu|m|đ|vnd)?/i],
    keywords: ['mua', 'trả', 'nhận', 'chi', 'thanh toán', 'tiêu', 'lương', 'thưởng'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_BALANCE',
    keywords: ['còn', 'còn lại', 'số dư', 'bao nhiêu tiền', 'tiền trong'],
    weight: 0.9,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_BILL_STATUS',
    mustMatch: [/(đóng|trả|thanh toán)\s*(chưa|rồi)?/i],
    keywords: ['bill', 'hóa đơn', 'điện', 'internet', 'nước', 'thuê nhà'],
    weight: 1.0,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_SAVINGS',
    keywords: ['tiết kiệm', 'để dành', 'savings', 'quỹ'],
    weight: 0.9,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_SAFE_TO_SPEND',
    mustMatch: [/(còn|được)\s.*(xài|tiêu|chi|spend)/i],
    keywords: ['safe to spend', 'thoải mái', 'tháng này', 'tuần này'],
    weight: 0.95,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_TASKS_TODAY',
    keywords: ['hôm nay', 'việc', 'nhiệm vụ', 'task', 'todo', 'làm gì'],
    weight: 0.9,
    pipeline: 'deterministic',
  },
  {
    type: 'QUERY_GOAL_PROGRESS',
    keywords: ['mục tiêu', 'goal', 'tiến độ', 'tới đâu', 'hoàn thành bao nhiêu'],
    weight: 0.9,
    pipeline: 'deterministic',
  },
  // === LLM intents ===
  {
    type: 'CFO_REPORT',
    keywords: ['báo cáo', 'report', 'cfo', 'tổng kết tháng'],
    weight: 1.1,
    pipeline: 'llm',
  },
  {
    type: 'ANALYZE_FINANCE',
    keywords: ['phân tích', 'đánh giá', 'năng lực tài chính', 'nhận xét'],
    weight: 1.0,
    pipeline: 'llm',
  },
  {
    type: 'ADVICE_CUT_SPENDING',
    keywords: ['cắt giảm', 'gợi ý', 'tiết kiệm thêm', 'tối ưu', 'tư vấn'],
    weight: 1.0,
    pipeline: 'llm',
  },
];

/** Stop-words tiếng Việt không tính điểm. */
export const STOP_WORDS = new Set([
  'tôi', 'mình', 'là', 'có', 'và', 'của', 'cho', 'đi', 'thì', 'nhé', 'ạ',
]);
```

#### `src/lib/aiMoneyChat/intent/intentClassifier.ts`

```ts
import { INTENT_PATTERNS, STOP_WORDS } from './intentPatterns';
import type { ChatIntent, ChatIntentType, IntentConfidence } from './types';

/** Normalize: lowercase, bỏ dấu câu thừa, collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokenize đơn giản — đủ cho tiếng Việt vì người dùng nhập tự do. */
function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter((t) => t && !STOP_WORDS.has(t));
}

/** Mapping score → confidence enum. */
function scoreToConfidence(score: number): IntentConfidence {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

export function classifyIntent(rawText: string): ChatIntent {
  const normalized = normalize(rawText);
  const tokens = tokenize(normalized);

  let best: { type: ChatIntentType; score: number; reason: string } = {
    type: 'UNKNOWN',
    score: 0,
    reason: 'no pattern matched',
  };

  for (const pattern of INTENT_PATTERNS) {
    // Tier 1 — mustMatch regex
    if (pattern.mustMatch) {
      const ok = pattern.mustMatch.every((re) => re.test(normalized));
      if (!ok) continue;
    }

    // Tier 2 — keyword scoring
    const hits = pattern.keywords.filter((kw) => normalized.includes(kw));
    if (hits.length === 0 && !pattern.mustMatch) continue;

    // Score = (số keyword hit / tổng keyword) * weight, có boost nếu mustMatch pass
    const keywordRatio = pattern.keywords.length
      ? hits.length / pattern.keywords.length
      : 0;
    const mustMatchBoost = pattern.mustMatch?.length ? 0.4 : 0;
    const score = Math.min(1, (keywordRatio + mustMatchBoost) * pattern.weight);

    if (score > best.score) {
      best = {
        type: pattern.type,
        score,
        reason: `keywords=[${hits.join(',')}] mustMatch=${!!pattern.mustMatch}`,
      };
    }
  }

  return {
    type: best.type,
    score: best.score,
    confidence: scoreToConfidence(best.score),
    slots: {},
    normalizedText: normalized,
    reason: best.reason,
  };
}
```

#### `src/lib/aiMoneyChat/intent/intentRouter.ts`

```ts
import { classifyIntent } from './intentClassifier';
import { parseMoneyText } from '@/lib/aiMoneyChat/parser';
import { extractBillSlots } from '@/lib/aiMoneyChat/intent/slotExtractors';
import type { ChatIntent } from './types';

/**
 * Public entry — gọi từ /api/chat/route.ts.
 *  - Trả về ChatIntent đã enriched với slot.
 *  - Quyết định pipeline (deterministic vs llm) nằm ở handlers, không nằm ở đây,
 *    vì cùng một intent có thể fallback sang LLM khi confidence thấp.
 */
export function routeIntent(rawText: string): ChatIntent {
  const intent = classifyIntent(rawText);

  // Slot extraction phụ thuộc intent
  switch (intent.type) {
    case 'LOG_TRANSACTION': {
      const parsed = parseMoneyText(rawText);
      intent.slots = {
        type: parsed.type,
        amount: parsed.amount,
        categoryId: parsed.categoryId,
        confidence: parsed.confidence,
      };
      break;
    }
    case 'QUERY_BILL_STATUS':
      intent.slots = extractBillSlots(intent.normalizedText);
      break;
    case 'QUERY_TASKS_TODAY':
      intent.slots = { date: new Date().toISOString().slice(0, 10) };
      break;
    // ... các intent khác
  }

  return intent;
}
```

#### `src/app/api/chat/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedRequestUid } from '@/lib/requestAuth';
import { routeIntent } from '@/lib/aiMoneyChat/intent/intentRouter';
import { handleLogTransaction } from '@/lib/aiMoneyChat/handlers/handleLogTransaction';
import { handleQueryBalance } from '@/lib/aiMoneyChat/handlers/handleQueryBalance';
import { handleQueryBill } from '@/lib/aiMoneyChat/handlers/handleQueryBill';
import { handleCFOReport } from '@/lib/aiMoneyChat/handlers/handleCFOReport';
import { handleFollowUp } from '@/lib/aiMoneyChat/handlers/handleFollowUp';
// ... import các handlers còn lại

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  const uid = await getVerifiedRequestUid(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as { message?: string; sessionId?: string };
  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'empty message' }, { status: 400 });

  const sessionId = body.sessionId ?? `${uid}:${Date.now()}`;

  // === 1. Route intent ===
  const intent = routeIntent(message);

  // === 2. Nếu có conversation context và user hỏi follow-up → FOLLOW_UP ===
  //    (handleFollowUp tự load context từ conversationStore)
  // Lưu ý: detect follow-up từ pronoun "đó", "nó", "tại sao", "vì sao", "bằng cách nào"
  const isFollowUp = /\b(đó|nó|tại sao|vì sao|sao lại|bằng cách nào|làm sao|cái này)\b/i
    .test(intent.normalizedText);
  if (isFollowUp && intent.type === 'UNKNOWN') {
    intent.type = 'FOLLOW_UP';
    intent.confidence = 'high';
  }

  // === 3. Dispatch ===
  try {
    let reply;
    switch (intent.type) {
      case 'LOG_TRANSACTION':
        reply = await handleLogTransaction(uid, intent);
        break;
      case 'QUERY_BALANCE':
        reply = await handleQueryBalance(uid, intent);
        break;
      case 'QUERY_BILL_STATUS':
        reply = await handleQueryBill(uid, intent);
        break;
      case 'CFO_REPORT':
      case 'ANALYZE_FINANCE':
      case 'ADVICE_CUT_SPENDING':
        reply = await handleCFOReport(uid, intent, sessionId);
        break;
      case 'FOLLOW_UP':
        reply = await handleFollowUp(uid, intent, sessionId);
        break;
      default:
        reply = {
          message:
            'Mình chưa rõ ý lắm. Bạn có muốn xem báo cáo CFO tháng, hay nhập một giao dịch mới?',
          ui: { kind: 'none' as const },
          meta: { intent: intent.type, source: 'deterministic' as const, latencyMs: 0 },
        };
    }

    reply.meta.latencyMs = Date.now() - startedAt;
    return NextResponse.json({ sessionId, intent, reply });
  } catch (error) {
    console.error('[chat] handler error:', error);
    return NextResponse.json(
      {
        error: 'handler_failed',
        message: 'Có lỗi khi xử lý câu hỏi. Bạn thử lại sau nhé.',
      },
      { status: 500 },
    );
  }
}
```

#### Ví dụ handler deterministic — `handleQueryBalance.ts`

```ts
import { getFinanceSnapshot } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import type { ChatIntent, ChatReply } from '@/lib/aiMoneyChat/intent/types';

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export async function handleQueryBalance(uid: string, intent: ChatIntent): Promise<ChatReply> {
  const snap = await getFinanceSnapshot(uid, { scope: 'wallets-only' });

  const lines = [
    `Số dư hiện tại của bạn:`,
    `- Ví chính: **${fmt(snap.wallets.main)}**`,
    `- Quỹ khẩn cấp: **${fmt(snap.wallets.emergency)}**`,
    `- Quỹ trả bill: **${fmt(snap.wallets.billFund)}**`,
    ``,
    `Tổng: **${fmt(snap.wallets.total)}**`,
  ];

  return {
    message: lines.join('\n'),
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
  };
}
```

---

### 1.4 Cơ chế hybrid — flow tổng quát

```
┌────────────┐
│ user input │
└──────┬─────┘
       ▼
┌─────────────────────┐
│ routeIntent()       │   <-- regex + keyword scoring (Tier 1+2)
└──────┬──────────────┘
       │
       ├── confidence >= 0.7 ─────► dispatcher
       │
       ├── confidence 0.4-0.7 ────► check memory store
       │                            (đã sửa similar phrase?)
       │
       └── confidence < 0.4 ──────► LLM classifier (gated by quota)
                                    chỉ chạy khi user là Pro
                                    hoặc còn free credit
                                    ▼
                                    dispatcher
```

#### Khi nào ép sang LLM dù confidence cao?
- Intent thuộc nhóm `llm` (CFO_REPORT, ANALYZE_FINANCE, ADVICE_CUT_SPENDING).
- Slot có ambiguity cần LLM resolve (vd: `cắt giảm` nhưng không biết cắt mục gì).
- Câu hỏi follow-up trên session đang có CFO report cached.

---

## Phần 2 — Data Aggregation Pipeline cho CFO Report

### 2.1 Triết lý
- LLM **không** đọc raw transactions. Mỗi transaction = vài chục token, 100 giao dịch/tháng = 2-3k token chỉ cho data → đắt và loãng.
- Ta nén thành **MonthlyFinancialSnapshot** — JSON ~600-800 tokens, đủ cho LLM nói câu nào cũng phải bám vào con số có sẵn.
- Snapshot được **cache 5 phút** per user/month — nếu transaction mới ghi sẽ invalidate.

### 2.2 Cấu trúc JSON output đề xuất

```ts
// src/lib/aiMoneyChat/aggregation/types.ts

export type MonthlyFinancialSnapshot = {
  /** Metadata */
  meta: {
    uid: string;
    monthKey: string;          // "2026-06"
    generatedAt: string;        // ISO
    dayOfMonth: number;         // 1-31
    daysInMonth: number;
    transactionCount: number;
    locale: 'vi-VN';
  };

  /** Cashflow tháng */
  cashflow: {
    income: number;             // Tổng thu
    expense: number;            // Tổng chi
    net: number;                // income - expense
    savings: number;            // amount đã chuyển vào emergency + billFund tháng này
    savingsRate: number;        // 0..1 (savings / income)
    avgDailyExpense: number;
  };

  /** Số dư 3 ví (snapshot tại thời điểm aggregate) */
  wallets: {
    main: number;
    emergency: number;
    billFund: number;
    total: number;
  };

  /** Safe to spend & budget */
  budget: {
    monthlyBudgetTotal: number;
    spentSoFar: number;
    safeToSpend: number;        // = budget - spent - bills chưa trả còn lại
    safeToSpendPerDay: number;
    daysRemaining: number;
    categoriesOverBudget: number;
    categoriesTotal: number;
  };

  /** Bills */
  bills: {
    duePast: BillStatus[];      // đã đến hạn
    dueSoon: BillStatus[];      // sắp đến hạn (<= 7 ngày)
    paid: BillStatus[];         // đã trả tháng này
    overdue: BillStatus[];      // quá hạn chưa trả
    totalDueThisMonth: number;
    totalPaidThisMonth: number;
  };

  /** Top categories — chỉ giữ 5 mục để gọn */
  categories: {
    top5BySpend: CategorySnapshot[];
    topOverspent: CategorySnapshot[];      // sorted by overBy desc
    abnormalSpikes: CategoryAnomaly[];     // > 2 SD so với 3 tháng trước
  };

  /** Goals */
  goals: {
    active: GoalSnapshot[];
    completedThisMonth: GoalSnapshot[];
    atRisk: GoalSnapshot[];                // tốc độ hiện tại không đạt deadline
  };

  /** Earning tasks (side gig) */
  tasks: {
    activeCount: number;
    completedThisMonth: number;
    earnedFromTasks: number;
    upcomingDeadlines: TaskSnapshot[];     // <= 7 ngày
  };

  /** So sánh tháng trước */
  comparison: {
    incomeDelta: number;        // tháng này - tháng trước
    expenseDelta: number;
    savingsDelta: number;
    topCategoriesChange: { categoryId: string; deltaPercent: number }[];
  };

  /** Health score (đã có sẵn computeHealthScore) */
  health: {
    score: number;              // 0-100
    tier: 'critical' | 'warning' | 'ok' | 'excellent';
    breakdown: {
      cashflow: number;
      discipline: number;
      savingsProgress: number;
      goalProgress: number;
    };
  };
};

export type BillStatus = {
  id: string;
  name: string;                 // "Tiền điện"
  category: string;             // "electricity"
  amount: number;
  dueDate: string;              // ISO date
  status: 'paid' | 'due' | 'overdue';
  paidAt?: string;
};

export type CategorySnapshot = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  percentOfLimit: number;       // 0..n
  overBy: number;               // max(0, spent - limit)
  txCount: number;
};

export type CategoryAnomaly = {
  categoryId: string;
  name: string;
  thisMonth: number;
  avgPrev3Months: number;
  zScore: number;
};

export type GoalSnapshot = {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  percent: number;
  deadline?: string;
  monthsToCompleteAtCurrentPace: number;
};

export type TaskSnapshot = {
  id: string;
  title: string;
  estimatedIncome: number;
  dueDate?: string;
  completed: boolean;
  subTasksDone: number;
  subTasksTotal: number;
};
```

> **Kích thước thực tế**: với 1 user trung bình (5 bills, 12 categories, 3 goals, 5 tasks), JSON này serialize ra ~3-4 KB / khoảng 700-900 tokens. Đủ rẻ để gửi cho LLM mỗi báo cáo.

---

### 2.3 Service triển khai — `snapshotBuilder.ts`

```ts
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import type { MonthlyFinancialSnapshot } from './types';
import { computeHealthScore, getHealthTier } from '@/lib/cfoHealthScore';

type BuildOptions = {
  monthKey?: string;            // mặc định = tháng hiện tại
  scope?: 'full' | 'wallets-only' | 'bills-only' | 'budget-only';
  forceRefresh?: boolean;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry = { at: number; snap: MonthlyFinancialSnapshot };
const CACHE = new Map<string, CacheEntry>();

export async function getFinanceSnapshot(
  uid: string,
  options: BuildOptions = {},
): Promise<MonthlyFinancialSnapshot> {
  const monthKey = options.monthKey ?? currentMonthKey();
  const cacheKey = `${uid}:${monthKey}`;

  // === Cache check ===
  if (!options.forceRefresh) {
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.snap;
    }
  }

  const db = getAdminFirestore();
  const { start, end } = monthBounds(monthKey);

  // === Chạy parallel — Firestore reads ===
  const [txns, bills, goals, tasks, budgets, walletsDoc, prevTxns] = await Promise.all([
    db.collection(`users/${uid}/transactions`)
      .where('date', '>=', start).where('date', '<', end).get(),
    db.collection(`users/${uid}/bills`).get(),
    db.collection(`users/${uid}/goals`).get(),
    db.collection(`users/${uid}/tasks`).get(),
    db.collection(`users/${uid}/budgets`).where('monthKey', '==', monthKey).get(),
    db.doc(`users/${uid}/state/wallets`).get(),
    db.collection(`users/${uid}/transactions`)
      .where('date', '>=', prevMonthStart(monthKey)).where('date', '<', start).get(),
  ]);

  // === Cashflow ===
  let income = 0, expense = 0, savings = 0;
  const byCategory = new Map<string, { spent: number; count: number }>();
  for (const doc of txns.docs) {
    const t = doc.data();
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
    else if (t.type === 'transfer' && t.toWallet !== 'main') savings += t.amount;

    if (t.type === 'expense' && t.categoryId) {
      const cur = byCategory.get(t.categoryId) ?? { spent: 0, count: 0 };
      byCategory.set(t.categoryId, { spent: cur.spent + t.amount, count: cur.count + 1 });
    }
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const avgDailyExpense = expense / Math.max(1, dayOfMonth);

  // === Wallets ===
  const wallets = (walletsDoc.data() ?? {}) as {
    main?: number; emergency?: number; billFund?: number;
  };
  const walletTotal = (wallets.main ?? 0) + (wallets.emergency ?? 0) + (wallets.billFund ?? 0);

  // === Bills ===
  const billsParsed = bills.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
  const billStatus = classifyBills(billsParsed, monthKey);

  // === Budget ===
  const budgetTotal = budgets.docs.reduce((sum, d) => sum + (d.data().limit ?? 0), 0);
  const budgetCategories = budgets.docs.map((d) => ({ id: d.id, ...d.data() }) as any);
  const overCount = budgetCategories.filter((b) => {
    const s = byCategory.get(b.categoryId)?.spent ?? 0;
    return b.limit > 0 && s > b.limit;
  }).length;

  const safeToSpend = Math.max(
    0,
    budgetTotal - expense - billStatus.totalUnpaidThisMonth,
  );

  // === Categories — top 5 + overspent + anomaly ===
  const allCats = Array.from(byCategory.entries())
    .map(([id, v]) => {
      const budget = budgetCategories.find((b) => b.categoryId === id);
      const limit = budget?.limit ?? 0;
      return {
        id,
        name: budget?.name ?? id,
        spent: v.spent,
        limit,
        percentOfLimit: limit > 0 ? v.spent / limit : 0,
        overBy: Math.max(0, v.spent - limit),
        txCount: v.count,
      };
    });

  const top5BySpend = [...allCats].sort((a, b) => b.spent - a.spent).slice(0, 5);
  const topOverspent = [...allCats].filter((c) => c.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy).slice(0, 5);

  const abnormalSpikes = detectAnomalies(byCategory, prevTxns);

  // === Goals ===
  const goalSnapshots = goals.docs.map((d) => buildGoalSnap(d.id, d.data()));

  // === Tasks ===
  const taskSnapshots = tasks.docs.map((d) => buildTaskSnap(d.id, d.data()));
  const completedThisMonth = taskSnapshots.filter((t) => t.completed && inMonth(t, monthKey));

  // === Health score ===
  const breakdown = computeHealthScore({
    monthlyIncome: income,
    monthlyExpense: expense,
    safeToSpend,
    emergencyBalance: wallets.emergency ?? 0,
    categoriesTotal: budgetCategories.length,
    categoriesOverBudget: overCount,
    billsDueByNow: billStatus.duePast.length + billStatus.overdue.length,
    billsPaidOfDue: billStatus.paid.length,
    dayOfMonth,
  });

  // === Compose ===
  const snap: MonthlyFinancialSnapshot = {
    meta: {
      uid, monthKey,
      generatedAt: new Date().toISOString(),
      dayOfMonth, daysInMonth,
      transactionCount: txns.size,
      locale: 'vi-VN',
    },
    cashflow: {
      income, expense,
      net: income - expense,
      savings,
      savingsRate: income > 0 ? savings / income : 0,
      avgDailyExpense,
    },
    wallets: {
      main: wallets.main ?? 0,
      emergency: wallets.emergency ?? 0,
      billFund: wallets.billFund ?? 0,
      total: walletTotal,
    },
    budget: {
      monthlyBudgetTotal: budgetTotal,
      spentSoFar: expense,
      safeToSpend,
      safeToSpendPerDay: daysRemaining > 0 ? safeToSpend / daysRemaining : 0,
      daysRemaining,
      categoriesOverBudget: overCount,
      categoriesTotal: budgetCategories.length,
    },
    bills: billStatus,
    categories: {
      top5BySpend, topOverspent, abnormalSpikes,
    },
    goals: {
      active: goalSnapshots.filter((g) => g.percent < 1),
      completedThisMonth: goalSnapshots.filter((g) => g.percent >= 1),
      atRisk: goalSnapshots.filter((g) => g.monthsToCompleteAtCurrentPace > 24),
    },
    tasks: {
      activeCount: taskSnapshots.filter((t) => !t.completed).length,
      completedThisMonth: completedThisMonth.length,
      earnedFromTasks: completedThisMonth.reduce((s, t) => s + t.estimatedIncome, 0),
      upcomingDeadlines: taskSnapshots
        .filter((t) => !t.completed && t.dueDate && daysUntil(t.dueDate) <= 7)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    },
    comparison: compareWithPrevious(monthKey, txns.docs, prevTxns.docs),
    health: {
      score: breakdown.total,
      tier: getHealthTier(breakdown.total),
      breakdown: {
        cashflow: breakdown.cashflow,
        discipline: breakdown.discipline,
        savingsProgress: breakdown.savingsProgress,
        goalProgress: breakdown.goalProgress,
      },
    },
  };

  CACHE.set(cacheKey, { at: Date.now(), snap });
  return snap;
}

/** Invalidate cache khi user vừa ghi transaction mới. */
export function invalidateSnapshotCache(uid: string, monthKey?: string) {
  if (monthKey) CACHE.delete(`${uid}:${monthKey}`);
  else for (const k of CACHE.keys()) if (k.startsWith(`${uid}:`)) CACHE.delete(k);
}

// ====== Helpers ======
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthBounds(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(y, m - 1, 1));
  const end = Timestamp.fromDate(new Date(y, m, 1));
  return { start, end };
}
function prevMonthStart(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 4, 1)); // lùi 3 tháng để tính anomaly
}
// classifyBills, detectAnomalies, buildGoalSnap, buildTaskSnap, daysUntil,
// inMonth, compareWithPrevious — implement riêng từng file, giữ snapshotBuilder gọn.
```

> **Hiệu năng**: 7 query parallel, mỗi query trung bình ~50-150ms với Firestore. Tổng cold-call ~300-500ms. Hit cache thì <5ms.

---

### 2.4 Ví dụ JSON snapshot rút gọn (gửi cho LLM)

Khi gửi cho LLM, mình **strip** những field LLM không cần (vd: `meta.uid`, các id) để giảm tokens:

```json
{
  "month": "2026-06",
  "day": 7,
  "daysLeft": 24,
  "cashflow": {
    "income": 20000000,
    "expense": 8400000,
    "net": 11600000,
    "savings": 2000000,
    "savingsRate": 0.10,
    "avgDailyExpense": 1200000
  },
  "budget": {
    "total": 12000000,
    "safeToSpend": 3600000,
    "safeToSpendPerDay": 150000,
    "overBudgetCount": 2,
    "totalCategories": 12
  },
  "wallets": { "main": 4500000, "emergency": 6000000, "billFund": 1200000 },
  "billsUnpaid": [
    { "name": "Tiền điện", "amount": 850000, "dueIn": 3 },
    { "name": "Internet", "amount": 250000, "dueIn": 5 }
  ],
  "top5Spend": [
    { "name": "Ăn uống", "spent": 2400000, "limit": 2000000, "over": 400000 },
    { "name": "Shopee", "spent": 1800000, "limit": 1500000, "over": 300000 },
    { "name": "Xe", "spent": 1200000, "limit": 1500000, "over": 0 },
    { "name": "Cà phê", "spent": 700000, "limit": 500000, "over": 200000 },
    { "name": "Giải trí", "spent": 600000, "limit": 800000, "over": 0 }
  ],
  "anomalies": [
    { "name": "Shopee", "thisMonth": 1800000, "avg3mo": 800000, "z": 2.6 }
  ],
  "goalsAtRisk": [
    { "name": "Mua xe máy", "saved": 12000000, "target": 50000000, "pctDone": 24, "monthsAtPace": 38 }
  ],
  "tasksThisMonth": { "active": 3, "done": 2, "earned": 4500000 },
  "vsLastMonth": { "incomeDelta": 0, "expenseDelta": 1200000, "savingsDelta": -800000 },
  "health": { "score": 62, "tier": "warning" }
}
```

→ ~550 tokens. Đủ chỗ cho system prompt (300) + user message (50) + history (200) trong 1500 input tokens.

---

## Phần 3 — Prompt Template & Conversation State

### 3.1 System prompt — **Lord Diamond**

`src/lib/aiMoneyChat/llm/systemPrompts.ts`:

```ts
export const LORD_DIAMOND_SYSTEM_PROMPT = `
Bạn là **Lord Diamond — Quản gia tài chính tối cao của người dùng**, vai trò
tương đương Chief Financial Officer của một doanh nghiệp cá nhân.

# Identity & Tone
- Sắc sảo, thẳng thắn, kỷ luật. KHÔNG xã giao, KHÔNG nói chung chung.
- Tôn trọng người dùng nhưng không nịnh. Khi họ làm tốt: ghi nhận ngắn gọn.
  Khi họ chi sai: chỉ rõ "lố ở đâu, bao nhiêu, cắt cách nào".
- Văn phong tiếng Việt chuẩn, có thể dùng phép gọi "ngài" hoặc "bạn" linh hoạt.
- Không emoji trừ khi user yêu cầu.

# Hard Rules — KHÔNG ĐƯỢC VI PHẠM
1. Mọi con số bạn đưa ra PHẢI có trong dữ liệu (CONTEXT) được cung cấp.
   Nếu không có, NÓI THẲNG: "Dữ liệu này chưa có trong sổ của ngài."
   TUYỆT ĐỐI không bịa số liệu, không ước lượng "khoảng".
2. Không hứa tương lai. Khi dự báo, dùng cụm "với tốc độ hiện tại" và phải
   nêu giả định dựa trên con số nào.
3. Khi đề xuất hành động, phải:
   - Cụ thể (cắt món nào, bao nhiêu VND).
   - Có lý do dựa trên dữ liệu (ví dụ: "vì danh mục X lố Y VND tháng này").
   - Đo lường được (kèm số tiền tiết kiệm dự kiến).
4. KHÔNG đưa lời khuyên đầu tư cụ thể (không gợi cổ phiếu, coin, ngân hàng).
   Chỉ nói về cấu trúc tài chính cá nhân.
5. Khi không chắc về intent của user, hỏi LẠI một câu súc tích — không đoán mò.

# Output Format
- Mặc định: trả lời ngắn (3-6 dòng).
- Khi user hỏi "báo cáo" / "phân tích": dùng markdown với 3 section cố định:
  ## Tình hình
  ## Vấn đề chính
  ## Hành động đề xuất
- Mỗi action item phải có cấu trúc:
  "- **<Hành động>**: <số tiền/tỉ lệ cụ thể> → tiết kiệm/lợi ích <X VND>"

# Anti-pattern (KHÔNG được làm)
- "Bạn nên tiết kiệm nhiều hơn" — quá chung.
- "Hãy cân nhắc chi tiêu hợp lý" — vô nghĩa.
- "Tháng này có vẻ ổn" — không dùng số liệu.
- "Có thể bạn đã chi nhiều" — không xác nhận với dữ liệu.

# Context format
Bạn nhận CONTEXT là JSON dạng MonthlyFinancialSnapshot. Đọc kỹ trước khi nói.
`.trim();
```

#### Variant theo tone mode
ManiCash đã có 4 tone (`Dịu dàng`, `Cà khịa`, `Kỷ luật thép`, `Lord Diamond`). Có thể swap chỉ phần `# Identity & Tone` mà giữ các Hard Rules.

---

### 3.2 Prompt builder

`src/lib/aiMoneyChat/llm/promptBuilder.ts`:

```ts
import type { MonthlyFinancialSnapshot } from '@/lib/aiMoneyChat/aggregation/types';
import type { ConversationTurn } from './conversationStore';
import { LORD_DIAMOND_SYSTEM_PROMPT } from './systemPrompts';

type BuildArgs = {
  snapshot: MonthlyFinancialSnapshot;
  history: ConversationTurn[];        // tối đa 6 turns gần nhất
  userMessage: string;
  intent: string;
};

/** Bóc snapshot xuống dạng nhẹ — bỏ id, meta, locale... */
function compactSnapshot(s: MonthlyFinancialSnapshot) {
  return {
    month: s.meta.monthKey,
    day: s.meta.dayOfMonth,
    daysLeft: s.meta.daysInMonth - s.meta.dayOfMonth + 1,
    cashflow: s.cashflow,
    budget: {
      total: s.budget.monthlyBudgetTotal,
      safeToSpend: s.budget.safeToSpend,
      safeToSpendPerDay: s.budget.safeToSpendPerDay,
      overBudgetCount: s.budget.categoriesOverBudget,
      totalCategories: s.budget.categoriesTotal,
    },
    wallets: s.wallets,
    billsUnpaid: [...s.bills.duePast, ...s.bills.dueSoon, ...s.bills.overdue]
      .map((b) => ({ name: b.name, amount: b.amount, dueIn: dueInDays(b.dueDate) })),
    top5Spend: s.categories.top5BySpend.map((c) => ({
      name: c.name, spent: c.spent, limit: c.limit, over: c.overBy,
    })),
    anomalies: s.categories.abnormalSpikes.map((a) => ({
      name: a.name, thisMonth: a.thisMonth, avg3mo: a.avgPrev3Months, z: a.zScore,
    })),
    goalsAtRisk: s.goals.atRisk.map((g) => ({
      name: g.name, saved: g.savedAmount, target: g.targetAmount,
      pctDone: Math.round(g.percent * 100),
      monthsAtPace: g.monthsToCompleteAtCurrentPace,
    })),
    tasksThisMonth: {
      active: s.tasks.activeCount,
      done: s.tasks.completedThisMonth,
      earned: s.tasks.earnedFromTasks,
    },
    vsLastMonth: s.comparison,
    health: s.health,
  };
}

function dueInDays(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function buildLLMMessages(args: BuildArgs) {
  const compact = compactSnapshot(args.snapshot);

  const messages = [
    { role: 'system' as const, content: LORD_DIAMOND_SYSTEM_PROMPT },
    {
      role: 'system' as const,
      content:
        `# CONTEXT (dữ liệu tài chính tháng ${compact.month})\n` +
        '```json\n' + JSON.stringify(compact, null, 2) + '\n```\n' +
        `\n# Intent người dùng: ${args.intent}`,
    },
    // History — chỉ giữ assistant/user pairs gần nhất
    ...args.history.flatMap((t) => ([
      { role: 'user' as const, content: t.userMessage },
      { role: 'assistant' as const, content: t.assistantMessage },
    ])),
    { role: 'user' as const, content: args.userMessage },
  ];

  return messages;
}
```

---

### 3.3 LLM client wrapper

`src/lib/aiMoneyChat/llm/llmClient.ts`:

```ts
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

type LLMCallOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export async function callLLM(
  apiKey: string,
  messages: { role: string; content: string }[],
  opts: LLMCallOptions = {},
): Promise<{ content: string; tokensUsed: number }> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? 'llama-3.3-70b-versatile',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 600,
    }),
  });

  if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}
```

---

### 3.4 Conversation State — short-term session cache

#### Mục tiêu
Khi user hỏi:
```
User: lên báo cáo CFO tháng                 (turn 1 — fan ra snapshot, gọi LLM, tốn ~600 tokens)
User: tại sao mục Shopee lại lố?            (turn 2 — chỉ ref lại snapshot cũ, không re-aggregate)
User: cắt giảm 30% thì tiết kiệm bao nhiêu?  (turn 3 — vẫn xài snapshot turn 1)
```

→ Không re-aggregate, không re-gửi full DB.

#### Schema

```ts
// src/lib/aiMoneyChat/llm/conversationStore.ts

import type { MonthlyFinancialSnapshot } from '@/lib/aiMoneyChat/aggregation/types';

export type ConversationTurn = {
  at: string;                   // ISO
  intent: string;
  userMessage: string;
  assistantMessage: string;
  tokensUsed: number;
};

export type ConversationContext = {
  sessionId: string;
  uid: string;
  /** Snapshot đã aggregate ở turn đầu — dùng cho mọi follow-up. */
  snapshot: MonthlyFinancialSnapshot;
  snapshotAt: string;
  turns: ConversationTurn[];
  /** TTL absolute. */
  expiresAt: string;
};

const SESSION_TTL_MS = 30 * 60 * 1000;   // 30 phút
const MAX_TURNS = 8;
const STORE = new Map<string, ConversationContext>();

export function getOrCreateSession(sessionId: string, uid: string): ConversationContext | null {
  const c = STORE.get(sessionId);
  if (!c) return null;
  if (new Date(c.expiresAt).getTime() < Date.now()) {
    STORE.delete(sessionId);
    return null;
  }
  return c;
}

export function createSession(
  sessionId: string,
  uid: string,
  snapshot: MonthlyFinancialSnapshot,
): ConversationContext {
  const ctx: ConversationContext = {
    sessionId, uid,
    snapshot,
    snapshotAt: new Date().toISOString(),
    turns: [],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  STORE.set(sessionId, ctx);
  return ctx;
}

export function appendTurn(sessionId: string, turn: ConversationTurn): void {
  const c = STORE.get(sessionId);
  if (!c) return;
  c.turns.push(turn);
  if (c.turns.length > MAX_TURNS) c.turns.shift();
  // Gia hạn TTL khi có hoạt động
  c.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

/** Cleanup background — gọi từ cron hoặc on demand. */
export function purgeExpired(): number {
  let n = 0;
  const now = Date.now();
  for (const [k, v] of STORE) {
    if (new Date(v.expiresAt).getTime() < now) {
      STORE.delete(k); n++;
    }
  }
  return n;
}
```

> **Production note**:
> - In-memory `Map` chỉ hoạt động với single instance. Khi deploy lên Vercel với Fluid Compute, instance vẫn được tái sử dụng cho cùng session → đủ tốt cho beta. Cold start mất cache → handler tự re-aggregate.
> - Khi cần scale: chuyển sang **Vercel Runtime Cache** (`@vercel/cache`) hoặc Redis (Upstash on Vercel Marketplace) với key `chat:session:{sessionId}`.

---

### 3.5 Handler cho CFO Report + Follow-up

#### `handleCFOReport.ts`

```ts
import { getFinanceSnapshot } from '@/lib/aiMoneyChat/aggregation/snapshotBuilder';
import { buildLLMMessages } from '@/lib/aiMoneyChat/llm/promptBuilder';
import { callLLM } from '@/lib/aiMoneyChat/llm/llmClient';
import {
  createSession, getOrCreateSession, appendTurn,
} from '@/lib/aiMoneyChat/llm/conversationStore';
import { chargeAiMoneyFallbackCredit } from '@/lib/aiMoneyChat/quota';
import type { ChatIntent, ChatReply } from '@/lib/aiMoneyChat/intent/types';

export async function handleCFOReport(
  uid: string,
  intent: ChatIntent,
  sessionId: string,
): Promise<ChatReply> {
  // 1) Quota
  const quota = await chargeAiMoneyFallbackCredit(uid);
  if (!quota.allowed) {
    return {
      message:
        `Ngài đã dùng hết quota AI tháng này (${quota.usedCredits}/${quota.usedCredits + quota.remainingCredits}). ` +
        'Nâng cấp Pro hoặc đợi sang tháng để tiếp tục dùng phân tích AI.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // 2) Snapshot — luôn dùng latest, vì user vừa "yêu cầu báo cáo"
  const snapshot = await getFinanceSnapshot(uid, { forceRefresh: true });

  // 3) Session
  const session = getOrCreateSession(sessionId, uid) ?? createSession(sessionId, uid, snapshot);

  // 4) Build prompt
  const messages = buildLLMMessages({
    snapshot: session.snapshot,
    history: session.turns,
    userMessage: intent.normalizedText,
    intent: intent.type,
  });

  // 5) Call LLM
  const apiKey = process.env.GROQ_API_KEY!;
  const { content, tokensUsed } = await callLLM(apiKey, messages, {
    temperature: 0.3,
    maxTokens: 700,
  });

  // 6) Persist turn
  appendTurn(sessionId, {
    at: new Date().toISOString(),
    intent: intent.type,
    userMessage: intent.normalizedText,
    assistantMessage: content,
    tokensUsed,
  });

  return {
    message: content,
    ui: {
      kind: 'cfo-card',
      payload: {
        healthScore: snapshot.health.score,
        tier: snapshot.health.tier,
        suggestions: extractSuggestions(content),
      },
    },
    meta: { intent: intent.type, source: 'llm', latencyMs: 0, tokensUsed },
  };
}

function extractSuggestions(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    .slice(0, 5);
}
```

#### `handleFollowUp.ts`

```ts
import { getOrCreateSession, appendTurn } from '@/lib/aiMoneyChat/llm/conversationStore';
import { buildLLMMessages } from '@/lib/aiMoneyChat/llm/promptBuilder';
import { callLLM } from '@/lib/aiMoneyChat/llm/llmClient';
import { chargeAiMoneyFallbackCredit } from '@/lib/aiMoneyChat/quota';
import type { ChatIntent, ChatReply } from '@/lib/aiMoneyChat/intent/types';

export async function handleFollowUp(
  uid: string,
  intent: ChatIntent,
  sessionId: string,
): Promise<ChatReply> {
  const session = getOrCreateSession(sessionId, uid);

  // Nếu session đã hết hạn → degrade về CFO_REPORT mới
  if (!session) {
    return {
      message:
        'Phiên hội thoại trước đã hết hạn. Bạn muốn mình lên báo cáo CFO mới không?',
      ui: { kind: 'follow-up-buttons', payload: { actions: ['cfo-report'] } },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  // Re-use snapshot cũ — KHÔNG re-aggregate
  const quota = await chargeAiMoneyFallbackCredit(uid);
  if (!quota.allowed) {
    return {
      message: 'Hết quota AI. Sang tháng nhé.',
      ui: { kind: 'none' },
      meta: { intent: intent.type, source: 'deterministic', latencyMs: 0 },
    };
  }

  const messages = buildLLMMessages({
    snapshot: session.snapshot,
    history: session.turns,
    userMessage: intent.normalizedText,
    intent: intent.type,
  });

  const { content, tokensUsed } = await callLLM(process.env.GROQ_API_KEY!, messages, {
    temperature: 0.3,
    maxTokens: 500,
  });

  appendTurn(sessionId, {
    at: new Date().toISOString(),
    intent: intent.type,
    userMessage: intent.normalizedText,
    assistantMessage: content,
    tokensUsed,
  });

  return {
    message: content,
    ui: { kind: 'none' },
    meta: { intent: intent.type, source: 'llm-cached', latencyMs: 0, tokensUsed },
  };
}
```

---

### 3.6 Ví dụ end-to-end conversation

```
[Turn 1]
User:  lên báo cáo CFO tháng 6 đi
→ intent: CFO_REPORT, confidence: high
→ pipeline: llm
→ aggregate snapshot (cold: 450ms)
→ createSession + callLLM (1.2s, 540 tokens in + 280 out)
Assistant:
   ## Tình hình
   Tháng 6 đến ngày 7. Thu 20.000.000đ, chi 8.400.000đ — net +11.600.000đ.
   Health score 62/100 (warning).

   ## Vấn đề chính
   - Shopee chi 1.800.000đ — gấp 2.25 lần trung bình 3 tháng (z=2.6).
   - Ăn uống lố 400.000đ; Cà phê lố 200.000đ.
   - Còn 2 bill chưa trả: Điện 850k (3 ngày tới), Internet 250k (5 ngày tới).
   - Mục tiêu "Mua xe máy" còn 38 tháng ở tốc độ này — quá deadline.

   ## Hành động đề xuất
   - **Đặt freeze Shopee tuần này**: tiết kiệm ~450.000đ → đẩy được 1 tháng tiến độ xe máy.
   - **Chuyển bill Điện về quỹ Trả bill ngay hôm nay**: tránh quên ngày 10.
   - **Cắt 1 ngày cà phê/tuần**: tiết kiệm ~120.000đ/tháng.

[Turn 2]
User:  tại sao Shopee lại lố?
→ intent: FOLLOW_UP (detect "tại sao")
→ pipeline: llm-cached (KHÔNG re-aggregate)
→ append turn 1 vào history → callLLM (700ms, 850 tokens in + 180 out)
Assistant:
   Lố vì chi 1.800.000đ trong khi giới hạn ngân sách Shopee là 1.500.000đ
   (vượt 300.000đ ~20%). So với trung bình 3 tháng trước (800.000đ),
   tháng này gấp 2.25 lần. Anomaly z-score 2.6 — bất thường có ý nghĩa
   thống kê, không phải dao động ngẫu nhiên.

[Turn 3]
User:  nếu mình cắt 30% Shopee thì tiết kiệm bao nhiêu?
→ intent: FOLLOW_UP
→ pipeline: llm-cached
Assistant:
   30% của 1.800.000đ = 540.000đ/tháng.
   Trong 12 tháng: 6.480.000đ — đủ để rút ngắn tiến độ "Mua xe máy" thêm
   ~5 tháng (giá xe target chia trung bình tiết kiệm tăng thêm).
```

---

## 4. Cost Analysis

| Use case | Tokens vào | Tokens ra | Chi phí Groq Llama-3.3-70B | Chi phí GPT-4o-mini |
|---|---|---|---|---|
| Intent classify (rule-based) | 0 | 0 | **0 VND** | 0 VND |
| Intent classify (LLM fallback) | ~150 | ~50 | ~2 VND | ~5 VND |
| Query balance (deterministic) | 0 | 0 | **0 VND** | 0 VND |
| CFO Report (turn 1) | ~850 (system+context+question) | ~350 | ~30-40 VND | ~80 VND |
| Follow-up (turn 2+, cached) | ~1100 (thêm history) | ~200 | ~25 VND | ~60 VND |

Với target Pro 49.000đ/tháng → 1.500 credits → mỗi user trung bình:
- 50 transactions/month → 50 * 0đ (local) + 5 lần fallback * 9đ = **45đ**
- 4 CFO reports + 12 follow-ups → 4*40 + 12*25 = **460đ**
- Tổng AI cost / user ~500-1.000đ/tháng → biên độ rất rộng để mở rộng feature.

---

## 5. Rollout Plan

### Phase A — Intent Router foundation (3-5 ngày)
- [ ] Tạo `src/lib/aiMoneyChat/intent/` với types + patterns + classifier + router.
- [ ] Viết test parser cho 50 câu tiếng Việt sinh hoạt (mỗi intent ≥ 5 câu).
- [ ] Endpoint `/api/chat/route.ts` — chỉ wire `LOG_TRANSACTION` (giữ behavior cũ qua proxy).
- [ ] Migrate `/chat` page client từ `parseMoneyText` trực tiếp → gọi `/api/chat`.
- [ ] Acceptance: tất cả luồng nhập liệu hiện có vẫn pass.

### Phase B — Deterministic queries (3-4 ngày)
- [ ] Implement `getFinanceSnapshot()` scope-aware (`wallets-only`, `bills-only`, `budget-only`).
- [ ] Handlers: `QUERY_BALANCE`, `QUERY_BILL_STATUS`, `QUERY_SAVINGS`, `QUERY_SAFE_TO_SPEND`, `QUERY_TASKS_TODAY`, `QUERY_GOAL_PROGRESS`.
- [ ] UI: response render markdown + optional quick-action chips.
- [ ] Snapshot cache layer (in-memory `Map`, 5 phút TTL).
- [ ] Acceptance: 10 câu hỏi đại diện trả lời chính xác, không hit LLM.

### Phase C — Full snapshot + CFO LLM (4-5 ngày)
- [ ] Implement full `getFinanceSnapshot()` (anomalies, comparison, goals at risk).
- [ ] Build `LORD_DIAMOND_SYSTEM_PROMPT` + `promptBuilder`.
- [ ] Handler `CFO_REPORT`, `ANALYZE_FINANCE`, `ADVICE_CUT_SPENDING`.
- [ ] Quota wiring qua `chargeAiMoneyFallbackCredit`.
- [ ] Test prompt golden: 5 snapshot fixture × 5 câu hỏi → so sánh output.

### Phase D — Conversation state (2-3 ngày)
- [ ] `conversationStore.ts` (in-memory, sau move sang Vercel Cache).
- [ ] Handler `FOLLOW_UP` + detect heuristic ("tại sao", "đó", "cách nào").
- [ ] UI: `useChatSessionStore` client-side mirror, hiển thị badge "đang theo dõi báo cáo".
- [ ] TTL purge cron (hoặc lazy purge on access).

### Phase E — Hardening (2 ngày)
- [ ] Telemetry: log `intent.type`, `source`, `latencyMs`, `tokensUsed`.
- [ ] Rate limit per uid (token bucket 30 req/phút).
- [ ] Snapshot invalidation hook: khi `useFinanceStore.addTransaction` → call `invalidateSnapshotCache(uid)`.
- [ ] Doc + report `reports/chat-backend-upgrade-report.md`.

---

## 6. Open Questions

1. **Multi-month query**: Nếu user hỏi "so tháng này với tháng trước", có nên cache 3 tháng gần nhất trong session không? → Đề xuất: chỉ cache tháng hiện tại; multi-month thì re-aggregate (5-10 query thêm, vẫn dưới 1s).
2. **Streaming response**: LLM trả về chậm 1-2s. Có nên SSE stream content cho UI không? → Phase C ưu tiên ship trước, streaming để Phase F.
3. **Multi-language**: Hiện chỉ tiếng Việt. Nếu user nhập tiếng Anh ("how much do I have left"), classifier hiện sẽ rớt sang `UNKNOWN`. → Để Phase G.
4. **Persisted session**: User đóng app → session mất. Có nên lưu Firestore `users/{uid}/chatSessions/{sessionId}` không? → Đề xuất KHÔNG vì:
   - Snapshot có thể stale sau vài giờ.
   - Session ngắn hạn (30 phút) đủ cho 1 buổi review.

---

## 7. Liên kết tài liệu liên quan

- [docs/AI_MONEY_CHAT_ROADMAP.md](AI_MONEY_CHAT_ROADMAP.md) — Roadmap gốc.
- [docs/AI_MONEY_CHAT_PHASE0_DISCOVERY.md](AI_MONEY_CHAT_PHASE0_DISCOVERY.md) — Phase 0 discovery.
- [src/lib/aiMoneyChat/parser.ts](../src/lib/aiMoneyChat/parser.ts) — Local parser hiện có.
- [src/lib/cfoHealthScore.ts](../src/lib/cfoHealthScore.ts) — Health score formula.
- [src/app/api/cfo/route.ts](../src/app/api/cfo/route.ts) — CFO endpoint hiện tại (sẽ deprecate dần khi `/api/chat` lên).
