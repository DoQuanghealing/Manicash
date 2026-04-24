/* ═══ Butler Name Utilities ═══ */

const DEFAULT_NAME = 'Lord Diamond';

/**
 * Replace all occurrences of "Lord Diamond" with custom butler name.
 */
export function replaceButlerName(text: string, customName: string): string {
  if (!customName || customName === DEFAULT_NAME) return text;
  return text.replaceAll(DEFAULT_NAME, customName);
}
