import { commandStatus, readStatus } from './bridge-read-state'
import { configuration, synchronize } from './bridge-client'
// No dialogs or credentials in diagnostics; safe to call from the widget host.
export async function autoSynchronize(options:{origin:string;force?:boolean;budgetMS?:number}){
 try{
  if(!Storage.get<boolean>('test-scope-consent')||!configuration())return {state:'unpaired'}
  const now=Date.now(),attempt=Storage.get<number>('bridge-auto-attempt')??0
  if(!options.force&&now-attempt<60000)return {state:'throttled'}
  if(!Storage.set('bridge-auto-attempt',now))throw Error('Falha ao guardar a tentativa automática.')
  const report=await synchronize({budgetMS:options.budgetMS??10000,origin:options.origin})
  const originLabel=({'widget':'execução do widget','app-open':'abertura do projeto','widget-touch':'toque na timeline','day-touch':'seleção de dia'} as Record<string,string>)[options.origin]??options.origin
  const result={state:'success',origin:options.origin,at:Date.now(),message:`Ponte automática (${originLabel}): ${new Date(report.finishedAt).toLocaleString('pt-BR')}. Agenda: ${report.agenda?.accepted?'recebida no servidor':'envio não confirmado'}. ${readStatus(report)} ${commandStatus(report)}`,report}
  Storage.set('bridge-auto-state',result)
  return result
 }catch{
  // Keep any native error and private configuration out of the widget/logs.
  const result={state:'deferred',origin:options.origin,at:Date.now(),message:'Ponte adiada por falha ou limite de tempo. A fila será retomada na próxima execução.'}
  try{Storage.set('bridge-auto-state',result)}catch{}
  return result
 }
}
