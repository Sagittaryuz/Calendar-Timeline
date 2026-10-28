import { Link, Rectangle, ZStack } from 'scripting'
import { GraphView } from './graph-view'

// Deep link supplied by the user; launch requires Weathergraph to be installed.
export const WEATHERGRAPH_URL:string|null='weathergraph://'
export function timelineLayout(modelWidth:number,modelHeight:number,width:number,height:number,extraLarge=false){
  if(![modelWidth,modelHeight,width,height].every(n=>Number.isFinite(n)&&n>0))throw Error('Dimensões da timeline inválidas.')
  const scale=Math.min(width/modelWidth,height/modelHeight)
  const drawingWidth=extraLarge?modelWidth*scale:width,drawingHeight=extraLarge?modelHeight*scale:height
  return {width:drawingWidth,height:drawingHeight,left:(width-drawingWidth)/2,top:(height-drawingHeight)/2,sx:drawingWidth/modelWidth,sy:drawingHeight/modelHeight}
}
export function timelineTouchRegions(model:any){
  const split=Math.max(0,Math.min(model.height,Number(model.touchSplit?.y)))
  if(!Number.isFinite(split))throw Error('Geometria dos charts ausente para os toques.')
  return [{target:'calendar',url:'calshow://',x:0,y:0,width:model.width,height:split},
    {target:'weathergraph',url:WEATHERGRAPH_URL,x:0,y:split,width:model.width,height:model.height-split}]
}
export function TimelineView({model,width,height,extraLarge=false}:{model:any;width:number;height:number;extraLarge?:boolean}){
  const layout=timelineLayout(model.width,model.height,width,height,extraLarge),{sx,sy}=layout
  return <ZStack alignment="topLeading" frame={{width,height}} clipped widgetBackground="#0A0A0B">
    <ZStack frame={{width:layout.width,height:layout.height}} position={{x:width/2,y:height/2}}><GraphView image={model.image} width={layout.width} height={layout.height}/></ZStack>
    {timelineTouchRegions(model).map(region=>{
      const frame={width:region.width*sx,height:region.height*sy},position={x:layout.left+(region.x+region.width/2)*sx,y:layout.top+(region.y+region.height/2)*sy}
      return region.url?<Link key={region.target} url={region.url} accessibilityLabel={region.target==='calendar'?'Abrir Calendário':'Abrir Weathergraph'} frame={frame} position={position}>
        <Rectangle fill="black" opacity={0.001} frame={frame}/>
      </Link>:null
    })}
  </ZStack>
}
