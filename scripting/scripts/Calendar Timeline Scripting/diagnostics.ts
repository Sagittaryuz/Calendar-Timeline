export const VERSION='0.3.1'

export function markPhase(phase:string,started:number){
  // Diagnostics must never turn a successful model into a failure.
  try{Storage.set('render-diagnostic',{version:VERSION,phase,started,elapsedMS:Date.now()-started})}catch{}
}

export function failureDetails(error:unknown){
  let phase='não identificada'
  try{phase=Storage.get<any>('render-diagnostic')?.phase??phase}catch{}
  let detail:string
  try{
    const value=error as {name?:string;message?:string;stack?:string}
    detail=value?.message ? `${value.name??'Erro'}: ${value.message}` : String(error)
    if(value?.stack)detail+='\n'+value.stack
  }catch{detail='Não foi possível ler o erro retornado pelo aplicativo.'}
  return `Versão ${VERSION} · etapa: ${phase}\n${detail.slice(0,1100)}`
}

