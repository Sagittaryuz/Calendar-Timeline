import { Widget, Text } from 'scripting'
import { loadModel } from './model'
import { TimelineView } from './timeline-view'
import { VERSION, failureDetails, resetCanvasDiagnostics } from './diagnostics'

async function main(){
  const family=String(Widget.family)
  if(family!=='systemMedium'&&family!=='systemExtraLarge'){
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Selecione o widget médio ou o extragrande horizontal do iPad.</Text>)
    return
  }
  try{
    resetCanvasDiagnostics()
    try{Storage.set('widget-diagnostic',{version:VERSION,phase:'loading-model',at:Date.now()})}catch{}
    const model=await loadModel({background:true}),{width,height}=Widget.displaySize
    try{Storage.set('widget-diagnostic',{version:VERSION,phase:'present-requested',at:Date.now()})}catch{}
    Widget.present(<TimelineView model={model} width={width} height={height} extraLarge={family==='systemExtraLarge'}/>,
      {policy:'after',date:new Date((Math.floor(Date.now()/60000)+1)*60000)})
  }catch(error){
    const detail=failureDetails(error)
    try{Storage.set('widget-diagnostic',{version:VERSION,phase:'failed-before-present',at:Date.now(),error:detail})}catch{}
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">{detail.slice(0,280)}. Abra o projeto no app para ver o diagnóstico.</Text>)
  }
}
main()
