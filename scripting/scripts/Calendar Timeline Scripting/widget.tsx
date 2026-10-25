import { Widget, Text } from 'scripting'
import { autoSynchronize } from './bridge-auto'
import { loadModel } from './model'
import { TimelineView } from './timeline-view'
import { VERSION, failureDetails } from './diagnostics'

async function main(){
  const family=String(Widget.family)
  if(family!=='systemMedium'&&family!=='systemExtraLarge'){
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Selecione o widget médio ou o extragrande horizontal do iPad.</Text>)
    return
  }
  try{
    const touched=Storage.get<number>('calendar-local-touch')??0
    if(!(Date.now()>=touched&&Date.now()-touched<15000))await autoSynchronize({origin:'widget',budgetMS:8000})
    const forced=Storage.get<number>('calendar-force-weather')??0
    const model=await loadModel({background:true,forceWeather:Date.now()>=forced&&Date.now()-forced<15000}),{width,height}=Widget.displaySize
    if(forced)Storage.set('calendar-force-weather',0)
    Storage.set('widget-diagnostic',{version:VERSION,phase:'present-requested',at:Date.now()})
    Widget.present(<TimelineView model={model} width={width} height={height} extraLarge={family==='systemExtraLarge'}/>,
      {policy:'after',date:new Date(Date.now()+60*1000)})
  }catch(error){
    const detail=failureDetails(error)
    try{Storage.set('widget-diagnostic',{version:VERSION,phase:'failed-before-present',at:Date.now(),error:detail})}catch{}
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">{detail.slice(0,280)}. Abra o projeto no app para ver o diagnóstico.</Text>)
  }
}
main()
