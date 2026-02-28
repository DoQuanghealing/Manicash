// src/utils/format.ts

// Parse an unknown input into a safe number.
// - Supports: number, "1.234.567", "1,234,567", " 1 234 567 ", "-1200"
// - Keeps minus sign. Drops all other non-numeric chars except "." and ","
// - If both "." and "," exist, assumes the last separator is decimal and removes the rest.
const toSafeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value == null) return fallback;

  const raw = String(value).trim();
  if (!raw) return fallback;

  // Keep digits, dot, comma, minus
  let s = raw.replace(/[^\d.,-]/g, "");

  // If multiple minus signs or minus not at start -> normalize
  s = s.replace(/(?!^)-/g, "");

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // Decide decimal separator by last occurrence
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";

    // Remove thousand separators, convert decimal to "."
    s = s.split(thouSep).join("");
    if (decSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    // Common vi-VN input: "1.234.567" => commas less common; but if commas exist alone,
    // it could be thousand sep or decimal. We'll treat comma as thousand sep if multiple.
    const commas = (s.match(/,/g) || []).length;
    if (commas >= 2) s = s.split(",").join("");
    else s = s.replace(",", "."); // allow "12,5" => 12.5
  } else if (hasDot && !hasComma) {
    const dots = (s.match(/\./g) || []).length;
    // If multiple dots, treat as thousand separators
    if (dots >= 2) s = s.split(".").join("");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
};

export const formatVND = (amount: number | string): string => {
  const n = toSafeNumber(amount, 0);
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
};

// Live formatting for text input (money style).
// Important for your app:
// - keeps "0" as "0" (doesn't blank out)
// - strips non-digits (money in VND integer), but preserves leading zeros -> normalized to int
export const formatNumberInput = (value: string | number): string => {
  const str = String(value ?? "");

  // keep digits only for VND integer input
  const digits = str.replace(/\D/g, "");

  // If user cleared the input, return empty.
  if (digits.length === 0) return "";

  // Avoid huge numbers causing parse issues
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";

  return new Intl.NumberFormat("vi-VN").format(n);
};

// Parse formatted money input back to number (integer VND).
export const parseNumberInput = (value: string | number): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

// Optional: compact number for UI badges
export const formatCompactNumber = (amount: number | string): string => {
  const n = toSafeNumber(amount, 0);
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};