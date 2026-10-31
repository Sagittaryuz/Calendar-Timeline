// Before/after render with synthetic agenda and locally substituted fonts.
// The image is a software preview, not an iPhone screenshot.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),c=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('../tests/scripting-rolling.cjs');
process.env.TZ='America/New_York';
const prefix='scripting/scripts/Calendar Timeline Scripting/';
(async()=>{
 const {d,host,options}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','MonoHeavy');
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','MonoRegular');
 c.GlobalFonts.registerFromPath(path.join(__dirname,'../tests/fixtures/fonts/BarlowCondensed-SemiBold.ttf'),'CondensedSemi');
 c.GlobalFonts.registerFromPath(path.join(__dirname,'../tests/fixtures/fonts/BarlowCondensed-Black.ttf'),'CondensedHeavy');
 host.DrawContext=class extends d.DrawContext{makeRaster=crop=>{const native=new c.Image();native.src=Buffer.from(encodePNG(crop));return {native,size:{width:crop.width,height:crop.height}}}};
 function paint(image){
  const canvas=c.createCanvas(Math.ceil(image.size.width),Math.ceil(image.size.height)),ctx=canvas.getContext('2d');
  const bridge=new Proxy(ctx,{set(o,k,v){if(k==='font'&&typeof v==='object'){const face=v.name.startsWith('AvenirNextCondensed')?(v.name.endsWith('DemiBold')?'CondensedSemi':'CondensedHeavy'):(v.name.endsWith('Regular')?'MonoRegular':'MonoHeavy');o[k]=`${v.size}px ${face}`}else o[k]=v;return true},get(o,k){if(k==='drawImage')return (src,...args)=>o.drawImage(src.image??src,...args);const v=o[k];return typeof v==='function'?v.bind(o):v}});
  for(const part of d.segments(image)){if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);else ctx.drawImage(paint(part.image),part.rect.x,part.rect.y,part.rect.width,part.rect.height)}
  if(image.outerClip){ctx.save();ctx.globalCompositeOperation='destination-in';ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.fillStyle='white';ctx.fill();ctx.restore()}
  if(image.blurRadius){const dest=c.createCanvas(canvas.width,canvas.height),blur=dest.getContext('2d');blur.filter=`blur(${image.blurRadius}px)`;blur.drawImage(canvas,0,0);return dest}
  return canvas;
 }
 const before=compile(cp.execFileSync('git',['show',`f55b66fc3e650b22296d4e1f1fc6020e1b2cbca5:${prefix}original-engine.js`],{encoding:'utf8'})),after=compile(raw);
 const rows=[
  ['2026-10-27T10:40:00','Terça-feira, hoje em dia útil'],
  ['2026-10-31T10:40:00','Sábado, virada de mês'],
  ['2026-11-01T10:40:00','Domingo, virada do horário de verão'],
  ['2026-12-31T10:40:00','Quinta-feira, virada de ano']
 ];
 const scale=0.48,panelWidth=1092*scale,sheetWidth=2*panelWidth+72,rowHeight=292;
 const sheet=c.createCanvas(Math.ceil(sheetWidth),125+rows.length*rowHeight),ctx=sheet.getContext('2d');
 ctx.fillStyle='#15171B';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#FFFFFF';ctx.font='bold 23px sans-serif';ctx.fillText('Calendar Timeline Scripting — cabeçalho móvel | 0.3.32 → 0.3.33',20,31);
 ctx.font='15px sans-serif';ctx.fillStyle='#C8CCD2';ctx.fillText('Dados sintéticos • DejaVu Mono substitui as faces iOS • prévia local, não captura de iPhone',20,57);
 ctx.fillStyle='#FFD166';ctx.font='bold 17px sans-serif';ctx.fillText('0.3.32 — semana fixa',20,91);ctx.fillText('0.3.33 — hoje no quarto slot',20+panelWidth+32,91);
 for(const [index,[date,label]]of rows.entries()){
  const now=new Date(date),key=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const items=[
   {kind:'event',identifier:'synthetic-event',title:'COMPROMISSO SINTÉTICO',start:new Date(+now+2*3600000),end:new Date(+now+3*3600000),color:'#0A84FF',isAllDay:false},
   {kind:'reminder',identifier:'synthetic-reminder',title:'LEMBRETE SINTÉTICO',start:new Date(+now+7*3600000),end:new Date(+now+12*3600000),sourceIsAllDay:true,color:'#FF9F0A',isAllDay:false}
  ];
  const o=options(now,items),daily={};for(let offset=-5;offset<=12;offset++){const day=new Date(now);day.setDate(day.getDate()+offset);daily[key(day)]={minimum:12+offset%5,maximum:23+offset%4,symbol:offset%4===0?'d5':'d0'}};o.hourlyWeather.daily=daily;
  o.loadResult.scheduleCountsByDay={[key(now)]:{events:1,reminders:1}};
  if(index===3)o.holidayDates=new Set([key(now)]);
  const y=125+index*rowHeight;ctx.fillStyle='#E5E7EB';ctx.font='bold 16px sans-serif';ctx.fillText(`${label} | ${date.slice(0,10)}`,20,y+23);
  for(const [column,run]of [before,after].entries()){
   const model=await run(host,o),image=paint(model.image),x=20+column*(panelWidth+32),top=y+38;
   ctx.drawImage(image,x,top,panelWidth,510*scale);
   ctx.strokeStyle='#666B75';ctx.lineWidth=1;ctx.strokeRect(x,top,panelWidth,510*scale);
  }
 }
 const out=path.resolve(__dirname,'../work/centered-week-0.3.33');fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'comparison.png'),sheet.toBuffer('image/png'));console.log(path.join(out,'comparison.png'));
})().catch(error=>{console.error(error);process.exitCode=1});
