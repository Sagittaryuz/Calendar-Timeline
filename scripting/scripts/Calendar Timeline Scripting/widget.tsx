import { Widget, Text } from 'scripting'
import { loadModel } from './model'
import { TimelineView } from './timeline-view'

async function main(){
  if(Widget.family!=='systemMedium'){
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Selecione o widget médio (4×2) para preservar a proporção original.</Text>)
    return
  }
  try{
    const model=await loadModel(),{width,height}=Widget.displaySize
    Widget.present(<TimelineView model={model} width={width} height={height}/>,
      {policy:'after',date:new Date(Date.now()+15*60*1000)})
  }catch{
    Widget.present(<Text widgetBackground="#0A0A0B" foregroundStyle="white">Abra Calendar Timeline Scripting no app para autorizar as fontes e verificar o teste.</Text>)
  }
}
main()
