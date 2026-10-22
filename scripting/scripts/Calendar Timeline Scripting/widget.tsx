import { Widget, Text } from 'scripting'
import { loadModel } from './model'
import { TimelineView } from './timeline-view'

async function main(){
  if(Widget.family!=='systemMedium'){
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Selecione o widget médio (4×2) para preservar a proporção original.</Text>)
    return
  }
  try{
    const model=await loadModel({background:true}),{width,height}=Widget.displaySize
    Storage.set('widget-diagnostic',{version:'0.1.1',phase:'present-requested',at:Date.now()})
    Widget.present(<TimelineView model={model} width={width} height={height}/>,
      {policy:'after',date:new Date(Date.now()+15*60*1000)})
  }catch(error){
    Storage.set('widget-diagnostic',{version:'0.1.1',phase:'failed-before-present',at:Date.now(),error:String(error).slice(0,180)})
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Abra Calendar Timeline Scripting no app para autorizar as fontes e verificar o teste.</Text>)
  }
}
main()
