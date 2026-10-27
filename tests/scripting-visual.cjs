// Local Canvas approximation for geometry review, not an iOS screenshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const native=require(process.env.CANVAS_PATH||'@napi-rs/canvas');
async function main(){
 const dir=path.join(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
 const version=JSON.parse(fs.readFileSync(path.join(dir,'script.json'),'utf8')).version;
 const d=await import(pathToFileURL(path.join(dir,'drawing.js')).href);
 const {encodePNG}=await import(pathToFileURL(path.join(dir,'rect-raster.js')).href);
 const {renderOriginal}=await import(pathToFileURL(path.join(dir,'original-engine.js')).href);
 const host={...d,DateFormatter:class{string(date){return String(date.getDate())}},
  Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},
  SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 host.DrawContext=class extends d.DrawContext{
  makeRaster=crop=>{const image=new native.Image();image.src=Buffer.from(encodePNG(crop));return {native:image,size:{width:crop.width,height:crop.height}}};
  onInvalidColor=detail=>{throw Error(JSON.stringify(detail))};
 };
 function paint(image){
  const canvas=native.createCanvas(Math.ceil(image.size.width),Math.ceil(image.size.height)),ctx=canvas.getContext('2d');
  const bridge=new Proxy(ctx,{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`bold ${v.size}px Arial`:v;return true},
   get(o,k){if(k==='drawImage')return (source,...args)=>o.drawImage(source.image??source,...args);const v=o[k];return typeof v==='function'?v.bind(o):v}});
  for(const part of d.segments(image)){
   if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);
   else ctx.drawImage(paint(part.image),part.rect.x,part.rect.y,part.rect.width,part.rect.height);
  }
  if(image.outerClip){
   ctx.save();ctx.globalCompositeOperation='destination-in';ctx.beginPath();
   for(const [method,...args] of image.outerClip)ctx[method](...args);
   ctx.fillStyle='white';ctx.fill();ctx.restore();
  }
  if(!image.blurRadius)return canvas;
  const blurred=native.createCanvas(canvas.width,canvas.height),b=blurred.getContext('2d');
  b.filter=`blur(${image.blurRadius}px)`;b.drawImage(canvas,0,0);return blurred;
 }
 const now=new Date(2026,9,22,12,30),out=path.join(__dirname,'../../artifacts');
 const sheet=native.createCanvas(1092,570*7),sheetCtx=sheet.getContext('2d');let row=0;
 for(const [day,label] of [[22,'Hoje: fundo acompanha curvas e respeita os vizinhos'],[21,'Outro dia útil: cinza, sem blur'],[24,'Sábado: azul, mesma fonte'],[18,'Domingo: vermelho, mesma fonte'],[19,'Segunda: junção ao lado do domingo'],[20,'Terça: duas junções'],[23,'Sexta: junção ao lado do sábado']]){
  const focus=new Date(2026,9,day),at=h=>new Date(2026,9,day,h);
  const items=[{kind:'event',identifier:'a',title:'EVENTO ROSA',start:at(10),end:at(14),color:'#FF2D55',isAllDay:false},
   {kind:'reminder',identifier:'b',title:'LEMBRETE LARANJA',start:at(8),end:at(16),color:'#FF9500',priority:1,sourceIsAllDay:false,isAllDay:false}];
  const options={rolling:false,now:+now,focusDate:+focus,loadResult:{items,holidayDates:new Set(),error:null},
   astronomy:{latitude:-16.68,longitude:-49.25},hourlyWeather:{hours:[],daily:Object.fromEntries(
     Array.from({length:7},(_,i)=>[`2026-10-${18+i}`,{minimum:20,maximum:30,symbol:'d0'}]))},holidayDates:new Set()};
  const model=await renderOriginal(host,options),ops=[],blurs=[];
  function visit(image){if(image.blurRadius)blurs.push(image);for(const op of image.ops){ops.push(op);if(op.type==='image'&&!op.image.native&&!op.image.symbol)visit(op.image)}}visit(model.image);
  assert.equal(blurs.length,0,'No blur on any selected day');
  assert.equal(model.timelineBackground,day===22?'#000000':day===24?'#0D3F68':day===18?'#521720':'#3B3C3E');
  assert.equal(model.nowMarker,null);
  if(day===22){

   for(const hex of ['FF2D55','FF9500'])assert(ops.some(o=>o.type==='fillRect'&&o.state.fill.hex.toUpperCase()===hex&&o.rect.width>=3&&o.rect.width<=5),'Source-colored start line: '+hex);
   assert(!ops.some(o=>o.type==='fillRect'&&o.state.fill.hex==='30D158'&&o.rect.height>300),'Green time marker removed');
  }
  const contour=ops.find(o=>o.type==='strokePath'&&o.state.stroke.hex==='FFFFFF'&&o.state.stroke.alpha===0.96);
  assert(contour,'Continuous selected-day frame');
  for(const [,x,y] of contour.path.filter(c=>c.length===3)){assert(x>=4&&x<=1088&&y>=4&&y<=506,'Contour within final widget coordinates')}
  const selected=model.header.find(c=>c.selected),points=contour.path.filter(p=>p.length===3);
  if(day!==18){
   const bridgeY=points.find(p=>Math.abs(p[1]-4)<0.01&&p[2]>selected.height&&p[2]<200)[2];
   const left=selected.x+4,right=selected.x+selected.width-4;
   const r=Math.min(52*510/484,(bridgeY-selected.y)/2,left-4);
   assert(points.some(p=>Math.abs(p[1]-(left-r))<0.1&&Math.abs(p[2]-bridgeY)<0.1),'Left outward bridge curve');
   if(day!==24)assert(points.some(p=>Math.abs(p[1]-(right+r))<0.1&&Math.abs(p[2]-bridgeY)<0.1),'Right outward bridge curve');
  }
  const headerOps=[...model.image.ops,...model.image.ops.filter(o=>o.type==='image'&&o.rect.y===0&&o.image.size.height===510).flatMap(o=>o.image.ops??[])];
  const cards=headerOps.filter(o=>o.type==='header');assert.equal(cards.length,7);
  const nativeMetrics=native.createCanvas(1,1).getContext('2d');
  const metricContext=new Proxy(nativeMetrics,{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`bold ${v.size}px Arial`:v;return true},get(o,k){const v=o[k];return typeof v==='function'?v.bind(o):v}});
  let rows;
  for(const card of cards){
    assert.equal(card.title.state.font.size,25.5);assert(!card.title.tracking);
    const plan=d.headerPlan(metricContext,card);rows??=plan.rowTops;assert.deepEqual(plan.rowTops,rows);
    assert(Math.abs((plan.block.left+plan.block.right)/2-card.frame.x-card.frame.width/2)<1e-8);
    assert(Math.abs((plan.block.top+plan.block.bottom)/2-card.frame.y-card.frame.height/2)<1e-8);
    if(card.weekday===0)assert(Math.abs(plan.title.bounds.right-plan.weather.bounds.right)<1e-8);
    if(card.weekday===6)assert(Math.abs(plan.title.bounds.left-plan.weather.bounds.left)<1e-8);
  }
  assert(model.image.outerClip?.length>200,'Complete contour clips nested content');
  const source=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8');
  assert(!ops.some(o=>o.type==='text'&&/^(DOM|SEG|TER|QUA|QUI|SEX|SAB)$/.test(o.text)&&o.rect?.y>400),'Static comparison has no midnight badge');
  const image=paint(model.image),pixels=image.getContext('2d');
  if(day!==18){
   const bridgeY=points.find(p=>Math.abs(p[1]-4)<0.01&&p[2]>selected.height&&p[2]<200)[2];
   const r=Math.min(52*510/484,(bridgeY-selected.y)/2,selected.x);
   const gap=3*510/484/2+1.2287;
   const childCards=model.image.ops.filter(o=>o.type==='image'&&o.rect.y===0&&o.image.outerClip);
   assert.equal(childCards.length,6,'All six neighboring cards use an independent contour mask');
   for(const side of day===24?[-1]:[-1,1]){
    const cx=side===-1?selected.x+4-r:selected.x+selected.width-4+r,cy=bridgeY-r;
    const unitX=side===-1?Math.SQRT1_2:-Math.SQRT1_2,unitY=Math.SQRT1_2;
    const profile=Math.pow(0.5,1/2.45),arcX=cx+(side===-1?1:-1)*r*profile,arcY=cy+r*profile;
    const point=distance=>[Math.round(arcX+unitX*distance),Math.round(arcY+unitY*distance)];
    const own=point(5),color=Array.from(pixels.getImageData(...own,1,1).data).slice(0,3);
    const expected=model.timelineBackground.slice(1).match(/../g).map(x=>parseInt(x,16));
    assert.deepEqual(color,expected,'Selected background follows the curved shoulder on both sides');
    // The same offset mask is applied to every adjacent card; inspect its
    // winding directly, independently of which rectangular card is painted.
    const mask=native.createCanvas(1092,510).getContext('2d');mask.beginPath();
    for(const [method,...args] of childCards[0].image.outerClip)mask[method](...args);
    assert.equal(mask.isPointInPath(...point(-gap-4)),true,'Neighbor side remains visible');
    assert.equal(mask.isPointInPath(...point(-gap+1)),false,'Gap follows a parallel offset of the real superellipse');
   }
  }
  for(const [x,y] of [[0,0],[1,255],[1091,255],[545,0],[545,509]])assert.equal(pixels.getImageData(x,y,1,1).data[3],0,'Paint outside outer frame is cut');
  fs.writeFileSync(path.join(out,`scripting-${version}-day-${day}.png`),image.toBuffer('image/png'));
  sheetCtx.fillStyle='#111';sheetCtx.fillRect(0,row*570,1092,570);sheetCtx.fillStyle='white';sheetCtx.font='24px Arial';sheetCtx.fillText(label,20,row*570+34);sheetCtx.drawImage(image,0,row*570+50);row++;
 }
 // Special dates retain their background even when they are today.
 for(const [day,holiday,expected] of [[24,false,'#0D3F68'],[18,false,'#521720'],[22,true,'#3A2A00'],[24,true,'#3A2A00']]){
  const focus=new Date(2026,9,day),key=`2026-10-${day}`;
  const holidays=new Set(holiday?[key]:[]);
  const model=await renderOriginal(host,{now:+focus,focusDate:+focus,
   loadResult:{items:[],holidayDates:holidays,error:null},holidayDates:holidays,
   astronomy:{latitude:-16.68,longitude:-49.25},hourlyWeather:{hours:[],daily:{}}});
  assert.equal(model.timelineBackground,expected,'Holiday/weekend takes precedence over today');
  const selected=model.header.find(c=>c.selected),image=paint(model.image),pixels=image.getContext('2d');
  const rgb=expected.slice(1).match(/../g).map(x=>parseInt(x,16));
  assert.deepEqual(Array.from(pixels.getImageData(Math.round(selected.x+selected.width-10),90,1,1).data).slice(0,3),rgb,'Selected card uses the same special-date background');
  assert.deepEqual(Array.from(pixels.getImageData(540,400,1,1).data).slice(0,3),rgb,'Timeline uses the special-date background');
  if(holiday)fs.writeFileSync(path.join(out,`scripting-${version}-holiday-${day}.png`),image.toBuffer('image/png'));
 }
 fs.writeFileSync(path.join(out,`scripting-${version}-review.png`),sheet.toBuffer('image/png'));
 console.log('PASS: static comparison keeps joined frame, daily backgrounds, source colors and in-bounds contour; green marker removed. Rolling/blur/badge validated separately. Local Canvas review images saved; iOS rendering unverified.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
