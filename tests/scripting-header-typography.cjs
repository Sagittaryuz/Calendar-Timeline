// Exercise the production engine and replay, with measured local glyph bounds.
// DejaVu Mono is a diagnostic substitute; this does not certify native SFMono.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const c=require('@napi-rs/canvas'),dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const base='6460bb70a8085c51cf408c790f03385c7030ed4b',relative='scripting/scripts/Calendar Timeline Scripting/';
const source=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8'),oldSource=cp.execFileSync('git',['show',base+':'+relative+'original-engine.js'],{encoding:'utf8'});
const compile=s=>new (Object.getPrototypeOf(async function(){}).constructor)('host','options',s.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
const current=compile(source),previous=compile(oldSource),skip=s=>compile(s.replace('function drawTitleDayCard(ctx,date,card,isSelected,isLast) {','function drawTitleDayCard(ctx,date,card,isSelected,isLast) { return;'));
const currentBody=skip(source),previousBody=skip(oldSource);
function flat(image){return image.ops.flatMap(o=>o.image?.ops?[o,...flat(o.image)]:[o])}
function ctxFor(canvas){return new Proxy(canvas.getContext('2d'),{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`${v.size}px ${v.name.endsWith('Regular')?'HeaderRegular':'HeaderHeavy'}`:v;return true},get(o,k){const v=o[k];return typeof v==='function'?v.bind(o):v}})}
function metrics(op){
 const ctx=ctxFor(c.createCanvas(1,1)),s=op.state,r=op.rect;ctx.font={name:s.font.name,size:s.font.size};ctx.textAlign='left';ctx.textBaseline='top';
 const chars=op.tracking?Array.from(op.text):[op.text],advances=chars.map(t=>ctx.measureText(t).width),width=advances.reduce((a,b)=>a+b,0)+(chars.length-1)*(op.tracking??0);
 const anchor=r.x+(s.align==='right'?r.width:s.align==='center'?r.width/2:0),left=anchor-(s.align==='right'?width:s.align==='center'?width/2:0);
 let x=left,ink={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
 chars.forEach((t,i)=>{const m=ctx.measureText(t);if(t.trim()){ink.left=Math.min(ink.left,x-m.actualBoundingBoxLeft);ink.right=Math.max(ink.right,x+m.actualBoundingBoxRight);ink.top=Math.min(ink.top,r.y-m.actualBoundingBoxAscent);ink.bottom=Math.max(ink.bottom,r.y+m.actualBoundingBoxDescent)}x+=advances[i]+(op.tracking??0)});
 return {advance:{left,right:left+width,top:r.y,bottom:r.y+s.font.size},ink};
}
function coverage(d,op,outerClip){
 const can=c.createCanvas(1092,110),ctx=ctxFor(can),unclipped={...op,rect:undefined};
 // Preserve the production anchor while removing only the local text clip.
 unclipped.point={x:op.rect.x+(op.state.align==='right'?op.rect.width:op.state.align==='center'?op.rect.width/2:0),y:op.rect.y};
 d.replay(ctx,[unclipped],1092,110,1092,110,()=>null);
 const a=can.getContext('2d').getImageData(0,0,1092,110).data;
 const real=can.getContext('2d');real.globalCompositeOperation='destination-in';real.fillStyle='white';real.beginPath();real.rect(op.rect.x,op.rect.y,op.rect.width,op.rect.height);real.fill();real.beginPath();for(const [method,...args]of outerClip)real[method](...args);real.fill();
 const b=real.getImageData(0,0,1092,110).data;let full=0,lost=0;for(let i=3;i<a.length;i+=4){full+=a[i];lost+=Math.max(0,a[i]-b[i])}return {full,lost,percent:full?100*lost/full:0};
}
(async()=>{
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','HeaderHeavy');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','HeaderRegular');
 const d=await import(pathToFileURL(path.join(dir,'drawing.js'))),host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 const scenes=[],sizes=[[338,158,false],[364,170,false],[402,186,false],[715,342,true],[744,348,true],[1064,510,true],[980,400,true]];
 let measured=0,scaled=0,worstLoss=0,worstInkEdge=0;
 for(const date of ['2026-10-18','2026-10-21','2026-10-24','2026-11-01','2026-12-31'])for(const holiday of [false,true])for(const [maximum,minimum]of [[30,20],[9,-2],[-12,-19],[null,null]]){
  const now=new Date(date+'T12:00:00'),h=new Set(holiday?[date]:[]);const start=new Date(+now);start.setDate(start.getDate()-start.getDay());
  const daily=Object.fromEntries(Array.from({length:7},(_,i)=>{const day=new Date(+start);day.setDate(day.getDate()+i);return [day.toISOString().slice(0,10),{maximum,minimum,symbol:'d0'}]}));
  const options={now:+now,focusDate:+now,loadResult:{items:[],holidayDates:h,error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily},holidayDates:h};
  const old=await previous(host,options),model=await current(host,options),ops=flat(model.image),texts=ops.filter(o=>o.type==='text'&&o.point.y<100),titles=texts.filter(o=>/^(DOM|SEG|TER|QUA|QUI|SEX|SAB) \d\d$/.test(o.text));assert.equal(titles.length,7);
  for(const key of ['header','hourLegend','thermalBand','timelineBackground','nowMarker','contour','panel'])assert.deepEqual(model[key],old[key],key+' preserved');
  const before=await previousBody(host,options),after=await currentBody(host,options);assert.equal(JSON.stringify(after.image),JSON.stringify(before.image),'All drawing outside the header remains identical');
  const bounds=[];
  for(const card of model.header){
   const title=titles.find(o=>o.text.endsWith(card.date.slice(-2))),weekday=new Date(card.date+'T12:00:00').getDay(),weekend=weekday===0||weekday===6;
   assert.equal(title.state.font.name,'SFMono-Heavy');assert.equal(title.state.font.size,38);assert.equal(title.state.align,weekday===0?'right':weekday===6?'left':'center');assert.equal(Boolean(title.tracking),weekend);
   const temperatures=texts.filter(o=>o.text.endsWith('º')&&o.rect.x>=card.x-1e-8&&o.rect.x<card.x+card.width).sort((a,b)=>a.rect.x-b.rect.x);assert.equal(temperatures.length,2);
   const count=texts.find(o=>/^E:/.test(o.text)&&o.rect.x>=card.x&&o.rect.x<card.x+card.width);assert(count);
   const t=metrics(title),hot=metrics(temperatures[0]),cold=metrics(temperatures[1]),n=metrics(count);
   assert(t.ink.bottom<hot.ink.top,'Title and temperature glyphs do not overlap: '+card.date);assert(hot.ink.bottom<n.ink.top,'Temperature and count glyphs do not overlap: '+card.date);assert(n.ink.bottom<card.y+card.height-1,'Count glyphs stay inside lower frame');
   if(weekday===0){assert(Math.abs(t.advance.right-cold.advance.right)<1e-8,'DOM right bounds match line 2');worstInkEdge=Math.max(worstInkEdge,Math.abs(t.ink.right-cold.ink.right));}
   if(weekday===6){assert(Math.abs(t.advance.left-hot.advance.left)<1e-8,'SAB left bounds match line 2');worstInkEdge=Math.max(worstInkEdge,Math.abs(t.ink.left-hot.ink.left));}
   if(!weekend){assert(Math.abs((t.advance.left+t.advance.right)/2-(card.x+card.width/2))<1e-8,'Ordinary approved centering preserved');const oldTitle=flat(old.image).find(o=>o.type==='text'&&o.text===title.text);assert.deepEqual(title.state.text,oldTitle.state.text,'Colors unchanged');}
   // Native measurement during replay, not the estimated card center, sets
   // tracked title width. No horizontal glyph scaling or font reduction.
   const cov=coverage(d,title,model.image.outerClip);worstLoss=Math.max(worstLoss,cov.percent);assert(cov.percent<0.1,'No material title clip: '+JSON.stringify({date:card.date,cov}));
   for(const [width,height,extraLarge]of sizes){const scale=extraLarge?Math.min(width/model.width,height/model.height):width/model.width;const vertical=extraLarge?scale:height/model.height;for(const box of [t.advance,t.ink,hot.advance,cold.advance,n.ink])assert([box.left*scale,box.right*scale,box.top*vertical,box.bottom*vertical].every(Number.isFinite));if(weekday===0)assert(Math.abs((t.advance.right-cold.advance.right)*scale)<1e-8);if(weekday===6)assert(Math.abs((t.advance.left-hot.advance.left)*scale)<1e-8);scaled++;}
   bounds.push({date:card.date,font:title.state.font,tracking:title.tracking??0,title:t,maximum:hot,minimum:cold,count:n,clippedPercent:cov.percent});measured++;
  }
  scenes.push({date,holiday,maximum,minimum,bounds});
 }
 assert(worstInkEdge<2,'Ink-edge difference stays within individual glyph side bearings');
 const report={base,version:JSON.parse(fs.readFileSync(path.join(dir,'script.json'))).version,scenes:scenes.length,measuredHeaders:measured,scaledHeaders:scaled,sizes,headline:{name:'SFMono-Heavy',size:38},weekendOnly:'tracking and inner row placement; no glyph compression',worstClippedTitlePercent:worstLoss,maxInkEdgeSideBearingDifference:worstInkEdge,drawingOutsideHeaders:'byte-identical recorded operations',clicks:'production timeline-view.tsx and app_intents.tsx unchanged',nativeIOS:'not tested; local DejaVu Mono substitute',details:scenes};
 if(process.env.HEADER_REPORT)fs.writeFileSync(process.env.HEADER_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,details:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
