// Read-only projection. Native objects/notes/attendees never leave the phone.
export const AGENDA_SCOPE='iphone-current-and-next-week-v1'
const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export function agendaWindow(now=new Date()){
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate())
 start.setDate(start.getDate()-((start.getDay()+6)%7))
 const next=new Date(start);next.setDate(next.getDate()+7)
 const end=new Date(start);end.setDate(end.getDate()+14)
 return {start:start.toISOString(),end:end.toISOString(),startDay:day(start),nextStart:day(next),endDay:day(end),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone??'UTC'}
}
export function exclusiveAllDayEnd(start:Date,end:Date){
 const result=new Date(end.getFullYear(),end.getMonth(),end.getDate())
 if(end.getHours()||end.getMinutes()||end.getSeconds()||end.getMilliseconds())result.setDate(result.getDate()+1)
 if(day(result)<=day(start))result.setTime(new Date(start.getFullYear(),start.getMonth(),start.getDate()+1).getTime())
 return day(result)
}
export function agendaDate(components:any){
 if(!components||components.year==null||components.month==null||components.day==null)return null
 const dateOnly=`${components.year}-${String(components.month).padStart(2,'0')}-${String(components.day).padStart(2,'0')}`
 if(components.hour==null||components.minute==null)return dateOnly
 return new Date(components.year,components.month-1,components.day,components.hour,components.minute).toISOString()
}
export async function collectAgenda(now=new Date(),host:any={events:(a:Date,b:Date)=>CalendarEvent.getAll(a,b),reminders:()=>Reminder.getAll()}){
 const startedAt=new Date().toISOString(),window=agendaWindow(now)
 const reads=await Promise.allSettled([host.events(new Date(window.start),new Date(window.end)),host.reminders()])
 const coverage:any={},items:any[]=[]
 for(let i=0;i<reads.length;i++){
  const kind=i===0?'event':'reminder',result=reads[i]
  coverage[kind]={state:result.status==='fulfilled'?'ok':'error',count:0}
  if(result.status!=='fulfilled')continue
  let invalid=0
  for(const native of result.value as any[]){
   try{
    const item:any={kind,id:native.identifier,title:native.title,calendarId:native.calendar?.identifier??'unknown',calendarTitle:native.calendar?.title??'',calendarType:native.calendar?.type??'unknown'}
    if(kind==='event'){
     const start=new Date(native.startDate),end=new Date(native.endDate)
     if(!Number.isFinite(+start)||!Number.isFinite(+end)||+end<=+start)throw Error('Invalid interval')
     if(+end<=Date.parse(window.start)||+start>=Date.parse(window.end))continue
     item.isAllDay=!!native.isAllDay;item.start=item.isAllDay?day(start):start.toISOString();item.end=item.isAllDay?exclusiveAllDayEnd(start,end):end.toISOString()
     item.occurrence=new Date(native.occurrenceDate??native.startDate).toISOString()
     const modified=native.lastModifiedDate==null?NaN:+new Date(native.lastModifiedDate)
     item.nativeModifiedAt=Number.isFinite(modified)?new Date(modified).toISOString():null
     item.timeZone=native.timeZone??window.timeZone
    }else{
     item.due=agendaDate(native.dueDateComponents);item.completed=!!native.isCompleted
     if(!item.due)continue
     const inRange=item.due.length===10?item.due>=window.startDay&&item.due<window.endDay:Date.parse(item.due)>=Date.parse(window.start)&&Date.parse(item.due)<Date.parse(window.end)
     if(!inRange)continue
    }
    if(typeof item.id!=='string'||typeof item.title!=='string')throw Error('Invalid native item')
    items.push(item);coverage[kind].count++
   }catch{invalid++}
  }
  if(invalid)coverage[kind]={...coverage[kind],state:'partial',invalid}
 }
 items.sort((a,b)=>(a.start??a.due).localeCompare(b.start??b.due)||a.id.localeCompare(b.id))
 let selected=items.slice(0,1500)
 while(JSON.stringify(selected).length>350000)selected=selected.slice(0,Math.max(0,selected.length-50))
 const truncated=selected.length<items.length
 return {scope:AGENDA_SCOPE,startedAt,capturedAt:new Date().toISOString(),window,coverage,truncated,items:selected}
}
