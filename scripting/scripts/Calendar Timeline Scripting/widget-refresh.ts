// Separate local refresh from cloud availability. Always preserve the Calendar destination.
export async function refreshFromWidget(host:any){
 try{await host.sync()}catch{}
 try{await host.load()}catch(error){host.failed(error)}
 finally{
  host.reload()
  const opened=await host.open('calshow://')
  if(!opened)throw Error('O iOS não conseguiu abrir o Calendário da Apple.')
 }
}
