import { Navigation, NavigationStack, ScrollView, VStack, Text, Script, Widget, useEffect, useState } from 'scripting'
import { refreshFromWidget } from './widget-refresh'
import { loadModel } from './model'
import { clearTimelineSelection } from './selection'
import { VERSION, failureDetails } from './diagnostics'

async function main(){
  try{
    if(Script.queryParameters.refresh==='1'){
      await refreshFromWidget({
        request:()=>{clearTimelineSelection();Storage.set('calendar-local-touch',Date.now());Storage.set('calendar-force-weather',Date.now())},
        prepare:(isCurrent:()=>boolean)=>loadModel({background:true,forceWeather:true,prepareOnly:true,shouldPersist:isCurrent}),
        reload:()=>Widget.reloadAll(),open:(url:string)=>Safari.openURL(url),
        failed:()=>Storage.set('widget-tap-diagnostic',{at:Date.now(),state:'local-render-failed'})
      })
      return
    }
    await Navigation.present(<Screen/>)
  }catch(error){
    const detail=failureDetails(error)
    await Navigation.present(<NavigationStack><ScrollView><VStack spacing={12} padding={16} navigationTitle="Diagnóstico Calendar Timeline">
      <Text>Falha ao preparar a timeline. Este erro não confirma falta de permissão.</Text>
      <Text>{detail}</Text>
      <Text>Envie uma captura desta tela para identificar a causa. O diagnóstico fica somente no aparelho.</Text>
    </VStack></ScrollView></NavigationStack>)
  }
  finally{Script.exit()}
}
function Screen(){
  const [model,setModel]=useState<any>(null),[error,setError]=useState('')
  useEffect(()=>{
    let active=true
    void (async()=>{
      try{
        const next=await loadModel({prepareOnly:true})
        Widget.reloadAll()
        if(active)setModel(next)
      }catch(error){if(active)setError(failureDetails(error))}
    })()
    return ()=>{active=false}
  },[])
  return <NavigationStack><ScrollView><VStack spacing={12} padding={16} navigationTitle="Calendar Timeline">
      <Text>{error||(!model?'Consultando agenda e preparando os dados…':'Dados locais preparados.')}</Text>
      <Text>Eventos e lembretes são lidos no iPhone para exibição local. A integração Calendar Timeline Bridge foi retirada; esta versão não envia a agenda nem processa comandos remotos.</Text>
      <Text>Versão de teste para Scripting · {VERSION}</Text>
      <Text>Preparação local: {Storage.get<any>('render-diagnostic')?.elapsedMS??'—'} ms. Isso não mede o desenho final na Tela de Início.</Text>
      <Text>Motor original: {model?.version??'—'}. Dia: {model?.focusDate??'—'}.</Text>
      <Text>Avisos de desenho: {JSON.stringify(Storage.get('raster-warnings'))}. Se houver avisos, partes do efeito visual foram omitidas; a reprodução visual precisa de conferência.</Text>
      <Text>Calendário: {!model?'aguardando consulta':model.sourceStatus.schedule?.event===false?'acesso não confirmado':'consultado'}. Lembretes: {!model?'aguardando consulta':model.sourceStatus.schedule?.reminder===false?'acesso não confirmado':'consultado'}.</Text>
      <Text>Semana fixa de domingo a sábado. A timeline acompanha o horário atual em cada atualização permitida pelo iOS. Os quadros não selecionam outro dia.</Text>
      <Text>Eventos e lembretes são consultados novamente a cada execução. A atualização automática é solicitada após 1 minuto, sujeita ao iOS.</Text>
      <Text>Os charts abrem o Calendário; curva térmica e legenda de horas solicitam atualização local. Na virada do dia, a próxima execução acompanha a nova data.</Text>
      <Text>Esta versão ainda exige conferência visual e teste dos toques na Tela de Início.</Text>
      <Text>Último diagnóstico do widget: {Storage.get<any>('widget-diagnostic')?.error??Storage.get<any>('widget-diagnostic')?.phase??'sem registro'}.</Text>
    </VStack></ScrollView></NavigationStack>
}

main()
