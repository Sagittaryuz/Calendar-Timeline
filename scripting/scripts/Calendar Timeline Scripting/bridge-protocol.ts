export const PREFIX='[CT TESTE] '
export const ENDPOINT='https://calendar-timeline-bridge.sagittaryuz.chatgpt.site'
export function revision(item:any){return JSON.stringify(item.kind==='event'?[item.id,item.title,item.calendarId,item.start,item.end,item.isAllDay]:[item.id,item.title,item.calendarId,item.due,item.completed])}
export function validateConfig(value:any){
 if(value?.version!==1||value.endpoint!==ENDPOINT||!['deviceId','deviceToken','siteAccess'].every(k=>typeof value[k]==='string'&&value[k].length>=20))throw Error('Configuração inválida. Use o painel privado da ponte.')
 return value
}
function dueString(components:any){
 if(!components)return null
 if(components.hour!=null&&components.minute!=null){if(!components.date)throw Error('Data do lembrete indisponível');return new Date(components.date).toISOString()}
 if(components.year==null||components.month==null||components.day==null)throw Error('Data parcial fora do piloto')
 return `${components.year}-${String(components.month).padStart(2,'0')}-${String(components.day).padStart(2,'0')}`
}
export function project(kind:string,item:any){
 const out:any={kind,id:item.identifier,title:item.title,calendarId:item.calendar?.identifier}
 if(kind==='event'){out.start=new Date(item.startDate).toISOString();out.end=new Date(item.endDate).toISOString();out.isAllDay=!!item.isAllDay
  const modified=item.lastModifiedDate==null?NaN:Number(new Date(item.lastModifiedDate))
  out.nativeModifiedAt=Number.isFinite(modified)?new Date(modified).toISOString():null
  out.linkKey=item.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]??null
 }
 else {out.due=dueString(item.dueDateComponents);out.completed=!!item.isCompleted}
 out.revision=revision(out);return out
}
export function assertTest(item:any){
 if(!item||!item.title?.startsWith(PREFIX)||!item.notes?.includes('ct-bridge-command:'))throw Error('Item fora do piloto; não será modificado.')
 if(item.hasRecurrenceRules||item.hasAttendees||item.isAllDay)throw Error('Recorrência, convidados e dia inteiro ficam fora deste piloto.')
 if(!item.calendar?.allowsContentModifications)throw Error('Lista/calendário não permite alterações.')
}
function validateCommand(command:any){
 if(!command||typeof command.id!=='string'||!['event','reminder'].includes(command.kind)||!['create','update','complete','reopen'].includes(command.action))throw Error('Comando inválido')
 if(command.kind==='event'&&['complete','reopen'].includes(command.action))throw Error('Evento não possui conclusão')
 const p=command.payload;if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['title','due','start','end'].includes(k)))throw Error('Campos não permitidos')
 if(p.title!==undefined&&(!p.title.startsWith(PREFIX)||p.title.length>180))throw Error('Título fora do piloto')
 const isISO=(s:any)=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s))
 if(command.kind==='event'){
  if('due'in p)throw Error('Data de lembrete em evento')
  if(('start'in p)!==('end'in p))throw Error('Intervalo incompleto')
  if('start'in p&&(!isISO(p.start)||!isISO(p.end)||Date.parse(p.end)<=Date.parse(p.start)))throw Error('Intervalo inválido')
  if(command.action==='create'&&!p.start)throw Error('Evento sem intervalo')
 }else if('start'in p||'end'in p)throw Error('Intervalo de evento em lembrete')
 if(p.due!=null&&!isISO(p.due)&&!(typeof p.due==='string'&&/^\d{4}-\d\d-\d\d$/.test(p.due)))throw Error('Data de lembrete inválida')
 if(command.action==='create'&&!p.title)throw Error('Título obrigatório')
 if(command.action!=='create'&&(typeof command.itemId!=='string'||typeof command.expectedRevision!=='string'))throw Error('Identificador/revisão obrigatórios')
}
export function matches(command:any,item:any){
 if(command.action==='complete'&&!item.completed||command.action==='reopen'&&item.completed)return false
 return Object.entries(command.payload).every(([key,value])=>item[key]===value)
}
// Dependencies are explicit so the transport can be tested without reading
// or changing anybody's actual iOS calendar database.
export async function executeCommand(command:any,host:any){
 validateCommand(command)
 const journal=host.loadJournal(command.id)
 let native:any,isNew=false
 if(command.action==='create'){
  const linked=host.getLinked(command.kind)
  if(linked&&!journal)throw Error('Já existe um item desse tipo vinculado ao piloto')
  native=journal?.nativeId?await host.get(command.kind,journal.nativeId):null
  native??=await host.recover(command)
  if(!native){host.saveJournal(command.id,{state:'started',kind:command.kind});native=await host.make(command.kind);isNew=true}
 }else{
  if(host.getLinked(command.kind)!==command.itemId)throw Error('Identificador fora dos dois itens de teste')
  native=await host.get(command.kind,command.itemId)
  if(!native)return {status:'conflict',error:'O item de teste foi removido no iPhone.'}
 }
 if(!isNew){
  assertTest(native)
  const current=project(command.kind,native)
  // After an interrupted write, accept only the requested state, or the
  // original revision. A manual edit must not be overwritten on retry.
  if(journal&&matches(command,current)){host.link(command.kind,native.identifier);host.saveJournal(command.id,{state:'applied',nativeId:native.identifier,kind:command.kind});return {status:'applied',item:current}}
  if(command.action==='create')return {status:'conflict',error:'Um item recuperado difere do comando; confira no aparelho.'}
  if(current.revision!==command.expectedRevision)return {status:'conflict',error:'O item mudou no iPhone depois da última sincronização.'}
 }
 host.saveJournal(command.id,{state:'started',nativeId:native.identifier||null,kind:command.kind})
 await host.apply(command,native)
 const nativeId=native.identifier
 if(!nativeId)throw Error('Gravação não retornou identificador; sincronize novamente para recuperar')
 host.link(command.kind,nativeId)
 host.saveJournal(command.id,{state:'written',nativeId,kind:command.kind})
 const reread=await host.get(command.kind,nativeId);assertTest(reread)
 const item=project(command.kind,reread)
 if(!matches(command,item))throw Error('A releitura ainda não confirmou os campos solicitados')
 host.saveJournal(command.id,{state:'applied',nativeId,kind:command.kind})
 return {status:'applied',item}
}
