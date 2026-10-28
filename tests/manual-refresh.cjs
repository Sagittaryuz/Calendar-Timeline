const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {transformSync}=require('esbuild');
const dir=path.resolve(__dirname,'../scripting/scripts/Calendar Timeline Scripting');
function load(name,deps,values=new Map()){
 const code=transformSync(fs.readFileSync(path.join(dir,name),'utf8'),{loader:name.endsWith('tsx')?'tsx':'ts',format:'cjs',jsxFactory:'createElement'}).code;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:name=>deps[name],Date,Storage:{remove:k=>values.delete(k),get:k=>values.get(k),set:(k,v)=>{values.set(k,v);return true}}});return module.exports;
}
(async()=>{
 const values=new Map([['weather-model',{savedAt:Date.now(),weather:{hours:[{}]},location:{latitude:1,longitude:2}}]]);
 const calls=[];const deps={'./host':{createHost:()=>({renderWarnings:()=>[]})},'./selection':{resolveFocus:(_,now)=>now,clearTimelineSelection:()=>{}},'./diagnostics':{markPhase:()=>{}},'./original-engine':{renderOriginal:async(_,options)=>{calls.push(options);return {weatherSnapshot:{hours:[{}]},locationSnapshot:{latitude:1,longitude:2}}}}};
 const model=load('model.ts',deps,values);
 await model.loadModel({background:true});await model.loadModel({background:true,forceWeather:true});
 assert(calls[0].hourlyWeather,'Regular refresh reuses valid weather');assert.equal(calls[1].hourlyWeather,undefined,'Manual refresh must query weather instead of imposing the 15-minute cache');
 console.log('PASS data cache: normal model reuses weather; internal force option bypasses cache. Widget taps do not call this option.');
})().catch(e=>{console.error(e);process.exitCode=1});
