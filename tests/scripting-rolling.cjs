// Production engine geometry and source rules. No physical iOS scheduler/font claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const raw=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8');
const compile=s=>new(Object.getPrototypeOf(async function(){}).constructor)('host','options',s.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
const probe=s=>compile(s.replace('return {temporal:',`return {test:{bridgeY:dayBoundaryMoonBorderTopY(),blur:shouldBlurFutureTimeline(),prepared:preparedItems,chosen:selectedItems,segments:preparedItems.map(i=>timelineBarSegments(i,Math.max(0,timeToX(i.start)),Math.min(timelineWidth(),timeToX(i.end))))},temporal:`));
const flatten=image=>image.ops.flatMap(o=>o.image?.ops?[o,...flatten(o.image)]:[o]);
function assertHeaderCoversEdges(header){
 const gap=header[1].x-header[0].x-header[0].width;
 for(const edge of [4,1088]){
  const distance=header.some(card=>card.x<=edge&&card.x+card.width>=edge)?0:
   Math.min(...header.flatMap(card=>[Math.abs(edge-card.x),Math.abs(edge-card.x-card.width)]));
  assert(distance<=gap+1e-7,`Moving header reaches canvas edge ${edge} with at most its normal card gap`);
 }
 const visible=header.filter(card=>card.x+card.width>4&&card.x<1088);
 assert(visible.length>0);assert.equal(visible[0].edgeAlignment,'right','First visible card aligns its paired lines at the right');
 assert.equal(visible.at(-1).edgeAlignment,'left','Last visible card aligns its paired lines at the left');
 for(const card of visible.slice(1,-1))assert.equal(card.edgeAlignment,'center','Interior visible cards stay centered');
}
async function fixture(){
 const d=await import(pathToFileURL(path.join(dir,'drawing.js')).href);
 const host={...d,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},FileManager:{local:()=>({documentsDirectory:()=>'/cache',joinPath:(a,b)=>a+'/'+b,fileExists:()=>false})},SFSymbol:{named:symbol=>({image:{symbol,size:{width:30,height:30}},applyFont(){}})}};
 const options=(now,items=[],extra={})=>({now:+now,focusDate:+now,loadResult:{items,holidayDates:new Set(),error:null},astronomy:{latitude:0,longitude:0},hourlyWeather:{hours:[],daily:{}},holidayDates:new Set(),...extra});
 return {d,host,options};
}
async function main(){
 const {host,options}=await fixture(),render=probe(raw),old=compile(cp.execFileSync('git',['show','3f4199d:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'}));
 const at=(day,h=0,m=0)=>new Date(2026,9,day,h,m),item=(kind,start,end,extra={})=>({kind,start,end,identifier:kind,title:'SYNTHETIC '+kind,color:'#FF9500',isAllDay:false,...extra});
 let scenes=0;const states=[];
 for(const day of [25,26,27,28,29,30,31]){
  const first=await render(host,options(at(day))),edge=first.temporal.rightBridge.edge,cross=24*(1-edge/1092);
  const times=[0,6,12,18,23+59/60,...(day===31?[]:[cross-1/60,cross,cross+1/60])];
  for(const h of times){
   const now=new Date(+at(day)+h*3600000),o=options(now),model=await render(host,o),before=await old(host,o);
   assert.equal(model.windowStart,+new Date(now.setSeconds(0,0)));assert.equal(model.windowEnd-model.windowStart,86400000);assert.equal(model.nowMarker,null);
   assert.equal(model.header.length,16,'The moving strip draws all dates needed to cover the viewport');assert.equal(model.header[8].date,model.focusDate,'Today keeps its temporal anchor at its natural moving position');assert.equal(model.header.filter(d=>d.selected).length,1);
   assert(Math.abs(model.header[8].x+4-model.temporal.midnightX)<1e-7,'Today card’s visible left edge follows today’s timeline endpoint');assertHeaderCoversEdges(model.header);
   for(let i=0;i<6;i++)assert(Math.abs(model.header[i+1].x-model.header[i].x-model.header[i].width-1.2287)<1e-7,'Card width and approved gap stay constant while the ribbon moves');
   const headers=flatten(model.image).filter(o=>o.type==='header'),expectedHeaders=model.header.filter(card=>(card.x+card.width>4&&card.x<1088)||card.selected).length;assert.equal(headers.length,expectedHeaders,'The full 16-date range is modeled; only visible cards and today’s offscreen anchor are drawn');
   const ops=flatten(model.image);assert(!ops.some(o=>o.type==='fillRect'&&o.state.fill?.hex==='30D158'&&o.rect.height>300));
   assert(!model.test.blur,'Empty future remains sharp');
   if(h>0)assert(ops.some(o=>o.type==='text'&&o.text===['DOM','SEG','TER','QUA','QUI','SEX','SAB'][(now.getDay()+1)%7]),'Midnight weekday circle label restored');
   const b=model.temporal.rightBridge;
   if(!b.outerEdge){const stroke=ops.find(o=>o.type==='strokePath'&&o.state.stroke?.hex==='FFFFFF'&&o.state.stroke.alpha===0.96);const points=stroke.path.filter(p=>p.length===3);const bridgeY=model.test.bridgeY,target=b.edge+b.direction*b.radius;if(target>=4-1e-6&&target<=1088+1e-6)assert(points.some(p=>Math.abs(p[1]-target)<1e-6&&Math.abs(p[2]-bridgeY)<1e-6),'Visible contour endpoint follows the shrinking/inverted right bridge');else assert(points.every(p=>p[1]>=4-1e-6&&p[1]<=1088+1e-6),'Off-canvas bridge endpoints are clipped to the widget contour');}
   assert(b.radius>=0&&b.radius<=55);if(!b.outerEdge&&Math.abs(b.boundary-b.edge)>1e-6)assert.equal(b.direction,Math.sign(b.boundary-b.edge));
   const finite=o=>{if(typeof o==='number')assert(Number.isFinite(o));else if(o&&typeof o==='object')for(const [k,v]of Object.entries(o))if(k!=='shared')finite(v)};finite(model.image.outerClip);
   states.push({day,h,midnightX:model.temporal.midnightX,bridge:b});scenes++;
  }
 }
 // The header ribbon uses the lower timeline's same px/hour time basis.
 const a=await render(host,options(at(26,10))),b=await render(host,options(at(26,11)));
 assert.equal(a.temporal.midnightX-b.temporal.midnightX,1092/24);assert.deepEqual(a.header.map(d=>d.date),b.header.map(d=>d.date),'Civil-day labels remain stable intraday');
 for(let i=0;i<a.header.length;i++){assert.equal(a.header[i].width,b.header[i].width);assert(Math.abs(a.header[i].x-b.header[i].x-1092/24)<1e-7,'Every day card moves left with the timeline');}assertHeaderCoversEdges(a.header);assertHeaderCoversEdges(b.header);
 assert(Math.abs(a.header[8].x+4-a.temporal.midnightX)<1e-7);assert(Math.abs(b.header[8].x+4-b.temporal.midnightX)<1e-7);
 const other=await render(host,options(at(26,11),[],{focusDate:+at(27)}));assert(!other.temporal.rolling);assert.equal(other.windowStart,+at(27));assert.equal(other.windowEnd,+at(28));
 const event=item('event',at(26,23),at(27,2));
 const pending=item('reminder',at(26,8),at(27),{sourceIsAllDay:false});
 const future=item('event',at(27,3),at(27,4));
 const originalEnd=+pending.end;
 const noon=await render(host,options(at(26,12),[event,pending,future]));assert(noon.test.blur);
 assert.equal(+noon.test.prepared[0].end,+event.end,'Real event duration preserved');
 assert.equal(+noon.test.prepared[1].end,+at(27,6));assert.equal(+pending.end,originalEnd,'Source reminder untouched');
 assert(noon.test.prepared[1].isPendingDayCarryover);assert.equal(noon.test.segments[1].length,1,'Carryover is a single continuous bar');
 assert(flatten(noon.image).some(o=>o.type==='image'&&o.image.blurRadius),'Actual future blur image emitted');
 for(const [label,items,blur] of [
  ['empty',[],false],['all-day',[item('event',at(26),at(27),{isAllDay:true})],false],
  ['birthday',[item('event',at(26),at(27),{isBirthday:true})],false],
  ['completed',[item('reminder',at(26),at(27),{isCompleted:true})],false],
  ['ended',[item('event',at(26,8),at(26,9))],false],['tomorrow',[future],false],['timed-today',[event],true],['pending-today',[pending],true]
 ])assert.equal((await render(host,options(at(26,15),items))).test.blur,blur,label);
 const beforeNoon=await render(host,options(at(26,11,59),[pending]));assert(!beforeNoon.test.prepared[0].isPendingDayCarryover);
 const dueLater=item('reminder',at(26,20),at(27));assert(!(await render(host,options(at(26,15),[dueLater]))).test.prepared[0].isPendingDayCarryover);
 const error=await render(host,options(at(26,15),[],{loadResult:{items:[],holidayDates:new Set(),error:'offline'}}));assert(error.test.blur,'Unreadable future protected as in historical rule');
 for(const date of [new Date(2026,11,31,23,59),new Date(2027,0,1),new Date(2026,10,1),new Date(2026,2,8),new Date(2026,10,1,1,59),new Date(2026,10,1,2,1)]){
  const m=await render(host,options(date));assert.equal(m.windowEnd-m.windowStart,86400000);assert(m.temporal.midnightX>=0&&m.temporal.midnightX<=1092*25/24);scenes++;
 }
 const report={scenes,shiftPerHour:1092/24,header:'16 chronological local civil dates: eight prior, today, seven future; today follows the lower timeline boundary and all cards translate 45.5 logical px/hour; the visible strip reaches both canvas edges while today may naturally be outside the viewport',rules:'production follows now; labels advance on local date change; internal static fixtures retain seven-day civil range; historical noon/06 carryover on drawing copies; future-only blur; no green now line',states,physicalIOS:'not tested'};
 if(process.env.ROLLING_REPORT)fs.writeFileSync(process.env.ROLLING_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,states:undefined}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={fixture,compile,probe,flatten,raw};
