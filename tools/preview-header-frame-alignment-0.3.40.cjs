// Side-by-side synthetic preview of the published 0.3.39 anchor and the
// corrected right-frame alignment. Desktop fonts/icons; not native iOS output.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createCanvas,Image,GlobalFonts}=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('../tests/scripting-rolling.cjs');
const directory=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const beforeSource=cp.execFileSync('git',['show','2fd6f48:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const times=[['00:00',0],['06:00',6],['12:00',12],['18:00',18],['23:59',23+59/60]];
const output=path.resolve(__dirname,'../docs/previews/calendar-timeline-frame-right-alignment-0.3.40.png');

GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','MonoRegular');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','MonoHeavy');
GlobalFonts.registerFromPath(path.join(__dirname,'../tests/fixtures/fonts/BarlowCondensed-SemiBold.ttf'),'CondSemi');
GlobalFonts.registerFromPath(path.join(__dirname,'../tests/fixtures/fonts/BarlowCondensed-Black.ttf'),'CondHeavy');
for(const [file,name] of [['Semibold','SansSemi'],['ExtraBold','SansHeavy'],['Regular','SansRegular'],['Bold','SansBold']])
  GlobalFonts.registerFromPath(`/usr/share/fonts/truetype/open-sans/OpenSans-${file}.ttf`,name);

function localFont(face,size){
  if(face==='AvenirNextCondensed-Heavy')return `${size}px CondHeavy`;
  if(face==='AvenirNextCondensed-DemiBold')return `${size}px CondSemi`;
  if(face==='Menlo-Bold'||face==='AvenirNext-Heavy')return `${size}px MonoHeavy`;
  if(face==='Menlo-Regular')return `${size}px MonoRegular`;
  if(face==='AvenirNext-DemiBold'||face==='HelveticaNeue-Bold')return `${size}px SansSemi`;
  if(face==='AvenirNext-Bold')return `${size}px SansBold`;
  return `${size}px SansRegular`;
}
function proxyContext(ctx,nativeCache){
  return new Proxy(ctx,{
    set(target,key,value){target[key]=key==='font'&&value&&typeof value==='object'?localFont(value.name,value.size):value;return true;},
    get(target,key){
      if(key==='drawImage')return (source,...args)=>{
        let image=source?.image??source;
        if(image?.bytes){let decoded=nativeCache.get(image);if(!decoded){decoded=new Image();decoded.src=Buffer.from(image.bytes);nativeCache.set(image,decoded);}image=decoded;}
        return target.drawImage(image,...args);
      };
      const value=target[key];return typeof value==='function'?value.bind(target):value;
    }
  });
}
function weatherSymbol(symbol,color){
  const icon=createCanvas(36,36),ctx=icon.getContext('2d');ctx.fillStyle=color||'#FFFFFF';ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=2.8;
  if(/d0|sun|clear/i.test(String(symbol))){ctx.beginPath();ctx.arc(18,16,7,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(18+Math.cos(a)*11,16+Math.sin(a)*11);ctx.lineTo(18+Math.cos(a)*15,16+Math.sin(a)*15);ctx.stroke();}}
  else{ctx.beginPath();ctx.arc(13,21,6,Math.PI,Math.PI*2);ctx.arc(20,17,8,Math.PI,Math.PI*2);ctx.arc(27,21,5,Math.PI,Math.PI*2);ctx.lineTo(30,27);ctx.lineTo(9,27);ctx.closePath();ctx.fill();}
  return icon;
}
async function paintImage(ctx,image,view,d,nativeCache){
  ctx.save();
  if(image.outerClip){ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.clip();}
  for(const part of d.segments(image,view)){
    if(part.type==='canvas')d.replay(ctx,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,(symbol,color)=>weatherSymbol(symbol,color));
    else if(part.type==='image'){
      const viewport=d.childViewport(part.image,part.rect,view);if(!viewport)continue;
      ctx.save();ctx.translate(part.rect.x,part.rect.y);ctx.scale(part.rect.width/part.image.size.width,part.rect.height/part.image.size.height);
      await paintImage(ctx,part.image,viewport,d,nativeCache);ctx.restore();
    }
  }
  ctx.restore();
}
async function main(){
  const {encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const {d,host,options}=await fixture();
  host.DrawContext=class extends d.DrawContext{makeRaster(crop){return {native:{bytes:Buffer.from(encodePNG(crop))},size:{width:crop.width,height:crop.height}};}};
  const before=compile(beforeSource),after=compile(raw),canvas=createCanvas(1092,1760),sheet=canvas.getContext('2d');
  sheet.fillStyle='#0b0c0e';sheet.fillRect(0,0,1092,1536);
  sheet.font='bold 22px sans-serif';sheet.fillStyle='#f7f7f7';sheet.fillText('BASELINE 0.3.39 · moldura antiga',14,28);sheet.fillText('CORREÇÃO 0.3.40 · borda direita alinhada',560,28);
  const rows=[];
  for(let row=0;row<times.length;row++){
    const [label,hour]=times[row],minute=hour===23+59/60?59:0,h=hour===23+59/60?23:hour;
    const now=new Date(2026,9,27,h,minute),start=new Date(now);start.setHours(0,0,0,0);
    const daily={};for(let i=-10;i<=18;i++){const day=new Date(start);day.setDate(day.getDate()+i);const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;daily[key]={minimum:Math.round(12+7*Math.sin(i/3)),maximum:Math.round(23+7*Math.sin(i/4)),symbol:i%3===0?'d0':'d1'};}
    const event={kind:'event',identifier:'synthetic-event',title:'SYNTHETIC EVENT',start:new Date(start.getFullYear(),start.getMonth(),start.getDate(),9),end:new Date(start.getFullYear(),start.getMonth(),start.getDate(),10,30),color:'#FF9F0A',isAllDay:false};
    const reminder={kind:'reminder',identifier:'synthetic-reminder',title:'SYNTHETIC REMINDER',start:new Date(start.getFullYear(),start.getMonth(),start.getDate(),17),end:new Date(start.getFullYear(),start.getMonth(),start.getDate(),17,20),color:'#64D2FF',isAllDay:false};
    const o=options(now,[event,reminder]);o.hourlyWeather={hours:[],daily};
    const models=[await before(host,o),await after(host,o)];
    const top=48+row*340;sheet.font='bold 17px sans-serif';sheet.fillStyle='#dddddf';sheet.fillText(`${label}  ·  ${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,14,top-8);sheet.fillText(`${label}  ·  mesmo relógio da timeline`,560,top-8);
    for(let pane=0;pane<2;pane++){
      const x=pane*546;sheet.save();sheet.translate(x,top);sheet.scale(.5,.48);
      sheet.fillStyle='#090a0c';sheet.fillRect(0,0,1092,510);
      const nativeCache=new WeakMap();await paintImage(proxyContext(sheet,nativeCache),models[pane].image,{x:0,y:0,width:1092,height:510},d,nativeCache);sheet.restore();
    }
    const previousCard=models[0].header.find(card=>card.selected),card=models[1].header.find(card=>card.selected);
    const oldFrameRightX=previousCard.x+previousCard.width-4,newFrameRightX=card.x+card.width-4,boundaryX=models[1].temporal.midnightX;
    sheet.font='12px sans-serif';sheet.fillStyle='#d0d0d0';sheet.fillText(`ANTES: moldura ${oldFrameRightX.toFixed(2)} · linha ${boundaryX.toFixed(2)} · Δ ${(oldFrameRightX-boundaryX).toFixed(2)} px`,14,top+265);sheet.fillText(`DEPOIS: moldura ${newFrameRightX.toFixed(2)} · linha ${boundaryX.toFixed(2)} · Δ ${(newFrameRightX-boundaryX).toFixed(4)} px`,560,top+265);
    const visible=models[1].header.filter(c=>c.x+c.width>4&&c.x<1088);
    rows.push({time:label,cardCount:models[1].header.length,selectedDate:models[1].focusDate,oldFrameRightX,newFrameRightX,boundaryX,oldDelta:oldFrameRightX-boundaryX,newDelta:newFrameRightX-boundaryX,visibleFirst:visible[0].date,visibleLast:visible.at(-1).date,leftEdgeGap:edgeDistance(models[1].header,4),rightEdgeGap:edgeDistance(models[1].header,1088)});
  }
  const png=canvas.toBuffer('image/png');fs.writeFileSync(output,png);console.log(JSON.stringify({output,bytes:png.length,rows}));
}
function edgeDistance(cards,x){return cards.some(c=>c.x<=x&&c.x+c.width>=x)?0:Math.min(...cards.flatMap(c=>[Math.abs(x-c.x),Math.abs(x-c.x-c.width)]));}
main().catch(error=>{console.error(error);process.exitCode=1;});
