import assert from 'node:assert/strict';
import {executeCommand,revision,project,validateConfig} from '../scripting/scripts/Calendar Timeline Bridge/protocol.ts';
const native=new Map(),journals=new Map(),links=new Map();let writes=0,recoveryReads=0,failAfterSave=false;
const host={loadJournal:id=>journals.get(id),saveJournal:(id,data)=>journals.set(id,data),getLinked:kind=>links.get(kind),link:(kind,id)=>links.set(kind,id),
 get:async(kind,id)=>{if(failAfterSave){failAfterSave=false;throw Error('Simulated suspended after save')}return native.get(id)},
 recover:async cmd=>{recoveryReads++;return [...native.values()].find(x=>x.notes.includes('ct-bridge-command:'+cmd.id))},
 make:async kind=>({identifier:'new-'+kind,calendar:{identifier:'test-cal',allowsContentModifications:true}}),
 apply:async(cmd,item)=>{writes++;if(cmd.action==='create')item.notes='ct-bridge-command:'+cmd.id;Object.assign(item,cmd.payload);if(cmd.kind==='event'){item.startDate=new Date(cmd.payload.start);item.endDate=new Date(cmd.payload.end);item.isAllDay=false}else{item.isCompleted=cmd.action==='complete'?true:cmd.action==='reopen'?false:item.isCompleted??false;if('due'in cmd.payload)item.dueDateComponents=cmd.payload.due?{date:new Date(cmd.payload.due),hour:18,minute:0}:null}native.set(item.identifier,item)}
};
const create={id:'first-r',kind:'reminder',action:'create',payload:{title:'[CT TESTE] Inicial',due:'2026-10-23T18:00:00.000Z'}};
let result=await executeCommand(create,host);assert.equal(result.status,'applied');assert.equal(writes,1);
result=await executeCommand(create,host);assert.equal(result.status,'applied');assert.equal(writes,1,'Retry must not duplicate writes');
const complete={id:'done',kind:'reminder',action:'complete',itemId:result.item.id,expectedRevision:result.item.revision,payload:{}};
result=await executeCommand(complete,host);assert(result.item.completed);assert.equal(writes,2);
const reopen={id:'reopen',kind:'reminder',action:'reopen',itemId:result.item.id,expectedRevision:result.item.revision,payload:{}};
result=await executeCommand(reopen,host);assert(!result.item.completed);
const stale={id:'stale',kind:'reminder',action:'update',itemId:result.item.id,expectedRevision:result.item.revision,payload:{title:'[CT TESTE] Remoto'}};
native.get(result.item.id).title='[CT TESTE] Editado manualmente';const before=writes;
assert.equal((await executeCommand(stale,host)).status,'conflict');assert.equal(writes,before,'Manual edit preserved');
await assert.rejects(executeCommand({...stale,id:'unrelated',itemId:'personal-id'},host),/fora/);
await assert.rejects(executeCommand({...stale,id:'bad',payload:{notes:'not allowed'}},host),/permitidos/);
const event={id:'first-e',kind:'event',action:'create',payload:{title:'[CT TESTE] Evento',start:'2026-10-23T18:00:00.000Z',end:'2026-10-23T19:00:00.000Z'}};
failAfterSave=true;await assert.rejects(executeCommand(event,host),/suspended/);const afterCrash=writes;
result=await executeCommand(event,host);assert.equal(result.status,'applied');assert.equal(writes,afterCrash,'Interrupted save recovered without duplicate');
assert.equal(result.item.revision,revision(result.item));
assert.throws(()=>validateConfig({version:1,endpoint:'https://evil.test'}),/inválida/);
console.log('PASS: native adapter protocol: create, readback, retry, complete, reopen, manual conflict, scope, interrupted-save recovery, endpoint allowlist. Real iPhone execution still required.');
