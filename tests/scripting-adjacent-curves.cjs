// Offset geometry from the production path; no native iPhone rendering claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),c=require('@napi-rs/canvas');
const {fixture,compile,raw}=require('./scripting-rolling.cjs');
const instrument=raw.replace('path.closeSubpath();return dayCardNeighbourClip.cache=path.commands;',`path.closeSubpath();host.neighbourProbe?.({vertices,points,offset,bridge,y:dayBoundaryMoonBorderTopY(),card:titleDayCardRect(titleTodayCardIndex()),gap:titleCardGap(),halfStroke:scaleVertical(3)/2,maxRadius:Math.min(WIDGET_COMMON_CORNER_RADIUS,(dayBoundaryMoonBorderTopY()-titleDayCardRect(titleTodayCardIndex()).y)/2),commands:path.commands});return dayCardNeighbourClip.cache=path.commands;`).replace("ctx.setFillColor(new Color('#303136',0.82));\n  ctx.fillRect(new Rect(left,top,card.x+2-left,bottom-top));", "host.extensionProbe?.({date:dateKey(date),card,left,top,bottom,bridge});ctx.setFillColor(new Color('#303136',0.82));\n  ctx.fillRect(new Rect(left,top,card.x+2-left,bottom-top));");
const beforeSource=cp.execFileSync('git',['show','75e9812:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
function dist(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
const polyDistance=(p,poly)=>Math.min(...poly.map((a,i)=>dist(p,a,poly[(i+1)%poly.length])));
function crossed(a,b,c,d){const turn=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return turn(a,b,c)*turn(a,b,d)<-1e-10&&turn(c,d,a)*turn(c,d,b)<-1e-10}
(async()=>{
 const {d,host,options}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');host.DrawContext=class extends d.DrawContext{makeRaster=crop=>({native:{sha256:require('node:crypto').createHash('sha256').update(encodePNG(crop)).digest('hex')},size:{width:crop.width,height:crop.height}})};
 const render=compile(instrument),before=compile(beforeSource);let probe,extensions=[];host.neighbourProbe=x=>probe=x;host.extensionProbe=x=>extensions.push(x);
 let scenes=0,samples=0,gapError=0,maxCoordinate=0,cusps=0;const states=[];
 for(let day=25;day<=31;day++)for(const minute of [0,60,6*60,12*60,13*60+47,13*60+49,14*60,18*60,23*60+59]){
  const now=new Date(2026,9,day,0,minute),o=options(now);extensions=[];probe=null;
  const m=await render(host,o),b=await before(host,o);assert.equal(m.header.length,7);assert.equal(m.header[3].date,m.focusDate);assert.deepEqual(m.header.map(h=>({x:h.x,width:h.width})),b.header.map(h=>({x:h.x,width:h.width})),'Header slot geometry stays fixed');assert.deepEqual(m.hourLegend,b.hourLegend);assert.deepEqual(m.thermalBand,b.thermalBand);assert.equal(m.temporal.midnightX,b.temporal.midnightX);
  assert(probe);const {vertices,points,offset,bridge,y,card,gap,halfStroke,maxRadius}=probe;
  assert.equal(gap,1.2287,'Approved raw card gap is unchanged');assert(Math.abs(offset-halfStroke-gap)<1e-10);
  assert(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  for(const p of points){maxCoordinate=Math.max(maxCoordinate,Math.abs(p.x),Math.abs(p.y));assert(p.x>=-offset-5&&p.x<=1092+offset+5&&p.y>=-offset-5&&p.y<=510+offset+5,'No divergent cusp miter')}
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++)if(!(i===0&&j===points.length-1))assert(!crossed(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]),'Offset polygon remains simple '+JSON.stringify({day,minute,bridge,i,j,a:points[i],b:points[(i+1)%points.length],c:points[j],d:points[(j+1)%points.length]}));
  const mask=c.createCanvas(1092,510).getContext('2d');mask.beginPath();for(const [method,...args]of probe.commands)mask[method](...args);
  for(let i=0;i<vertices.length;i++){
   const a=vertices[i],z=vertices[(i+1)%vertices.length],dx=z.x-a.x,dy=z.y-a.y,length=Math.hypot(dx,dy);if(length<1e-7||Math.abs(dx)<1e-7||Math.abs(dy)<1e-7)continue;
   const left=card.x+4,right=card.x+card.width-4;
   const onLeft=day!==25&&Math.min(a.x,z.x)>=left-maxRadius-1e-6&&Math.max(a.x,z.x)<=left+1e-6;
   const onRight=!bridge.outerEdge&&bridge.radius>offset&&Math.min(a.x,z.x)>=right-maxRadius-1e-6&&Math.max(a.x,z.x)<=right+maxRadius+1e-6;
   if(!onLeft&&!onRight||Math.min(a.y,z.y)<y-maxRadius-1e-6||Math.max(a.y,z.y)>y+1e-6)continue;
   const normal={x:dy/length,y:-dx/length},p={x:(a.x+z.x)/2+normal.x*offset,y:(a.y+z.y)/2+normal.y*offset};
   if(p.y>y-offset-1e-6)continue;
   const error=polyDistance(p,points);assert(error<1e-6,'Neighbour follows the exact master-curve offset');gapError=Math.max(gapError,Math.abs(polyDistance(p,vertices)-halfStroke-gap));samples++;
   const outside={x:p.x+normal.x*0.05,y:p.y+normal.y*0.05};assert(mask.isPointInPath(outside.x,outside.y),'Outside of selected offset belongs to neighbour mask');
   const inside={x:p.x-normal.x*0.05,y:p.y-normal.y*0.05};assert(!mask.isPointInPath(inside.x,inside.y),'Clear gap remains unpainted');
  }
  if(bridge.direction<0&&!bridge.outerEdge){assert(extensions.length<=1);if(extensions.length){const next=new Date(now);next.setDate(next.getDate()+1);assert.equal(extensions[0].date,`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`);assert.equal(m.header[4].date,extensions[0].date,'The cusp follows the next chronological header slot');assert(extensions[0].top>card.y+card.height/3,'Extension only affects lower corner');cusps++;}}
  else assert.equal(extensions.length,0,'No extension before inversion or at the outer Saturday edge');
  states.push({date:now.toISOString(),bridge,extensions:extensions.map(e=>({date:e.date,left:e.left,top:e.top,bottom:e.bottom})),points:points.length});scenes++;
 }
 assert(samples>1000);assert(gapError<1e-6);assert(cusps>0);
 const report={version:'0.3.33-preview',scenes,samples,approvedGap:1.2287,gapError,maxCoordinate,cusps,geometry:'one common master curve, normal offset by half stroke + approved gap; inward cusp trimmed against offset timeline plane; only next chronological slot lower-left corner extended',frames:'centered today slot stays fixed while the continuous lower timeline advances',states,physicalIOS:'not tested; local path geometry and raster-mask queries'};
 if(process.env.ADJ_REPORT)fs.writeFileSync(process.env.ADJ_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,states:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
