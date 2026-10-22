// @ts-nocheck
// Scriptable drawing contract, recorded without changing the source geometry.
import { drawDiagonal } from './diagonal-canvas.js';
export class Size { constructor(width,height) {Object.assign(this,{width,height});} }
export class Point { constructor(x,y) {Object.assign(this,{x,y});} }
export class Rect { constructor(x,y,width,height) {Object.assign(this,{x,y,width,height});} }
export class Color {
  constructor(hex,alpha=1) {this.hex=hex.replace(/^#/, '');this.alpha=alpha;}
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
  setTextAlignedCenter(){this.state.align='center';}
  addPath(p){this.path=p.commands.slice();}
  op(type,data){this.ops.push({type,...data,state:{...this.state}});}
  fillRect(rect){this.op('fillRect',{rect});}
  strokeRect(rect){this.op('strokeRect',{rect});}
  fillEllipse(rect){this.op('fillEllipse',{rect});}
  strokeEllipse(rect){this.op('strokeEllipse',{rect});}
  fillPath(){this.op('fillPath',{path:this.path});this.path=[];}
  strokePath(){this.op('strokePath',{path:this.path});this.path=[];}
  drawText(text,point){this.op('text',{text:String(text),point});}
  drawTextInRect(text,rect){this.op('text',{text:String(text),point:new Point(rect.x,rect.y),rect});}
  drawImageAtPoint(image,p){this.drawImageInRect(image,new Rect(p.x,p.y,image.size.width,image.size.height));}
  drawImageInRect(image,rect){this.ops.push({type:'image',image,rect});}
  getImage(){return {size:{...this.size},ops:this.ops.slice()};}
}

export function replay(ctx,ops,width,height,targetWidth,targetHeight,resolveSymbol){
  ctx.save();ctx.scale(targetWidth/width,targetHeight/height);
  for(const op of ops){
    const s=op.state,r=op.rect;
    if(s){ctx.fillStyle=s.fill.css();ctx.strokeStyle=s.stroke.css();ctx.lineWidth=s.width;}
    if(op.type==='fillRect'||op.type==='strokeRect')ctx[op.type](r.x,r.y,r.width,r.height);
    else if(op.type==='fillEllipse'||op.type==='strokeEllipse'){
      ctx.beginPath();ctx.ellipse(r.x+r.width/2,r.y+r.height/2,r.width/2,r.height/2,0,0,Math.PI*2,false);
      ctx[op.type==='fillEllipse'?'fill':'stroke']();
    } else if(op.type==='fillPath'||op.type==='strokePath'){
      ctx.beginPath();for(const [method,...args] of op.path)ctx[method](...args);
      ctx[op.type==='fillPath'?'fill':'stroke']();
    } else if(op.type==='text'){
      ctx.save();if(r){ctx.beginPath();ctx.rect(r.x,r.y,r.width,r.height);ctx.clip();}
      ctx.font={name:s.font.name,size:s.font.size};ctx.fillStyle=s.text.css();ctx.textBaseline='top';ctx.textAlign=s.align;
      ctx.fillText(op.text,op.point.x+(r&&s.align==='center'?r.width/2:0),op.point.y);ctx.restore();
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
export function segments(image,viewport={x:0,y:0,width:image.size.width,height:image.size.height}){
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
  flush();return result;
}
