// Foreground handoff: request a new render before opening Calendar.
// Await a short preparation budget; timeout/offline still reload cache and navigate.
export async function refreshFromWidget(host:any){
  const failed=(error:unknown)=>{try{host.failed?.(error)}catch{}}
  try{host.request?.()}catch(error){failed(error)}
  let active=true,timer:ReturnType<typeof setTimeout>|undefined
  try{
    if(host.prepare)await Promise.race([
      host.prepare(()=>active),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo de preparação ao toque excedido; manter cache.')),host.budgetMS??1200)})
    ])
  }catch(error){failed(error)}
  finally{active=false;if(timer!==undefined)clearTimeout(timer)}
  try{host.reload()}catch(error){failed(error)}
  const opened=await host.open('calshow://')
  if(!opened)throw Error('O iOS não conseguiu abrir o Calendário da Apple.')
}
