// Side-by-side synthetic preview; substitute desktop font, not an iPhone capture.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createCanvas,GlobalFonts,Image}=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('../tests/scripting-rolling.cjs');
const root=path.resolve(__dirname,'..');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baselineRaw=cp.execFileSync('git',['show',`bff4c71:${engine}`],{cwd:root,encoding:'utf8'});
const output=path.join(root,'docs/previews/calendar-timeline-birthday-thermal-0.3.41.png');
const detailOutput=path.join(root,'docs/previews/calendar-timeline-birthday-thermal-detail-0.3.41.png');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf','BirthdayHeavy');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf','BirthdayRegular');

function birthday(title,date){const start=new Date(date);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);return{kind:'event',identifier:`birthday-${title}`,title,isBirthday:true,isAllDay:true,start,end,color:'#000000'};}
function sceneItems(now){
  const start=new Date(now);start.setMinutes(0,0,0);start.setHours(start.getHours()+1);
  const end=new Date(+start+6*3600000),day=new Date(start);day.setHours(0,0,0,0);
  const birthdayDay=new Date(now);birthdayDay.setHours(0,0,0,0);
  const items=[];
  for(let i=0;i<6;i++)items.push({kind:'event',identifier:`event-${i}`,title:`SYNTHETIC EVENT ${i+1}`,start:new Date(start),end:new Date(end),color:['#FF9F0A','#0A84FF','#30D158','#BF5AF2','#FF453A','#64D2FF'][i],isAllDay:false});
  for(let i=0;i<4;i++)items.push({kind:'reminder',identifier:`reminder-${i}`,title:`SYNTHETIC REMINDER ${i+1}`,start:new Date(start),end:new Date(+start+3600000),color:'#FF9F0A',isAllDay:false,isCompleted:false});
  items.push(birthday('🎂 Alice Silva',birthdayDay),birthday('🎂 Bruno Costa',birthdayDay),birthday('🎂 Camila Lima',birthdayDay));
  const tomorrow=new Date(birthdayDay);tomorrow.setDate(tomorrow.getDate()+1);items.push(birthday('🎂 Davi Rocha',tomorrow));
  return items;
}
function fontCSS(font){return `${font.size}px ${font.name.includes('Regular')?'BirthdayRegular':'BirthdayHeavy'}`;}
function bridge(ctx,cache){return new Proxy(ctx,{set(target,key,value){target[key]=key==='font'&&value&&typeof value==='object'?fontCSS(value):value;return true;},get(target,key){if(key==='drawImage')return(source,...args)=>{let image=source?.image??source;if(image?.native?.bytes){let decoded=cache.get(image);if(!decoded){decoded=new Image();decoded.src=Buffer.from(image.native.bytes);cache.set(image,decoded);}image=decoded;}return target.drawImage(image,...args);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});}
async function paintImage(ctx,image,d,view={x:0,y:0,width:image.size.width,height:image.size.height},cache=new WeakMap()){
  ctx.save();
  if(image.outerClip){ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.clip();}
  for(const part of d.segments(image,view)){
    if(part.type==='canvas')d.replay(ctx,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);
    else{const child=d.childViewport(part.image,part.rect,view);if(!child)continue;ctx.save();ctx.translate(part.rect.x,part.rect.y);ctx.scale(part.rect.width/part.image.size.width,part.rect.height/part.image.size.height);await paintImage(ctx,part.image,d,child,cache);ctx.restore();}
  }
  ctx.restore();
  if(image.blurRadius){const result=createCanvas(image.size.width,image.size.height),blur=result.getContext('2d');blur.filter=`blur(${image.blurRadius}px)`;blur.drawImage(ctx.canvas,0,0);return result;}
  return ctx.canvas;
}
async function main(){
  const {d,host,options}=await fixture();
  const before=compile(baselineRaw),after=compile(raw);
  const times=[['00:00',0,0],['06:00',6,0],['12:00',12,0],['18:00',18,0],['23:59',23,59]];
  const scale=.70,rowHeight=396,top=130,width=2224,height=top+times.length*rowHeight;
  const sheet=createCanvas(width,height),ctx=sheet.getContext('2d');
  ctx.fillStyle='#111318';ctx.fillRect(0,0,width,height);ctx.fillStyle='#F5F5F7';ctx.font='bold 28px sans-serif';ctx.fillText('Calendar Timeline · aniversários sobre a curva térmica · 0.3.40 → 0.3.41',22,34);
  ctx.font='20px sans-serif';ctx.fillStyle='#D5D7DC';ctx.fillText('Comparação sintética com seis charts, quatro lembretes e três aniversários no mesmo dia. Sem dados pessoais.',22,64);
  ctx.fillText('Fonte Open Sans desktop como aproximação; não é captura física do iPhone. Hoje (antes)',22,94);ctx.fillText('Ajuste (depois)',1120,94);
  const results=[],detailFrames=[];
  for(const [index,[label,hour,minute]] of times.entries()){
    const now=new Date(2026,10,10,hour,minute),items=sceneItems(now);
    const weather={hours:Array.from({length:49},(_,i)=>({timestamp:+now+i*3600000,temperature:18+8*Math.sin(i/4),rainChance:0,rainMM:0,symbol:'d0'})),daily:{}};
    const opts=options(now,items,{hourlyWeather:weather});
    const models=[await before(host,opts),await after(host,opts)];
    const y=top+index*rowHeight;ctx.fillStyle='#BFC2C8';ctx.font='bold 20px sans-serif';ctx.fillText(`${label} local`,22,y-12);
    for(let pane=0;pane<2;pane++){
      const x=18+pane*1104;const canvas=createCanvas(1092,510),paintCtx=canvas.getContext('2d');paintCtx.fillStyle='#08090B';paintCtx.fillRect(0,0,1092,510);
      await paintImage(paintCtx,models[pane].image,d);
      ctx.drawImage(canvas,x,y,1092*scale,510*scale);
      ctx.strokeStyle='#3E424A';ctx.lineWidth=1;ctx.strokeRect(x,y,1092*scale,510*scale);
      if(pane===0)detailFrames.push({label,bandY:models[pane].thermalBand.y,canvases:[canvas]});
      else detailFrames.at(-1).canvases.push(canvas);
    }
    results.push({time:label,version:models[1].version,selectedDate:models[1].focusDate,birthdayGroups:items.filter(i=>i.isBirthday).length,thermalBand:models[1].thermalBand});
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,sheet.toBuffer('image/png'));
  const cropY=364,cropHeight=120,detail=createCanvas(2224,88+times.length*(cropHeight+34)),detailCtx=detail.getContext('2d');
  detailCtx.fillStyle='#111318';detailCtx.fillRect(0,0,detail.width,detail.height);detailCtx.fillStyle='#F5F5F7';detailCtx.font='bold 26px sans-serif';detailCtx.fillText('Detalhe da faixa térmica · mesmo dado sintético · 0.3.40 antes / 0.3.41 depois',20,32);detailCtx.font='19px sans-serif';detailCtx.fillStyle='#D5D7DC';detailCtx.fillText('Recorte em escala lógica 1:1, fontes desktop substitutas. A linha rosa mostra os três nomes mesmo com todas as linhas ocupadas.',20,61);
  detailFrames.forEach((frame,index)=>{const y=88+index*(cropHeight+34);detailCtx.fillStyle='#BFC2C8';detailCtx.font='bold 19px sans-serif';detailCtx.fillText(frame.label+' local',20,y-5);for(let pane=0;pane<2;pane++){const crop=createCanvas(1092,cropHeight),cropCtx=crop.getContext('2d');cropCtx.drawImage(frame.canvases[pane],0,cropY,1092,cropHeight,0,0,1092,cropHeight);detailCtx.drawImage(crop,18+pane*1104,y,1092,cropHeight);detailCtx.strokeStyle='#3E424A';detailCtx.strokeRect(18+pane*1104,y,1092,cropHeight);}});
  fs.writeFileSync(detailOutput,detail.toBuffer('image/png'));
  console.log(JSON.stringify({output,bytes:fs.statSync(output).size,dimensions:{width,height},detailOutput,detailBytes:fs.statSync(detailOutput).size,detailDimensions:{width:detail.width,height:detail.height},rows:results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
