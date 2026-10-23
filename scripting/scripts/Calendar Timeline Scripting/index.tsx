import { readLines } from './bridge-read-state'
import { previousAttemptLines } from './bridge-attempts'
import { Navigation, NavigationStack, ScrollView, VStack, Text, Script, Widget } from 'scripting'
import { BridgeLauncher, showBridge } from './bridge'
import { autoSynchronize } from './bridge-auto'
import { refreshFromWidget } from './widget-refresh'
import { loadModel } from './model'
import { VERSION, failureDetails } from './diagnostics'

async function main(){
  // Snapshot before app-open sync so success cannot hide the prior offline attempt.
  const previousAttempts=previousAttemptLines()
  try{
    if(Script.queryParameters.refresh==='1'){
      await refreshFromWidget({
        sync:()=>autoSynchronize({origin:'widget-touch',force:true,budgetMS:10000}),
        load:()=>loadModel({background:true}),reload:()=>Widget.reloadAll(),open:(url:string)=>Safari.openURL(url),
        failed:()=>Storage.set('widget-tap-diagnostic',{at:Date.now(),state:'local-render-failed'})
      })
      return
    }
    if(Script.queryParameters.bridge==='1'||Script.queryParameters.configure==='1'){
      await showBridge(Script.queryParameters.configure==='1')
      return
    }
    // The first foreground execution obtains the iOS permissions used by the widget.
    await autoSynchronize({origin:'app-open',force:true,budgetMS:15000})
    const model=await loadModel()
    Widget.reloadAll()
    await Navigation.present(<NavigationStack><ScrollView><VStack spacing={12} padding={16} navigationTitle="Calendar Timeline">
      <BridgeLauncher/>
      {previousAttempts.map((line:string,index:number)=><Text key={'attempt-'+index} fixedSize={{horizontal:false,vertical:true}}>{line}</Text>)}
      {readLines(Storage.get('bridge-read-items'),Storage.get<any[]>('bridge-local-items')??[]).map((line:string,index:number)=><Text key={index} fixedSize={{horizontal:false,vertical:true}}>{line}</Text>)}
      <Text fixedSize={{horizontal:false,vertical:true}}>{(()=>{const agenda=Storage.get<any>('bridge-agenda-status');return agenda?.accepted?`Agenda real: ${agenda.count} itens enviados (${agenda.state}) em ${new Date(agenda.receivedAt).toLocaleString('pt-BR')}. Janela: ${agenda.window?.startDay} a ${agenda.window?.endDay} (fim exclusivo).`:'Agenda real: envio ainda não confirmado nesta execução.'})()}</Text>
      <Text>Ponte automática ao abrir, tocar e nas execuções do widget autorizadas pelo iOS. Não há serviço contínuo garantido com a tela bloqueada.</Text>
      <Text>A ponte compartilha sua semana atual e a próxima para consulta privada: títulos, datas, horários, calendário/lista e conclusão. Notas e convidados ficam no iPhone. O ChatGPT pode solicitar criação/edição de eventos e lembretes reais e conclusão/reabertura de lembretes. A gravação só é confirmada após releitura no iPhone. Séries e itens com participantes são apenas consultados.</Text>
      <Text>Versão de teste para Scripting · {VERSION}</Text>
      <Text>Preparação local: {Storage.get<any>('render-diagnostic')?.elapsedMS??'—'} ms. Isso não mede o desenho final na Tela de Início.</Text>
      <Text>Motor original: {model.version}. Dia: {model.focusDate}.</Text>
      <Text>Avisos de desenho: {JSON.stringify(Storage.get('raster-warnings'))}. Se houver avisos, partes do efeito visual foram omitidas; a reprodução visual precisa de conferência.</Text>
      <Text>Calendário: {model.sourceStatus.schedule?.event===false?'acesso não confirmado':'consultado'}. Lembretes: {model.sourceStatus.schedule?.reminder===false?'acesso não confirmado':'consultado'}.</Text>
      <Text>Semana fixa de domingo a sábado. Toque em um dia para ver sua agenda das 00h às 24h. A régua não se desloca com o relógio.</Text>
      <Text>Eventos e lembretes são consultados novamente a cada execução. A atualização automática é solicitada a partir de 15 minutos, sujeita ao iOS.</Text>
      <Text>Não há botão Atualizar. Na virada do dia, a seleção retorna a hoje na próxima execução.</Text>
      <Text>Esta versão ainda exige conferência visual e teste dos toques na Tela de Início.</Text>
      <Text>Último diagnóstico do widget: {Storage.get<any>('widget-diagnostic')?.error??Storage.get<any>('widget-diagnostic')?.phase??'sem registro'}.</Text>
    </VStack></ScrollView></NavigationStack>)
  }catch(error){
    const detail=failureDetails(error)
    await Navigation.present(<NavigationStack><ScrollView><VStack spacing={12} padding={16} navigationTitle="Diagnóstico Calendar Timeline">
      <Text>Falha ao preparar a timeline. Este erro não confirma falta de permissão.</Text>
      {previousAttempts.map((line:string,index:number)=><Text key={'attempt-error-'+index} fixedSize={{horizontal:false,vertical:true}}>{line}</Text>)}
      <Text>{detail}</Text>
      <Text>Envie uma captura desta tela para identificar a causa. O diagnóstico fica somente no aparelho.</Text>
    </VStack></ScrollView></NavigationStack>)
  }
  finally{Script.exit()}
}
main()
