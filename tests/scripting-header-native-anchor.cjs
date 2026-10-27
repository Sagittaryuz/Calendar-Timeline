// Historical 0.3.19 -> 0.3.20 counterfactual stays pinned; active two-row metrics are checked separately.
// Regression model: UIKit baseline measurements + top-anchored drawing.
// It reproduces the failure class; these are not the phone's captured metrics.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),c=require('@napi-rs/canvas');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting'),base='b2ed8f618deed6e20375fb925db2bfda53c10638';
function flat(image){return image.ops.flatMap(o=>o.image?.ops?[o,...flat(o.image)]:[o])}
(async()=>{
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','AnchorHeavy');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','AnchorRegular');
 const d=await import(pathToFileURL(path.join(dir,'drawing.js'))),engine={renderOriginal:require('./scripting-rolling.cjs').compile(cp.execFileSync('git',['show','e6c7305:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'}))};
 let oldSource=cp.execFileSync('git',['show',base+':scripting/scripts/Calendar Timeline Scripting/drawing.js'],{encoding:'utf8'});
 for(const file of ['diagonal-canvas.js','rect-raster.js'])oldSource=oldSource.replace('./'+file,pathToFileURL(path.join(dir,file)).href);
 const previous=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
 const host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 function backend(canvas,mode,positions){
  const real=canvas.getContext('2d');let font={name:'SFMono-Heavy',size:25.5};
  return new Proxy(real,{set(o,k,v){if(k==='font'&&typeof v==='object'){font=v;o.font=`${v.size}px ${v.name.endsWith('Regular')?'AnchorRegular':'AnchorHeavy'}`}else o[k]=v;return true},get(o,k){
   if(k==='measureText')return text=>{const m=o.measureText(text);if(mode==='web')return m;return {width:m.width,actualBoundingBoxLeft:m.actualBoundingBoxLeft,actualBoundingBoxRight:m.actualBoundingBoxRight,actualBoundingBoxAscent:0,actualBoundingBoxDescent:font.size*.7,fontBoundingBoxAscent:font.size*1.1,fontBoundingBoxDescent:font.size*.2}};
   if(k==='fillText')return (text,x,y,...args)=>{if(/^(DOM|SEG|TER|QUA|QUI|SEX|SAB) \d\d$/.test(text)){const m=o.getTransform();positions.push({text,x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f})}return o.fillText(text,x,y,...args)};
   if(k==='drawImage')return (src,...args)=>o.drawImage(src.image??src,...args);const v=o[k];return typeof v==='function'?v.bind(o):v;
  }});
 }
 const rows=[],sheet=c.createCanvas(2240,700),sc=sheet.getContext('2d');sc.fillStyle='#15171c';sc.fillRect(0,0,2240,700);sc.fillStyle='white';sc.font='24px sans-serif';sc.fillText('0.3.19 → 0.3.20 | regressão de ancoragem: reprodução simulada',20,35);sc.font='17px sans-serif';sc.fillText('Métricas de baseline simuladas + desenho ancorado no topo. DejaVu Mono; não é SFMono nem captura do iOS.',20,67);
 for(const [index,day]of [26,25,31].entries()){
  const now=new Date(2026,9,day,12),keys=Array.from({length:7},(_,i)=>'2026-10-'+(25+i));
  const model=await engine.renderOriginal(host,{now:+now,focusDate:+now,loadResult:{items:[],holidayDates:new Set(),error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily:Object.fromEntries(keys.map(k=>[k,{maximum:30,minimum:20,symbol:'d0'}]))},holidayDates:new Set()});
  const original=flat(model.image).filter(o=>o.type==='header');assert.equal(original.length,7);
  const outputs=[];
  for(const [side,adapter]of [previous,d].entries()){
   const groups=JSON.parse(JSON.stringify(original)),canvas=c.createCanvas(1092,510),positions=[];const ctx=backend(canvas,'baseline',positions);
   // Restore the production Color helpers after copying the shared fixture.
   function revive(o){if(o?.state)for(const k of ['fill','stroke','text'])if(o.state[k]?.hex)o.state[k]=new d.Color(o.state[k].hex,o.state[k].alpha);if(o.type==='header'){revive(o.title);revive(o.count);o.weather.ops.forEach(revive)}}groups.forEach(revive);
   for(const op of groups)adapter.replay(ctx,[op],1092,510,1092,510,()=>null);
   assert.equal(positions.length,7);
   if(!side)assert(positions.every(p=>p.y<0),'0.3.19 draws every L1 above the widget in the baseline model');
   else{
    assert(positions.every(p=>p.y>10&&p.y<25),'Hotfix emits absolute positive title coordinates');
    const alternate=backend(c.createCanvas(1,1),'web',[]);
    for(const op of groups){const p=adapter.headerPlan(ctx,op),q=adapter.headerPlan(alternate,{...op,shared:{...op.shared}});assert.deepEqual(p.rowTops,q.rowTops,'Vertical layout is independent of baseline metrics');}
   }
   outputs.push({version:side?'0.3.20':'0.3.19',positions});
   const y=100+index*195,x=20+side*1110;sc.fillStyle='white';sc.font='18px sans-serif';sc.fillText(`${side?'Depois: títulos inteiros, coordenadas absolutas':'Antes: títulos saem pelo topo'} | hoje ${day}/10`,x,y);sc.drawImage(canvas,0,0,1092,120,x,y+16,1092,120);sc.strokeStyle='#778';sc.strokeRect(x,y+16,1092,100);
  }
  rows.push({day,outputs});
 }
 const report={base,font:25.5,scenes:3,prior:'all 21 title origins negative',hotfix:'all 21 title origins positive; vertical axes independent of metric convention',nativeMetrics:'simulated baseline values, not measured on physical phone',rows};
 if(process.env.ANCHOR_REPORT)fs.writeFileSync(process.env.ANCHOR_REPORT,JSON.stringify(report,null,2)+'\n');if(process.env.ANCHOR_PREVIEW)fs.writeFileSync(process.env.ANCHOR_PREVIEW,sheet.toBuffer('image/png'));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});
