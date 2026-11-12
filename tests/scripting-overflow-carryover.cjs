// Real selection/drawing engine with synthetic agenda, never personal records.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baseline=cp.execFileSync('git',['show',`100531a:${engine}`],{encoding:'utf8'});
const probe=s=>compile(s.replace('return {temporal:','return {selected:selectedItems,temporal:'));
const at=(day,h=0,m=0)=>new Date(2026,10,day,h,m);
const reminders=(count,day=12)=>Array.from({length:count},(_,i)=>({kind:'reminder',identifier:`r${day}-${i}`,title:'SYNTHETIC TASK '+i,start:at(day),end:at(day+1),sourceIsAllDay:true,color:'#0088FF'}));
async function main(){
 const {host,options}=await fixture(),before=probe(baseline),after=probe(raw);
 const bad=await before(host,options(at(12,12,55),reminders(8)));
 assert.equal(bad.selected.filter(i=>i.isOverflow).length,0,'Baseline reproduces missing +2 after noon');
 let count=0;
 for(const hour of [0,6,11.99,12,12.9167,18,21,22,23.9])for(const n of [0,1,5,6,7,8,9,10,20]){
  const now=new Date(+at(12)+hour*3600000),items=reminders(n),original=JSON.stringify(items);
  const [old,m]=await Promise.all([before(host,options(now,items)),after(host,options(now,items))]);
  assert.equal(JSON.stringify(items),original,'Source agenda unchanged');
  const normal=m.selected.filter(i=>!i.isOverflow),oldNormal=old.selected.filter(i=>!i.isOverflow);
  assert.deepEqual(normal.map(i=>[i.identifier,+i.start,+i.end,i.gridRow]),oldNormal.map(i=>[i.identifier,+i.start,+i.end,i.gridRow]),'Bar time, priority and row unchanged');
  const badges=m.selected.filter(i=>i.isOverflow);
  const room=m.temporal.midnightX>65;
  assert.equal(badges.length,n>6&&room?1:0,'One daily badge only when there are hidden records and enough width');
  if(badges.length){
   assert.equal(badges[0].title,'+'+(n-6));
   assert(badges[0].markerX>=0&&badges[0].markerX+62<=m.temporal.midnightX,'Badge stays inside its civil day');
   assert(flatten(m.image).some(o=>o.type==='text'&&o.text===badges[0].title),'Badge is painted, not only selected');
  }
  if(n<=6) assert.deepEqual(m.image,old.image,'No-overflow drawing stays identical');
  count++;
 }
 // Calendar may also list an ended morning event and a birthday. Neither
 // should inflate the hidden active/reminder count; birthday has its own band.
 const mixed=[...reminders(8),
  {kind:'event',identifier:'past',title:'PAST SYNTHETIC EVENT',start:at(12,9),end:at(12,10),color:'#FF0000'},
  {kind:'event',identifier:'birthday',title:'SYNTHETIC BIRTHDAY',start:at(12),end:at(13),isBirthday:true,isAllDay:true,color:'#FF00FF'}];
 const mixedModel=await after(host,options(at(12,12,55),mixed));
 assert.deepEqual(mixedModel.selected.filter(i=>i.isOverflow).map(i=>i.title),['+2']);
 assert(!mixedModel.selected.some(i=>i.identifier==='past'));
 // Both day counts remain separate when today extends into tomorrow.
 for(const n of [7,8,10]){
  const items=[...reminders(8),...reminders(n,13)];
  const m=await after(host,options(at(12,12,55),items));
  const badges=m.selected.filter(i=>i.isOverflow);
  assert.equal(badges.filter(i=>+i.overflowDayStart===+at(12)).length,1);
  assert.equal(badges.find(i=>+i.overflowDayStart===+at(12)).title,'+2');
 }
 console.log(`PASS: ${count} carryover/overflow scenes plus multi-day checks; native iPhone not tested`);
}
main().catch(e=>{console.error(e);process.exit(1)});
