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
  // Older imported widgets may still carry a selected-day record. Ignore it.
  return new Date(now.getFullYear(),now.getMonth(),now.getDate())
}

export function validateSelection(value: unknown, now = new Date()): string {
  const date = parseLocalDay(value)
  const {start,end}=weekRange(now)
  if (!date || date < start || date >= end) throw new Error('Data fora da semana exibida.')
  return localDay(date)
}

export function weekRange(now=new Date()){
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-now.getDay())
  const end=new Date(start);end.setDate(end.getDate()+7)
  return {start,end}
}

// Only our retired navigation preference is removed; agenda/Bridge caches remain.
export function clearTimelineSelection(storage=Storage){
  try{storage.remove('selected-day')}catch{}
}
