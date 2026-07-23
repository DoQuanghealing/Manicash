/* ═══ Butler Name Utilities ═══ */

const DEFAULT_NAME = 'Lord Diamond';

/**
 * Replace all occurrences of "Lord Diamond" with custom butler name.
 */
export function replaceButlerName(text: string, customName: string): string {
  if (!customName || customName === DEFAULT_NAME) return text;
  return text.replaceAll(DEFAULT_NAME, customName);
}

/** Viết tắt tên quản gia cho avatar tròn: "Lord Diamond"→"LD", "Vượng Tài"→"VT". */
export function butlerInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
