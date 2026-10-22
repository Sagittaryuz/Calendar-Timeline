// Local Canvas approximation for geometry review, not an iOS screenshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const native=require(process.env.CANVAS_PATH||'@napi-rs/canvas');
async function main(){
 const dir=path.join(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
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
  if(!image.blurRadius)return canvas;
  const blurred=native.createCanvas(canvas.width,canvas.height),b=blurred.getContext('2d');
  b.filter=`blur(${image.blurRadius}px)`;b.drawImage(canvas,0,0);return blurred;
 }
 const now=new Date(2026,9,22,12,30),out=path.join(__dirname,'../../artifacts');
 const sheet=native.createCanvas(1092,570*3),sheetCtx=sheet.getContext('2d');let row=0;
 for(const [day,label] of [[22,'Hoje: preto, cores de origem, marcador verde'],[21,'Outro dia útil: cinza e blur integral'],[24,'Sábado: azul, blur integral, cantos inferiores retos']]){
  const focus=new Date(2026,9,day),at=h=>new Date(2026,9,day,h);
  const items=[{kind:'event',identifier:'a',title:'EVENTO ROSA',start:at(10),end:at(14),color:'#FF2D55',isAllDay:false},
   {kind:'reminder',identifier:'b',title:'LEMBRETE LARANJA',start:at(8),end:at(16),color:'#FF9500',priority:1,sourceIsAllDay:false,isAllDay:false}];
  const options={now:+now,focusDate:+focus,loadResult:{items,holidayDates:new Set(),error:null},
   astronomy:{latitude:-16.68,longitude:-49.25},hourlyWeather:{hours:[],daily:{}},holidayDates:new Set()};
  const model=await renderOriginal(host,options),ops=[],blurs=[];
  function visit(image){if(image.blurRadius)blurs.push(image);for(const op of image.ops){ops.push(op);if(op.type==='image'&&!op.image.native&&!op.image.symbol)visit(op.image)}}visit(model.image);
  assert.equal(blurs.length,day===22?0:1,'Whole panel blur only when selected day is not today');
  assert.equal(model.timelineBackground,day===22?'#000000':day===24?'#0D3F68':'#3B3C3E');
  assert.equal(model.nowMarker===null,day!==22);
  if(day===22){
   assert.equal(model.nowMarker.x,1092*12.5/24);
   for(const hex of ['FF2D55','FF9500'])assert(ops.some(o=>o.type==='fillRect'&&o.state.fill.hex.toUpperCase()===hex&&o.rect.width>=3&&o.rect.width<=5),'Source-colored start line: '+hex);
   assert(ops.some(o=>o.type==='fillRect'&&o.state.fill.hex==='30D158'&&o.rect.height>300),'Green time marker spans timeline');
  }
  const contour=ops.find(o=>o.type==='strokePath'&&o.state.stroke.hex==='FFFFFF'&&o.state.stroke.alpha===0.9);
  assert(contour,'One external contour');
  for(const [,x,y] of contour.path.filter(c=>c.length===3)){assert(x>=4&&x<=1088&&y>=4&&y<=506,'Contour within final widget coordinates')}
  for(const card of model.header){
   const texts=model.image.ops.filter(o=>o.type==='text'&&o.point.y<100&&o.point.x>=card.x&&o.point.x<card.x+card.width);
   assert(texts.length>=3,'Three header rows');
   const top=Math.min(...texts.map(o=>o.point.y)),bottom=Math.max(...texts.map(o=>o.point.y+o.state.font.size));
   assert(Math.abs((top+bottom)/2-(card.y+card.height/2))<5,'Header block centered vertically');
   const cardPath=model.image.ops.find(o=>o.type==='fillPath'&&o.path.some(p=>p.length===3&&Math.abs(p[1]-card.x-card.width)<0.01&&Math.abs(p[2]-card.y)<0.01));
   // Weekdays have curved lower corners; weekend cards meet their lower
   // corners exactly. Assert geometry in the recorded path, not a style flag.
   if(cardPath){
    const bottom=card.y+card.height;
    const hasLowerCorner=x=>cardPath.path.some(p=>p.length===3&&Math.abs(p[1]-x)<0.01&&Math.abs(p[2]-bottom)<0.01);
    const weekday=new Date(card.date+'T12:00:00').getDay();
    assert.equal(hasLowerCorner(card.x),weekday===0||weekday===6,'Left lower card corner');
    assert.equal(hasLowerCorner(card.x+card.width),weekday===0||weekday===6,'Right lower card corner');
   }
  }
  const image=paint(model.image);fs.writeFileSync(path.join(out,`scripting-0.2.1-day-${day}.png`),image.toBuffer('image/png'));
  sheetCtx.fillStyle='#111';sheetCtx.fillRect(0,row*570,1092,570);sheetCtx.fillStyle='white';sheetCtx.font='24px Arial';sheetCtx.fillText(label,20,row*570+34);sheetCtx.drawImage(image,0,row*570+50);row++;
 }
 fs.writeFileSync(path.join(out,'scripting-0.2.1-review.png'),sheet.toBuffer('image/png'));
 console.log('PASS: whole-panel blur, daily backgrounds, source-colored event/reminder lines, green now marker, in-bounds external contour. Local Canvas review images saved; iOS rendering unverified.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
