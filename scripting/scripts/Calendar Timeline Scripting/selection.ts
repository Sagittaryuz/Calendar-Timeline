export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function parseLocalDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y,m,d] = value.split('-').map(Number)
  const date = new Date(y,m-1,d)
  return localDay(date) === value ? date : null
}

export function resolveFocus(saved: unknown, now = new Date()): Date {
  const record = saved as {date?: unknown; selectedOn?: unknown} | null
  // A choice lasts for the current real day; midnight restores today automatically.
  const chosen = record?.selectedOn === localDay(now) ? parseLocalDay(record.date) : null
  if (!chosen || localDay(chosen) === localDay(now)) return new Date(now)
  return chosen
}

export function validateSelection(value: unknown, now = new Date()): string {
  const date = parseLocalDay(value)
  const first = new Date(now.getFullYear(),now.getMonth(),now.getDate()-7)
  const last = new Date(now.getFullYear(),now.getMonth(),now.getDate()+7)
  if (!date || date < first || date > last) throw new Error('Data fora do intervalo de navegação.')
  return localDay(date)
}
