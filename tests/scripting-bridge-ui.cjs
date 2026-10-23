const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const source=fs.readFileSync('scripting/scripts/Calendar Timeline Scripting/bridge.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'}}).outputText;
let config=null,consent=false,calls=0,reloads=0,failPrompt=false,promptValue=null,releasePrompt,state=[],promptCalls=0;
const client={configuration:()=>config,configure:()=>{config={}},synchronize:async()=>{calls++;return {finishedAt:new Date().toISOString(),applied:2,conflicts:0,pending:0}}};
const native=new Proxy({Button:'Button',VStack:'VStack',Text:'Text',Widget:{reloadAll:()=>reloads++},Navigation:{present:()=>{throw Error('Nested presentation must not be used by launcher')}},useState:value=>[value,next=>state.push(next)]},{get:(o,k)=>{if(k==='Dialog')throw Error('Dialog must be a native global');return o[k]}});
const moduleObject={exports:{}};
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,require:()=>{},createElement:(type,props,...children)=>({type,props,children}),Date,Storage:{get:()=>consent,set:()=>{consent=true;return true}},Dialog:{prompt:async()=>{promptCalls++;if(failPrompt)throw Error('native prompt unavailable');if(releasePrompt)return new Promise(resolve=>{releasePrompt.resolve=resolve});return promptValue},confirm:async()=>true,alert:()=>{throw Error('Launcher errors must be inline')}} ,require:name=>{if(name==='scripting')return native;if(name==='./bridge-read-state'){const helper={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('scripting/scripts/Calendar Timeline Scripting/bridge-read-state.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:helper.exports,Date});return helper.exports;}return client;}});
const {showBridge,BridgeLauncher}=moduleObject.exports;
(async()=>{
 let status=[];await showBridge(false,x=>status.push(x));assert(status.at(-1).includes('cancelado'));assert.equal(calls,0);
 failPrompt=true;status=[];await showBridge(false,x=>status.push(x));assert(status.at(-1).includes('native prompt unavailable'));assert.equal(calls,0);failPrompt=false;
 promptValue='private config';status=[];await showBridge(false,x=>status.push(x));assert.equal(calls,1);assert.equal(reloads,1);assert(status.at(-1).includes('Gravações confirmadas: 2'));
 config=null;consent=false;releasePrompt={};state=[];const button=BridgeLauncher().children[0];const first=button.props.action();await Promise.resolve();const count=promptCalls;await button.props.action();assert.equal(promptCalls,count,'Repeated tap must not open another prompt');assert(state.some(x=>String(x).includes('Abrindo a ponte')));assert(state.some(x=>String(x).includes('já está em execução')));releasePrompt.resolve(null);await first;assert.equal(state.at(-1),false);
 console.log('PASS: actual bridge UI callback: global Dialog, visible cancellation/error/success, immediate progress, repeated-tap guard, no nested result modal. Device UI still needs confirmation.');
})().catch(e=>{console.error(e);process.exitCode=1});
