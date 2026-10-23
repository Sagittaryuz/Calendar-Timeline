const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript'),dir='scripting/scripts/Calendar Timeline Scripting/';
const values=new Map(),keys=new Map(),uploads=[];let mode='fresh';
const calendar={identifier:'cal',title:'Calendário',type:'calDAV',allowsContentModifications:true};
const modified=new Date('2026-10-23T12:01:51.536Z'),start=new Date();start.setHours(19,0,0,0);
const old={identifier:'trial-event',calendar,title:'[CT TESTE] Evento original',notes:'ct-bridge-command:owned',startDate:start,endDate:new Date(+start+1800000),lastModifiedDate:modified};
const edited={...old,title:'[CT TESTE] Evento EDITADO'};
const rem={identifier:'trial-rem',calendar,title:'[CT TESTE] Lembrete',notes:'ct-bridge-command:rem-owned',isCompleted:true,dueDateComponents:{year:start.getFullYear(),month:start.getMonth()+1,day:start.getDate()}};
let canonical;
const globals={Storage:{get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,v);return true},remove:k=>values.delete(k)},Keychain:{get:k=>keys.get(k)??null,set:(k,v)=>{keys.set(k,v);return true}},Calendar:{forEvents:async()=>[calendar],forReminders:async()=>[calendar]},CalendarEvent:{get:async()=>old,getAll:async()=>[mode==='fresh'?edited:old]},Reminder:{get:async()=>rem,getAll:async()=>[rem]},Date,Intl,console,setTimeout,clearTimeout,fetch:async(url,options)=>{
 if(mode==='offline')throw Error('offline');const body=JSON.parse(options.body);uploads.push(body);
 if(body.op==='real-sync')return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({pendingCount:0,commands:[]})};
 if(body.op==='agenda'){
  canonical??=body.snapshot.items;
  return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({accepted:true,state:mode==='fresh'?'complete':'partial',capturedAt:body.snapshot.capturedAt,receivedAt:new Date().toISOString(),readItems:canonical,coverage:body.snapshot.coverage,count:canonical.length,warnings:mode==='fresh'?[]:['stale-event-retained']})};
 }
 throw Error('Unexpected test sync/claim: the conflicting pilot must not run');
}};
const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};cache.set(name,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(dir+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{...globals,exports:m.exports,module:m,require:id=>load(id.replace('./',''))});return m.exports;}
(async()=>{
 const client=load('bridge-client'),auto=load('bridge-auto'),ui=load('bridge-read-state'),protocol=load('bridge-protocol');
 client.configure(JSON.stringify({version:1,endpoint:protocol.ENDPOINT,deviceId:'synthetic-device-id-long-enough',deviceToken:'synthetic-token-long-enough',siteAccess:'synthetic-access-long-enough'}));
 values.set('test-scope-consent',true);values.set('linked:event',old.identifier);values.set('linked:reminder',rem.identifier);values.set('bridge-local-items',[protocol.project('event',old)]);
 values.set('bridge-event-reference',{id:old.identifier,calendarId:calendar.identifier,start:start.toISOString(),marker:'ct-bridge-command:owned',nativeModifiedAt:modified.toISOString(),revision:protocol.project('event',old).revision});
 const first=await auto.autoSynchronize({origin:'app-open',force:true,budgetMS:10000});
 assert.equal(first.state,'success');assert.equal(first.report.testState,'agenda-read');assert.equal(first.report.commandState,'not-checked');assert.equal(first.report.conflicts,0);assert.equal(first.report.pending,null);
 assert(first.message.includes('Leitura confirmada pela agenda real'));assert(first.message.includes('Comandos de teste: não consultados'));assert(!first.message.includes('deferred'));
 const lines=ui.readLines(values.get('bridge-read-items'),values.get('bridge-local-items'));
 assert(lines.some(x=>x.includes(edited.title)));assert(!lines.some(x=>x.includes('Evento original')));assert(uploads.every(x=>['agenda','real-sync'].includes(x.op)));
 assert.equal(uploads[0].meta.clientVersion,'0.2.14');
 // Same native version + cached original cannot overwrite the canonical read.
 mode='older';await auto.autoSynchronize({origin:'widget',force:true,budgetMS:10000});
 assert(ui.readLines(values.get('bridge-read-items')).some(x=>x.includes(edited.title)));assert(uploads.every(x=>['agenda','real-sync'].includes(x.op)));
 const missing=ui.agendaReadState({items:[],coverage:{event:{state:'ok'},reminder:{state:'ok'}},capturedAt:new Date().toISOString()},{event:old.identifier},{readItems:[],state:'complete',receivedAt:new Date().toISOString()});
 assert(ui.readLines(missing,[protocol.project('event',old)]).some(x=>x.includes('fora da janela')));assert(!ui.readLines(missing,[protocol.project('event',old)]).some(x=>x.includes(old.title)));
 mode='offline';assert.equal((await auto.autoSynchronize({origin:'app-open',force:true,budgetMS:10000})).state,'deferred');
 assert(ui.readLines(values.get('bridge-read-items')).some(x=>x.includes(edited.title)),'Last confirmed capture remains dated, never replaced by failed round');
 console.log('PASS: same timestamp EDITADO uses canonical accepted agenda, strict write checkpoint retained, old pilot never uploaded or claimed, readable command status, no false conflicts, no fallback to obsolete label, partial capture and offline behavior.');
})().catch(e=>{console.error(e);process.exitCode=1});
