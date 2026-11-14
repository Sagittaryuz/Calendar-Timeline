// Pixel equivalence and bridge-call counts with synthetic data and desktop fonts.
// These are not native iPhone timing or font measurements.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {createCanvas,ImageData}=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('./scripting-rolling.cjs');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const baseline='d7310b6';
function adapter(ctx,count){return new Proxy(ctx,{set(target,key,value){if(['fillStyle','strokeStyle','lineWidth'].includes(key))count.styles++;target[key]=key==='font'&&typeof value==='object'?`${value.size}px sans-serif`:value;return true;},get(target,key){if(key==='drawImage')return(source,...args)=>target.drawImage(source.image??source,...args);const value=target[key];return typeof value==='function'?value.bind(target):value;}})}
function paint(image,d,count,view={x:0,y:0,width:image.size.width,height:image.size.height}){
 const canvas=createCanvas(image.size.width,image.size.height),ctx=canvas.getContext('2d'),bridge=adapter(ctx,count);
 if(image.outerClip){ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.clip();}
 const symbol=createCanvas(30,30);symbol.getContext('2d').fillRect(3,3,24,24);
 for(const part of d.segments(image,view)){
  if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>symbol);
  else{const child=d.childViewport(part.image,part.rect,view);if(!child)continue;const sub=paint(part.image,d,count,child);ctx.save();if(part.image.blurRadius)ctx.filter=`blur(${part.image.blurRadius}px)`;ctx.drawImage(sub,part.rect.x,part.rect.y,part.rect.width,part.rect.height);ctx.restore();}
 }
 return canvas;
}
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-render-baseline-'));
 try{
  let old=cp.execFileSync('git',['show',`${baseline}:scripting/scripts/Calendar Timeline Scripting/drawing.js`],{encoding:'utf8'});
  for(const name of ['diagonal-canvas.js','rect-raster.js'])old=old.replace(`'./${name}'`,JSON.stringify(pathToFileURL(path.join(dir,name)).href));
  fs.writeFileSync(path.join(temp,'drawing.mjs'),old);
  const previous=await import(pathToFileURL(path.join(temp,'drawing.mjs')).href),{d,host,options}=await fixture(),render=compile(raw);
  let before=0,after=0;const results=[];
  class BitmapDrawContext extends d.DrawContext {
   makeRaster=crop=>{const canvas=createCanvas(crop.width,crop.height);canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(crop.pixels),crop.width,crop.height),0,0);return {size:{width:crop.width,height:crop.height},native:canvas};};
  }
  for(const raster of [false,true]){
  for(const [label,now,dense]of [['midnight',new Date(2026,10,14,0),false],['rain-and-overflow',new Date(2026,10,14,13),true],['late-day',new Date(2026,10,14,23,59),true],['year-rollover',new Date(2026,11,31,18),true],['empty',new Date(2026,10,15,6),false]]){
   const start=new Date(now);start.setHours(0,0,0,0);
   const items=dense?Array.from({length:10},(_,i)=>({kind:i%2?'reminder':'event',identifier:String(i),title:`Synthetic ${i}`,start:new Date(+start+i*3600000),end:new Date(+start+(i+12)*3600000),color:i%2?'#30D158':'#0088FF',isAllDay:false})):[];
   if(dense)items.push({kind:'event',identifier:'birthday',title:'Synthetic Birthday',start,end:new Date(+start+86400000),isBirthday:true,isAllDay:true,color:'#FF9500'});
   const weather={hours:Array.from({length:49},(_,i)=>({timestamp:+now+i*3600000,temperature:18+8*Math.sin(i/4),rainChance:dense&&i%3===0?100:0,rainMM:dense&&i%3===0?10:0,rainRate:dense&&i%3===0?10:0,cloudiness:50,symbol:'d0'})),daily:{}};
   const model=await render(raster?{...host,DrawContext:BitmapDrawContext}:host,options(now,items,{hourlyWeather:weather})),a={styles:0},b={styles:0};
   const first=paint(model.image,previous,a),second=paint(model.image,d,b);
   assert(Buffer.from(first.getContext('2d').getImageData(0,0,1092,510).data).equals(Buffer.from(second.getContext('2d').getImageData(0,0,1092,510).data)),`${label}: identical synthetic pixels`);
   before+=a.styles;after+=b.styles;results.push({label,raster,before:a.styles,after:b.styles});
  }
  }
  assert(after<before*.6,'At least 40% fewer native style assignments in the fixture corpus');
  const modelSource=fs.readFileSync(path.join(dir,'model.ts'),'utf8');assert(!modelSource.includes('clearTimelineSelection'),'No retired storage migration per render');
  const selection=fs.readFileSync(path.join(dir,'selection.ts'),'utf8');assert(!/validateSelection|parseLocalDay|weekRange|Storage/.test(selection),'No retired selector or storage effects');
  console.log(JSON.stringify({passed:true,pixelEquivalentScenes:results.length,styleAssignments:{before,after,reductionPercent:Math.round((1-after/before)*100)},results,physicalIOS:'not measured'}));
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
