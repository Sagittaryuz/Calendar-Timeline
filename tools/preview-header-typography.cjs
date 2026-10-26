// Local Canvas comparison. Native SFMono and physical WidgetKit remain unverified.
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const output=path.resolve(__dirname,'../work/typography-review');fs.mkdirSync(output,{recursive:true});
const canvas=require('@napi-rs/canvas');
const source=require('child_process').execFileSync('git',['show','6460bb7:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const candidate=fs.readFileSync(path.join(root,'original-engine.js'),'utf8');

const compile=s=>new (Object.getPrototypeOf(async function(){}).constructor)('host','options',s.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
(async()=>{
 const d=await import(pathToFileURL(root+'/drawing.js'));
 canvas.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','ReviewMono');
 canvas.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','ReviewMonoRegular');
 const host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 function paint(image){
  const c=canvas.createCanvas(image.size.width,image.size.height),ctx=c.getContext('2d');
  const bridge=new Proxy(ctx,{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`${v.size}px "${v.name.includes('Regular')?'ReviewMonoRegular':'ReviewMono'}"`:v;return true},get(o,k){if(k==='drawImage')return (src,...args)=>o.drawImage(src.image??src,...args);const v=o[k];return typeof v==='function'?v.bind(o):v}});
  for(const part of d.segments(image)){
   if(part.type==='canvas')d.replay(bridge,part.ops,image.size.width,image.size.height,image.size.width,image.size.height,()=>null);
   else ctx.drawImage(paint(part.image),part.rect.x,part.rect.y,part.rect.width,part.rect.height);
  }
  if(image.outerClip){ctx.save();ctx.globalCompositeOperation='destination-in';ctx.beginPath();for(const [method,...args]of image.outerClip)ctx[method](...args);ctx.fillStyle='white';ctx.fill();ctx.restore()}
  return c;
 }
 const rows=[['Hoje comum | QUA 21, preto',21,null,30,20],['Hoje sábado | SAB 24, azul',24,null,30,20],['Hoje domingo | DOM 18, vermelho',18,null,30,20],['Hoje feriado | QUA 21',21,'2026-10-21',30,20],['Textos curtos | 9º e -2º',21,null,9,-2],['Textos longos | -12º e -19º',21,null,-12,-19],['Sem clima | --º e --º',21,null,null,null]];
 const sheet=canvas.createCanvas(2240,110+rows.length*177),ctx=sheet.getContext('2d');ctx.fillStyle='#17191F';ctx.fillRect(0,0,sheet.width,sheet.height);
 ctx.fillStyle='white';ctx.font='bold 27px sans-serif';ctx.fillText('Calendar Timeline | diagnóstico de tipografia',20,34);ctx.font='19px sans-serif';ctx.fillText('Esquerda: 0.3.17. Direita: 38 px em todos; ajuste interno apenas em DOM/SAB.',20,65);ctx.fillStyle='#FFCC66';ctx.fillText('SIMULAÇÃO LOCAL: DejaVu Mono substitui SFMono; não é captura iOS. Contorno e caixas são os do motor.',20,92);
 const report=[];
 for(let i=0;i<rows.length;i++){
  const [label,day,holiday,maximum,minimum]=rows[i],now=new Date(2026,9,day,12),holidays=new Set(holiday?[holiday]:[]);
  const options={now:+now,focusDate:+now,loadResult:{items:[],holidayDates:holidays,error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily:Object.fromEntries(Array.from({length:7},(_,i)=>[`2026-10-${18+i}`,{maximum,minimum,symbol:'d0'}]))},holidayDates:holidays};
  const y=110+i*177;ctx.fillStyle='#ddd';ctx.font='18px sans-serif';ctx.fillText(label,20,y+20);
  for(const [j,src] of [source,candidate].entries()){
   const captures=[];const instrument=src.replace('const layout=weekHeaderLayout(date,card,headlineSize);','const layout=weekHeaderLayout(date,card,headlineSize);host.probe(date,card,headlineSize,layout);');
   const model=await compile(instrument)({...host,probe:(date,card,size,layout)=>captures.push({date:date.toISOString().slice(0,10),card,size,layout})},options);
   const img=paint(model.image),x=20+j*1110;ctx.drawImage(img,0,0,1092,110,x,y+31,1092,110);
   for(const r of captures){
    // Actual advance boxes, rather than card-center assertions.
    const l=r.layout;ctx.save();ctx.strokeStyle='#54DCFF';ctx.setLineDash([3,3]);ctx.strokeRect(x+l.x,y+31+l.top,l.width,r.size);ctx.strokeStyle='#FFC754';ctx.strokeRect(x+l.temperatureLeft,y+31+l.temperatureY,l.temperatureRight-l.temperatureLeft,l.temperatureSize);ctx.restore();
   }
   ctx.fillStyle=j?'#FFCC66':'#A9B5C7';ctx.font='14px sans-serif';ctx.fillText(j?'38 px sem compressão de glifos; espaço interno ajustado em DOM/SAB':'Hoje maior; demais menores | ciano: título, amarelo: linha 2',x,y+164);
   report.push({case:label,variant:j?'uniform0318':'current0317',captures});
  }
 }
 fs.writeFileSync(path.join(output,'Calendar-Timeline-typography-0.3.18.png'),sheet.toBuffer('image/png'));
 fs.writeFileSync(path.join(output,'preview-0.3.18-layout.json'),JSON.stringify({baseline:'6460bb70a8085c51cf408c790f03385c7030ed4b',nativeFont:'SFMono-Heavy',fontSubstitute:'DejaVu Sans Mono Bold',report},null,2));
 console.log('Preview and measured layout report ready.');
})();
