const fs=require('node:fs'),ts=require(process.env.TYPESCRIPT_PATH||'typescript'),assert=require('node:assert/strict');
const dir='scripting/scripts/Calendar Timeline Scripting/';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
for(const name of ['index.tsx','bridge.tsx','bridge-client.ts','bridge-protocol.ts','intent.tsx']){
 const r=ts.transpileModule(read(dir+name),{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}});
 assert.equal(r.diagnostics.length,0,name);
}
assert.equal(read(dir+'bridge-client.ts').replace('./bridge-protocol','./protocol'),read('scripting/scripts/Calendar Timeline Bridge/client.ts'));
assert.equal(read(dir+'bridge-protocol.ts'),read('scripting/scripts/Calendar Timeline Bridge/protocol.ts'));
assert(!read(dir+'widget.tsx').includes('bridge-client'));
assert(read(dir+'index.tsx').includes('finally{Script.exit()}'));
assert(read(dir+'index.tsx').includes('<BridgeLauncher/>'));
console.log('PASS: integrated bridge syntax; tested client/protocol preserved; foreground entry and intent; widget has no bridge network dependency. Native UI still requires iPhone.');
