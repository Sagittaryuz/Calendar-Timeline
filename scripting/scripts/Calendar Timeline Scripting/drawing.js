// @ts-nocheck
// Scriptable drawing contract, recorded without changing the source geometry.
import { drawDiagonal } from './diagonal-canvas.js';
import { RectRaster } from './rect-raster.js';
export class Size { constructor(width,height) {Object.assign(this,{width,height});} }
export class Point { constructor(x,y) {Object.assign(this,{x,y});} }
export class Rect { constructor(x,y,width,height) {Object.assign(this,{x,y,width,height});} }
export class Color {
  constructor(hex,alpha=1) {
    const raw=hex.replace(/^#/,'');
    const rgba=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(raw);
    if(rgba){
      this.hex=rgba.slice(1,4).map(n=>Math.max(0,Math.min(255,Math.round(Number(n)))).toString(16).padStart(2,'0')).join('');
      this.alpha=alpha*(rgba[4]===undefined?1:Math.max(0,Math.min(1,Number(rgba[4]))));
    }else{this.hex=raw;this.alpha=alpha;}
  }
  static white(){return new Color('FFFFFF');}
  static black(){return new Color('000000');}
  css(){const h=this.hex;return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${this.alpha})`;}
}
export class Font {
  constructor(name,size){Object.assign(this,{name,size});}
  static blackMonospacedSystemFont(n){return new Font('SFMono-Heavy',n);}
  static blackRoundedSystemFont(n){return new Font('SFProRounded-Black',n);}
  static boldRoundedSystemFont(n){return new Font('SFProRounded-Bold',n);}
  static boldSystemFont(n){return new Font('SFProText-Bold',n);}
  static mediumSystemFont(n){return new Font('SFProText-Medium',n);}
  static regularMonospacedSystemFont(n){return new Font('SFMono-Regular',n);}
  static regularRoundedSystemFont(n){return new Font('SFProRounded-Regular',n);}
}
export class Path {
  constructor(){this.commands=[];}
  move(p){this.commands.push(['moveTo',p.x,p.y]);}
  addLine(p){this.commands.push(['lineTo',p.x,p.y]);}
  addCurve(p,c1,c2){this.commands.push(['bezierCurveTo',c1.x,c1.y,c2.x,c2.y,p.x,p.y]);}
  closeSubpath(){this.commands.push(['closePath']);}
}
export class DrawContext {
  constructor(){this.size=new Size(1,1);this.ops=[];this.state={fill:new Color('000000'),stroke:new Color('000000'),text:new Color('000000'),font:new Font('SFProText-Regular',12),width:1,align:'left'};}
  setFillColor(v){this.state.fill=v;}
  setStrokeColor(v){this.state.stroke=v;}
  setTextColor(v){this.state.text=v;}
  setFont(v){this.state.font=v;}
  setLineWidth(v){this.state.width=v;}
  setTextAlignedLeft(){this.state.align='left';}
  setTextAlignedRight(){this.state.align='right';}
  setTextAlignedCenter(){this.state.align='center';}
  addPath(p){this.path=p.commands.slice();}
  flushRects(){
    if(this.bitmap){
      const crop=this.bitmap.crop();this.bitmap=null;
      if(crop){const image=this.makeRaster(crop);this.ops.push({type:'image',image,rect:new Rect(crop.x,crop.y,crop.width,crop.height)});}
    }else if(this.rectRun?.length)for(const entry of this.rectRun)this.ops.push({type:'fillRect',rect:entry.rect,state:entry.state});
    this.rectRun=[];
  }
  op(type,data){this.flushRects();this.ops.push({type,...data,state:{...this.state}});}
  fillRect(rect){
    if(!this.makeRaster){this.op('fillRect',{rect});return;}
    if(this.bitmap){this.bitmap.fill(rect,this.state.fill);return;}
    (this.rectRun??=[]).push({rect,state:{...this.state}});
    if(this.rectRun.length>=128){
      this.bitmap=new RectRaster(this.size.width,this.size.height,this.onInvalidColor);
      for(const entry of this.rectRun)this.bitmap.fill(entry.rect,entry.state.fill);
      this.rectRun=[];
    }
  }
  strokeRect(rect){this.op('strokeRect',{rect});}
  fillEllipse(rect){this.op('fillEllipse',{rect});}
  strokeEllipse(rect){this.op('strokeEllipse',{rect});}
  fillPath(){this.op('fillPath',{path:this.path});this.path=[];}
  strokePath(){this.op('strokePath',{path:this.path});this.path=[];}
  drawText(text,point){this.op('text',{text:String(text),point});}
  drawTextInRect(text,rect,tracking=0){this.op('text',{text:String(text),point:new Point(rect.x,rect.y),rect,...(tracking?{tracking}:{})});}
  drawImageAtPoint(image,p){this.drawImageInRect(image,new Rect(p.x,p.y,image.size.width,image.size.height));}
  drawImageInRect(image,rect){this.flushRects();this.ops.push({type:'image',image,rect});}
  getImage(){this.flushRects();return {size:{...this.size},ops:this.ops.slice()};}
}

export function replay(ctx,ops,width,height,targetWidth,targetHeight,resolveSymbol){
  ctx.save();ctx.scale(targetWidth/width,targetHeight/height);
  for(const op of ops){
    const s=op.state,r=op.rect;
    if(s){ctx.fillStyle=s.fill.css();ctx.strokeStyle=s.stroke.css();ctx.lineWidth=s.width;}
    if(op.type==='header')replayHeader(ctx,op,resolveSymbol);
    else if(op.type==='fillRect'||op.type==='strokeRect')ctx[op.type](r.x,r.y,r.width,r.height);
    else if(op.type==='fillEllipse'||op.type==='strokeEllipse'){
      ctx.beginPath();ctx.ellipse(r.x+r.width/2,r.y+r.height/2,r.width/2,r.height/2,0,0,Math.PI*2,false);
      ctx[op.type==='fillEllipse'?'fill':'stroke']();
    } else if(op.type==='fillPath'||op.type==='strokePath'){
      ctx.beginPath();for(const [method,...args] of op.path)ctx[method](...args);
      ctx[op.type==='fillPath'?'fill':'stroke']();
    } else if(op.type==='text'){
      ctx.save();if(r){ctx.beginPath();ctx.rect(r.x,r.y,r.width,r.height);ctx.clip();}
      ctx.font={name:s.font.name,size:s.font.size};ctx.fillStyle=s.text.css();ctx.textBaseline='top';ctx.textAlign=s.align;
      const anchor=op.point.x+(r?(s.align==='center'?r.width/2:s.align==='right'?r.width:0):0);
      if(op.tracking){
        const chars=Array.from(op.text),advances=chars.map(char=>ctx.measureText(char).width);
        const width=advances.reduce((a,b)=>a+b,0)+(chars.length-1)*op.tracking;
        let x=anchor-(s.align==='right'?width:s.align==='center'?width/2:0);
        ctx.textAlign='left';
        chars.forEach((char,i)=>{ctx.fillText(char,x,op.point.y);x+=advances[i]+op.tracking;});
      }else ctx.fillText(op.text,anchor,op.point.y);
      ctx.restore();
    } else if(op.type==='symbol'){
      const image=resolveSymbol(op.symbol,s.fill.css());
      if(image)ctx.drawImage({image},r.x,r.y,r.width,r.height);
    } else if(op.type==='raster')ctx.drawImage({image:op.image},r.x,r.y,r.width,r.height);
    else if(op.type==='diagonal'){
      const nativeContext=new Proxy(ctx,{set(target,prop,value){
        if(prop==='font'&&typeof value==='string'){
          const size=Number(value.match(/([\d.]+)px/)?.[1]??30);
          target.font={name:'HelveticaNeue-CondensedBlack',size};
        }else target[prop]=value;
        return true;
      },get(target,prop){const value=target[prop];return typeof value==='function'?value.bind(target):value;}});
      drawDiagonal(nativeContext,op.entries,op.options);
    }
    else if(op.type==='capsules'){
      for(const entry of op.entries){
        ctx.save();ctx.translate(entry.x,op.centerY);ctx.rotate(Math.PI/2);
        ctx.font={name:'SFProText-Heavy',size:op.fontSize};
        const metrics=ctx.measureText(entry.label),length=Math.max(op.height,Math.ceil(metrics.width+12)),half=op.width/2;
        ctx.beginPath();ctx.moveTo(-length/2+half,-half);ctx.lineTo(length/2-half,-half);
        ctx.arc(length/2-half,0,half,-Math.PI/2,Math.PI/2,false);ctx.lineTo(-length/2+half,half);
        ctx.arc(-length/2+half,0,half,Math.PI/2,Math.PI*1.5,false);ctx.closePath();
        ctx.fillStyle='#'+entry.color.replace('#','');ctx.fill();
        const align=ctx.measureText('0h e 00m');ctx.fillStyle='#000000';ctx.textAlign='center';ctx.textBaseline='alphabetic';
        ctx.fillText(entry.label,0,(align.actualBoundingBoxAscent-align.actualBoundingBoxDescent)/2);ctx.restore();
      }
    }
    else throw new Error('Unsupported drawing operation: '+op.type);
  }
  ctx.restore();
}

export function intersect(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);
  return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
}
function bounds(op){
  if(op.rect)return op.rect;
  if(op.path?.length){
    const coordinates=op.path.flatMap(([, ...values])=>values),xs=[],ys=[];
    for(let i=0;i<coordinates.length;i+=2){xs.push(coordinates[i]);ys.push(coordinates[i+1]);}
    if(!xs.length)return null;
    const margin=(op.state?.width??1)+2,x=Math.min(...xs)-margin,y=Math.min(...ys)-margin;
    return {x,y,width:Math.max(...xs)+margin-x,height:Math.max(...ys)+margin-y};
  }
  if(op.type==='text'){
    const size=op.state.font.size,width=Math.max(size,op.text.length*size*1.5);
    return {x:op.point.x-(op.state.align==='center'?width/2:0)-size,y:op.point.y-size,width:width+size*2,height:size*4};
  }
  return null;
}
export function childViewport(image,rect,viewport){
  const visible=intersect(rect,viewport);if(!visible)return null;
  const sx=image.size.width/rect.width,sy=image.size.height/rect.height;
  return {x:(visible.x-rect.x)*sx,y:(visible.y-rect.y)*sy,width:visible.width*sx,height:visible.height*sy};
}
const segmentCache=new WeakMap();
export function segments(image,viewport={x:0,y:0,width:image.size.width,height:image.size.height}){
  const key=[viewport.x,viewport.y,viewport.width,viewport.height].join(',');
  let cached=segmentCache.get(image);if(cached?.has(key))return cached.get(key);
  const result=[];let run=[];
  function flush(){if(run.length){result.push({type:'canvas',ops:run});run=[];}}
  for(const op of image.ops){
    const box=bounds(op);
    if(box&&!intersect(box,viewport))continue;
    if(op.type==='image'){
      if(op.image.symbol)run.push({type:'symbol',symbol:op.image.symbol,rect:op.rect,state:{fill:new Color('FFFFFF')}});
      else if(op.image.native)run.push({type:'raster',image:op.image.native,rect:op.rect});
      else {flush();result.push(op);}
    }else {
      // Merge adjacent equal-color scanline fills without altering their union.
      const previous=run.at(-1),a=previous?.rect,b=op.rect;
      if(previous?.type==='fillRect'&&op.type==='fillRect'&&previous.state.fill.css()===op.state.fill.css()
        &&a.y===b.y&&a.height===b.height&&Math.abs(a.x+a.width-b.x)<1e-8){
        run[run.length-1]={...previous,rect:{...a,width:a.width+b.width}};
      }else if(previous?.type==='fillRect'&&op.type==='fillRect'&&previous.state.fill.css()===op.state.fill.css()
        &&a.x===b.x&&a.width===b.width&&Math.abs(a.y+a.height-b.y)<1e-8){
        run[run.length-1]={...previous,rect:{...a,height:a.height+b.height}};
      }else run.push(op);
    }
  }
  flush();if(!cached){cached=new Map();segmentCache.set(image,cached)}
  if(cached.size>=4)cached.clear();cached.set(key,result);return result;
}

function unionHeaderBounds(boxes){return {left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))};}
const headerMeasureCache=new WeakMap();
export function headerTextBounds(ctx,op,text=op.text,cache){
  const font=op.state.font;ctx.font={name:font.name,size:font.size};ctx.textAlign='left';ctx.textBaseline='top';
  const key=font.name+':'+font.size+':'+text;
  let m=cache?.get(key);if(!m){m=ctx.measureText(text);cache?.set(key,m)}
  const width=Number.isFinite(m.width)?m.width:text.length*font.size*0.62;
  const left=Number.isFinite(m.actualBoundingBoxLeft)?-m.actualBoundingBoxLeft:0;
  const right=Number.isFinite(m.actualBoundingBoxRight)?m.actualBoundingBoxRight:width;
  // Scripting measures UIKit baseline metrics but draws through SwiftUI
  // anchors. Do not turn those vertical metrics into top-anchor offsets.
  // The stable 0.3.18 renderer positioned top-aligned text by its line box.
  const top=0,bottom=font.size;
  const r=op.rect,anchor=op.point.x+(r?(op.state.align==='right'?r.width:op.state.align==='center'?r.width/2:0):0);
  const x=anchor-(op.state.align==='right'?width:op.state.align==='center'?width/2:0);
  return {left:x+left,right:x+right,top:op.point.y+top,bottom:op.point.y+bottom};
}
function headerWeatherBounds(ctx,op,cache){
  const texts=op.weather.ops.filter(o=>o.type==='text').map(o=>headerTextBounds(ctx,o,o.text,cache));
  const vector=op.shared.icons[op.weekday]??{left:0,right:0,top:0,bottom:0};
  return unionHeaderBounds([...texts,vector]);
}
// All seven cards share native row metrics; only their horizontal internal
// alignment differs. The measured block is centered in each visible card.
export function headerPlan(ctx,op){
  if(op.twoRows)return twoRowHeaderPlan(ctx,op);
  ctx.save();
  const s=op.shared;let cache=headerMeasureCache.get(s);if(!cache){cache=new Map();headerMeasureCache.set(s,cache)}
  const title=headerTextBounds(ctx,op.title,op.title.text,cache),count=headerTextBounds(ctx,op.count,op.count.text,cache),weather=headerWeatherBounds(ctx,op,cache);
  const titleRows=s.headlines.map(t=>headerTextBounds(ctx,op.title,t,cache));
  const countRows=s.counts.map(t=>headerTextBounds(ctx,op.count,t,cache));
  const temperature=op.weather.ops.find(o=>o.type==='text');
  const weatherRows=[...s.temperatures.map(t=>headerTextBounds(ctx,temperature,t,cache)),...s.icons];
  const a=unionHeaderBounds(titleRows),b=unionHeaderBounds(weatherRows),c=unionHeaderBounds(countRows);
  const h1=a.bottom-a.top,h2=b.bottom-b.top,h3=c.bottom-c.top;
  const height=h1+s.gap+h2+s.rowGap+h3,top=op.frame.y+(op.frame.height-height)/2,center=op.frame.x+op.frame.width/2;
  const y1=top-a.top,y2=top+h1+s.gap-b.top,y3=top+h1+s.gap+h2+s.rowGap-c.top;
  const relativeTitleX=op.weekday===0?weather.right-title.right:op.weekday===6?weather.left-title.left:(weather.left+weather.right-title.left-title.right)/2;
  const combinedLeft=Math.min(weather.left,title.left+relativeTitleX),combinedRight=Math.max(weather.right,title.right+relativeTitleX);
  const weatherX=center-(combinedLeft+combinedRight)/2,titleX=relativeTitleX+weatherX;
  const countX=center-(count.left+count.right)/2;
  const shift=(box,x,y)=>({left:box.left+x,right:box.right+x,top:box.top+y,bottom:box.bottom+y});
  const plan={title:{x:titleX,y:y1,bounds:shift(title,titleX,y1)},weather:{x:weatherX,y:y2,bounds:shift(weather,weatherX,y2)},count:{x:countX,y:y3,bounds:shift(count,countX,y3)},block:{left:0,right:0,top,bottom:top+height},rowTops:[top,top+h1+s.gap,top+h1+s.gap+h2+s.rowGap]};
  const block=unionHeaderBounds([plan.title.bounds,plan.weather.bounds,plan.count.bounds]);plan.block.left=block.left;plan.block.right=block.right;
  ctx.restore();return plan;
}
// Canvas text draws through SwiftUI anchors, while its measured bounds come
// from UIKit. Measure both conventions without applying offsets to text itself.
export function headerInkBounds(ctx,op,cache){
  const box=headerTextBounds(ctx,op,op.text,cache),font=op.state.font;
  const key=font.name+':'+font.size+':'+op.text;
  const m=cache?.get(key)??ctx.measureText(op.text);
  const alphabeticKey=key+':alphabetic';let baseline=cache?.get(alphabeticKey);
  if(!baseline){ctx.textBaseline='alphabetic';baseline=ctx.measureText(op.text);cache?.set(alphabeticKey,baseline)}
  ctx.textBaseline='top';
  const ascent=Number(m.actualBoundingBoxAscent),descent=Number(m.actualBoundingBoxDescent);
  if(!Number.isFinite(ascent)||!Number.isFinite(descent)||ascent+descent<=0||ascent+descent>font.size*2)return {...box,metricMode:'line-box-fallback'};
  const anchorRelative=Math.abs(ascent-Number(baseline.actualBoundingBoxAscent))>1e-7||Math.abs(descent-Number(baseline.actualBoundingBoxDescent))>1e-7;
  // A UIKit rectangle whose origin is already zero needs no baseline shift.
  const baselineOffset=anchorRelative||ascent===0?0:Number(m.fontBoundingBoxAscent);
  if(!Number.isFinite(baselineOffset))return {...box,metricMode:'line-box-fallback'};
  return {...box,top:op.point.y+baselineOffset-ascent,bottom:op.point.y+baselineOffset+descent,metricMode:anchorRelative?'anchor-relative':ascent===0?'uikit-top-box':'uikit-baseline'};
}

function twoRowHeaderPlan(ctx,op){
  ctx.save();
  const s=op.shared;let cache=headerMeasureCache.get(s);if(!cache){cache=new Map();headerMeasureCache.set(s,cache)}
  const word=headerTextBounds(ctx,op.word,op.word.text,cache),number=headerTextBounds(ctx,op.number,op.number.text,cache),weather=headerWeatherBounds(ctx,op,cache),numberInk=headerInkBounds(ctx,op.number,cache);
  const size=op.title.state.font.size;
  const metric=(name,text)=>{const spec={...op.word,state:{...op.word.state,font:{name,size}}};headerTextBounds(ctx,spec,text,cache);return cache.get(name+':'+size+':'+text)};
  const spaceAdvance=Math.max(1,metric('SFMono-Regular','0 0').width-metric('SFMono-Regular','00').width,metric('SFMono-Heavy','0 0').width-metric('SFMono-Heavy','00').width);
  headerTextBounds(ctx,op.word,op.word.text,cache);const wordAdvance=cache.get(op.word.state.font.name+':'+size+':'+op.word.text).width;
  const numberX=wordAdvance+spaceAdvance,wordX=0;
  const diskDiameter=Math.max(number.right-number.left+2,size*(op.number.text.length<2?1.05:(s.diskScale??1.375))+(s.diskPadding??1.5));
  const rowHeight=size*(s.diskScale??1.375)+(s.diskPadding??1.5),textY=(rowHeight-size)/2;
  const title={left:Math.min(word.left,number.left+numberX),right:Math.max(word.right,number.right+numberX),top:textY,bottom:textY+size};
  const temperature=op.weather.ops.find(o=>o.type==='text');
  const row2=unionHeaderBounds([...s.temperatures.map(t=>headerTextBounds(ctx,temperature,t,cache)),...s.icons]);
  const height=rowHeight+s.gap+row2.bottom-row2.top,top=op.frame.y+(op.frame.height-height)/2,center=op.frame.x+op.frame.width/2;
  // New weekend rule: Sunday LEFT, Saturday RIGHT. The circle is decoration
  // and never changes text advance, spacing, or alignment anchors.
  const edgeInset=s.weekendInset??35;
  const place=box=>op.weekday===0?op.frame.x+edgeInset-box.left:op.weekday===6?op.frame.x+op.frame.width-edgeInset-box.right:center-(box.left+box.right)/2;
  const tx=place(title),wx=place(weather),wy=top+rowHeight+s.gap-row2.top;
  const shift=(box,x,y)=>({...box,left:box.left+x,right:box.right+x,top:box.top+y,bottom:box.bottom+y});
  const positionedNumber=shift(number,tx+numberX,top+textY-number.top),positionedInk=shift(numberInk,tx+numberX,top+textY-number.top);
  const circle=op.isToday?{x:(positionedInk.left+positionedInk.right-diskDiameter)/2,y:(positionedInk.top+positionedInk.bottom-diskDiameter)/2,width:diskDiameter,height:diskDiameter}:null;
  const visualTitle=unionHeaderBounds([shift(title,tx,top),...(circle?[{left:circle.x,right:circle.x+circle.width,top:circle.y,bottom:circle.y+circle.height}]:[])]);
  const result={title:{x:tx,y:top,bounds:shift(title,tx,top),visualBounds:visualTitle},word:{x:tx+wordX,y:top+textY-word.top,bounds:shift(word,tx+wordX,top+textY-word.top)},number:{x:tx+numberX,y:top+textY-number.top,bounds:positionedNumber,ink:positionedInk},weather:{x:wx,y:wy,bounds:shift(weather,wx,wy)},circle,circleFilled:!!circle,spacing:{spaceAdvance,wordAdvance,numberAdvance:numberX},alignment:op.weekday===0?'left':op.weekday===6?'right':'center',block:{left:Math.min(tx+title.left,wx+weather.left),right:Math.max(tx+title.right,wx+weather.right),top,bottom:top+height},rowTops:[top,top+rowHeight+s.gap]};
  ctx.restore();return result;
}

function offsetHeaderOp(op,x,y){
  return {...op,
    ...(op.point?{point:{x:op.point.x+x,y:op.point.y+y}}:{}),
    ...(op.rect?{rect:{...op.rect,x:op.rect.x+x,y:op.rect.y+y}}:{}),
    ...(op.path?{path:op.path.map(([method,...args])=>[method,...args.map((v,i)=>v+(i%2?y:x))])}:{})};
}
function replayHeader(ctx,op,resolveSymbol){
  const plan=headerPlan(ctx,op);
  if(op.twoRows){
    const ops=[offsetHeaderOp(op.word,plan.word.x,plan.word.y),offsetHeaderOp(op.number,plan.number.x,plan.number.y),...op.weather.ops.map(o=>offsetHeaderOp(o,plan.weather.x,plan.weather.y))];
    if(plan.circle)ops.unshift({type:'fillEllipse',rect:plan.circle,state:{...op.title.state,fill:new Color('FFFFFF')}});
    for(const part of segments({size:{width:1092,height:510},ops})){
      if(part.type==='canvas')replay(ctx,part.ops,1092,510,1092,510,resolveSymbol);
      else if(part.image?.native)ctx.drawImage({image:part.image.native},part.rect.x,part.rect.y,part.rect.width,part.rect.height);
    }
    return;
  }
  const parts=[['title',{size:{width:1092,height:510},ops:[op.title]}],['weather',op.weather],['count',{size:{width:1092,height:510},ops:[op.count]}]];
  for(const [name,image]of parts){
    // Use absolute points and clip rectangles, as in the working renderer.
    // Avoid nesting text anchors inside a translated header context.
    const shifted={...image,ops:image.ops.map(o=>offsetHeaderOp(o,plan[name].x,plan[name].y))};
    for(const part of segments(shifted)){
      if(part.type==='canvas')replay(ctx,part.ops,1092,510,1092,510,resolveSymbol);
      else if(part.image?.native)ctx.drawImage({image:part.image.native},part.rect.x,part.rect.y,part.rect.width,part.rect.height);
    }
  }
}
