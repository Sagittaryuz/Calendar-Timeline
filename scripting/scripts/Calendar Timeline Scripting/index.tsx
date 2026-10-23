import { Button, Navigation, NavigationStack, VStack, Text, Script, Widget } from 'scripting'
import { showBridge } from './bridge'
import { loadModel } from './model'
import { VERSION, failureDetails } from './diagnostics'

async function main(){
  try{
    if(Script.queryParameters.bridge==='1'||Script.queryParameters.configure==='1'){
      await showBridge(Script.queryParameters.configure==='1')
      return
    }
    // The first foreground execution obtains the iOS permissions used by the widget.
    const model=await loadModel()
    Widget.reloadAll()
    await Navigation.present(<NavigationStack><VStack spacing={12} padding={16} navigationTitle="Calendar Timeline">
      <Button title="Ponte com ChatGPT" action={()=>showBridge()}/>
      <Text>A ponte compartilha somente os dois itens de teste após o pareamento privado.</Text>
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
    </VStack></NavigationStack>)
  }catch(error){
    const detail=failureDetails(error)
    await Navigation.present(<NavigationStack><VStack spacing={12} padding={16} navigationTitle="Diagnóstico Calendar Timeline">
      <Text>Falha ao preparar a timeline. Este erro não confirma falta de permissão.</Text>
      <Text>{detail}</Text>
      <Text>Envie uma captura desta tela para identificar a causa. O diagnóstico fica somente no aparelho.</Text>
    </VStack></NavigationStack>)
  }
  finally{Script.exit()}
}
main()
