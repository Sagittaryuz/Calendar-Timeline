// Side-by-side synthetic preview; substitute desktop font, not an iPhone capture.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createCanvas,GlobalFonts,Image}=require('@napi-rs/canvas');
const {fixture,compile,flatten,raw}=require('../tests/scripting-rolling.cjs');
const root=path.resolve(__dirname,'..');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baselineRaw=cp.execFileSync('git',['show',`100531a:${engine}`],{cwd:root,encoding:'utf8'});
const output=path.join(root,'docs/previews/calendar-timeline-overflow-carryover-0.3.43.png');
const detailOutput=path.join(root,'docs/previews/calendar-timeline-overflow-carryover-detail-0.3.43.png');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf','BirthdayHeavy');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf','BirthdayRegular');

function sceneItems(now){
 const start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
 return Array.from({length:8},(_,i)=>({kind:'reminder',identifier:'synthetic-'+i,title:'SYNTHETIC TASK '+(i+1),start:new Date(start),end:new Date(end),sourceIsAllDay:true,color:i<3?'#30D158':'#0088FF'}));
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
  const times=[['12:55',12,55],['18:00',18,0]];
  const scale=.70,rowHeight=396,top=130,width=2224,height=top+times.length*rowHeight;
  const sheet=createCanvas(width,height),ctx=sheet.getContext('2d');
  ctx.fillStyle='#111318';ctx.fillRect(0,0,width,height);ctx.fillStyle='#F5F5F7';ctx.font='bold 28px sans-serif';ctx.fillText('Calendar Timeline · indicador de itens excedentes · 0.3.42 → 0.3.43',22,34);
  ctx.font='20px sans-serif';ctx.fillStyle='#D5D7DC';ctx.fillText('Comparação sintética: oito lembretes, seis linhas visíveis. +2 reaparece no próprio dia.',22,64);
  ctx.fillText('Fonte Open Sans desktop como aproximação; não é captura física do iPhone. Hoje (antes)',22,94);ctx.fillText('Ajuste (depois)',1120,94);
  const results=[],detailFrames=[];
  for(const [index,[label,hour,minute]] of times.entries()){
    const now=new Date(2026,10,12,hour,minute),items=sceneItems(now);
    const nextMidnight=new Date(now);nextMidnight.setHours(24,0,0,0);
    const tomorrowRainIndex=Math.floor((+nextMidnight-+now)/3600000)+1;
    const rainIndices=new Set([1,tomorrowRainIndex]);
    const weather={hours:Array.from({length:49},(_,i)=>{const raining=rainIndices.has(i);return{timestamp:+now+i*3600000,temperature:18+8*Math.sin(i/4),rainChance:raining?100:0,rainMM:raining?10:0,rainRate:raining?10:0,cloudiness:raining?90:15,symbol:raining?'d5':'d0'};}),daily:{}};
    const opts=options(now,items,{hourlyWeather:weather});
    const models=[await before(host,opts),await after(host,opts)];
    const y=top+index*rowHeight;ctx.fillStyle='#BFC2C8';ctx.font='bold 20px sans-serif';ctx.fillText(`${label} local`,22,y-12);
    for(let pane=0;pane<2;pane++){
      const x=18+pane*1104;const canvas=createCanvas(1092,510),paintCtx=canvas.getContext('2d');paintCtx.fillStyle='#08090B';paintCtx.fillRect(0,0,1092,510);
      await paintImage(bridge(paintCtx,new WeakMap()),models[pane].image,d);
      ctx.drawImage(canvas,x,y,1092*scale,510*scale);
      ctx.strokeStyle='#3E424A';ctx.lineWidth=1;ctx.strokeRect(x,y,1092*scale,510*scale);
      if(pane===0)detailFrames.push({label,bandY:models[pane].thermalBand.y,canvases:[canvas]});
      else detailFrames.at(-1).canvases.push(canvas);
    }
    const rainBars=flatten(models[1].image).filter(op=>op.type==='fillRect'&&op.state?.fill?.hex?.toLowerCase()==='17baec').length;
    results.push({time:label,version:models[1].version,selectedDate:models[1].focusDate,birthdayGroups:items.filter(i=>i.isBirthday).length,syntheticRainBars:rainBars,thermalBand:models[1].thermalBand});
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,sheet.toBuffer('image/png'));
  const cropY=295,cropHeight=95,detail=createCanvas(2224,88+times.length*(cropHeight+34)),detailCtx=detail.getContext('2d');
  detailCtx.fillStyle='#111318';detailCtx.fillRect(0,0,detail.width,detail.height);detailCtx.fillStyle='#F5F5F7';detailCtx.font='bold 26px sans-serif';detailCtx.fillText('Detalhe do indicador +2 · 0.3.42 antes / 0.3.43 depois',20,32);detailCtx.font='19px sans-serif';detailCtx.fillStyle='#D5D7DC';detailCtx.fillText('O badge permanece no próprio dia, sem alterar a duração do lembrete.',20,61);
  detailFrames.forEach((frame,index)=>{const y=88+index*(cropHeight+34);detailCtx.fillStyle='#BFC2C8';detailCtx.font='bold 19px sans-serif';detailCtx.fillText(frame.label+' local',20,y-5);for(let pane=0;pane<2;pane++){const crop=createCanvas(1092,cropHeight),cropCtx=crop.getContext('2d');cropCtx.drawImage(frame.canvases[pane],0,cropY,1092,cropHeight,0,0,1092,cropHeight);detailCtx.drawImage(crop,18+pane*1104,y,1092,cropHeight);detailCtx.strokeStyle='#3E424A';detailCtx.strokeRect(18+pane*1104,y,1092,cropHeight);}});
  fs.writeFileSync(detailOutput,detail.toBuffer('image/png'));
  console.log(JSON.stringify({output,bytes:fs.statSync(output).size,dimensions:{width,height},detailOutput,detailBytes:fs.statSync(detailOutput).size,detailDimensions:{width:detail.width,height:detail.height},rows:results},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
