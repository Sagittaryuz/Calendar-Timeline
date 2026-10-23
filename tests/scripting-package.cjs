const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const root=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'build-manifest.json'),'utf8'));
function transpile(source,name){return ts.transpileModule(source,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'}}).outputText}
for(const file of manifest.sourceFiles){const source=fs.readFileSync(path.join(root,file.name),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),file.sha256,file.name)}
for(const {name} of manifest.files){
 const source=fs.readFileSync(path.join(root,name),'utf8'),tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 for(const node of tree.statements)if(ts.isImportDeclaration(node)){assert.equal(node.moduleSpecifier.text,'scripting','No local imports can mix an older module into an entry');assert(ts.isNamespaceImport(node.importClause.namedBindings),'No unchecked native named imports');}
 if(['index.tsx','widget.tsx'].includes(name))assert(source.includes(`VERSION = "${manifest.version}"`),'Entry must embed its own current version');
}
(async()=>{
 let finish,done=false,shown=false;
 const pending=new Promise(resolve=>{finish=()=>{done=true;resolve({state:'success'})}});
 let source=fs.readFileSync(path.join(root,'widget.tsx'),'utf8');
 // Replace only the test's native/model boundary; exercise the distributed
 // bundle's module initialization and actual main(), with no project resolver.
 source=source.replace(/\nPromise\.resolve\(main\(\)\)\.catch\(__calendarBootFailure\);\n/, '\n  autoSynchronize=()=>pending; loadModel=async()=>({}); globalThis.run=main();\n');
 assert(source.includes('globalThis.run=main()'));
 const ui={Widget:{family:'systemMedium',displaySize:{width:364,height:170},present(){assert(done,'Bridge must finish before the host destroys the context');shown=true}},AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:()=>()=>({})}};
 const context={pending,console,Storage:{set:()=>true},Date,setTimeout,clearTimeout,createElement:()=>({}),exports:{},require:name=>{assert.equal(name,'scripting');return ui}};
 vm.runInNewContext(transpile(source,'widget.tsx'),context);await new Promise(resolve=>setImmediate(resolve));assert(!shown);finish();await context.run;assert(shown);
 const errors=[];vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'index.tsx'),'utf8'),'index.tsx'),{console,exports:{},require:name=>{assert.equal(name,'scripting');return {Script:{exit(){}}}},Dialog:{alert:async x=>errors.push(x)},Date,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(errors.length,1,'Native initialization failure must show an independent diagnostic');assert(errors[0].title.includes(manifest.version));
 const runDiagnostic=async damaged=>{
  const alerts=[],state=new Map();const sdk={Script:{directory:'/project',name:'Calendar Timeline Scripting',metadata:{version:manifest.version},exit(){}}};
  for(const name of ['Widget','Text','Navigation','NavigationStack','ScrollView','VStack','HStack','Button','Canvas','ZStack','Rectangle','Link','useState','useRef','useEffect','AppIntentManager','AppIntentProtocol'])sdk[name]={};
  vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'diagnose.tsx'),'utf8'),'diagnose.tsx'),{exports:{},require:()=>sdk,console:{log(){}},Date,FileManager:{readAsString:async file=>{const name=path.basename(file);if(damaged===name)throw Error('missing');return fs.readFileSync(path.join(root,name),'utf8')}},Crypto:{sha256:data=>({toHexString:()=>crypto.createHash('sha256').update(data).digest('hex')})},Data:{fromString:s=>Buffer.from(s)},Storage:{set:(k,v)=>state.set(k,v)},Dialog:{alert:async a=>alerts.push(a)}});
  for(let i=0;i<5&&!alerts.length;i++)await new Promise(resolve=>setImmediate(resolve));assert(alerts.length);return state.get('source-integrity-report');
 };
 assert.equal((await runDiagnostic()).issues.length,0);assert((await runDiagnostic('create-item.ts')).issues.some(s=>s.includes('create-item.ts')));
 console.log('PASS package: hashes, self-contained entries, inline version, actual bundle initialization/render order, visible bootstrap failure, standalone integrity check and missing-file diagnosis. Native iPhone compilation remains unverified.');
})().catch(e=>{console.error(e);process.exitCode=1});
