const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{transformSync}=require('esbuild');
const root='scripting/scripts/Calendar Timeline Scripting/';
function load(file,deps={},extra={}){const m={exports:{}};let text=fs.readFileSync(root+file,'utf8').replace(/main\(\)\s*$/,'module.exports=main');vm.runInNewContext(transformSync(text,{loader:file.endsWith('tsx')?'tsx':'ts',format:'cjs',jsxFactory:'createElement'}).code,{module:m,exports:m.exports,require:n=>deps[n],setTimeout,clearTimeout,Date,...extra});return m.exports}
(async()=>{
 const helper=load('widget-refresh.ts');
 for(const mode of ['success','failure','timeout']){
  const trace=[];let isCurrent;
  await helper.refreshFromWidget({budgetMS:10,prepare:active=>{trace.push('prepare');isCurrent=active;return mode==='success'?Promise.resolve():mode==='failure'?Promise.reject(Error('offline')):new Promise(()=>{})},reload:()=>trace.push('reload'),open:async url=>{assert.equal(url,'calshow://');trace.push('open');return true},failed:()=>trace.push('failed')});
  assert.equal(isCurrent(),false);assert.deepEqual(trace,mode==='success'?['prepare','reload','open']:['prepare','failed','reload','open']);
 }
 const source=fs.readFileSync(root+'timeline-view.tsx','utf8');assert(source.includes('scripting://run_single/Calendar%20Timeline%20Scripting?refresh=1'));assert(source.includes("weathergraph://"));
 let options, reloads=0,opens=0,exits=0;
 const run=load('index.tsx',{'scripting':{Script:{queryParameters:{refresh:'1'},exit:()=>exits++},Widget:{reloadAll:()=>reloads++}},'./widget-refresh':helper,'./model':{loadModel:async o=>{options=o}},'./diagnostics':{}},{Safari:{openURL:async url=>{assert.equal(url,'calshow://');opens++;return true}},Storage:{set:()=>true}});
 await run();assert(options.background&&options.prepareOnly&&typeof options.shouldPersist==='function');assert.equal(reloads,1);assert.equal(opens,1);assert.equal(exits,1);
 console.log('PASS: toque consulta agenda, solicita recarga e abre Calendário; falha e tempo limite preservam navegação.');
})().catch(e=>{console.error(e);process.exitCode=1});
