import { EXTRA_FIELDS, hasExtras, normalizeDetails, normalizeExtras, patchedDetails, detailsKey } from './bridge-fields'
import { agendaDate, exclusiveAllDayEnd } from './bridge-agenda'
const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const localDate=(v:string)=>{const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d)}
function write(key:string,value:any){if(!Storage.set(key,value))throw Error('Não foi possível guardar o diário de escrita.')}
export function writeRevision(i:any){return JSON.stringify(i.kind==='event'?[i.kind,i.id,i.calendarId,i.title,i.start,i.end,i.isAllDay,i.nativeModifiedAt??null]:[i.kind,i.id,i.calendarId,i.title,i.due,i.completed])}
export function projectReal(kind:string,n:any,includeDetails=false){
 const i:any={kind,id:n.identifier,title:n.title,calendarId:n.calendar?.identifier,calendarTitle:n.calendar?.title??'',calendarType:n.calendar?.type??'unknown',writeAccess:{writable:n.calendar?.allowsContentModifications===true,recurring:typeof n.hasRecurrenceRules==='boolean'?n.hasRecurrenceRules:null,participants:typeof n.hasAttendees==='boolean'?n.hasAttendees:null}}
 if(kind==='event'){
  const a=new Date(n.startDate),b=new Date(n.endDate);i.isAllDay=!!n.isAllDay;i.start=i.isAllDay?day(a):a.toISOString();i.end=i.isAllDay?exclusiveAllDayEnd(a,b):b.toISOString()
  i.nativeModifiedAt=n.lastModifiedDate==null?null:new Date(n.lastModifiedDate).toISOString()
 }else {i.due=agendaDate(n.dueDateComponents);i.completed=!!n.isCompleted}
 if(includeDetails){i.details=projectDetails(kind,n);i.detailsRevision=detailRevision(kind,i.details)}
 return i
}
function markers(notes:any){return String(notes??'').split('\n').filter(line=>/^ct-bridge-(real|command):[a-zA-Z0-9-]+$/.test(line))}
function visibleNotes(notes:any){return String(notes??'').replace(/\r\n?/g,'\n').split('\n').filter(line=>!/^ct-bridge-(real|command):[a-zA-Z0-9-]+$/.test(line)).join('\n')||null}
function nativeLocation(v:any){if(!v)return null;if(!v.geoLocation)throw Error('Localização nativa sem coordenadas; leitura detalhada não confirmada.');return {title:v.title??null,latitude:v.geoLocation.latitude,longitude:v.geoLocation.longitude,radius:v.radius}}
function projectDetails(kind:string,n:any){
 const alarms=(n.alarms??[]).map((a:any)=>({absoluteDate:a.absoluteDate?new Date(a.absoluteDate).toISOString():null,relativeOffset:a.absoluteDate?0:a.relativeOffset??0,location:nativeLocation(a.structuredLocation),proximity:a.proximity??'none'}))
 return normalizeDetails(kind==='event'?{notes:visibleNotes(n.notes),alarms,location:n.location??null,url:n.url??null,structuredLocation:nativeLocation(n.structuredLocation)}:{notes:visibleNotes(n.notes),alarms,priority:n.priority??0},kind)
}
function detailRevision(kind:string,details:any){const data=Data.fromString(detailsKey(details,kind));if(!data)throw Error('Não foi possível calcular a revisão dos detalhes.');return 'sha256:'+Crypto.sha256(data).toHexString().toLowerCase()}
function toNativeLocation(v:any){return v?{title:v.title,geoLocation:{latitude:v.latitude,longitude:v.longitude},radius:v.radius}:null}
function applyDetails(c:any,n:any){
 const before=projectDetails(c.kind,n),after=patchedDetails(before,c.payload,c.kind),p=c.payload
 if('notes'in p){const internal=markers(n.notes);n.notes=[after.notes,...internal].filter(x=>x!==null&&x!=='').join('\n')||null}
 for(const key of ['location','url','priority'])if(key in p)n[key]=after[key]
 if('structuredLocation'in p)n.structuredLocation=toNativeLocation(after.structuredLocation)
 if('alarms'in p){
  for(const alarm of [...(n.alarms??[])])n.removAlarm(alarm)
  for(const spec of after.alarms){
   const alarm=spec.absoluteDate?EventAlarm.fromAbsoluteDate(new Date(spec.absoluteDate)):EventAlarm.fromRelativeOffset(spec.relativeOffset)
   alarm.structuredLocation=toNativeLocation(spec.location);alarm.proximity=spec.proximity as any;n.addAlarm(alarm)
  }
 }
}
function assertWritable(n:any){
 if(!n||!n.calendar?.allowsContentModifications||n.hasRecurrenceRules!==false||n.hasAttendees!==false||['birthday','subscription'].includes(n.calendar.type))throw Error('Item indisponível, somente leitura, recorrente ou com participantes; nenhuma alteração foi autorizada nesse formato.')
}
export async function realCapabilities(version:string){
 const lists=await Promise.all([Calendar.forEvents(),Calendar.forReminders()])
 return {protocol:2,clientVersion:version,at:new Date().toISOString(),calendars:lists.flatMap((list,index)=>list.map(c=>({kind:index?'reminder':'event',id:c.identifier,title:c.title??'Sem título',writable:c.allowsContentModifications===true&&!['birthday','subscription'].includes(c.type)})))}
}
async function calendarFor(c:any){
 const lists=c.kind==='event'?await Calendar.forEvents():await Calendar.forReminders()
 const id=c.calendarId??c.baseline?.calendarId
 const found=lists.find(x=>x.identifier===id)
 if(!found||(c.action!=='read'&&(!found.allowsContentModifications||['birthday','subscription'].includes(found.type))))throw Error('Destino não gravável ou não encontrado no iPhone.')
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
 if(rows.some(n=>writeRevision(projectReal(c.kind,n))!==writeRevision(projectReal(c.kind,rows[0]))||(c.detailsProtocol===1&&projectReal(c.kind,n,true).detailsRevision!==projectReal(c.kind,rows[0],true).detailsRevision)))throw Error('Mais de uma ocorrência ou leituras diferentes; sincronize antes de editar.')
 return rows[0]
}
function matches(c:any,i:any){
 const expected={...(c.baseline??{}),...c.payload}
 if(c.action==='complete')expected.completed=true
 if(c.action==='reopen')expected.completed=false
 if(c.action==='create'&&c.kind==='reminder'){expected.due??=null;expected.completed=false}
 const core=(c.kind==='event'?['title','start','end','isAllDay']:['title','due','completed']).every(k=>expected[k]===undefined||expected[k]===i[k])
 if(!core)return false
 if(c.detailsProtocol!==1)return true
 if(!i.details)return false
 if(c.action==='create')return Object.entries(normalizeExtras(Object.fromEntries(Object.entries(c.payload).filter(([k])=>EXTRA_FIELDS.includes(k))),c.kind)).filter(([k])=>k!=='notesMode').every(([k,v])=>JSON.stringify(i.details[k])===JSON.stringify(v))
 return detailsKey(i.details,c.kind)===detailsKey(patchedDetails(c.baseline.details,c.payload,c.kind),c.kind)
}
function validate(c:any){
 if(!c||typeof c.id!=='string'||!['event','reminder'].includes(c.kind)||!['create','update','complete','reopen','read'].includes(c.action)||c.kind==='event'&&['complete','reopen'].includes(c.action))throw Error('Comando pessoal inválido')
 if(!c.payload||Object.keys(c.payload).some(k=>!['title','due','start','end','isAllDay',...EXTRA_FIELDS].includes(k)))throw Error('Campo fora do escopo de escrita')
 if((hasExtras(c.payload)||c.action==='read')&&c.detailsProtocol!==1)throw Error('Cliente sem protocolo de detalhes')
 if(c.action!=='create'&&c.action!=='read'&&c.detailsProtocol===1&&(!c.baseline?.details||c.expectedDetailsRevision!==c.baseline.detailsRevision))throw Error('Revisão dos detalhes ausente')
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
 if(c.action==='read'){
  if(writeRevision(projectReal(c.kind,n))!==c.expectedRevision)return {status:'conflict',error:'O item mudou antes da leitura detalhada; sincronize a agenda.'}
  try{return {status:'applied',item:projectReal(c.kind,n,true)}}catch{return {status:'failed',error:'Detalhes nativos fora do formato suportado; nenhum campo foi alterado.'}}
 }
 if(!isNew){
  try{assertWritable(n)}catch{return {status:'conflict',error:'O item não permite esta alteração.'}}
  const current=projectReal(c.kind,n,c.detailsProtocol===1)
  if(journal&&matches(c,current)){write(key,{state:'applied',nativeId:n.identifier});return {status:'applied',item:current}}
  if(c.action==='create'||writeRevision(current)!==c.expectedRevision||(c.detailsProtocol===1&&current.detailsRevision!==c.expectedDetailsRevision))return {status:'conflict',error:'O item mudou desde a captura; consulte a nova revisão.'}
  // Requery through the same range API as the real agenda before writing.
  n=await readReal(c,c.itemId)
  if(!n||writeRevision(projectReal(c.kind,n))!==c.expectedRevision||(c.detailsProtocol===1&&projectReal(c.kind,n,true).detailsRevision!==c.expectedDetailsRevision))return {status:'conflict',error:'Leitura mudou antes da gravação.'}
  assertWritable(n)
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
 if(c.detailsProtocol===1)applyDetails(c,n)
 await n.save()
 if(!n.identifier)throw Error('A gravação não retornou identificador; aguarde a recuperação da fila.')
 write(key,{state:'written',nativeId:n.identifier})
 const reread=await readReal(c,n.identifier);assertWritable(reread)
 const item=projectReal(c.kind,reread,c.detailsProtocol===1)
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
   if(!n||writeRevision(projectReal(command.kind,n))!==writeRevision(ack.item)||(command.detailsProtocol===1&&projectReal(command.kind,n,true).detailsRevision!==ack.item.detailsRevision)){ack.status='conflict';delete ack.item;ack.error='O item mudou depois da gravação interrompida.'}
  }
  await request(ack);Storage.remove('real-result-outbox')
 }
 const state=await realCapabilities(version)
 const first=await request({op:'real-sync',state,claim:remaining()>3000})
 let applied=0,conflicts=0,detailsRead=0
 for(const command of first.commands){
  if(remaining()<2500)break
  if(Date.parse(command.leaseUntil)<=Date.now())throw Error('Reserva da escrita pessoal expirada.')
  const result=await executeReal(command)
  const ack={op:'real-result',commandId:command.id,leaseToken:command.leaseToken,...result}
  write('real-result-outbox',{...ack,command});await request(ack);Storage.remove('real-result-outbox')
  if(result.status==='applied'){if(command.action==='read')detailsRead++;else applied++}else conflicts++
 }
 const final=first.commands.length?await request({op:'real-sync',state:{...state,at:new Date().toISOString()},claim:false}):first
 const report={at:new Date().toISOString(),applied,conflicts,detailsRead,pending:final.pendingCount}
 write('bridge-real-report',report);return report
}
