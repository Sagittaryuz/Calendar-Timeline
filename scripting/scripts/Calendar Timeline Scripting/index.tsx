import { Navigation, NavigationStack, VStack, Text, Script, Widget } from 'scripting'
import { loadModel } from './model'

async function main(){
  try{
    // The first foreground execution obtains the iOS permissions used by the widget.
    const model=await loadModel()
    Widget.reloadAll()
    await Navigation.present(<NavigationStack><VStack spacing={12} padding={16} navigationTitle="Calendar Timeline">
      <Text>Versão de teste para Scripting · 0.1.0</Text>
      <Text>Motor original: {model.version}. Dia: {model.focusDate}.</Text>
      <Text>Calendário: {model.sourceStatus.schedule?.event===false?'acesso não confirmado':'consultado'}. Lembretes: {model.sourceStatus.schedule?.reminder===false?'acesso não confirmado':'consultado'}.</Text>
      <Text>Adicione o widget médio do Scripting à Tela de Início e selecione este projeto. Toque nos dias do cabeçalho para mudar a timeline.</Text>
      <Text>Não há botão Atualizar. Na virada do dia, a seleção retorna a hoje na próxima execução.</Text>
      <Text>Esta versão ainda exige conferência visual e teste dos toques na Tela de Início.</Text>
    </VStack></NavigationStack>)
  }catch{
    await Navigation.present(<NavigationStack><Text padding={16}>Não foi possível preparar o widget. Verifique as permissões de Calendário, Lembretes e Localização do Scripting e tente novamente.</Text></NavigationStack>)
  }
  Script.exit()
}
main()
