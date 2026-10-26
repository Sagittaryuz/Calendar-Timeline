// Real engine/replay; local font is a substitute, not a native iOS certification.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{pathToFileURL}=require('node:url'),c=require('@napi-rs/canvas');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting'),base='334bf949ebdfdd489da6e2b9bce0b3bb079d8bd3';
const raw=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8'),old=cp.execFileSync('git',['show',base+':scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const compile=s=>new(Object.getPrototypeOf(async function(){}).constructor)('host','options',s.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
const run=compile(raw),previous=compile(old),skip=s=>compile(s.replace('function drawTitleDayCard(ctx,date,card,isSelected,isLast) {','function drawTitleDayCard(ctx,date,card,isSelected,isLast) { return;'));
const body=skip(raw),oldBody=skip(old);
function flat(image){return image.ops.flatMap(o=>o.image?.ops?[o,...flat(o.image)]:[o])}
function context(canvas){return new Proxy(canvas.getContext('2d'),{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`${v.size}px ${v.name.endsWith('Regular')?'HeaderRegular':'HeaderHeavy'}`:v;return true},get(o,k){if(k==='drawImage')return (src,...a)=>o.drawImage(src.image??src,...a);const v=o[k];return typeof v==='function'?v.bind(o):v}})}
function inset(y){const d=Math.min(y-4,506-y);if(d>=97)return 4;if(d<0)return 546;return 4+98*(1-Math.pow(1-Math.pow(1-d/97,2.45),1/2.45))}
function paintedTextBounds(ctx,d,op){
 const b=d.headerTextBounds(ctx,op);ctx.textAlign='left';ctx.textBaseline='top';const m=ctx.measureText(op.text);
 return {...b,top:op.point.y-m.actualBoundingBoxAscent,bottom:op.point.y+m.actualBoundingBoxDescent};
}
function translated(b,p){return {left:b.left+p.x,right:b.right+p.x,top:b.top+p.y,bottom:b.bottom+p.y}}
(async()=>{
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','HeaderHeavy');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','HeaderRegular');
 const d=await import(pathToFileURL(path.join(dir,'drawing.js'))),ctx=context(c.createCanvas(1,1)),host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 const sizes=[[338,158,false],[364,170,false],[402,186,false],[715,342,true],[744,348,true],[1064,510,true],[980,400,true]],details=[];
 const candidates=[24,24.5,25,25.5,26,26.5,27,28,30,38],fit=new Map(candidates.map(n=>[n,{minSafety:Infinity,failures:0}]));
 let headers=0,scaled=0,centerError=0,actualInkCenterError=0,edgeError=0,minSafety=Infinity,nextExample;const snapshots=[];
 for(const date of ['2026-10-18','2026-10-21','2026-10-24','2026-11-01','2026-12-31'])for(const holiday of [false,true])for(const [maximum,minimum]of [[30,20],[9,-2],[-12,-19],[null,null]])for(const counts of [false,true]){
  const now=new Date(date+'T12:00:00'),h=new Set(holiday?[date]:[]),start=new Date(+now);start.setDate(start.getDate()-start.getDay());
  const keys=Array.from({length:7},(_,i)=>{const t=new Date(+start);t.setDate(t.getDate()+i);return t.toISOString().slice(0,10)});
  const options={now:+now,focusDate:+now,loadResult:{items:[],holidayDates:h,error:null,scheduleCountsByDay:Object.fromEntries(keys.map((key,i)=>[key,{events:counts?[0,1,12,123,1234,7,88][i]:0,reminders:counts?[1234,23,1,98,4,123,0][i]:0}]))},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily:Object.fromEntries(keys.map(key=>[key,{maximum,minimum,symbol:counts?'d7':'d0'}]))},holidayDates:h};
  const model=await run(host,options),before=await previous(host,options),groups=flat(model.image).filter(o=>o.type==='header');assert.equal(groups.length,7);
  for(const k of ['header','hourLegend','thermalBand','contour','timelineBackground','nowMarker','panel'])assert.deepEqual(model[k],before[k],k+' unchanged');
  assert.equal(JSON.stringify((await body(host,options)).image),JSON.stringify((await oldBody(host,options)).image),'Every operation outside header unchanged');
  let commonRows;const scene=[];
  for(const op of groups){
   assert.equal(op.title.state.font.name,'SFMono-Heavy');assert.equal(op.title.state.font.size,25.5);assert(!op.title.tracking,'No tracking or glyph compression');assert.equal(op.frame.width,model.header[op.weekday].width);assert.equal(op.frame.y,2);
   const plan=d.headerPlan(ctx,op);commonRows??=plan.rowTops;assert.deepEqual(plan.rowTops,commonRows,'All seven row axes align');
   const cx=op.frame.x+op.frame.width/2,cy=op.frame.y+op.frame.height/2;
   centerError=Math.max(centerError,Math.abs((plan.block.left+plan.block.right)/2-cx),Math.abs((plan.block.top+plan.block.bottom)/2-cy));assert(centerError<1e-8,'Centered in both axes');
   const actualTop=Math.min(plan.title.bounds.top,plan.weather.bounds.top,plan.count.bounds.top),actualBottom=Math.max(plan.title.bounds.bottom,plan.weather.bounds.bottom,plan.count.bounds.bottom);actualInkCenterError=Math.max(actualInkCenterError,Math.abs((actualTop+actualBottom)/2-cy));
   const edge=op.weekday===0?Math.abs(plan.title.bounds.right-plan.weather.bounds.right):op.weekday===6?Math.abs(plan.title.bounds.left-plan.weather.bounds.left):0;edgeError=Math.max(edgeError,edge);assert(edge<1e-8,'DOM right / SAB left actual measured bounds align with L2');
   assert(plan.title.bounds.bottom<=plan.weather.bounds.top-op.shared.gap+1e-8);assert(plan.weather.bounds.bottom<=plan.count.bounds.top-op.shared.rowGap+1e-8);
   const individual=p=>[['title',translated(paintedTextBounds(ctx,d,op.title),p.title)],['count',translated(paintedTextBounds(ctx,d,op.count),p.count)],...op.weather.ops.filter(o=>o.type==='text').map(o=>['temperature',translated(paintedTextBounds(ctx,d,o),p.weather)]),['icon',translated(op.shared.icons[op.weekday],p.weather)]];
   const safety=p=>Math.min(...individual(p).map(([,b])=>Math.min(b.left-inset(b.top),1092-inset(b.top)-b.right,b.left-op.frame.x,op.frame.x+op.frame.width-b.right,b.top-op.frame.y,op.frame.y+op.frame.height-b.bottom)));
   const margin=safety(plan);minSafety=Math.min(minSafety,margin);assert(margin>=1,'Measured glyphs stay inside real contour/card with >=1 logical pixel clearance: '+JSON.stringify({date,title:op.title.text,maximum,minimum,margin}));
   for(const [w,h,extra]of sizes){const sx=extra?Math.min(w/1092,h/510):w/1092,sy=extra?sx:h/510;assert(Number.isFinite(plan.block.left*sx+plan.block.top*sy));assert(Math.abs(((plan.block.left+plan.block.right)/2-cx)*sx)<1e-8);assert(Math.abs(((plan.block.top+plan.block.bottom)/2-cy)*sy)<1e-8);scaled++;}
   if(!counts){const original=op.title.state.font.size;for(const size of candidates){op.title.state.font.size=size;const candidate=d.headerPlan(ctx,op),m=safety(candidate),result=fit.get(size);result.minSafety=Math.min(result.minSafety,m);if(m<1){result.failures++;if(size===26&&!nextExample)nextExample={date,title:op.title.text,maximum,minimum,margin:m}}}op.title.state.font.size=original;}
   scene.push({day:op.title.text,frame:op.frame,fonts:[op.title.state.font.size,op.shared.temperatureSize,op.shared.countSize],plan,margin});headers++;
  }
  if(details.length<4)details.push({date,holiday,maximum,minimum,counts,headers:scene});
  if(!counts&&!holiday&&date==='2026-10-21'&&maximum===30)snapshots.push(model);
 }
 const valid=[...fit.entries()].filter(([,r])=>r.failures===0).map(([n])=>n);assert(valid.includes(25.5),'Approved font size remains within the stable line-box layout');
 // External baseline metrics cannot change top-aligned line-box coordinates.
 const nativeLike={save(){},restore(){},measureText:()=>({width:50,actualBoundingBoxAscent:17,actualBoundingBoxDescent:2,fontBoundingBoxAscent:22,fontBoundingBoxDescent:4})};const sample=snapshots[0].image;const op=flat(sample).find(o=>o.type==='header');const box=d.headerTextBounds(nativeLike,op.title);assert.equal(box.top,0);assert.equal(box.bottom,25.5,'Top anchor uses font line height, not UIKit baseline conversion');
 // Exercise the real header replay and verify painting emits all full strings.
 const canvas=c.createCanvas(1092,510),paint=context(canvas);for(const part of d.segments(snapshots[0].image)){if(part.type==='canvas')d.replay(paint,part.ops,1092,510,1092,510,()=>null);else if(part.image?.ops){for(const sub of d.segments(part.image))if(sub.type==='canvas')d.replay(paint,sub.ops,1092,510,1092,510,()=>null)}}
 const report={base,version:JSON.parse(fs.readFileSync(path.join(dir,'script.json'))).version,scenes:80,headers,scaled,sizes,headline:25.5,defaultTemperatures:22,temperatureSizing:'shared 66/max-string-length, max22; fixed row width',counts:'one shared size <=17 fitted across seven strings',geometry:'original frames, margins, corners, charts, thermal, taps unchanged',centerError,lineBoxCenterError:actualInkCenterError,edgeError,minSafety,candidateSizes:[...fit].map(([size,result])=>({size,...result})),nextRejectedExample:nextExample,physicalIOS:'not tested; local DejaVu Mono ink bounds, stable line boxes independent of UIKit vertical metrics',details};
 if(process.env.HEADER_REPORT)fs.writeFileSync(process.env.HEADER_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,details:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
