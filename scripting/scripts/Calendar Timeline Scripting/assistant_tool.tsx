import { Button, Text, VStack, useState } from 'scripting'
import { localDay, readDay } from './day-model'
function Tool({response}:AssistantTool.UIProps<{}>){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  return <VStack><Text>Compartilhar a agenda de hoje com esta conversa.</Text><Button title={busy?'Consultando…':'Consultar hoje'} action={async()=>{if(busy)return;setBusy(true);try{
    const data=await readDay(localDay(new Date()));response({success:true,output:{assistantParts:[{type:'text',text:JSON.stringify(data)}],userParts:[{type:'text',text:'Agenda de '+data.date+' · consulta '+data.capturedAt}]}})
  }catch{setError('Não foi possível consultar a agenda.')}finally{setBusy(false)}}}/>{error?<Text>{error}</Text>:null}</VStack>
}
AssistantTool.registerUIView(Tool)
