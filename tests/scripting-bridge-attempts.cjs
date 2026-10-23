const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript'),dir='scripting/scripts/Calendar Timeline Scripting/';
const values=new Map(),keys=new Map();let mode='ok',writes=0;
const cal={identifier:'synthetic-calendar',title:'Lembretes',type:'calDAV',allowsContentModifications:true};
const globals={Storage:{get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,structuredClone(v));return true},remove:k=>values.delete(k)},Keychain:{get:k=>keys.get(k)??null,set:(k,v)=>{keys.set(k,v);return true}},Calendar:{forEvents:async()=>[cal],forReminders:async()=>[cal]},CalendarEvent:{getAll:async()=>[]},Reminder:{getAll:async()=>[]},Date,Intl,setTimeout,clearTimeout,fetch:async(url,options)=>{
 const b=JSON.parse(options.body);
 if(mode==='offline')throw Error('NATIVE PRIVATE ERROR token=DO-NOT-PERSIST https://secret.test');
 if(mode==='http')return {ok:false,status:500,headers:{get:()=> 'application/json'},json:async()=>({error:'SERVER PRIVATE ERROR'})};
 if(mode==='response')return {ok:true,headers:{get:()=> 'text/html'}};
 if(mode==='partial'&&b.op==='agenda')throw Error('NATIVE PRIVATE ERROR');
 if(b.op==='real-result')writes++;
 return {ok:true,headers:{get:()=> 'application/json'},json:async()=>b.op==='agenda'?{accepted:true,state:'complete',readItems:[],coverage:b.snapshot.coverage,capturedAt:b.snapshot.capturedAt,receivedAt:new Date().toISOString(),count:0}:{commands:[],pendingCount:0}};
}};
const cache=new Map();function load(name){if(cache.has(name))return cache.get(name);const m={exports:{}};cache.set(name,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(dir+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{...globals,exports:m.exports,module:m,require:id=>load(id.replace('./',''))});return m.exports}
(async()=>{
 const client=load('bridge-client'),auto=load('bridge-auto'),log=load('bridge-attempts'),touch=load('widget-refresh');
 client.configure(JSON.stringify({version:1,endpoint:load('bridge-protocol').ENDPOINT,deviceId:'synthetic-device-long-enough',deviceToken:'DO-NOT-PERSIST-device-token',siteAccess:'DO-NOT-PERSIST-site-access'}));values.set('test-scope-consent',true);
 mode='offline';assert.equal((await auto.autoSynchronize({origin:'widget-touch',force:true})).state,'deferred');
 const problem=values.get('bridge-last-problem-v1');assert.equal(problem.reason,'connection');assert.equal(problem.origin,'widget-touch');assert(problem.finishedAt);assert.equal(problem.state,'deferred');
 const displayBefore=log.previousAttemptLines();assert(displayBefore.some(s=>s.includes('Falha de conexão')));assert(!displayBefore.some(s=>s.includes('sem internet confirmada')));
 mode='ok';await auto.autoSynchronize({origin:'app-open',force:true});
 assert.equal(values.get('bridge-attempt-history-v1').at(-1).state,'success');assert.equal(values.get('bridge-last-problem-v1').id,problem.id,'Success cannot erase earlier failure');assert(log.previousAttemptLines().some(s=>s.includes('Falha de conexão')));
 assert(displayBefore.some(s=>s.includes('toque no widget')),'Opening snapshots the prior result before app-open sync');
 mode='http';await auto.autoSynchronize({origin:'manual',force:true});assert.equal(values.get('bridge-last-problem-v1').reason,'http');
 mode='response';await auto.autoSynchronize({origin:'widget',force:true});assert.equal(values.get('bridge-last-problem-v1').reason,'response');
 mode='partial';await auto.autoSynchronize({origin:'app-open',force:true});assert.equal(values.get('bridge-attempt-history-v1').at(-1).state,'deferred','Swallowed agenda failure still recorded even if command polling succeeds');
 const serialized=JSON.stringify([...values].filter(([k])=>k.startsWith('bridge-attempt')||k==='bridge-last-problem-v1'));
 for(const secret of ['DO-NOT-PERSIST','PRIVATE ERROR','secret.test','deviceToken','siteAccess','payload','title'])assert(!serialized.includes(secret),secret);
 mode='ok';for(let i=0;i<15;i++)await auto.autoSynchronize({origin:'app-open',force:true});assert.equal(values.get('bridge-attempt-history-v1').length,12);assert(values.get('bridge-last-problem-v1'));
 log.beginAttempt('widget-touch');assert(log.previousAttemptLines().some(s=>s.includes('sem resultado local registrado')),'Interrupted does not pretend to know whether writes happened');
 const order=[];mode='offline';await touch.refreshFromWidget({sync:()=>auto.autoSynchronize({origin:'widget-touch',force:true}),load:async()=>{order.push('load');throw Error('render')},failed:()=>order.push('failed'),reload:()=>order.push('reload'),open:async url=>{assert.equal(url,'calshow://');order.push('calendar');return true}});
 assert.deepEqual(order,['load','failed','reload','calendar']);assert.equal(writes,0);
 const index=fs.readFileSync('scripting/entrypoints/index.tsx','utf8');assert(index.indexOf('const previousAttempts=previousAttemptLines()')<index.indexOf("origin:'app-open'"));assert(index.includes("key={'attempt-'+index}"));
 console.log('PASS: offline actual client -> persistent safe journal -> next-open snapshot -> successful retry retains failure; HTTP/format/partial errors, bounded history, interrupted state, no secrets/payloads and Calendar redirect preserved. Native APIs simulated.');
})().catch(e=>{console.error(e);process.exitCode=1});
