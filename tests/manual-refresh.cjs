const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transformSync}=require('esbuild');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
function load(name,deps,values=new Map()){
 const code=transformSync(fs.readFileSync(path.join(dir,name),'utf8'),{loader:name.endsWith('tsx')?'tsx':'ts',format:'cjs',jsxFactory:'createElement'}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:name=>deps[name],Date,Storage:{get:k=>values.get(k),set:(k,v)=>{values.set(k,v);return true}}});return module.exports;
}
(async()=>{
 for(const fail of [false,true]){
  const values=new Map(),events=[],definitions={};
  const sdk={AppIntentManager:{register:d=>{definitions[d.name]=d;return ()=>({name:d.name})}},AppIntentProtocol:{AppIntent:0},Widget:{reloadAll:()=>events.push('reload')},ControlWidget:{reloadButtons:()=>events.push('control')}};
  const deps={scripting:sdk,'./selection':{}};
  deps['./bridge-auto']={autoSynchronize:async options=>{assert(options.force);events.push('bridge')}};
  deps['./model']={loadModel:async options=>{assert(options.background&&options.forceWeather);events.push('model');if(fail)throw Error('offline')}};
  load('app_intents.tsx',deps,values);
  await definitions['CalendarTimelineRefresh'].perform();
  assert(events.includes('reload'),'Refresh failure must still request redraw');
  assert.deepEqual(events,['bridge','model','reload']);assert.equal(values.get('manual-refresh').state,fail?'failed-cache-preserved':'prepared');
 }
 const values=new Map([['weather-model',{savedAt:Date.now(),weather:{hours:[{}]},location:{latitude:1,longitude:2}}]]);
 const calls=[];const deps={'./host':{createHost:()=>({renderWarnings:()=>[]})},'./selection':{resolveFocus:(_,now)=>now},'./diagnostics':{markPhase:()=>{}},'./original-engine':{renderOriginal:async(_,options)=>{calls.push(options);return {weatherSnapshot:{hours:[{}]},locationSnapshot:{latitude:1,longitude:2}}}}};
 const model=load('model.ts',deps,values);
 await model.loadModel({background:true});await model.loadModel({background:true,forceWeather:true});
 assert(calls[0].hourlyWeather,'Regular refresh reuses valid weather');assert.equal(calls[1].hourlyWeather,undefined,'Manual refresh must query weather instead of imposing the 15-minute cache');
 console.log('PASS manual refresh: actual intent requests current data, preserves offline status and reloads on success/failure. Native tap pending.');
})().catch(e=>{console.error(e);process.exitCode=1});
