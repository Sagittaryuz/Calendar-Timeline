import { VERSION } from './diagnostics'
const HISTORY='bridge-attempt-history-v1',PROBLEM='bridge-last-problem-v1'
const reasons=['connection','timeout','budget','http','response','storage','unknown']
const origins=['app-open','widget-touch','widget','day-touch','manual']
const stages=['agenda','real-sync','real-result','sync','result','native-read']
export function bridgeFailure(reason:string,stage?:string){
 const messages:any={connection:'Falha de conexão com a ponte; pode haver indisponibilidade de internet ou do serviço.',timeout:'Tempo de espera excedido; o resultado não foi confirmado.',budget:'Tempo disponível da rodada encerrado.',http:'O servidor recusou a solicitação.',response:'Resposta da ponte não reconhecida.',storage:'Não foi possível guardar o registro local.',unknown:'A rodada não confirmou todos os resultados.'}
 return Object.assign(Error(messages[reason]??messages.unknown),{bridgeReason:reasons.includes(reason)?reason:'unknown',bridgeStage:stages.includes(stage??'')?stage:undefined})
}
export function safeFailure(error:any){return {reason:reasons.includes(error?.bridgeReason)?error.bridgeReason:'unknown',stage:stages.includes(error?.bridgeStage)?error.bridgeStage:null}}
function history():any[]{const rows=Storage.get<any>(HISTORY);return Array.isArray(rows)?rows.slice(-12):[]}
export function beginAttempt(origin='manual'){
 const entry={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),version:VERSION,origin:origins.includes(origin)?origin:'manual',startedAt:Date.now(),state:'started'}
 if(!Storage.set(HISTORY,[...history(),entry].slice(-12)))throw bridgeFailure('storage')
 return entry
}
export function finishAttempt(entry:any,report?:any,error?:any){
 const incomplete=error||report?.agenda&&!report.agenda.accepted
 const failure=error?safeFailure(error):report?.agenda?.failure??{reason:'unknown',stage:null}
 // Allowlisted metadata only. Never persist error text, payloads or credentials.
 const result={...entry,finishedAt:Date.now(),state:incomplete?'deferred':'success',...(incomplete?{reason:reasons.includes(failure.reason)?failure.reason:'unknown',stage:stages.includes(failure.stage)?failure.stage:null}:{}),agendaAccepted:report?.agenda?.accepted===true,applied:Number(report?.realWrites?.applied??0),pending:typeof report?.realWrites?.pending==='number'?report.realWrites.pending:null}
 try{
  if(incomplete)Storage.set(PROBLEM,result)
  const rows=history();const index=rows.findIndex(r=>r.id===entry.id)
  if(index>=0)rows[index]=result;else rows.push(result)
  Storage.set(HISTORY,rows.slice(-12))
 }catch{}
 return result
}
export function previousAttemptLines(){
 try{
  const rows=history(),problem=Storage.get<any>(PROBLEM)
  const latest=rows.at(-1),entries=[problem,latest?.state==='started'||latest?.state==='deferred'?latest:null].filter((r,index,a)=>r&&a.findIndex(x=>x?.id===r.id)===index)
  const labels:any={'app-open':'abertura do projeto','widget-touch':'toque no widget',widget:'execução do widget','day-touch':'seleção de dia',manual:'execução manual'}
  return entries.map(r=>{
   const when=new Date(r.startedAt).toLocaleString('pt-BR'),origin=labels[r.origin]??'execução'
   const detail=r.state==='started'?'Iniciada, mas sem resultado local registrado; pode ter sido interrompida. Isso não confirma falha nem gravação.':bridgeFailure(r.reason).message
   return `Registro local anterior — ${when} (${origin}): ${detail}${r.stage?' Etapa: '+r.stage+'.':''} Consulte a ponte para confirmar comandos. Este registro permanece após uma rodada bem-sucedida.`
  })
 }catch{return ['Não foi possível consultar o histórico local de tentativas.']}
}
