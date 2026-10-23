import { Button, Rectangle, ZStack, Link } from 'scripting'
import { GraphView } from './graph-view'
import { SelectDay } from './app_intents'

export function TimelineView({model,width,height}:{model:any;width:number;height:number}){
  const sx=width/model.width,sy=height/model.height
  return <ZStack alignment="topLeading" frame={{width,height}} clipped widgetBackground="#0A0A0B">
    <Link url="calshow://"><GraphView image={model.image} width={width} height={height}/></Link>
    {model.header.map((day:any)=><Button key={day.date} intent={SelectDay({date:day.date})}
      buttonStyle="plain" accessibilityLabel={`Mostrar ${day.label}, ${day.date}`}
      frame={{width:day.width*sx,height:day.height*sy}}
      position={{x:(day.x+day.width/2)*sx,y:(day.y+day.height/2)*sy}}>
      <Rectangle fill="black" opacity={0.001} frame={{width:day.width*sx,height:day.height*sy}}/>
    </Button>)}
  </ZStack>
}
