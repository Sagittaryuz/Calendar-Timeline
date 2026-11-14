// Production is always anchored to the current local civil day. The saved
// selection argument is ignored for compatibility with older callers.
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function resolveFocus(saved: unknown, now = new Date()): Date {
  return new Date(now.getFullYear(),now.getMonth(),now.getDate())
}
