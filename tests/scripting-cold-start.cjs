// Deterministic startup failures: no personal agenda and no live network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict'),{transformSync}=require('esbuild');
const {fixture,compile,raw}=require('./scripting-rolling.cjs');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
function load(text,deps,extra){const m={exports:{}};vm.runInNewContext(transformSync(text,{loader:'ts',format:'cjs'}).code,{module:m,exports:m.exports,require:n=>deps[n],Date,URL,setTimeout,clearTimeout,...extra});return m.exports}
(async()=>{
 const {d}=await fixture(),values=new Map(),storage={contains:k=>values.has(k),get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,v);return true},remove:k=>values.delete(k)};
 const globals={Storage:storage,DateFormatter:class{string(date){return String(date.getDate())}},Keychain:{contains:()=>false},Location:{setAccuracy:async()=>{},requestCurrent:async()=>null,reverseGeocode:async()=>[]},CalendarEvent:{getAll:async()=>{throw Error('Permission denied')}},Reminder:{getIncompletes:async()=>{throw Error('Permission denied')}}};
 const current=fs.readFileSync(path.join(dir,'host.ts'),'utf8'),old=cp.execFileSync('git',['show','d7310b6:scripting/scripts/Calendar Timeline Scripting/host.ts'],{encoding:'utf8'});
 const make=(source,fetch)=>load(source,{'./drawing':d,'./rect-raster':{}},{...globals,fetch}).createHost(new Date(),{background:true});
 const hangingBody=async()=>({status:200,ok:true,text:()=>new Promise(()=>{})});
 const before=new (make(old,hangingBody).Request)('https://api.open-meteo.com/test');before.timeoutInterval=.01;
 assert.equal(await Promise.race([before.loadString().then(()=>false,()=>false),new Promise(r=>setTimeout(()=>r('pending'),40))]),'pending','Reproduces unbounded response body in 0.3.44');
 const after=new (make(current,hangingBody).Request)('https://api.open-meteo.com/test');after.timeoutInterval=.01;
 await assert.rejects(after.loadString(),/Tempo de consulta excedido/);
 for(const [name,fetch,pattern]of [
  ['headers-stalled',()=>new Promise(()=>{}),/Tempo de consulta excedido/],
  ['unauthorized',async()=>({status:401,ok:false}),/HTTP 401/],
  ['invalid-json',async()=>({status:200,ok:true,text:async()=>'{broken'}),/JSON|Unexpected|property/],
 ]){const req=new(make(current,fetch).Request)('https://api.open-meteo.com/test');req.timeoutInterval=.01;await assert.rejects(req.loadJSON(),pattern,name);}
 // No cache, location unavailable, denied local permissions, disconnected network:
 // preparation must terminate and report partial sources rather than hang.
 const host=make(current,async()=>{throw Error('offline')});
 const model=await compile(raw)(host,{prepareOnly:true,now:+new Date(2026,10,14,9),hours:'24'});
 assert.equal(model.image,null);assert(model.sourceStatus);assert.equal(model.sourceStatus.schedule.event,false);assert.equal(model.sourceStatus.schedule.reminder,false);
 const diag=load(fs.readFileSync(path.join(dir,'diagnostics.ts'),'utf8'),{},globals);let draws=0;diag.resetCanvasDiagnostics();assert.equal(values.get('canvas-diagnostic').phase,'awaiting-canvas');
 diag.runCanvasDraw(()=>draws++);assert.equal(values.get('canvas-diagnostic').phase,'first-canvas-layer-completed');
 assert.throws(()=>diag.runCanvasDraw(()=>{throw Error('Synthetic Canvas failure')}),/Synthetic Canvas failure/);assert.equal(values.get('canvas-diagnostic').phase,'canvas-failed');
 diag.runCanvasDraw(()=>draws++);assert.equal(values.get('canvas-diagnostic').phase,'canvas-failed','Later layers must not hide the first failure');
 storage.set=()=>{throw Error('storage unavailable')};assert.doesNotThrow(()=>diag.runCanvasDraw(()=>draws++));assert.equal(draws,3);
 console.log(JSON.stringify({passed:true,bodyHang:'reproduced before; bounded after',coldStart:'no cache + denied calendar/reminders + no location + offline terminates with partial source status',canvas:'first callback and late failure logged; no user content collected; logging failure cannot stop painting',physicalDevices:'not tested; these cases do not prove the reported black-screen cause'}));
})().catch(e=>{console.error(e);process.exitCode=1});
