// Production engine geometry and source rules. No physical iOS scheduler/font claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),{pathToFileURL}=require('node:url');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const raw=fs.readFileSync(path.join(dir,'original-engine.js'),'utf8');
const compile=s=>new(Object.getPrototypeOf(async function(){}).constructor)('host','options',s.replace('export async function renderOriginal(host, options = {}) {','').replace(/}\s*$/,''));
const probe=s=>compile(s.replace('return {temporal:',`return {test:{bridgeY:dayBoundaryMoonBorderTopY(),blur:shouldBlurFutureTimeline(),prepared:preparedItems,chosen:selectedItems,segments:preparedItems.map(i=>timelineBarSegments(i,Math.max(0,timeToX(i.start)),Math.min(timelineWidth(),timeToX(i.end))))},temporal:`));
const flatten=image=>image.ops.flatMap(o=>o.image?.ops?[o,...flatten(o.image)]:[o]);
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
   assert.deepEqual(model.header,before.header,'All seven fixed touch frames and selection preserved');
   const headers=flatten(model.image).filter(o=>o.type==='header');assert.deepEqual(headers,flatten(before.image).filter(o=>o.type==='header'),'Approved typography/row boxes unchanged');
   const ops=flatten(model.image);assert(!ops.some(o=>o.type==='fillRect'&&o.state.fill?.hex==='30D158'&&o.rect.height>300));
   assert(!model.test.blur,'Empty future remains sharp');
   if(h>0)assert(ops.some(o=>o.type==='text'&&o.text===['DOM','SEG','TER','QUA','QUI','SEX','SAB'][(now.getDay()+1)%7]),'Midnight weekday circle label restored');
   const b=model.temporal.rightBridge;
   if(!b.outerEdge){const stroke=ops.find(o=>o.type==='strokePath'&&o.state.stroke?.hex==='FFFFFF'&&o.state.stroke.alpha===0.96);const points=stroke.path.filter(p=>p.length===3);const bridgeY=model.test.bridgeY;assert(points.some(p=>Math.abs(p[1]-(b.edge+b.direction*b.radius))<1e-6&&Math.abs(p[2]-bridgeY)<1e-6),'Actual contour endpoint follows shrinking/inverted right bridge');}
   assert(b.radius>=0&&b.radius<=55);if(!b.outerEdge&&Math.abs(b.boundary-b.edge)>1e-6)assert.equal(b.direction,Math.sign(b.boundary-b.edge));
   const finite=o=>{if(typeof o==='number')assert(Number.isFinite(o));else if(o&&typeof o==='object')for(const [k,v]of Object.entries(o))if(k!=='shared')finite(v)};finite(model.image.outerClip);
   states.push({day,h,midnightX:model.temporal.midnightX,bridge:b});scenes++;
  }
 }
 // Exact leftward movement uses real render time, without moving cards.
 const a=await render(host,options(at(26,10))),b=await render(host,options(at(26,11)));
 assert.equal(a.temporal.midnightX-b.temporal.midnightX,1092/24);assert.deepEqual(a.header,b.header);
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
 const report={scenes,shiftPerHour:1092/24,header:'exact recorded header operations equal 0.3.20',rules:'production follows now; internal static fixtures retain civil day; historical noon/06 carryover on drawing copies; future-only blur; no green now line',states,physicalIOS:'not tested'};
 if(process.env.ROLLING_REPORT)fs.writeFileSync(process.env.ROLLING_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,states:undefined}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={fixture,compile,probe,flatten,raw};
