import { Button, Dialog, Navigation, NavigationStack, Script, Widget, Text, VStack } from 'scripting'
import { configuration, configure, synchronize } from './bridge-client'

export async function showBridge(reconfigure=false){
 try{
  if(!configuration()||reconfigure){
   const raw=await Dialog.prompt({title:'Parear Calendar Timeline Bridge',message:'Cole a configuração privada gerada no painel. Ela será guardada no Keychain deste projeto.',obscureText:true,confirmLabel:'Parear'})
   if(!raw)return
   configure(raw)
  }
  if(!Storage.get<boolean>('test-scope-consent')){
   const yes=await Dialog.confirm({title:'Prova com dois itens de teste',message:'Este projeto pode criar e editar somente o lembrete e o evento [CT TESTE] enviados pela ponte privada. Pode concluir/reabrir o lembrete. Nenhum outro registro será enviado. Os itens usam o calendário/lista padrão do iPhone.',confirmLabel:'Executar prova',cancelLabel:'Cancelar'})
   if(!yes)return
   if(!Storage.set('test-scope-consent',true))throw Error('Não foi possível guardar a autorização local.')
  }
  const report=await synchronize()
  Widget.reloadAll()
  await Navigation.present(<NavigationStack><VStack spacing={14} padding={20} navigationTitle="Calendar Timeline Bridge">
   <Text>Ponte de teste · versão 0.1.1</Text>
   <Text>Última execução: {new Date(report.finishedAt).toLocaleString('pt-BR')}</Text>
   <Text>Gravações confirmadas nesta execução: {report.applied}. Conflitos: {report.conflicts}. Pendentes: {report.pending}.</Text>
   <Text>Somente os dois itens [CT TESTE] são compartilhados. Alterações feitas neles no Calendário ou Lembretes serão enviadas na próxima execução.</Text>
   <Text>Volte ao ChatGPT e use o plugin Calendar Timeline Bridge para consultar o resultado ou enviar uma alteração de teste.</Text>
   <Text>A ponte roda ao executar este projeto. Atualização contínua com o iPhone bloqueado ainda não foi comprovada.</Text>
   <Button title="Fechar" action={()=>Navigation.dismiss()}/>
  </VStack></NavigationStack>)
 }catch(error:any){await Dialog.alert({title:'Ponte não concluída',message:'Não foi possível confirmar a sincronização. A fila e o registro local serão retomados na próxima execução.\n\n'+String(error?.message??error)})}
}

