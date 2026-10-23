// Presentation/read state is derived only from the accepted real agenda capture.
// It must never be reused as permission or revision proof for native writes.
export function agendaReadState(snapshot:any,linked:Record<string,string|null>,receipt:any){
 const items:any[]=[],states:any={}
 const canonical=Array.isArray(receipt.readItems)?receipt.readItems:null
 const coverage=receipt.coverage??snapshot.coverage
 for(const kind of ['event','reminder']){
  if(coverage?.[kind]?.state==='error'||!canonical){states[kind]='unavailable';continue}
  const matches=canonical.filter((i:any)=>i.kind===kind&&i.id===linked[kind])
  if(matches.length!==1){states[kind]=matches.length?'ambiguous':coverage?.[kind]?.state==='ok'?'not-in-window':'unavailable';continue}
  const item=matches[0]
  items.push({...item});states[kind]='confirmed'
 }
 return {source:'agenda',capturedAt:receipt.capturedAt??snapshot.capturedAt,receivedAt:receipt.receivedAt,partial:receipt.state!=='complete',items,states}
}
export function disagreesWithAgenda(pilot:any[],reads:any){
 return pilot.some(item=>{
  const observed=reads?.items.find((r:any)=>r.kind===item.kind&&r.id===item.id)
  if(!observed)return false
  const fields=item.kind==='event'?['title','calendarId','start','end','isAllDay']:['title','calendarId','due','completed']
  return fields.some(key=>item[key]!==observed[key])
 })
}
export function readLines(reads:any,legacy:any[]=[]){
 if(!reads)return legacy.map(i=>i.kind==='event'?`Último evento lido: ${i.title} (leitura anterior do teste)`:`Último lembrete lido: ${i.completed?'concluído':'aberto'} (leitura anterior do teste)`)
 const when=new Date(reads.capturedAt).toLocaleString('pt-BR')
 return ['reminder','event'].map(kind=>{
  const label=kind==='event'?'Último evento lido':'Último lembrete lido'
  const item=reads.items.find((i:any)=>i.kind===kind)
  if(!item)return `${label}: ${reads.states[kind]==='not-in-window'?'fora da janela atual ou não encontrado':'leitura não confirmada nesta captura'}. Captura da agenda: ${when}.`
  return `${label}: ${kind==='event'?item.title:item.completed?'concluído':'aberto'}. Agenda real${reads.partial?' (captura parcial)':''}: ${when}.`
 })
}
export function commandStatus(report:any){
 const real=report.realWrites
 const personal=real?`Agenda pessoal: ${real.applied} gravações confirmadas, ${real.detailsRead??0} leituras detalhadas, ${real.conflicts} conflitos, ${real.pending} pendentes. `:''
 return personal+(report.commandState==='not-checked'?'Comandos de teste: não consultados nesta execução.':`Gravações confirmadas: ${report.applied}. Conflitos: ${report.conflicts}. Pendentes: ${report.pending??'não consultados'}.`)
}
export function readStatus(report:any){
 return report.testState==='agenda-read'?'Leitura confirmada pela agenda real.':report.testState==='unavailable'?'Leitura do teste não confirmada na janela atual.':'Leitura do teste confirmada.'
}
