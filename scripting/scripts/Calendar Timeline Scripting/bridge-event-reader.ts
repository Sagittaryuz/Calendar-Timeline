import { project } from './bridge-protocol'
// Native identifiers can change. Resolve the exact creation marker across all
// calendars, never by title. Do not assume either lookup is inherently fresh.
export async function readLinkedEvent(id:string,host:any){
 const cached=await host.get(id),reference=host.reference()
 const marker=reference?.marker??cached?.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]
 const anchor=Number(new Date(reference?.start??cached?.startDate??Date.now()))
 const rows=await host.query(new Date(anchor-15*86400000),new Date(anchor+15*86400000))
 const exact=rows.filter((e:any)=>e.identifier===id)
 const marked=marker?rows.filter((e:any)=>e.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]===marker):[]
 if(!marked.length&&!exact.length)throw Error('Evento de teste ausente na nova consulta. A cópia anterior não será tratada como atualizada.')
 if(exact.some((e:any)=>marker&&e.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]!==marker))throw Error('O vínculo do evento mudou; sincronização interrompida para conferência.')
 const candidates=[...marked,...exact,...(cached&&(!marker||cached.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]===marker)?[cached]:[])]
 const snapshots=candidates.map((native:any)=>({native,item:project('event',native)}))
 snapshots.sort((a:any,b:any)=>(b.item.nativeModifiedAt??'').localeCompare(a.item.nativeModifiedAt??''))
 const chosen=snapshots[0]
 for(const candidate of snapshots){
  const a=chosen.item,b=candidate.item
  if(a.revision!==b.revision&&(!a.nativeModifiedAt||!b.nativeModifiedAt||a.nativeModifiedAt===b.nativeModifiedAt)){
   host.diagnose({at:new Date().toISOString(),state:'conflict',candidates:snapshots.slice(0,10).map((x:any)=>x.item)})
   throw Error('Leituras conflitantes ou identificador ambíguo sem versão nativa distinta. Nenhum título será reenviado.')
  }
 }
 if(reference?.nativeModifiedAt&&(!chosen.item.nativeModifiedAt||chosen.item.nativeModifiedAt<reference.nativeModifiedAt||(chosen.item.nativeModifiedAt===reference.nativeModifiedAt&&reference.revision!==chosen.item.revision)))throw Error('Leitura anterior ao último estado confirmado do evento; envio adiado.')
 host.remember({id:chosen.item.id,calendarId:chosen.item.calendarId,start:chosen.item.start,marker,nativeModifiedAt:chosen.item.nativeModifiedAt,revision:chosen.item.revision})
 host.diagnose({at:new Date().toISOString(),method:'all-calendars-marker-and-version',relinked:chosen.item.id!==id,changedFromIdentifierRead:cached?.title!==chosen.item.title,title:chosen.item.title,candidates:snapshots.slice(0,10).map((x:any)=>x.item)})
 return chosen.native
}
