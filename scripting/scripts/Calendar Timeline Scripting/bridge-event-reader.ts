// Refresh the linked event through a bounded calendar query, not a retained get(id) object.
// Other events returned locally are never projected or transmitted.
export async function readLinkedEvent(id:string,host:any){
 const cached=await host.get(id)
 const reference=host.reference()
 const calendarId=cached?.calendar?.identifier??reference?.calendarId
 if(!calendarId){if(!cached)return null;throw Error('Calendário do evento de teste não identificado.')}
 const calendars=(await host.calendars()).filter((c:any)=>c.identifier===calendarId)
 if(!calendars.length)throw Error('Calendário do evento de teste indisponível; nenhum título antigo será reenviado.')
 const anchor=Number(cached?.startDate??new Date(reference?.start??Date.now()))
 const rows=await host.query(new Date(anchor-15*86400000),new Date(anchor+15*86400000),calendars)
 const matches=rows.filter((event:any)=>event.identifier===id)
 if(matches.length>1)throw Error('Identificador de evento ambíguo; confira o item de teste no aparelho.')
 const fresh=matches[0]
 if(!fresh)throw Error('Evento de teste ausente na nova consulta. A cópia anterior não será tratada como atualizada.')
 const marker=cached?.notes?.match(/ct-bridge-command:[^\s]+/)?.[0]??reference?.marker
 if(marker&&!fresh.notes?.includes(marker))throw Error('O vínculo do evento mudou; sincronização interrompida para conferência.')
 host.remember({id,calendarId,start:fresh.startDate.toISOString(),marker})
 host.diagnose({at:new Date().toISOString(),method:'calendar-range',changedFromIdentifierRead:cached?.title!==fresh.title,title:fresh.title})
 return fresh
}
