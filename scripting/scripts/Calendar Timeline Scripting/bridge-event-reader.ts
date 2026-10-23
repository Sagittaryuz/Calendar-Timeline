import { project } from './bridge-protocol'
// Arrival order is not a version: both native entry points can retain old objects.
export async function readLinkedEvent(id:string,host:any){
 const cached=await host.get(id)
 const reference=host.reference()
 const calendarId=reference?.calendarId??cached?.calendar?.identifier
 if(!calendarId){if(!cached)return null;throw Error('Calendário do evento de teste não identificado.')}
 const calendars=(await host.calendars()).filter((c:any)=>c.identifier===calendarId)
 if(!calendars.length)throw Error('Calendário do evento de teste indisponível; nenhum título antigo será reenviado.')
 const anchor=Number(cached?.startDate??new Date(reference?.start??Date.now()))
 const rows=await host.query(new Date(anchor-15*86400000),new Date(anchor+15*86400000),calendars)
 const matches=rows.filter((event:any)=>event.identifier===id)
 if(matches.length>1)throw Error('Identificador de evento ambíguo; confira o item de teste no aparelho.')
 let fresh=matches[0],method='calendar-range'
 if(!fresh)throw Error('Evento de teste ausente na nova consulta. A cópia anterior não será tratada como atualizada.')
 const marker=reference?.marker??cached?.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]
 for(const item of [fresh,...(cached?[cached]:[])])if(item.identifier!==id||item.calendar?.identifier!==calendarId||(marker&&!item.notes?.includes(marker)))throw Error('O vínculo do evento mudou; sincronização interrompida para conferência.')
 let chosen=project('event',fresh)
 if(cached){
  const direct=project('event',cached)
  if(direct.revision!==chosen.revision&&(!direct.nativeModifiedAt||!chosen.nativeModifiedAt||direct.nativeModifiedAt===chosen.nativeModifiedAt))throw Error('Leituras conflitantes do evento sem versão nativa distinta. Nenhum título será reenviado.')
  if(direct.nativeModifiedAt&&(!chosen.nativeModifiedAt||direct.nativeModifiedAt>chosen.nativeModifiedAt)){fresh=cached;chosen=direct;method='identifier-newer'}
 }
 if(reference?.nativeModifiedAt&&(!chosen.nativeModifiedAt||chosen.nativeModifiedAt<reference.nativeModifiedAt||(chosen.nativeModifiedAt===reference.nativeModifiedAt&&reference.revision!==chosen.revision)))throw Error('Leitura anterior ao último estado confirmado do evento; envio adiado.')
 host.remember({id,calendarId,start:fresh.startDate.toISOString(),marker,nativeModifiedAt:chosen.nativeModifiedAt,revision:chosen.revision})
 host.diagnose({at:new Date().toISOString(),method,nativeModifiedAt:chosen.nativeModifiedAt,changedFromIdentifierRead:cached?.title!==fresh.title,title:fresh.title})
 return fresh
}
