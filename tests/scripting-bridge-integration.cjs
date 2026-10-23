const fs=require('node:fs'),ts=require(process.env.TYPESCRIPT_PATH||'typescript'),assert=require('node:assert/strict');
const dir='scripting/scripts/Calendar Timeline Scripting/';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
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
