import { Canvas, ZStack, UIImage } from 'scripting'
import { replay, segments, childViewport } from './drawing'

const symbols = new Map<string,UIImage|null>()
function resolveSymbol(name:string,color:string){
  const key=name+color
  if(!symbols.has(key))symbols.set(key,UIImage.fromSFSymbol(name)?.withTintColor(color,'alwaysOriginal')??null)
  return symbols.get(key)
}

// Each offscreen Scriptable image keeps its own clip and painter order.
// Native blur is isolated to the future layer, rather than blurring current events.
export function GraphView({image,width,height,viewport}:{image:any;width:number;height:number;viewport?:any}){
  const sx=width/image.size.width,sy=height/image.size.height
  const visible=viewport??{x:0,y:0,width:image.size.width,height:image.size.height}
  return <ZStack alignment="topLeading" frame={{width,height}} clipped
    blur={image.blurRadius ? image.blurRadius*Math.min(sx,sy) : undefined}>
    {segments(image,visible).map((part:any,index:number)=>{
      if(part.type==='canvas')return <Canvas key={String(index)} frame={{width,height}} opaque={false}
        draw={(ctx,size)=>replay(ctx,part.ops,image.size.width,image.size.height,size.width,size.height,resolveSymbol)} />
      const r=part.rect
      const child=childViewport(part.image,r,visible)
      if(!child)return null
      return <ZStack key={String(index)} frame={{width:r.width*sx,height:r.height*sy}}
        position={{x:(r.x+r.width/2)*sx,y:(r.y+r.height/2)*sy}}>
        <GraphView image={part.image} width={r.width*sx} height={r.height*sy} viewport={child}/>
      </ZStack>
    })}
  </ZStack>
}
