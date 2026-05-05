import type { InvariantViolation, PhaseRunResult, PersonaProfile } from './types';
import { formatVnd, sum } from './math';

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), item]);
  }
  return grouped;
}

export function formatViolationLine(violation: InvariantViolation): string {
  return `- [${violation.personaId}][Ngay ${violation.day}][Invariant ${violation.invariantId}] expected ${violation.expected}, got ${violation.actual}`;
}

export function buildIntermediateReport(results: PhaseRunResult[], personas: PersonaProfile[]): string {
  const violations = results.flatMap((result) => result.violations);
  const violationsByPersona = groupBy(violations, (violation) => violation.personaId);
  const violationsByInvariant = groupBy(violations, (violation) => String(violation.invariantId));

  const personaLines = personas.map((persona) => {
    const result = results.find((item) => item.personaId === persona.id);
    const personaViolations = violationsByPersona.get(persona.id) ?? [];
    const incomeTotal = sum(result?.finalState.ledger.transactions.filter((txn) => txn.type === 'income').map((txn) => txn.amount) ?? []);
    const expenseTotal = sum(result?.finalState.ledger.transactions.filter((txn) => txn.type === 'expense').map((txn) => txn.amount) ?? []);
    const savingsTotal = sum(Object.values(result?.finalState.app.fundBalances ?? {}));
    return `| ${persona.displayName} | ${result?.daysRun ?? 0} | ${formatVnd(incomeTotal)} | ${formatVnd(expenseTotal)} | ${formatVnd(savingsTotal)} | ${personaViolations.length} |`;
  });

  const invariantLines =
    violationsByInvariant.size === 0
      ? ['- Khong co invariant violation trong adapter mo phong Phase 0+1.']
      : Array.from(violationsByInvariant.entries()).map(
          ([id, items]) => `- Invariant #${id}: ${items.length} violation(s)`,
        );

  const firstViolations =
    violations.length === 0
      ? ['- Khong co violation tu dong de hien thi.']
      : violations.slice(0, 20).map(formatViolationLine);

  return [
    '# Synthetic User Testing - Intermediate Phase 0+1',
    '',
    '## Scope',
    '',
    '- Window: ngay 1-30, bat dau 2025-08-01.',
    '- Layer 1: deterministic ledger + invariant checks.',
    '- Layer 2: da tao diary 30 ngay dau va UX findings tam thoi; se append tiep sau Phase 2/3.',
    '- App code khong bi sua trong phase run.',
    '',
    '## Summary',
    '',
    `- Personas run: ${results.length}`,
    `- Total invariant violations: ${violations.length}`,
    '- Status: Phase 0+1 da chay xong tren synthetic adapter. Chua noi vao browser/Zustand that vi repo chua co test runner/path-alias loader on dinh.',
    '',
    '## Persona Totals',
    '',
    '| Persona | Days | Income | Expense | Savings | Violations |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...personaLines,
    '',
    '## Violations By Invariant',
    '',
    ...invariantLines,
    '',
    '## First Violations',
    '',
    ...firstViolations,
    '',
    '## Phase 2 Adjustments Proposed',
    '',
    '- Noi them adapter voi store/browser that truoc khi chay edge case xoa giao dich va sua bill, neu khong report se chi la mo phong tham chieu.',
    '- Backdate la case can verify truc tiep trong UI vi source hien tai khong thay date picker trong TransactionInput.',
    '- Delete transaction la case Phase 2 can verify truc tiep vi source hien tai chua thay action xoa giao dich trong FinanceStore.',
    '',
  ].join('\n');
}

export function buildBugsReportFromPhaseOne(): string {
  return [
    '# Bugs - Synthetic User Testing',
    '',
    '## BUG #1 - [Severity: High]',
    '',
    '- File: src/stores/useFinanceStore.ts; src/components/ui/TransactionInput.tsx',
    '- Repro: Persona Minh, Ngay 14, nhap bu giao dich ngay 12-13. Persona Tuan, Ngay 12, nhap bu giao dich ngay 8-11.',
    '- Expected: Flow nhap giao dich cho phep chon ngay giao dich cu; `dateKey` cua transaction phai la ngay duoc chon va monthly snapshot cua thang do duoc tinh lai.',
    '- Actual: `addTransaction` tu tao `date`, `dateKey` bang `new Date()` va `TransactionInput` khong truyen ngay tuy chon. Search source chua thay action backdate rieng.',
    '- Invariant violated: #7 khi noi adapter vao UI/store that.',
    '- Suggested fix: them truong ngay giao dich vao input va cho `addTransaction` nhan optional transaction date; sau do recalculate budget/month snapshot theo thang cua transaction date.',
    '',
    '## BUG #2 - [Severity: Medium]',
    '',
    '- File: src/stores/useFinanceStore.ts; src/app/(app)/ledger/_components/LedgerContent.tsx',
    '- Repro: Phase 2, Persona Huong, Ngay 38, xoa mot giao dich nhap sai cach day 5 ngay.',
    '- Expected: Co action xoa transaction va rollback balance, category spent, monthly snapshot, chart contribution neu lien quan.',
    '- Actual: Source hien tai khong thay `deleteTransaction/removeTransaction`; ledger chi loc/xem transaction.',
    '- Invariant violated: #8 khi toi Phase 2.',
    '- Suggested fix: thiet ke action xoa/sua transaction trong FinanceStore truoc, gom rollback side effects vao mot duong duy nhat.',
    '',
    '> Note: day la finding tu doc source trong luc chay Phase 0+1 setup, can verify lai bang UI/browser truoc khi fix theo canh bao false positive cua plan.',
    '',
  ].join('\n');
}

export function buildUxFindingsPhaseOne(): string {
  return [
    '# UX Findings - Synthetic User Testing',
    '',
    '## Phase 0+1 Pain Points',
    '',
    '1. Backdate la diem roi thoi quen lon nhat cho Minh va Tuan: ca hai persona deu co ngay quen va can nhap bu.',
    '2. Flow chia tien sau khi nhan thu nhap can cuc ngan; neu slider/preset qua day, user co the dong popup va de tien o vi chinh.',
    '3. Bill den han truoc ngay co thu nhap tao cam giac bi ket; UI can noi ro quy bill thieu bao nhieu va goi y nap.',
    '4. So 0 o tiet kiem la dung, nhung can giai thich bang tien trinh/phan bo de user khong thay app bi trong.',
    '5. Persona co con nhu Huong can nhom chi tieu cho con ro hon de bieu do co y nghia.',
    '',
    '## Phase 0+1 Delights',
    '',
    '1. Tach tong tien can nap thanh chi tieu hang ngay + bill co dinh giup user hieu vi sao can nap tien.',
    '2. Chia tien ngay sau thu nhap lam savings tang som, co tac dung dong luc voi Huong.',
    '3. Ledger theo ngay phu hop voi nguoi hay quen neu backdate duoc lam dung.',
    '',
    '## Habit Formation',
    '',
    '- Huong co kha nang dinh cao nhat vi nhap deu va quan tam bieu do.',
    '- Minh co the dinh neu nhap bu nhanh, vi co muc tieu MacBook ro.',
    '- Tuan de roi nhat neu app khong xu ly backdate va vuot nguong that mem.',
    '',
  ].join('\n');
}

export function buildExecutiveSummaryPhaseOne(): string {
  return [
    '# Executive Summary - Phase 0+1',
    '',
    '- Automated invariant violations: 0 tren synthetic adapter.',
    '- Technical findings logged: 1 High, 1 Medium.',
    '- Persona co rui ro roi app cao nhat: Tuan.',
    '- Finding non-obvious hien tai: app source co comment ve backdate/streak, nhung `addTransaction` va `TransactionInput` chua co duong truyen ngay giao dich cu.',
    '',
    '## Top 3 Priorities Before Continuing',
    '',
    '1. Noi adapter vao store/browser that de bien violations thanh bug co repro chac hon.',
    '2. Verify backdate flow trong UI; neu khong co, day la High truoc khi test user that.',
    '3. Thiet ke rollback cho sua/xoa transaction truoc Phase 2.',
    '',
    '## Readiness',
    '',
    '- Readiness for real user testing: 5/10.',
    '- Ly do: cong thuc tong quan da co read-model ro, nhung test tu dong chua cham truc tiep store/browser that va cac flow backdate/delete con thieu bang chung runtime.',
    '',
  ].join('\n');
}
