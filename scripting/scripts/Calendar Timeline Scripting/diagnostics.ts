export const VERSION='0.3.45'

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

// Canvas callbacks execute after Widget.present; its surrounding try/catch
// cannot observe them. Log only the first entry/completion and first error.
let canvasStarted=false,canvasFailed=false
function canvasRecord(phase:string,error?:unknown){
  try{Storage.set('canvas-diagnostic',{version:VERSION,phase,at:Date.now(),
    ...(error!==undefined?{error:String(error).slice(0,600)}:{})})}catch{}
}
export function resetCanvasDiagnostics(){
  canvasStarted=false;canvasFailed=false;canvasRecord('awaiting-canvas')
}
export function runCanvasDraw(draw:()=>void){
  const first=!canvasStarted;canvasStarted=true
  if(first)canvasRecord('canvas-started')
  try{
    draw()
    if(first&&!canvasFailed)canvasRecord('first-canvas-layer-completed')
  }catch(error){
    if(!canvasFailed){canvasFailed=true;canvasRecord('canvas-failed',error)}
    throw error
  }
}
