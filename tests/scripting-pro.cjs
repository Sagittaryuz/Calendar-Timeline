const assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const {buildSync}=require('esbuild');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
function load(name,globals={}){
 const code=buildSync({entryPoints:[path.join(dir,name)],bundle:true,write:false,platform:'node',format:'cjs',external:['scripting']}).outputFiles[0].text;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,Date,console,require:()=>({}),...globals});return module.exports;
}
const {analyzeDay,parseDay}=load('day-model.ts'),date='2026-10-23';
const event=(title,a,b,availability='busy')=>({id:title,title,start:date+'T'+a+':00-03:00',end:date+'T'+b+':00-03:00',isAllDay:false,availability});
assert.throws(()=>parseDay('2026-02-30'));assert.throws(()=>parseDay('2026-13-01'));
const result=analyzeDay([event('A','09:00','11:00'),event('B','10:00','12:00'),event('Free','14:00','15:00','free')],[],date);
assert.equal(result.conflicts.length,1);assert.equal(result.slots.length,2);assert.equal(new Date(result.slots[0].end).getTime(),Date.parse(date+'T09:00:00-03:00'));
assert.equal(new Date(result.slots[1].start).getTime(),Date.parse(date+'T12:00:00-03:00'));
assert.equal(analyzeDay([],[],date,false,true).slots.length,0,'Failed calendar read cannot imply a free day');
const {validateDraft}=load('create-item.ts');
assert.equal(validateDraft({kind:'reminder',title:'Teste',due:''}).due,null);
assert.equal(validateDraft({kind:'event',title:'Teste',start:date,end:'2026-10-24'}).isAllDay,true);
for(const draft of [
 {kind:'event',title:'Teste',start:date,end:date},
 {kind:'event',title:'Teste',start:date+'T12:00:00-03:00',end:date+'T11:00:00-03:00'},
 {kind:'event',title:'Teste',start:date,end:date+'T12:00:00Z'},
 {kind:'reminder',title:'Teste',due:'2026-02-30T12:00:00Z'},
 {kind:'reminder',title:'',due:null},
 {kind:'reminder',title:'Teste',due:date+'T25:00:00Z'}
])assert.throws(()=>validateDraft(draft));
(async()=>{
 const values=new Map();let saves=0,queries=0;const calendar={identifier:'c',title:'Pessoal',allowsContentModifications:true,type:'local'};let item;
 class NativeReminder{constructor(){this.hasRecurrenceRules=false;this.hasAttendees=false;this.isCompleted=false}async save(){saves++;this.identifier='r';item=this}}
 const actions=[1,0,0],prompts=['Lembrar de testar','Teste','2026-10-24T09:00:00-03:00'];
 const api=load('create-item.ts',{Storage:{get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,v);return true},remove:k=>values.delete(k)},
  LanguageModelSession:class{static isAvailable=true;async respond(){return {json:{kind:'reminder',title:'Teste',due:'2026-10-24T09:00:00-03:00'}}}dispose(){}},
  Dialog:{prompt:async()=>prompts.shift(),actionSheet:async()=>actions.shift()},Calendar:{forReminders:async()=>[calendar]},
  DateComponents:{fromDate:d=>({year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate(),hour:d.getHours(),minute:d.getMinutes()})},
  Reminder:Object.assign(NativeReminder,{getAll:async()=>{queries++;return item?[item]:[]}})});
 const r=await api.createItem();assert.equal(r.status,'applied');assert.equal(saves,1);assert(queries>=2,'Creation is queried and reread');assert.equal(values.has('pro-create-pending'),false);
 assert.equal(await api.resumeCreate(),null);assert.equal(saves,1,'No duplicate save after success');
 console.log('PASS Pro: conflicts/free intervals/partial coverage, invalid and all-day dates, explicit review/destination, journal and native save/reread via mocks. iPhone remains untested.');
})().catch(e=>{console.error(e);process.exitCode=1});
