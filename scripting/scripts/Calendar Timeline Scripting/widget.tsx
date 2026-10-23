import { Widget, Text } from 'scripting'
import { autoSynchronize } from './bridge-auto'
import { loadModel } from './model'
import { TimelineView } from './timeline-view'
import { VERSION, failureDetails } from './diagnostics'

async function main(){
  if(Widget.family!=='systemMedium'){
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Selecione o widget médio (4×2) para preservar a proporção original.</Text>)
    return
  }
  try{
    await autoSynchronize({origin:'widget',budgetMS:4500})
    const model=await loadModel({background:true}),{width,height}=Widget.displaySize
    Storage.set('widget-diagnostic',{version:VERSION,phase:'present-requested',at:Date.now()})
    Widget.present(<TimelineView model={model} width={width} height={height}/>,
      {policy:'after',date:new Date(Date.now()+15*60*1000)})
  }catch(error){
    const detail=failureDetails(error)
    try{Storage.set('widget-diagnostic',{version:VERSION,phase:'failed-before-present',at:Date.now(),error:detail})}catch{}
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">{detail.slice(0,280)}. Abra o projeto no app para ver o diagnóstico.</Text>)
  }
}
main()
