import { VERSION } from './diagnostics'
import { beginAttempt, finishAttempt, bridgeFailure, safeFailure } from './bridge-attempts'
import { synchronizeReal } from './bridge-real'
import { agendaReadState, disagreesWithAgenda } from './bridge-read-state'
import { collectAgenda } from './bridge-agenda'
import { readLinkedEvent } from './bridge-event-reader'
import { assertTest, ENDPOINT, executeCommand, project, validateConfig } from './bridge-protocol'
const CONFIG='ct-bridge-config-v1'
function write(key:string,value:any){if(!Storage.set(key,value))throw Error('Não foi possível guardar o estado local; nenhuma nova operação será iniciada.')}
export function configure(raw:string){const config=validateConfig(JSON.parse(raw));const previous=configuration();if(!Keychain.set(CONFIG,JSON.stringify(config),{accessibility:'first_unlock_this_device',synchronizable:false}))throw Error('Falha ao guardar a credencial no Keychain');if(previous?.deviceId!==config.deviceId)Storage.remove('result-outbox');return config}
export function configuration(){const raw=Keychain.get(CONFIG);return raw?validateConfig(JSON.parse(raw)):null}
function linked(kind:string){return Storage.get<string>('linked:'+kind)}
const api={
 get:async(kind:string,id:string)=>{
  if(kind!=='event')return Reminder.get(id)
  const item=await readLinkedEvent(id,{
   get:(key:string)=>CalendarEvent.get(key),reference:()=>Storage.get<any>('bridge-event-reference'),
   query:(start:Date,end:Date)=>CalendarEvent.getAll(start,end),
   remember:(value:any)=>write('bridge-event-reference',value),diagnose:(value:any)=>write('bridge-event-read',value)
  })
  if(item&&item.identifier!==id)write('linked:event',item.identifier)
  return item
 },
 getLinked:linked,
 link:(kind:string,id:string)=>write('linked:'+kind,id),
 loadJournal:(id:string)=>Storage.get<any>('journal:'+id),
 saveJournal:(id:string,value:any)=>write('journal:'+id,value),
 make:async(kind:string)=>{
  const calendar=kind==='event'?await Calendar.defaultForEvents():await Calendar.defaultForReminders()
  if(!calendar?.allowsContentModifications)throw Error('O calendário/lista padrão não permite gravar o item de teste.')
  const item=kind==='event'?new CalendarEvent():new Reminder();item.calendar=calendar;return item
 },
 recover:async(command:any)=>{
  const calendarId=Storage.get<string>('calendar:'+command.kind)
  if(!calendarId)return null
  const calendars=(command.kind==='event'?await Calendar.forEvents():await Calendar.forReminders()).filter(c=>c.identifier===calendarId)
  if(!calendars.length)return null
  const items=command.kind==='event'?await CalendarEvent.getAll(new Date(Date.now()-15*86400000),new Date(Date.now()+15*86400000),calendars):await Reminder.getAll(calendars)
  const found=items.filter(x=>x.notes?.includes('ct-bridge-command:'+command.id))
  if(found.length>1)throw Error('Mais de uma cópia do item de teste foi encontrada; confira no aparelho.')
  return found[0]??null
 },
 apply:async(command:any,item:any)=>{
  const p=command.payload
  if(command.action==='create'){
   item.notes='Calendar Timeline Bridge — item exclusivo da prova.\nct-bridge-command:'+command.id
   write('calendar:'+command.kind,item.calendar.identifier)
  }
  if(p.title!==undefined)item.title=p.title
  if(command.kind==='event'){
   item.isAllDay=false
   if(p.start){item.startDate=new Date(p.start);item.endDate=new Date(p.end)}
  }else{
   if('due'in p){
    if(p.due===null)item.dueDateComponents=null
    else if(/^\d{4}-\d\d-\d\d$/.test(p.due)){const [year,month,day]=p.due.split('-').map(Number);item.dueDateComponents=new DateComponents({year,month,day})}
    else item.dueDateComponents=DateComponents.fromDate(new Date(p.due))
   }
   if(command.action==='complete')item.isCompleted=true
   if(command.action==='reopen')item.isCompleted=false
  }
  await item.save()
 }
}
let deadline=Infinity
async function request(config:any,body:any):Promise<any>{
 const remaining=Math.min(20000,deadline-Date.now())
 if(remaining<150)throw bridgeFailure('budget',body.op)
 let timer:any
 try{return await Promise.race([(async()=>{
  let response:any
  try{response=await fetch(ENDPOINT+'/api/device',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.deviceToken,'OAI-Sites-Authorization':'Bearer '+config.siteAccess},body:JSON.stringify(body)})}catch{throw bridgeFailure('connection',body.op)}
  if(!response.headers.get('content-type')?.includes('application/json'))throw bridgeFailure('response',body.op)
  let data:any;try{data=await response.json()}catch{throw bridgeFailure('response',body.op)}
  if(!response.ok)throw bridgeFailure('http',body.op);return data
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(bridgeFailure('timeout',body.op)),remaining)})])}finally{clearTimeout(timer)}
}
async function items(){
 const result=[]
 for(const kind of ['reminder','event']){
  const id=linked(kind);if(!id)continue
  const item=await api.get(kind,id)
  if(item){if(!item.title?.startsWith('[CT TESTE] ')||!item.notes?.includes('ct-bridge-command:'))throw Error('Vínculo fora do piloto');result.push(project(kind,item))}
 }
 return result
}
let syncing=false
export async function synchronize(options:{budgetMS?:number;origin?:string}={}){
 if(syncing)throw Error('Sincronização já está em andamento nesta execução')
 syncing=true
 deadline=options.budgetMS?Date.now()+options.budgetMS:Infinity
 let attempt:any
 try{
  attempt=beginAttempt(options.origin)
  const config=configuration();if(!config)throw Error('Pareie o projeto pelo painel privado primeiro.')
  const meta={clientVersion:VERSION,origin:options.origin??'manual',linkedReadIds:{event:linked('event'),reminder:linked('reminder')}}
  // Real agenda upload is independent of the test command path. A stale test
  // event must not prevent a read-only weekly snapshot reaching the owner.
  let agenda:any=null,reads:any=null
  if(Storage.get<boolean>('real-agenda-disabled')!==true){
   let timer:any
   try{
    const remaining=Math.max(150,Math.min(10000,deadline-Date.now()-300))
    const snapshot:any=await Promise.race([collectAgenda(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(bridgeFailure('timeout','native-read')),remaining)})])
    const result=await request(config,{op:'agenda',snapshot,meta})
    agenda={...result,coverage:result.coverage??snapshot.coverage}
    write('bridge-agenda-status',agenda)
    if(result.accepted){reads=agendaReadState(snapshot,{event:linked('event'),reminder:linked('reminder')},result);write('bridge-read-items',reads)}
   }catch(error){agenda={state:'deferred',at:new Date().toISOString(),failure:safeFailure(error)};write('bridge-agenda-status',agenda)}finally{clearTimeout(timer)}
  }
  // Personal commands never depend on the stale legacy pilot lookup.
  const realWrites=Storage.get<boolean>('real-agenda-disabled')===true?null:await synchronizeReal(body=>request(config,body),VERSION,()=>deadline-Date.now())
  if(realWrites?.applied&&deadline-Date.now()>1500){
   const snapshot=await collectAgenda(),result=await request(config,{op:'agenda',snapshot,meta})
   agenda={...result,coverage:result.coverage??snapshot.coverage};write('bridge-agenda-status',agenda)
   if(result.accepted){reads=agendaReadState(snapshot,{event:linked('event'),reminder:linked('reminder')},result);write('bridge-read-items',reads)}
  }
  // Replay a result whose upload failed before any new native writes.
  const outbox=Storage.get<any>('result-outbox')
  if(outbox){
   // An ACK persisted by an older release has no native version. Re-read it
   // before retrying, without repeating the native write or inventing a title.
   if(outbox.status==='applied'&&outbox.item?.kind==='event'){
    const native=await api.get('event',outbox.item.id),current=native?project('event',native):null
    if(current?.revision===outbox.item.revision)outbox.item=current
    else {outbox.status='conflict';outbox.error='O evento mudou após a gravação interrompida; releitura atual preservada.';delete outbox.item}
   }
   await request(config,outbox);Storage.remove('result-outbox')
  }
  const readOnlyReport=()=>{
   const report={version:VERSION,finishedAt:new Date().toISOString(),applied:0,conflicts:0,pending:null,agenda,realWrites,testState:reads?.states.event==='confirmed'?'agenda-read':'unavailable',commandState:'not-checked'}
   write('last-sync',report);finishAttempt(attempt,report);return report
  }
  let initialItems:any[]
  try{initialItems=await items()}catch(error){
   if(agenda?.accepted){
    return readOnlyReport()
   }
   throw error
  }
  // Do not re-upload an older test lookup or claim writes when it disagrees
  // with the real agenda capture that has just been accepted.
  if(agenda?.accepted&&disagreesWithAgenda(initialItems,reads))return readOnlyReport()
  const received=await request(config,{op:'sync',items:initialItems,claim:deadline-Date.now()>2000,meta:{...meta,eventRead:Storage.get('bridge-event-read')}})
  if(received.warnings?.length)throw Error('A ponte recusou uma leitura antiga ou conflitante. Atualize o projeto e tente novamente.')
  let applied=0,conflicts=0
  for(const command of received.commands){
   if(deadline-Date.now()<1500)break
   if(Date.parse(command.leaseUntil)<=Date.now())throw Error('A reserva do comando expirou. Aguarde e execute a sincronização novamente.')
   // A native or transport failure leaves the cloud command pending. The
   // durable journal + command marker recover a save interrupted by iOS.
   const result=await executeCommand(command,api)
   const ack={op:'result',commandId:command.id,leaseToken:command.leaseToken,...result}
   write('result-outbox',ack);await request(config,ack);Storage.remove('result-outbox')
   if(result.status==='applied')applied++;else conflicts++
  }
  // Reuse the initial snapshot when no command changed native records.
  const finalItems=received.commands.length?await items():initialItems
  const final=received.commands.length?await request(config,{op:'sync',items:finalItems,claim:false,meta}):received
  if(final.warnings?.length)throw Error('A ponte preservou uma versão mais recente do evento; envio adiado.')
  write('bridge-local-items',finalItems)
  const report={version:VERSION,finishedAt:new Date().toISOString(),applied,conflicts,pending:final.pendingCount,agenda,realWrites,testState:reads?.states.event==='confirmed'?'agenda-read':'ok',commandState:'checked'}
  write('last-sync',report);finishAttempt(attempt,report);return report
 }catch(error){if(attempt)finishAttempt(attempt,undefined,error);throw error}
 finally{syncing=false;deadline=Infinity}
}
