const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
const old=cp.execFileSync('git',['show','a1aa5d7:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const instrument=s=>compile(s.replace('return {temporal:', 'return {frameProbe:{bridgeY:dayBoundaryMoonBorderTopY(),outline:currentDayOutlinePath().commands},temporal:'));
const isFrame=o=>o.type==='strokePath'&&o.state.stroke?.hex==='FFFFFF'&&o.state.stroke.alpha===0.96;
const normalize=image=>JSON.parse(JSON.stringify(image),(k,v)=>Array.isArray(v)?v.filter(o=>!isFrame(o)):v);
(async()=>{
 const {host,options,d}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');host.DrawContext=class extends d.DrawContext{makeRaster=crop=>({native:{sha256:require('node:crypto').createHash('sha256').update(encodePNG(crop)).digest('hex')},size:{width:crop.width,height:crop.height}})};const render=instrument(raw),before=compile(old),states=[];
 for(let day=25;day<=31;day++)for(const hour of [0,1,6,10+38/60,12,18,21,23+59/60]){
  const now=new Date(2026,9,day,0,Math.round(hour*60)),midnight=new Date(2026,9,day+1),start=new Date(2026,9,day,8);
  const items=[{kind:'event',identifier:'test',title:'SYNTHETIC EVENT',start,end:new Date(+midnight+7200000),color:'#FF9500',isAllDay:false}];
  const o=options(now,items),m=await render(host,o),b=await before(host,o);
  assert.deepEqual(normalize(m.image),normalize(b.image),'Only the white outline changes; backgrounds, masks, type, marker, blur, bars remain exact');
  for(const key of ['header','hourLegend','thermalBand','temporal','windowStart','windowEnd','panel'])assert.deepEqual(m[key],b[key],key+' unchanged');
  const {bridgeY,outline}=m.frameProbe,limit=Math.min(1088,m.temporal.midnightX),strokes=flatten(m.image).filter(isFrame);assert.equal(strokes.length,1,'One white outline stroke');
  let last,lowerSegments=0;
  for(const [op,x,y]of outline){
   assert(Number.isFinite(x)&&Number.isFinite(y));assert(x>=4-1e-6&&x<=1088+1e-6&&y>=4-1e-6&&y<=506+1e-6,'Same outer limits');
   if(Math.abs(y-bridgeY)<1e-6&&x>limit+1e-6){const card=m.header.find(d=>d.selected);assert(x>=card.x-56&&x<=card.x+card.width+56,'No white spur toward far future along top seam');}
   if(op==='lineTo'&&last){
    if(Math.max(last.y,y)>bridgeY+1e-6){
     assert(x<=limit+1e-6&&last.x<=limit+1e-6,'No white timeline frame in tomorrow');lowerSegments++;
     if(limit<1088)assert(!(Math.abs(x-limit)<1e-6&&Math.abs(last.x-limit)<1e-6),'Existing divider owns vertical line, no double stroke through moon/badge');
    }
   }
   last={x,y};
  }
  if(limit>5)assert(lowerSegments>0,'Today keeps its visible lower outline');
  const points=outline.filter(c=>c.length===3),card=m.header.find(d=>d.selected);
  assert(points.some(p=>p[2]===4&&p[1]>=card.x&&p[1]<=card.x+card.width),'Today card still outlined');
  states.push({day,hour:now.getHours()+now.getMinutes()/60,midnightX:m.temporal.midnightX,bridgeY,commands:outline.length});
 }
 // Both sides of the header/body contact threshold in every weekday column.
 for(let day=25;day<=31;day++)for(let minute=0;minute<1440;minute+=137){
  const m=await render(host,options(new Date(2026,9,day,0,minute)));for(const [,x,y]of m.frameProbe.outline)assert(Number.isFinite(x)&&Number.isFinite(y));
 }
 for(const now of [new Date(2026,9,31,23,59),new Date(2026,10,1),new Date(2026,11,31,23,59),new Date(2027,0,1)]){
  const m=await render(host,options(now));assert(m.header.find(d=>d.selected).date===m.focusDate);
 }
 const report={version:'0.3.22',populatedComparisons:states.length,additionalColumnPassages:77,midnightAndYearCases:4,unchanged:'every recorded operation except white frame; same metadata and touch geometry',nativeIOS:'not tested; synthetic Canvas/font substitution',states};
 if(process.env.FRAME_REPORT)fs.writeFileSync(process.env.FRAME_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,states:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
