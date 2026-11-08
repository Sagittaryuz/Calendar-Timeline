// Local-civil rolling header and moving-timeline regression; no native iOS claim.
const assert=require('node:assert/strict'),{fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
process.env.TZ='America/New_York';
const injected=raw.replace('return {temporal:', 'return {frameProbe:{outline:currentDayOutlinePath().commands},temporal:');
const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function expectedHeader(now){const first=new Date(now);first.setHours(0,0,0,0);first.setDate(first.getDate()-8);return Array.from({length:16},(_,i)=>{const day=new Date(first);day.setDate(day.getDate()+i);return key(day)})}
const dates=[
  new Date(2026,2,7,0),new Date(2026,2,8,0),new Date(2026,2,8,23,59),new Date(2026,2,9,0),
  new Date(2026,9,31,0),new Date(2026,10,1,0),new Date(2026,10,1,23,59),new Date(2026,10,2,0),
  new Date(2026,11,31,0),new Date(2027,0,1,0),new Date(2026,3,1,0),new Date(2026,6,15,0)
];
(async()=>{
 const {d,host,options}=await fixture(),render=compile(injected);let scenes=0,midnightTransitions=0,dstCases=0;
 const baseline=new Date(2026,9,27,12),reference=await render(host,options(baseline));
 const geometry=reference.header.map(({y,width,height})=>({y,width,height}));
 for(const now of dates){
  const model=await render(host,options(now)),expected=expectedHeader(now),selected=model.header.filter(day=>day.selected);
  assert.deepEqual(model.header.map(day=>day.date),expected,'Seven consecutive local dates surround the focused civil day');
  assert.equal(model.header.length,16);assert.equal(model.header[8].date,key(now));assert.equal(selected.length,1);assert.equal(selected[0].date,key(now));
  assert.deepEqual(model.header.map(({y,width,height})=>({y,width,height})),geometry,'Card dimensions and vertical geometry do not move with weekday or DST');
  const shift=model.temporal.midnightX-reference.temporal.midnightX;
  for(let i=0;i<16;i++)assert(Math.abs(model.header[i].x-reference.header[i].x-shift)<1e-7,'Every chronological card translates by the lower timeline’s elapsed-time displacement');
  assert(Math.abs(model.header[8].x+4-model.temporal.midnightX)<1e-7,'Today card’s visible left edge follows local midnight on the timeline');
  const edgeGap=(x)=>model.header.some(card=>card.x<=x&&card.x+card.width>=x)?0:Math.min(...model.header.flatMap(card=>[Math.abs(x-card.x),Math.abs(x-card.x-card.width)]));
  const normalGap=model.header[1].x-model.header[0].x-model.header[0].width;assert(edgeGap(4)<=normalGap+1e-7&&edgeGap(1088)<=normalGap+1e-7,'The moving strip covers both sides, allowing only its normal inter-card gap');
  assert.equal(model.windowEnd-model.windowStart,86400000,'The lower 24-hour viewport keeps its existing duration');
  const headers=flatten(model.image).filter(op=>op.type==='header'),expectedHeaders=model.header.filter(day=>(day.x+day.width>4&&day.x<1088)||day.selected).length;assert.equal(headers.length,expectedHeaders);assert.equal(headers.filter(op=>op.isToday).length,1);
  const frames=flatten(model.image).filter(op=>op.type==='strokePath'&&op.state.stroke?.hex==='FFFFFF'&&op.state.stroke.alpha===0.96);assert.equal(frames.length,1,'The today card and moving region share one white frame path');
  const card=model.header[8],outline=model.frameProbe.outline,points=outline.filter(command=>command.length===3);
  const visibleLeft=Math.max(4,card.x+4),visibleRight=Math.min(1088,card.x+card.width-4);
  if(visibleRight>visibleLeft)assert(points.some(p=>p[2]===4&&p[1]>=visibleLeft-1e-7&&p[1]<=visibleRight+1e-7),'Frame path reaches the visible portion of today’s moving card');
  assert(points.every(p=>p[1]>=4-1e-7&&p[1]<=1088+1e-7),'Frame points are clipped to the widget’s rounded contour');
  assert(outline.every(command=>command.slice(1).every(Number.isFinite)),'Frame path remains finite at day, month, year, and DST boundaries');
  if(now.getMonth()===2&&now.getDate()===8||now.getMonth()===10&&now.getDate()===1)dstCases++;
  scenes++;
 }
 for(const day of [new Date(2026,2,8),new Date(2026,10,1),new Date(2026,9,31),new Date(2026,11,31)]){
  const at=new Date(day);at.setHours(0,0,0,0);const noon=new Date(day);noon.setHours(12,0,0,0);const late=new Date(day);late.setHours(23,59,0,0);
  const a=await render(host,options(at)),b=await render(host,options(noon)),c=await render(host,options(late));
  assert.deepEqual(a.header.map(d=>d.date),b.header.map(d=>d.date));assert.deepEqual(b.header.map(d=>d.date),c.header.map(d=>d.date),'Header is stable within the local day');
  assert(a.temporal.midnightX>b.temporal.midnightX&&b.temporal.midnightX>c.temporal.midnightX,'The independent lower timeline advances as local time passes');
  assert(a.windowStart<b.windowStart&&b.windowStart<c.windowStart);assert(a.header[8].x>b.header[8].x&&b.header[8].x>c.header[8].x,'Today card moves left with the timeline during the same local day');assert(Math.abs(a.header[8].x+4-a.temporal.midnightX)<1e-7&&Math.abs(b.header[8].x+4-b.temporal.midnightX)<1e-7&&Math.abs(c.header[8].x+4-c.temporal.midnightX)<1e-7);
  const next=new Date(late);next.setDate(next.getDate()+1);next.setHours(0,0,0,0);const after=await render(host,options(next));
  assert.deepEqual(after.header.map(d=>d.date),expectedHeader(next));assert.equal(after.header[8].date,key(next));assert(Math.abs(after.header[8].x+4-after.temporal.midnightX)<1e-7,'After local midnight, the selected card returns to the matching new timeline boundary');midnightTransitions++;
 }
 const spring=await render(host,options(new Date(2026,2,8,0))),fall=await render(host,options(new Date(2026,10,1,0)));
 assert.equal(spring.temporal.midnightX,1092*23/24,'Spring DST midnight uses local date arithmetic over the existing 24 elapsed-hour timeline');
 assert.equal(fall.temporal.midnightX,1092*25/24,'Fall DST midnight uses local date arithmetic over the existing 24 elapsed-hour timeline');
 assert.equal(dstCases,4,'Both days adjacent to each US DST transition are included');
 const report={version:'0.3.39-preview',timezone:process.env.TZ,scenes,midnightTransitions,dstTransitionDates:dstCases,header:'8 prior / today / 7 future local civil dates; today stays at the timeline anchor and all 16 cards translate in sync with the lower timeline, then labels advance at local midnight',timeline:'same lower 24-hour elapsed window; verified at 00:00, noon, 23:59, year/date rollover, and spring/fall DST midnight',frame:'one finite white outline reaches the visible moving card and follows the same today boundary; detailed seam checked separately',physicalIOS:'not tested; Node local timezone and synthetic widget render only'};
 if(process.env.CENTERED_WEEK_REPORT)require('node:fs').writeFileSync(process.env.CENTERED_WEEK_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1});
