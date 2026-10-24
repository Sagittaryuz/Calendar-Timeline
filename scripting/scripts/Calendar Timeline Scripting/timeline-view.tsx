import { Button, Rectangle, ZStack, Link, Image } from 'scripting'
import { GraphView } from './graph-view'
import { SelectDay, RefreshCalendar } from './app_intents'

export function timelineLayout(modelWidth:number,modelHeight:number,width:number,height:number,extraLarge=false){
  if(![modelWidth,modelHeight,width,height].every(n=>Number.isFinite(n)&&n>0))throw Error('Dimensões da timeline inválidas.')
  const scale=Math.min(width/modelWidth,height/modelHeight)
  const drawingWidth=extraLarge?modelWidth*scale:width,drawingHeight=extraLarge?modelHeight*scale:height
  return {width:drawingWidth,height:drawingHeight,left:(width-drawingWidth)/2,top:(height-drawingHeight)/2,sx:drawingWidth/modelWidth,sy:drawingHeight/modelHeight}
}
export function TimelineView({model,width,height,extraLarge=false}:{model:any;width:number;height:number;extraLarge?:boolean}){
  const layout=timelineLayout(model.width,model.height,width,height,extraLarge),{sx,sy}=layout
  return <ZStack alignment="topLeading" frame={{width,height}} clipped widgetBackground="#0A0A0B">
    <Link url="calshow://" {...(extraLarge?{frame:{width:layout.width,height:layout.height},position:{x:width/2,y:height/2}}:{})}><GraphView image={model.image} width={layout.width} height={layout.height}/></Link>
    {model.header.map((day:any)=><Button key={day.date} intent={SelectDay({date:day.date})}
      buttonStyle="plain" accessibilityLabel={`Mostrar ${day.label}, ${day.date}`}
      frame={{width:day.width*sx,height:day.height*sy}}
      position={{x:layout.left+(day.x+day.width/2)*sx,y:layout.top+(day.y+day.height/2)*sy}}>
      <Rectangle fill="black" opacity={0.001} frame={{width:day.width*sx,height:day.height*sy}}/>
    </Button>)}
    <Button intent={RefreshCalendar()} buttonStyle="plain" accessibilityLabel="Atualizar agenda e condições atuais"
      frame={{width:28,height:28}} position={{x:layout.left+layout.width-24,y:layout.top+layout.height-24}}>
      <Image systemName="arrow.clockwise" font={12} foregroundStyle="white" frame={{width:28,height:28}}
        background={{style:'rgba(0,0,0,0.35)',shape:{type:'circle'}}}/>
    </Button>
  </ZStack>
}
