import { VERSION } from './diagnostics'
import { commandStatus, readStatus } from './bridge-read-state'
import { Button, Navigation, NavigationStack, Widget, Text, VStack, useState } from 'scripting'
import { configuration, configure, synchronize } from './bridge-client'

export async function showBridge(reconfigure=false,onStatus?:(message:string)=>void){
 try{
  onStatus?.("Verificando o pareamento local…")
  if(!configuration()||reconfigure){
   onStatus?.("Aguardando a configuração privada no diálogo de pareamento…")
   const raw=await Dialog.prompt({title:'Parear Calendar Timeline Bridge',message:'Cole a configuração privada gerada no painel. Ela será guardada no Keychain deste projeto.',obscureText:true,confirmLabel:'Parear'})
   if(!raw){onStatus?.("Pareamento cancelado. Nenhum dado foi enviado.");return}
   configure(raw)
  }
  if(!Storage.get<boolean>('test-scope-consent')){
   onStatus?.("Aguardando sua autorização para os dois itens de teste…")
   const yes=await Dialog.confirm({title:'Conectar agenda e testes',message:'Este projeto pode criar e editar eventos e lembretes enviados pela sua ponte privada e concluir/reabrir lembretes reais. Séries recorrentes e itens com participantes ficam somente para consulta. Sua agenda real da semana atual e próxima também é enviada em modo de consulta; notas e convidados não são enviados. Os itens usam o calendário/lista padrão do iPhone.',confirmLabel:'Executar prova',cancelLabel:'Cancelar'})
   if(!yes){onStatus?.("Prova cancelada. Nenhum dado foi enviado.");return}
   if(!Storage.set('test-scope-consent',true))throw Error('Não foi possível guardar a autorização local.')
  }
  onStatus?.("Conectando à ponte privada e verificando a fila…")
  const report=await synchronize()
  Widget.reloadAll()
  const message=`Sincronização concluída em ${new Date(report.finishedAt).toLocaleString("pt-BR")}. ${readStatus(report)} ${commandStatus(report)} Agenda: ${report.agenda?.accepted?'recebida':'envio não confirmado'}.`
  if(onStatus){onStatus(message);return}
  await Navigation.present(<NavigationStack><VStack spacing={14} padding={20} navigationTitle="Calendar Timeline Bridge">
   <Text>Ponte Calendar Timeline · {VERSION}</Text>
   <Text>Última execução: {new Date(report.finishedAt).toLocaleString('pt-BR')}</Text>
   <Text>{readStatus(report)} {commandStatus(report)}</Text>
   <Text>A semana atual e a próxima são compartilhadas para consulta. Itens reais graváveis, sem recorrência ou participantes, aceitam alterações pela fila privada.</Text>
   <Text>Volte ao ChatGPT e use o plugin Calendar Timeline Bridge para consultar o resultado ou solicitar uma alteração na sua agenda.</Text>
   <Text>A ponte roda ao executar este projeto. Atualização contínua com o iPhone bloqueado ainda não foi comprovada.</Text>

  </VStack></NavigationStack>)
 }catch(error:any){const message='Não foi possível confirmar a sincronização. A fila e o registro local serão retomados na próxima execução.\n\n'+String(error?.message??error);if(onStatus){onStatus(message);return}await Dialog.alert({title:'Ponte não concluída',message})}
}


let launching=false
export function BridgeLauncher(){
 const [status,setStatus]=useState(Storage.get<any>('bridge-auto-state')?.message??'')
 const [busy,setBusy]=useState(false)
 return <VStack spacing={8}>
  <Button title={busy?'Ponte em execução…':'Ponte com ChatGPT'} action={async()=>{
   if(launching){setStatus('A ponte já está em execução. Aguarde o resultado.');return}
   launching=true;setBusy(true);setStatus('Abrindo a ponte…')
   try{await showBridge(false,setStatus)}
   catch{setStatus('Não foi possível abrir a ponte. Feche e execute novamente o projeto. Nenhuma sincronização foi confirmada.')}
   finally{launching=false;setBusy(false)}
  }}/>
  {status?<Text fixedSize={{horizontal:false,vertical:true}}>{status}</Text>:null}
 </VStack>
}
