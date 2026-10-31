// Local-civil rolling header and moving-timeline regression; no native iOS claim.
const assert=require('node:assert/strict'),{fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
process.env.TZ='America/New_York';
const injected=raw.replace('return {temporal:', 'return {frameProbe:{outline:currentDayOutlinePath().commands},temporal:');
const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function expectedHeader(now){const first=new Date(now);first.setHours(0,0,0,0);first.setDate(first.getDate()-3);return Array.from({length:7},(_,i)=>{const day=new Date(first);day.setDate(day.getDate()+i);return key(day)})}
const dates=[
  new Date(2026,2,7,0),new Date(2026,2,8,0),new Date(2026,2,8,23,59),new Date(2026,2,9,0),
  new Date(2026,9,31,0),new Date(2026,10,1,0),new Date(2026,10,1,23,59),new Date(2026,10,2,0),
  new Date(2026,11,31,0),new Date(2027,0,1,0),new Date(2026,3,1,0),new Date(2026,6,15,0)
];
(async()=>{
 const {d,host,options}=await fixture(),render=compile(injected),cardRects=[];let scenes=0,midnightTransitions=0,dstCases=0;
 const baseline=new Date(2026,9,27,12),reference=await render(host,options(baseline));
 const geometry=reference.header.map(({x,y,width,height})=>({x,y,width,height}));
 for(const now of dates){
  const model=await render(host,options(now)),expected=expectedHeader(now),selected=model.header.filter(day=>day.selected);
  assert.deepEqual(model.header.map(day=>day.date),expected,'Seven consecutive local dates surround the focused civil day');
  assert.equal(model.header.length,7);assert.equal(model.header[3].date,key(now));assert.equal(selected.length,1);assert.equal(selected[0].date,key(now));
  assert.deepEqual(model.header.map(({x,y,width,height})=>({x,y,width,height})),geometry,'Card/touch geometry does not move with weekday or DST');
  assert.equal(model.windowEnd-model.windowStart,86400000,'The lower 24-hour viewport keeps its existing duration');
  const headers=flatten(model.image).filter(op=>op.type==='header');assert.equal(headers.length,7);assert.equal(headers.filter(op=>op.isToday).length,1);
  const frames=flatten(model.image).filter(op=>op.type==='strokePath'&&op.state.stroke?.hex==='FFFFFF'&&op.state.stroke.alpha===0.96);assert.equal(frames.length,1,'The today card and moving region share one white frame path');
  const card=model.header[3],outline=model.frameProbe.outline,points=outline.filter(command=>command.length===3);
  assert(points.some(p=>p[2]===4&&p[1]>=card.x&&p[1]<=card.x+card.width),'Frame path reaches the centered today card');
  assert(outline.every(command=>command.slice(1).every(Number.isFinite)),'Frame path remains finite at day, month, year, and DST boundaries');
  if(now.getMonth()===2&&now.getDate()===8||now.getMonth()===10&&now.getDate()===1)dstCases++;
  scenes++;
 }
 for(const day of [new Date(2026,2,8),new Date(2026,10,1),new Date(2026,9,31),new Date(2026,11,31)]){
  const at=new Date(day);at.setHours(0,0,0,0);const noon=new Date(day);noon.setHours(12,0,0,0);const late=new Date(day);late.setHours(23,59,0,0);
  const a=await render(host,options(at)),b=await render(host,options(noon)),c=await render(host,options(late));
  assert.deepEqual(a.header.map(d=>d.date),b.header.map(d=>d.date));assert.deepEqual(b.header.map(d=>d.date),c.header.map(d=>d.date),'Header is stable within the local day');
  assert(a.temporal.midnightX>b.temporal.midnightX&&b.temporal.midnightX>c.temporal.midnightX,'The independent lower timeline advances as local time passes');
  assert(a.windowStart<b.windowStart&&b.windowStart<c.windowStart);assert.equal(a.header[3].x,b.header[3].x);assert.equal(b.header[3].x,c.header[3].x);
  const next=new Date(late);next.setDate(next.getDate()+1);next.setHours(0,0,0,0);const after=await render(host,options(next));
  assert.deepEqual(after.header.map(d=>d.date),expectedHeader(next));assert.equal(after.header[3].date,key(next));assert.equal(after.header[3].x,c.header[3].x,'Only the header dates advance at local midnight; slot stays centered');midnightTransitions++;
 }
 assert.equal(dstCases,4,'Both days adjacent to each US DST transition are included');
 const report={version:'0.3.33-preview',timezone:process.env.TZ,scenes,midnightTransitions,dstTransitionDates:dstCases,header:'3 prior / today / 3 future local civil dates; slot 4 selected; unchanged intraday geometry',timeline:'same lower 24-hour window advances independently; verified at 00:00, noon, 23:59, and rollover',frame:'single finite white outline reaches centered card; detailed continuity checked separately',physicalIOS:'not tested; Node local timezone and synthetic widget render only'};
 if(process.env.CENTERED_WEEK_REPORT)require('node:fs').writeFileSync(process.env.CENTERED_WEEK_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
