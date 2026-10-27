import { Button, Link, Rectangle, ZStack } from 'scripting'
import { GraphView } from './graph-view'
import { RefreshCalendar } from './app_intents'

export function timelineLayout(modelWidth:number,modelHeight:number,width:number,height:number,extraLarge=false){
  if(![modelWidth,modelHeight,width,height].every(n=>Number.isFinite(n)&&n>0))throw Error('Dimensões da timeline inválidas.')
  const scale=Math.min(width/modelWidth,height/modelHeight)
  const drawingWidth=extraLarge?modelWidth*scale:width,drawingHeight=extraLarge?modelHeight*scale:height
  return {width:drawingWidth,height:drawingHeight,left:(width-drawingWidth)/2,top:(height-drawingHeight)/2,sx:drawingWidth/modelWidth,sy:drawingHeight/modelHeight}
}
export function TimelineView({model,width,height,extraLarge=false}:{model:any;width:number;height:number;extraLarge?:boolean}){
  const layout=timelineLayout(model.width,model.height,width,height,extraLarge),{sx,sy}=layout
  const headerBottom=Math.max(0,...model.header.map((day:any)=>day.y+day.height))
  return <ZStack alignment="topLeading" frame={{width,height}} clipped widgetBackground="#0A0A0B">
    <ZStack frame={{width:layout.width,height:layout.height}} position={{x:width/2,y:height/2}}><GraphView image={model.image} width={layout.width} height={layout.height}/></ZStack>
    <Link url="scripting://run_single/Calendar%20Timeline%20Scripting?refresh=1" accessibilityLabel="Abrir Calendário pelos eventos e lembretes"
      frame={{width:layout.width,height:(model.height-headerBottom)*sy}}
      position={{x:width/2,y:layout.top+(headerBottom+(model.height-headerBottom)/2)*sy}}>
      <Rectangle fill="black" opacity={0.001} frame={{width:layout.width,height:(model.height-headerBottom)*sy}}/>
    </Link>
    {model.thermalBand?<Button intent={RefreshCalendar()} buttonStyle="plain" accessibilityLabel="Atualizar todos os widgets pela curva térmica"
      frame={{width:model.thermalBand.width*sx,height:model.thermalBand.height*sy}}
      position={{x:layout.left+(model.thermalBand.x+model.thermalBand.width/2)*sx,y:layout.top+(model.thermalBand.y+model.thermalBand.height/2)*sy}}>
      <Rectangle fill="black" opacity={0.001} frame={{width:model.thermalBand.width*sx,height:model.thermalBand.height*sy}}/>
    </Button>:null}
    {model.hourLegend?<Button intent={RefreshCalendar()} buttonStyle="plain" accessibilityLabel="Atualizar todos os widgets pela legenda de horas"
      frame={{width:model.hourLegend.width*sx,height:model.hourLegend.height*sy}}
      position={{x:layout.left+(model.hourLegend.x+model.hourLegend.width/2)*sx,y:layout.top+(model.hourLegend.y+model.hourLegend.height/2)*sy}}>
      <Rectangle fill="black" opacity={0.001} frame={{width:model.hourLegend.width*sx,height:model.hourLegend.height*sy}}/>
    </Button>:null}
  </ZStack>
}
