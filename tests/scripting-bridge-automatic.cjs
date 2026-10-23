const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const dir='scripting/scripts/Calendar Timeline Scripting/';
const values=new Map(),keys=new Map(),uploads=[];let mode='ok',queryRows,reloads=0;
const calendar={identifier:'test-cal',allowsContentModifications:true};
const oldEvent={identifier:'event-id',title:'[CT TESTE] Evento',calendar,startDate:new Date(),endDate:new Date(Date.now()+1800000),notes:'ct-bridge-command:owned-test',lastModifiedDate:new Date('2026-10-23T10:00:00.001Z')};
const edited={...oldEvent,title:'[CT TESTE] Evento EDITADO',lastModifiedDate:new Date('2026-10-23T10:00:00.002Z')};
const completed={identifier:'rem-id',title:'[CT TESTE] Lembrete',calendar,notes:'ct-bridge-command:owned-rem',isCompleted:true,dueDateComponents:null};
queryRows=[edited,{...edited,identifier:'private-id',title:'Personal event must not be transmitted',notes:'unrelated private notes'}];
const globals={Storage:{get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,v);return true},remove:k=>values.delete(k)},Keychain:{get:k=>keys.get(k)??null,set:(k,v)=>{keys.set(k,v);return true}},Calendar:{forEvents:async()=>[calendar]},CalendarEvent:{get:async()=>oldEvent,getAll:async()=>queryRows},Reminder:{get:async()=>completed},Date,console,setTimeout,clearTimeout,fetch:async(url,options)=>{if(mode==='offline')throw Error('offline');if(mode==='hanging')return new Promise(()=>{});const body=JSON.parse(options.body);uploads.push(body);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({commands:[],pendingCount:0})}}};
const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const code=ts.transpileModule(fs.readFileSync(dir+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const m={exports:{}};cache.set(name,m.exports);vm.runInNewContext(code,{...globals,exports:m.exports,module:m,require:id=>load(id.replace('./',''))});cache.set(name,m.exports);return m.exports;}
(async()=>{
 const client=load('bridge-client'),auto=load('bridge-auto'),touch=load('widget-refresh');
 assert.equal((await auto.autoSynchronize({origin:'widget'})).state,'unpaired');assert.equal(uploads.length,0);
 client.configure(JSON.stringify({version:1,endpoint:'https://calendar-timeline-bridge.sagittaryuz.chatgpt.site',deviceId:'synthetic-device-id-long-enough',deviceToken:'synthetic-token-long-enough',siteAccess:'synthetic-platform-long-enough'}));
 values.set('test-scope-consent',true);values.set('real-agenda-disabled',true);values.set('linked:event','event-id');values.set('linked:reminder','rem-id');
 const report=await auto.autoSynchronize({origin:'widget',budgetMS:4500});assert.equal(report.state,'success');assert(report.message.includes('execução do widget'),'Automatic result identifies its trigger');
 for(const sent of uploads){assert.equal(sent.items.length,2);assert(sent.items.some(x=>x.kind==='reminder'&&x.completed));assert(sent.items.some(x=>x.title==='[CT TESTE] Evento EDITADO'));assert(!JSON.stringify(sent).includes('Personal event'));}
 assert.equal(values.get('bridge-event-read').changedFromIdentifierRead,true);
 const before=uploads.length;assert.equal((await auto.autoSynchronize({origin:'widget'})).state,'throttled');assert.equal(uploads.length,before);
 // A stale range must not beat a newer direct lookup.
 globals.CalendarEvent.get=async()=>edited;queryRows=[oldEvent];await client.synchronize();
 assert.equal(uploads.at(-1).items.find(x=>x.kind==='event').title,edited.title);
 // Both sources reverting cannot beat the durable checkpoint.
 globals.CalendarEvent.get=async()=>oldEvent;queryRows=[oldEvent];const retained=uploads.length;
 await assert.rejects(client.synchronize(),/último estado confirmado/);assert.equal(uploads.length,retained);
 // Equal native timestamp with different content is ambiguous, never last-arrival-wins.
 queryRows=[{...oldEvent,lastModifiedDate:edited.lastModifiedDate}];globals.CalendarEvent.get=async()=>edited;
 await assert.rejects(client.synchronize(),/conflitantes/);
 // A genuine later rename back to the original title is accepted.
 const renamed={...oldEvent,lastModifiedDate:new Date('2026-10-23T10:00:00.003Z')};
 globals.CalendarEvent.get=async()=>renamed;queryRows=[renamed];await client.synchronize();
 assert.equal(uploads.at(-1).items.find(x=>x.kind==='event').title,oldEvent.title);
 // Restore the fixture with a still newer native version.
 edited.lastModifiedDate=new Date('2026-10-23T10:00:00.004Z');globals.CalendarEvent.get=async()=>oldEvent;
 const beforeFailures=uploads.length;
 queryRows=[];await assert.rejects(client.synchronize(),/ausente na nova consulta/);assert.equal(uploads.length,beforeFailures,'Never upload stale identifier lookup if refreshed query failed');
 queryRows=[edited,{...edited,title:'[CT TESTE] Conflicting duplicate'}];await assert.rejects(client.synchronize(),/ambíguo/);
 queryRows=[{...edited,notes:'ct-bridge-command:somebody-else'}];await assert.rejects(client.synchronize(),/vínculo/);
 queryRows=[edited];mode='hanging';const started=Date.now();await assert.rejects(client.synchronize({budgetMS:200}),/Tempo de conexão excedido/);assert(Date.now()-started<1000,'Bounded network wait');
 mode='offline';assert.equal((await auto.autoSynchronize({origin:'widget',force:true})).state,'deferred');assert(!JSON.stringify(values.get('bridge-auto-state')).includes('synthetic-token'));
 const order=[];await touch.refreshFromWidget({sync:async()=>{order.push('sync');throw Error('offline')},load:async()=>{order.push('local');throw Error('local unavailable')},failed:()=>order.push('diagnostic'),reload:()=>{order.push('reload');reloads++},open:async url=>{assert.equal(url,'calshow://');order.push('calendar');return true}});
 assert.deepEqual(order,['sync','local','diagnostic','reload','calendar']);assert.equal(reloads,1);
 console.log('PASS: EDITADO replaces stale get(id), completed reminder upload, personal events excluded, missing/ambiguous/relinked events fail safely, timeout, automatic consent/throttle/offline handling, widget refresh and Calendar opening despite cloud/local errors. Native iPhone confirmation still required.');
})().catch(e=>{console.error(e);process.exitCode=1});
