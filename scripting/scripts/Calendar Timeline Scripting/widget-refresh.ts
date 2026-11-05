// Prepare fresh local calendar/reminder data, request a widget reload, then open Calendar.
export async function openCalendarFromWidget(open:(url:string)=>Promise<boolean>){
  if(!await open('calshow://'))throw Error('O iOS não conseguiu abrir o Calendário da Apple.')
}
export async function refreshFromWidget(host:any){
  let active=true,timer:ReturnType<typeof setTimeout>|undefined
  try{
    await Promise.race([
      host.prepare(()=>active),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo de consulta excedido')),host.budgetMS??1200)})
    ])
  }catch(error){try{host.failed?.(error)}catch{}}
  finally{active=false;if(timer!==undefined)clearTimeout(timer)}
  try{host.reload()}catch(error){try{host.failed?.(error)}catch{}}
  await openCalendarFromWidget(host.open)
}
