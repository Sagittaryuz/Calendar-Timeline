// Compatibility handoff for old rendered links: navigation only, no refresh.
export async function openCalendarFromWidget(open:(url:string)=>Promise<boolean>){
  if(!await open('calshow://'))throw Error('O iOS não conseguiu abrir o Calendário da Apple.')
}
export async function refreshFromWidget(host:any){return openCalendarFromWidget(host.open)}
