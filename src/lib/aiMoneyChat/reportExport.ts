/* ═══ Phase 12 — CFO Report Export (CSV) ═══
 * Pure functions, no dependencies. Builds a UTF-8 CSV string from aggregated
 * monthly report data. The CSV opens cleanly in Excel/Google Sheets with
 * Vietnamese accents preserved (BOM prefix added at download time).
 */

export interface ReportExportData {
  monthLabel: string;
  income: number;
  expense: number;
  savings: number;
  savingsRate: number;
  healthScore: number;
  tierLabel: string;
  categories: Array<{ name: string; amount: number }>;
  goals: Array<{ name: string; current: number; target: number; progress: number }>;
  actionPlan: string[];
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(cells: Array<string | number>): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Build a multi-section CSV string for the monthly CFO report. */
export function buildMonthlyReportCsv(data: ReportExportData): string {
  const lines: string[] = [];

  lines.push(row([`ManiCash — Báo cáo ${data.monthLabel}`]));
  lines.push('');

  lines.push(row(['Tổng quan', 'Giá trị']));
  lines.push(row(['Sức khỏe tài chính', `${data.healthScore}/100 (${data.tierLabel})`]));
  lines.push(row(['Thu nhập', data.income]));
  lines.push(row(['Chi tiêu', data.expense]));
  lines.push(row(['Tiết kiệm', data.savings]));
  lines.push(row(['Tỷ lệ tiết kiệm (%)', data.savingsRate]));
  lines.push('');

  if (data.categories.length > 0) {
    lines.push(row(['Danh mục chi tiêu', 'Số tiền']));
    for (const cat of data.categories) {
      lines.push(row([cat.name, cat.amount]));
    }
    lines.push('');
  }

  if (data.goals.length > 0) {
    lines.push(row(['Mục tiêu', 'Đã có', 'Cần đạt', 'Tiến độ (%)']));
    for (const goal of data.goals) {
      lines.push(row([goal.name, goal.current, goal.target, goal.progress]));
    }
    lines.push('');
  }

  if (data.actionPlan.length > 0) {
    lines.push(row(['Kế hoạch tháng tới']));
    data.actionPlan.forEach((action, i) => {
      lines.push(row([`${i + 1}`, action]));
    });
  }

  return lines.join('\n');
}

/** Trigger a browser download of the CSV (client-only). UTF-8 BOM keeps Excel happy. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
