// Synthetic records only. Exercise the production selection and drawing engine.
const assert=require('node:assert/strict'),cp=require('node:child_process');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
const baseline=cp.execFileSync('git',['show','d0f2da1:scripting/scripts/Calendar Timeline Scripting/original-engine.js'],{encoding:'utf8'});
const probe=s=>compile(s.replace('return {temporal:','return {selected:selectedItems,temporal:'));
const at=(day,h=0,m=0)=>new Date(2026,10,day,h,m);
const reminders=n=>Array.from({length:n},(_,i)=>({kind:'reminder',identifier:'r'+i,title:'SYNTHETIC PENDING TASK '+i,start:at(18),end:at(19),sourceIsAllDay:true,color:'#0088FF'}));
const event=(i=0)=>({kind:'event',identifier:'event'+i,title:'SYNTHETIC ALL DAY '+i,start:at(19),end:at(20),isAllDay:true,color:'#FF0000'});
(async()=>{
 const {host,options}=await fixture(),before=probe(baseline),after=probe(raw);
 const bad=await before(host,options(at(18,21,23),[...reminders(8),event()]));
 assert(!bad.selected.some(i=>i.identifier==='event0'),'Reproduce all-day event hidden by carryover');
 assert(bad.selected.some(i=>i.isOverflow&&i.title==='+1'));
 let scenes=0;
 for(const hour of [0,6,12,18,21.3833,23.9])for(const n of [0,3,6,8,12]){
  const now=new Date(+at(18)+hour*3600000),items=[...reminders(n),event()],saved=JSON.stringify(items);
  const m=await after(host,options(now,items));
  // Tomorrow is outside the 24-hour range only at exactly midnight.
  if(hour>0){
   const e=m.selected.find(i=>i.identifier==='event0');
   assert(e,'Upcoming all-day event retained');
   assert.equal(+e.start,+at(19));assert.equal(+e.end,+at(20));
   assert(flatten(m.image).some(o=>o.type==='text'&&o.text==='SYNTHETIC ALL DAY 0'),'Event title painted');
   for(const r of m.selected.filter(i=>Number.isFinite(i.carryoverClipRight))){
    assert.equal(+r.end,+at(19),'Only artificial continuation clipped at midnight');
    assert(r.carryoverClipRight<m.temporal.midnightX);
   }
  }
  assert.equal(JSON.stringify(items),saved,'No source event/reminder mutation');
  const noEvent=options(now,reminders(n));
  assert.deepEqual((await after(host,noEvent)).image,(await before(host,noEvent)).image,'No all-day conflict: unchanged drawing');
  scenes++;
 }
 for(const count of [2,3]){
  const m=await after(host,options(at(18,21),[...reminders(8),...Array.from({length:count},(_,i)=>event(i))]));
  assert.equal(m.selected.filter(i=>i.identifier?.startsWith('event')).length,count);
 }
 // Never reclaim a real overnight event to display another record.
 const real=Array.from({length:6},(_,i)=>({kind:'event',identifier:'night'+i,title:'SYNTHETIC OVERNIGHT '+i,start:at(18,20),end:at(19,8),color:'#00AAFF'}));
 const m=await after(host,options(at(18,21),[...real,event()]));
 for(const i of m.selected.filter(i=>i.identifier?.startsWith('night')))assert.equal(+i.end,+at(19,8));
 console.log('PASS: '+scenes+' all-day/carryover scenes, multiple events, source immutability, real overnight protection, unchanged unaffected pixels/ops. Native iOS not tested.');
})().catch(e=>{console.error(e);process.exit(1)});
