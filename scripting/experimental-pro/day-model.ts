export const localDay=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export function parseDay(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Use AAAA-MM-DD.')
  const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d)
  if(localDay(date)!==value)throw Error('Data inválida.')
  return date
}
export function analyzeDay(events:any[],reminders:any[],date:string,eventRead=true,reminderRead=true){
  const start=parseDay(date),end=new Date(start);end.setDate(end.getDate()+1)
  const timed=events.filter(e=>!e.isAllDay&&Number.isFinite(Date.parse(e.start))&&Number.isFinite(Date.parse(e.end))&&Date.parse(e.end)>+start&&Date.parse(e.start)<+end).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))
  const conflicts:any[]=[]
  for(let i=0;i<timed.length;i++)for(let j=i+1;j<timed.length;j++){
    if(Date.parse(timed[j].start)>=Date.parse(timed[i].end))break
    if(timed[i].availability!=='free'&&timed[j].availability!=='free')conflicts.push([timed[i].title,timed[j].title])
  }
  const a=new Date(start);a.setHours(8);const b=new Date(start);b.setHours(18)
  const slots:any[]=[];let cursor=+a
  if(eventRead){for(const e of timed.filter(e=>e.availability!=='free')){
    const s=Math.max(+a,Date.parse(e.start)),t=Math.min(+b,Date.parse(e.end));if(t<=s)continue
    if(s>cursor)slots.push({start:new Date(cursor).toISOString(),end:new Date(s).toISOString()})
    cursor=Math.max(cursor,t)
  }if(cursor<+b)slots.push({start:new Date(cursor).toISOString(),end:b.toISOString()})}
  return {date,capturedAt:new Date().toISOString(),coverage:{events:eventRead,reminders:reminderRead},events,
    reminders:reminders.filter(r=>!r.completed),conflicts,slots,
    slotScope:'Intervalos sem eventos ocupados com horário entre 08h e 18h. Eventos de dia inteiro e lembretes não são descontados. Não comprova disponibilidade pessoal.'}
}
export async function readDay(date:string){
  const start=parseDay(date),end=new Date(start);end.setDate(end.getDate()+1)
  const reads=await Promise.allSettled([CalendarEvent.getAll(start,end),Reminder.getAll()])
  const events=reads[0].status==='fulfilled'?reads[0].value.map(n=>({id:n.identifier,title:n.title,calendar:n.calendar?.title??'',isAllDay:!!n.isAllDay,start:new Date(n.startDate).toISOString(),end:new Date(n.endDate).toISOString(),availability:n.availability})):[]
  const reminders=reads[1].status==='fulfilled'?reads[1].value.filter(n=>{
    const c=n.dueDateComponents;return c?.year===start.getFullYear()&&c?.month===start.getMonth()+1&&c?.day===start.getDate()
  }).map(n=>({id:n.identifier,title:n.title,calendar:n.calendar?.title??'',completed:n.isCompleted})):[]
  const result=analyzeDay(events,reminders,date,reads[0].status==='fulfilled',reads[1].status==='fulfilled')
  Storage.set('pro-day',result);return result
}
