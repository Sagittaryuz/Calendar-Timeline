import { agendaDate, exclusiveAllDayEnd } from './bridge-agenda'
const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const localDate=(v:string)=>{const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d)}
function write(key:string,value:any){if(!Storage.set(key,value))throw Error('Não foi possível guardar o diário de escrita.')}
export function writeRevision(i:any){return JSON.stringify(i.kind==='event'?[i.kind,i.id,i.calendarId,i.title,i.start,i.end,i.isAllDay,i.nativeModifiedAt??null]:[i.kind,i.id,i.calendarId,i.title,i.due,i.completed])}
export function projectReal(kind:string,n:any){
 const i:any={kind,id:n.identifier,title:n.title,calendarId:n.calendar?.identifier,calendarTitle:n.calendar?.title??'',calendarType:n.calendar?.type??'unknown',writeAccess:{writable:n.calendar?.allowsContentModifications===true,recurring:typeof n.hasRecurrenceRules==='boolean'?n.hasRecurrenceRules:null,participants:typeof n.hasAttendees==='boolean'?n.hasAttendees:null}}
 if(kind==='event'){
  const a=new Date(n.startDate),b=new Date(n.endDate);i.isAllDay=!!n.isAllDay;i.start=i.isAllDay?day(a):a.toISOString();i.end=i.isAllDay?exclusiveAllDayEnd(a,b):b.toISOString()
  i.nativeModifiedAt=n.lastModifiedDate==null?null:new Date(n.lastModifiedDate).toISOString()
 }else {i.due=agendaDate(n.dueDateComponents);i.completed=!!n.isCompleted}
 return i
}
function assertWritable(n:any,kind:string){
 if(!n||!n.calendar?.allowsContentModifications||typeof n.hasRecurrenceRules!=='boolean'||kind==='event'&&n.hasRecurrenceRules||n.hasAttendees!==false||['birthday','subscription'].includes(n.calendar.type))throw Error('Item indisponível, somente leitura, evento recorrente ou com participantes.')
}
export async function realCapabilities(version:string){
 const lists=await Promise.all([Calendar.forEvents(),Calendar.forReminders()])
 return {protocol:1,clientVersion:version,at:new Date().toISOString(),features:['recurring-reminders-v1'],calendars:lists.flatMap((list,index)=>list.map(c=>({kind:index?'reminder':'event',id:c.identifier,title:c.title??'Sem título',writable:c.allowsContentModifications===true&&!['birthday','subscription'].includes(c.type)})))}
}
async function calendarFor(c:any){
 const lists=c.kind==='event'?await Calendar.forEvents():await Calendar.forReminders()
 const id=c.calendarId??c.baseline?.calendarId
 const found=lists.find(x=>x.identifier===id)
 if(!found?.allowsContentModifications||['birthday','subscription'].includes(found.type))throw Error('Destino não gravável ou não encontrado no iPhone.')
 return found
}
async function nativeRows(c:any){
 const calendar=await calendarFor(c)
 if(c.kind==='reminder')return Reminder.getAll([calendar])
 const starts=[c.baseline?.start,c.payload.start].filter(Boolean).map(v=>new Date(v).getTime())
 const ends=[c.baseline?.end,c.payload.end].filter(Boolean).map(v=>new Date(v).getTime())
 if(!starts.length||!ends.length)throw Error('Intervalo de busca ausente.')
 return CalendarEvent.getAll(new Date(Math.min(...starts)-86400000),new Date(Math.max(...ends)+86400000),[calendar])
}
export async function readReal(c:any,id:string){
 const rows=(await nativeRows(c)).filter(n=>n.identifier===id)
 if(!rows.length)return null
 if(rows.some(n=>writeRevision(projectReal(c.kind,n))!==writeRevision(projectReal(c.kind,rows[0]))))throw Error('Mais de uma ocorrência ou leituras diferentes; sincronize antes de editar.')
 return rows[0]
}
function matches(c:any,i:any){
 const expected={...(c.baseline??{}),...c.payload}
 if(c.action==='complete')expected.completed=true
 if(c.action==='reopen')expected.completed=false
 if(c.action==='create'&&c.kind==='reminder'){expected.due??=null;expected.completed=false}
 return (c.kind==='event'?['title','start','end','isAllDay']:['title','due','completed']).every(k=>expected[k]===undefined||expected[k]===i[k])
}
function validate(c:any){
 if(!c||typeof c.id!=='string'||!['event','reminder'].includes(c.kind)||!['create','update','complete','reopen'].includes(c.action)||c.kind==='event'&&['complete','reopen'].includes(c.action))throw Error('Comando pessoal inválido')
 if(!c.payload||Object.keys(c.payload).some(k=>!['title','due','start','end','isAllDay'].includes(k)))throw Error('Campo fora do escopo de escrita')
 if(c.action!=='create'&&(!c.baseline||c.itemId!==c.baseline.id||c.kind!==c.baseline.kind||writeRevision(c.baseline)!==c.expectedRevision))throw Error('Identificador ou revisão inválidos')
}
export async function executeReal(c:any){
 validate(c)
 const key='real-journal:'+c.id,journal=Storage.get<any>(key)
 let n:any,isNew=false
 if(c.action==='create'){
  n=journal?.nativeId?await readReal(c,journal.nativeId):null
  if(journal?.nativeId&&!n)return {status:'conflict',error:'A criação registrada não foi encontrada no intervalo; nenhuma nova cópia foi criada.'}
  if(!n){const found=(await nativeRows(c)).filter(x=>x.notes?.split('\n').includes('ct-bridge-real:'+c.id));if(found.length>1)return {status:'conflict',error:'Criação duplicada encontrada; confira no iPhone.'};n=found[0]}
  if(!n){
   const calendar=await calendarFor(c)
   write(key,{state:'started',calendarId:calendar.identifier})
   n=c.kind==='event'?new CalendarEvent():new Reminder();n.calendar=calendar
   n.notes='ct-bridge-real:'+c.id;isNew=true
  }
 }else n=await readReal(c,c.itemId)
 if(!n)return {status:'conflict',error:'Item não encontrado no iPhone; nenhuma recriação foi feita.'}
 if(!isNew){
  try{assertWritable(n,c.kind)}catch{return {status:'conflict',error:'O item não permite esta alteração.'}}
  const current=projectReal(c.kind,n)
  if(journal&&matches(c,current)){write(key,{state:'applied',nativeId:n.identifier});return {status:'applied',item:current}}
  if(journal?.state==='written'||journal?.state==='applied')return {status:'conflict',error:'A gravação anterior não corresponde à releitura. Nenhuma segunda conclusão ou edição foi executada.'}
  if(c.action==='create'||writeRevision(current)!==c.expectedRevision)return {status:'conflict',error:'O item mudou desde a captura; consulte a nova revisão.'}
  // Requery through the same range API as the real agenda before writing.
  n=await readReal(c,c.itemId)
  if(!n||writeRevision(projectReal(c.kind,n))!==c.expectedRevision)return {status:'conflict',error:'Leitura mudou antes da gravação.'}
  assertWritable(n,c.kind)
 }
 write(key,{state:'started',nativeId:n.identifier??null})
 const p=c.payload
 if(p.title!==undefined)n.title=p.title
 if(c.kind==='event'){
  if('start'in p){n.isAllDay=p.isAllDay===true;n.startDate=n.isAllDay?localDate(p.start):new Date(p.start);n.endDate=n.isAllDay?localDate(p.end):new Date(p.end)}
 }else {
  if('due'in p){if(p.due===null)n.dueDateComponents=null;else if(p.due.length===10){const [year,month,day]=p.due.split('-').map(Number);n.dueDateComponents=new DateComponents({year,month,day})}else n.dueDateComponents=DateComponents.fromDate(new Date(p.due))}
  if(c.action==='complete')n.isCompleted=true
  if(c.action==='reopen'||c.action==='create')n.isCompleted=false
 }
 await n.save()
 if(!n.identifier)throw Error('A gravação não retornou identificador; aguarde a recuperação da fila.')
 write(key,{state:'written',nativeId:n.identifier})
 const reread=await readReal(c,n.identifier);assertWritable(reread,c.kind)
 const item=projectReal(c.kind,reread)
 if(!matches(c,item))throw Error('A releitura ainda não confirmou a alteração; nenhuma nova gravação será iniciada.')
 write(key,{state:'applied',nativeId:n.identifier})
 return {status:'applied',item}
}
export async function synchronizeReal(request:(b:any)=>Promise<any>,version:string,remaining:()=>number){
 const outbox=Storage.get<any>('real-result-outbox')
 if(outbox){
  const {command,...ack}=outbox
  if(ack.status==='applied'){
   const n=await readReal(command,ack.item.id)
   if(!n||writeRevision(projectReal(command.kind,n))!==writeRevision(ack.item)){ack.status='conflict';delete ack.item;ack.error='O item mudou depois da gravação interrompida.'}
  }
  await request(ack);Storage.remove('real-result-outbox')
 }
 const state=await realCapabilities(version)
 const first=await request({op:'real-sync',state,claim:remaining()>3000})
 let applied=0,conflicts=0
 for(const command of first.commands){
  if(remaining()<2500)break
  if(Date.parse(command.leaseUntil)<=Date.now())throw Error('Reserva da escrita pessoal expirada.')
  const result=await executeReal(command)
  const ack={op:'real-result',commandId:command.id,leaseToken:command.leaseToken,...result}
  write('real-result-outbox',{...ack,command});await request(ack);Storage.remove('real-result-outbox')
  if(result.status==='applied')applied++;else conflicts++
 }
 const final=first.commands.length?await request({op:'real-sync',state:{...state,at:new Date().toISOString()},claim:false}):first
 const report={at:new Date().toISOString(),applied,conflicts,pending:final.pendingCount}
 write('bridge-real-report',report);return report
}
