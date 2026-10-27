// Real Canvas metrics in the local backend; synthetic native conventions below.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict'),c=require('@napi-rs/canvas');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
(async()=>{
 const {d,host,options}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');host.DrawContext=class extends d.DrawContext{makeRaster=crop=>({native:{sha256:require('node:crypto').createHash('sha256').update(encodePNG(crop)).digest('hex')},size:{width:crop.width,height:crop.height}})};
 c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','Regular');c.GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf','Heavy');
 const real=c.createCanvas(1,1).getContext('2d'),ctx=new Proxy(real,{set(o,k,v){o[k]=k==='font'?`${v.size}px ${v.name.endsWith('Regular')?'Regular':'Heavy'}`:v;return true},get(o,k){const v=o[k];return typeof v==='function'?v.bind(o):v}});
 const priorSource=cp.execFileSync('git',['show','6566772:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'}),render=compile(raw),prior=compile(priorSource);
 const dates=['2027-01-01','2026-11-11','2026-10-28','2026-12-31','2026-11-01','2026-10-11','2026-06-28','2027-01-31','2026-08-01','2026-07-11','2026-11-28','2026-10-31'];
 const normal=image=>JSON.parse(JSON.stringify(image),(k,v)=>Array.isArray(v)?v.filter(o=>o.type!=='header'):v);
 const examples=[];let scenes=0,headers=0,inkCenterError=0,spaceError=0,anchorError=0;const spaces=new Set();
 for(const date of dates)for(const hour of [12,23]){
  const now=new Date(date+`T${hour}:00:00`),o=options(now);const start=new Date(now);start.setDate(start.getDate()-start.getDay());const key=t=>`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;o.hourlyWeather.daily=Object.fromEntries(Array.from({length:7},(_,i)=>{const t=new Date(start);t.setDate(t.getDate()+i);return [key(t),{minimum:20,maximum:30,symbol:'d0'}]}));
  const m=await render(host,o),old=await prior(host,o);assert.deepEqual(normal(m.image),normal(old.image),'All body operations/bitmaps, blur, frame, timeline and interactions remain unchanged');for(const k of ['header','thermalBand','hourLegend','temporal','panel','windowStart','windowEnd'])assert.deepEqual(m[k],old[k]);
  for(const h of flatten(m.image).filter(o=>o.type==='header')){
   const p=d.headerPlan(ctx,h),withoutDisk=d.headerPlan(ctx,{...h,isToday:false});for(const name of ['word','number','weather','spacing'])assert.deepEqual(p[name],withoutDisk[name],'Disk never changes text geometry or advance');
   const error=Math.abs(p.number.x-p.word.x-p.spacing.wordAdvance-p.spacing.spaceAdvance);spaceError=Math.max(spaceError,error);spaces.add(p.spacing.spaceAdvance.toFixed(9));assert(error<1e-7);
   const a=p.title.bounds,b=p.weather.bounds;let edge;
   if(h.weekday===0){edge=Math.max(Math.abs(a.left-b.left),Math.abs(a.left-h.frame.x-35));assert.equal(p.alignment,'left')}
   else if(h.weekday===6){edge=Math.max(Math.abs(a.right-b.right),Math.abs(a.right-(h.frame.x+h.frame.width-35)));assert.equal(p.alignment,'right')}
   else{edge=Math.max(Math.abs((a.left+a.right)/2-h.frame.x-h.frame.width/2),Math.abs((b.left+b.right)/2-h.frame.x-h.frame.width/2));assert.equal(p.alignment,'center')}
   anchorError=Math.max(anchorError,edge);assert(edge<1e-7);
   if(h.isToday){const ink=d.headerInkBounds(ctx,h.number),cx=(ink.left+ink.right)/2+p.number.x,cy=(ink.top+ink.bottom)/2+p.number.y;const e=Math.hypot(cx-p.circle.x-p.circle.width/2,cy-p.circle.y-p.circle.height/2);inkCenterError=Math.max(inkCenterError,e);assert(e<1e-7);if(hour===12)examples.push({date,weekday:h.weekday,number:h.number.text,spaceAdvance:p.spacing.spaceAdvance,alignment:p.alignment,ink:p.number.ink,circle:p.circle,word:p.word.bounds,weather:p.weather.bounds});}
   headers++;
  }scenes++;
 }
 assert.equal(spaces.size,1,'One exact space advance in every day, weight and date');
 const sample=(await render(host,options(new Date(2026,9,27,12)))).image;const h=flatten(sample).find(o=>o.type==='header'&&o.isToday);const modes=[];
 for(const [name,top,alpha,fontAscent,expected]of [['web-top',[-6,27],[21,0],27,16.5],['uikit-top-box',[0,35],[0,35],27.5,17.5],['uikit-baseline',[21,0],[21,0],27.5,17]]){
  const mock={font:null,textBaseline:'top',measureText:text=>({width:text.length*17.46,actualBoundingBoxAscent:(mock.textBaseline==='alphabetic'?alpha:top)[0],actualBoundingBoxDescent:(mock.textBaseline==='alphabetic'?alpha:top)[1],fontBoundingBoxAscent:fontAscent})};const b=d.headerInkBounds(mock,h.number);assert.equal((b.top+b.bottom)/2,expected);assert.notEqual(expected,29/2,'Old nominal line-box center would fail');modes.push({name,expectedCenter:expected,mode:b.metricMode});
 }
 const report={version:'0.3.25',scenes,headers,inkCenterError,spaceError,anchorError,spaceAdvance:[...spaces],weekendInset:35,weatherSpacing:'only gaps around existing icon compacted, fonts/values/icons retained',metricsModes:modes,examples,physicalIOS:'not tested; local DejaVu glyph measurements, native convention models; actual host measurements are used at runtime'};
 if(process.env.ALIGN_REPORT)fs.writeFileSync(process.env.ALIGN_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,examples:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
