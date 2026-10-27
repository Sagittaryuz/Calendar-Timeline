// Production paths and bitmaps; synthetic data, no native iPhone claim.
const assert=require('node:assert/strict'),cp=require('node:child_process'),fs=require('node:fs');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
const old=cp.execFileSync('git',['show','4bec9e3:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const inject=s=>compile(s.replace('  return path;\n}\n\nfunction drawCurrentDayFrameOverlay','  host.frameProbe?.({headerSpan,bodySpan,right,bridgeY,commands:path.commands});return path;\n}\n\nfunction drawCurrentDayFrameOverlay'));
const isFrame=o=>o.type==='strokePath'&&o.state.stroke?.hex==='FFFFFF'&&o.state.stroke.alpha===0.96;
const normal=image=>JSON.parse(JSON.stringify(image),(k,v)=>Array.isArray(v)?v.filter(o=>!isFrame(o)):v);
(async()=>{
 const {host,d,options}=await fixture(),{encodePNG}=await import('../scripting/scripts/Calendar%20Timeline%20Scripting/rect-raster.js');host.DrawContext=class extends d.DrawContext{makeRaster=crop=>({native:{sha256:require('node:crypto').createHash('sha256').update(encodePNG(crop)).digest('hex')},size:{width:crop.width,height:crop.height}})};
 const render=inject(raw),before=inject(old);let probe;host.frameProbe=p=>probe=p;const states=[];let gapsFixed=0;
 async function check(now){
  const o=options(now),b=await before(host,o),prior=probe,m=await render(host,o),p=probe;
  assert.deepEqual(normal(m.image),normal(b.image),'Every other draw operation/bitmap, header and mask unchanged');
  for(const key of ['header','hourLegend','thermalBand','temporal','panel','windowStart','windowEnd'])assert.deepEqual(m[key],b[key]);
  assert.equal(flatten(m.image).filter(isFrame).length,1,'Same single white stroke');
  const gap=p.headerSpan&&p.headerSpan[0]-Math.max(4,p.right)>1e-7;
  if(gap){
   const connector=[['moveTo',Math.max(4,p.right),p.bridgeY],['lineTo',p.headerSpan[0],p.bridgeY]];
   assert.deepEqual(p.commands.slice(-2),connector);assert.deepEqual(p.commands.slice(0,-2),prior.commands,'Only the missing connector was added');
   const mid=(connector[0][1]+connector[1][1])/2;let coverage=0,last;
   for(const [op,x,y]of p.commands){if(op==='lineTo'&&last&&Math.abs(y-p.bridgeY)<1e-7&&Math.abs(last.y-y)<1e-7&&mid>Math.min(x,last.x)&&mid<Math.max(x,last.x))coverage++;last={x,y}}
   assert.equal(coverage,1,'Gap closed once, no duplicated horizontal thickness');gapsFixed++;
  }else assert.deepEqual(p.commands,prior.commands,'No connector when the original outlines already touch');
  let last;for(const [op,x,y]of p.commands){assert(Number.isFinite(x)&&Number.isFinite(y));if(op==='lineTo'&&last&&Math.max(y,last.y)>p.bridgeY+1e-7)assert(Math.max(x,last.x)<=p.right+1e-7,'Lower frame never extends into tomorrow');last={x,y}}
  states.push({date:now.toISOString(),midnightX:p.right,headerStart:p.headerSpan?.[0],gapFixed:!!gap});return p;
 }
 for(let day=25;day<=31;day++){
  const first=await check(new Date(2026,9,day)),cross=Math.floor(1440*(1-first.headerSpan[0]/1092));
  for(const minute of new Set([1,720,1200,1439,cross-1,cross,cross+1].filter(x=>x>=0&&x<1440)))await check(new Date(2026,9,day,0,minute));
 }
 for(const date of ['2026-11-01T00:00:00','2026-12-31T23:59:00','2027-01-01T00:00:00'])await check(new Date(date));
 assert(gapsFixed>0);assert(states.some(s=>s.date.startsWith('2026-10-27T20:00')&&s.gapFixed),'Physical screenshot gap reproduced by synthetic geometry');
 const report={version:'0.3.28',scenes:states.length,gapsFixed,regression:'0.3.27 leaves a disconnected top seam once midnight is left of today header shoulder',change:'one missing horizontal connector in existing single white stroke; all other commands and bitmaps unchanged',physicalIOS:'reference JPEG inspected; fix validated synthetically, no physical iPhone execution',states};
 if(process.env.FRAME_CONTINUITY_REPORT)fs.writeFileSync(process.env.FRAME_CONTINUITY_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,states:undefined}));
})().catch(e=>{console.error(e);process.exitCode=1});
