import { NavigationStack, ScrollView, VStack, Text, Link, Button, useState } from 'scripting'
const projects=[['Calendar','Agenda','Calendar Timeline Scripting'],['Codex','Codex','Codex'],['Popular','Indicadores','Popular Scripting']]
export default function Home(){
  const [revision,setRevision]=useState(0)
  return <NavigationStack><ScrollView><VStack spacing={16} padding={16} navigationTitle="Meu painel">
    {projects.map(([id,title,name])=>{
      const status=Storage.get<{at:number;label:string}>('sagittaryuz-dashboard:'+id,{shared:true})
      return <VStack key={id} spacing={6}>
        <Link url={'scripting://run/'+encodeURIComponent(name)}><Text font="headline">{title}</Text></Link>
        <Text>{status?status.label:'Abra o projeto para consultar os dados.'}</Text>
        {status?<Text foregroundStyle="secondary">{'Consulta: '+new Date(status.at).toLocaleString('pt-BR')}</Text>:null}
      </VStack>
    })}
    <Button title="Recarregar painel" action={()=>setRevision(revision+1)}/>
  </VStack></ScrollView></NavigationStack>
}
