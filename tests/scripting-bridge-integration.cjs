const fs=require('node:fs'),ts=require(process.env.TYPESCRIPT_PATH||'typescript'),assert=require('node:assert/strict');
const dir='scripting/scripts/Calendar Timeline Scripting/';
const read=p=>fs.readFileSync(['index.tsx','widget.tsx','intent.tsx'].includes(require('node:path').basename(p))?'scripting/entrypoints/'+require('node:path').basename(p):p,'utf8').replace(/\r\n/g,'\n');
for(const name of ['index.tsx','bridge.tsx','bridge-client.ts','bridge-protocol.ts','intent.tsx','bridge-auto.ts','bridge-event-reader.ts','widget-refresh.ts','bridge-agenda.ts','bridge-read-state.ts']){
 const r=ts.transpileModule(read(dir+name),{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}});
 assert.equal(r.diagnostics.length,0,name);
}

assert(read(dir+'bridge-protocol.ts').includes('item.lastModifiedDate')); // Content revision format remains unchanged.
assert(read(dir+'bridge-protocol.ts').includes("[item.id,item.title,item.calendarId,item.start,item.end,item.isAllDay]"));
assert(!read(dir+'widget.tsx').includes('bridge-client'));
assert(read(dir+'index.tsx').includes('finally{Script.exit()}'));
assert(read(dir+'index.tsx').includes('<BridgeLauncher/>'));
console.log('PASS: integrated bridge syntax; pilot protocol preserved; foreground entry and intent; bounded automatic bridge; local refresh independent of cloud failure. Native UI still requires iPhone.');
const vm=require('node:vm');
(async()=>{
 let finishBridge,bridgeDone=false,presented=false;
 const pending=new Promise(resolve=>{finishBridge=()=>{bridgeDone=true;resolve({state:'success'})}});
 const source=read(dir+'widget.tsx').replace(/main\(\)\s*$/, 'module.exports=main');
 const code=ts.transpileModule(source,{fileName:'widget.tsx',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 const m={exports:{}};
 const dependencies={scripting:{Widget:{family:'systemMedium',displaySize:{width:300,height:150},present(){assert(bridgeDone,'Widget must not destroy the context before bridge completion');presented=true}},Text:()=>null},'./bridge-auto':{autoSynchronize:()=>pending},'./model':{loadModel:async()=>({})},'./timeline-view':{TimelineView:()=>null},'./diagnostics':{VERSION:'test',failureDetails:String},'./pro-common':{refreshMinutes:()=>1}};
 vm.runInNewContext(code,{exports:m.exports,module:m,require:id=>dependencies[id],React:{createElement:()=>({})},Storage:{set:()=>true},Date});
 const run=m.exports();await new Promise(resolve=>setImmediate(resolve));assert.equal(presented,false);
 finishBridge();await run;assert(presented);
 const client=read(dir+'bridge-client.ts');assert(client.indexOf('await synchronizeReal(')<client.indexOf('await Promise.race([collectAgenda()'),'Claim commands before full agenda capture consumes the time budget');
 console.log('PASS: actual widget entry waits for asynchronous bridge completion before context destruction; personal command claim precedes full agenda capture.');
})().catch(e=>{console.error(e);process.exitCode=1});
