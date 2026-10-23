import { Button, HStack, Text, VStack, useEffect, useRef, useState } from 'scripting'
import { analyzeDay, localDay, parseDay, readDay } from './day-model'
import { createItem, resumeCreate } from './create-item'
import { chooseExportFolder, dashboardStatus, explain, exportPreferences, readPreferences, refreshMinutes, reloadWidgets } from './pro-common'
export function DayDetails(){
  const [date,setDate]=useState(localDay(new Date())),[model,setModel]=useState<ReturnType<typeof analyzeDay>|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  const running=useRef(false)
  async function run(fn:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);try{await fn()}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir.')}finally{running.current=false;setBusy(false)}}
  async function refresh(day=date){const result=await readDay(day);setModel(result);setDate(day);dashboardStatus('Calendar',{at:Date.parse(result.capturedAt),label:result.events.length+' eventos · '+result.reminders.length+' lembretes no dia consultado'})}
  useEffect(()=>{void run(()=>refresh())},[])
  const time=(v:string)=>new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  return <VStack spacing={10}>
    <Text font="headline">Agenda do dia</Text>
    <HStack><Button title="Escolher data" action={()=>run(async()=>{const raw=await Dialog.prompt({title:'Data',defaultValue:date,message:'AAAA-MM-DD'});if(raw){parseDay(raw);await refresh(raw)}})}/><Button title={busy?'Consultando…':'Consultar dia'} action={()=>run(()=>refresh())}/></HStack>
    <Text>{date}</Text>
    {model?<VStack spacing={8}>
      {!model.coverage.events||!model.coverage.reminders?<Text>Consulta parcial: verifique permissões. Não é possível concluir que a agenda está vazia.</Text>:null}
      {model.events.map((e:any)=><Text key={e.id}>{(e.isAllDay?'Dia inteiro':time(e.start)+'–'+time(e.end))+' · '+e.title+' · '+e.calendar}</Text>)}
      {model.reminders.map((r:any)=><Text key={r.id}>{'☐ '+r.title+' · '+r.calendar}</Text>)}
      {model.conflicts.map((pair:any,i:number)=><Text key={'c'+i}>{'Sobreposição: '+pair.join(' / ')}</Text>)}
      <Text>{model.slotScope}</Text>
      {model.slots.map((s:any,i:number)=><Text key={'s'+i}>{time(s.start)+'–'+time(s.end)}</Text>)}
      <Button title="Resumir meu dia" action={()=>run(()=>explain('Resuma esta agenda, os conflitos e os intervalos calculados. Não afirme disponibilidade pessoal. Dados: '+JSON.stringify(model)))}/>
    </VStack>:null}
    <Button title="Criar por frase" action={()=>run(async()=>{const r=await createItem();if(r){setMessage(r.status==='applied'?'Criação confirmada por releitura no iPhone.':'Criação não confirmada. Confira antes de retomar.');await reloadWidgets();await refresh()}})}/>
    <Button title="Retomar criação pendente" action={()=>run(async()=>{const r=await resumeCreate();setMessage(!r?'Nenhuma criação pendente.':r.status==='applied'?'Criação confirmada por releitura.':'Conflito: confira o item no Calendário/Lembretes.');if(r?.status==='applied')await reloadWidgets()})}/>
    <Text>Frequência solicitada ao iOS</Text>
    <HStack>{[1,5,15].map(n=><Button key={n} title={(refreshMinutes()===n?'✓ ':'')+n+' min'} action={()=>run(async()=>{Storage.set('refresh-minutes',n);await reloadWidgets();setMessage('Intervalo solicitado; execução controlada pelo iOS.')})}/>)}</HStack>
    <Button title="Exportar preferências" action={()=>run(async()=>{await exportPreferences('Calendar',{refreshMinutes:refreshMinutes()})})}/>
    <Button title="Escolher pasta de exportação" action={()=>run(chooseExportFolder)}/>
    <Button title="Importar preferências" action={()=>run(async()=>{const p=await readPreferences('Calendar') as any;if(p){if(![1,5,15].includes(p.refreshMinutes))throw Error('Intervalo inválido.');Storage.set('refresh-minutes',p.refreshMinutes);await reloadWidgets()}})}/>
    {message?<Text>{message}</Text>:null}
  </VStack>
}
