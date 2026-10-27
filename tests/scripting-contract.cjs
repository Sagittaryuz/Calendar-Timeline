// Local behavioral checks. These do not stand in for iOS type/host validation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const root=path.join(__dirname,'..'),dir=path.join(root,'scripting/scripts/Calendar Timeline Scripting');
const store=new Map();
const storage={get:k=>store.get(k)??null,set:(k,v)=>{store.set(k,v);return true},contains:k=>store.has(k),remove:k=>store.delete(k)};
const modules=new Map();let reloads=0,writes=0,denied=false,requests=0;
const calendar={identifier:'cal',title:'Pessoal',color:'#0088FF'};
const dueDate=new Date(2026,9,23,9,30);
let encodedBitmap;
// Utilities exist globally, and deliberately do not exist in the UI module.
// The old mock incorrectly exported these and hid the device's import failure.
const globals={
  CalendarEvent:{getAll:async()=>{if(denied)throw Error('Permissão negada');return [{identifier:'event',title:'Teste',startDate:dueDate,endDate:new Date(+dueDate+3600000),isAllDay:false,calendar}]}},
  Reminder:{getIncompletes:async()=>[{identifier:'reminder',title:'Tarefa',dueDateComponents:{date:dueDate,hour:9,minute:30},calendar,isCompleted:false,priority:5}]},
  DateFormatter:class{},Keychain:{},Location:{},
  Data:{fromUint8Array:bytes=>{encodedBitmap=bytes;return {bytes}}},
  UIImage:{fromData:data=>({width:1,height:1,bytes:data.bytes})},
  fetch:async()=>{requests++;return {status:200,ok:true,text:async()=>'{"ok":true}'}}
};
const native={AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:spec=>Object.assign(params=>({name:spec.name,params}),{perform:spec.perform})},Widget:{reloadAll:()=>reloads++},
  Link:'Link',Button:'Button',Rectangle:'Rectangle',ZStack:'ZStack',Canvas:'Canvas'};
const uiModule=new Proxy(native,{get:(target,key)=>{
  if(key in globals)throw Error('Native utility incorrectly imported: '+String(key));
  return target[key];
}});
function load(name){
  name=name.replace(/\.(js|ts|tsx)$/,'');
  if(modules.has(name))return modules.get(name);
  const file=['.ts','.tsx','.js'].map(ext=>path.join(dir,name+ext)).find(fs.existsSync);
  const text=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'},reportDiagnostics:true});
  assert.equal(result.diagnostics.length,0,'Syntax diagnostics: '+name);
  const module={exports:{}};modules.set(name,module.exports);
  vm.runInNewContext(result.outputText,{...globals,module,exports:module.exports,Storage:storage,Date,URL,console,setTimeout,clearTimeout,
    createElement:(type,props,...children)=>({type,props,children}),
    require:id=>id==='scripting'?uiModule:load(id.replace('./',''))},{filename:file});
  modules.set(name,module.exports);return module.exports;
}
async function main(){
  const diagnostics=load('diagnostics');
  diagnostics.markPhase('teste do desenho',Date.now());
  assert.match(diagnostics.failureDetails(new TypeError('Falha nativa de teste')),/teste do desenho/);
  assert.match(diagnostics.failureDetails(new TypeError('Falha nativa de teste')),/TypeError: Falha nativa de teste/);
  assert.match(diagnostics.failureDetails(null),/null/);
  const originalSet=storage.set;storage.set=()=>{throw Error('Storage indisponível')};
  assert.doesNotThrow(()=>diagnostics.markPhase('não deve interromper o motor',Date.now()));
  storage.set=originalSet;
  const select=load('selection'),today=new Date(2026,9,22,12);
  assert.equal(select.localDay(select.resolveFocus(null,today)),'2026-10-22');
  assert.equal(select.resolveFocus(null,today).getHours(),0,'Today is a fixed full-day overview');
  for(const day of ['2026-10-18','2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24'])assert.equal(select.validateSelection(day,today),day);
  for(const day of ['2026-10-17','2026-10-25'])assert.throws(()=>select.validateSelection(day,today));
  assert.equal(select.localDay(select.resolveFocus({date:'2026-10-23',selectedOn:'2026-10-22'},today)),'2026-10-22');
  assert.equal(select.localDay(select.resolveFocus({date:'2026-10-23',selectedOn:'2026-10-21'},today)),'2026-10-22');
  for(const bad of ['2026-02-30','2026-13-01','invalid',null,{},'2020-01-01'])assert.throws(()=>select.validateSelection(bad,today));
  const {createHost}=load('host'),host=createHost(today);
  const bitmap=new host.DrawContext().makeRaster({width:1,height:1,pixels:new Uint8Array([255,0,0,255])});
  assert.deepEqual([...encodedBitmap.slice(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(bitmap.native.width,1);
  const graphSource=ts.transpileModule(fs.readFileSync(path.join(dir,'graph-view.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
  assert(!/scripting_\d+\.UIImage/.test(graphSource),'Graph must use the runtime-global UIImage');
  const events=await host.CalendarEvent.between(today,new Date(+today+86400000));
  assert.equal(events[0].title,'Teste');assert.equal(events[0].calendar.color.hex,'0088FF');
  calendar.color='rgba(255, 0, 0, 1.00)';
  assert.equal((await createHost(today).CalendarEvent.today())[0].calendar.color.hex,'ff0000','Native rgba must become valid Scriptable hex before chart/line creation');
  calendar.color='#0088FF';
  const reminders=await host.Reminder.incompleteDueToday();assert.equal(reminders[0].dueDate,+dueDate===+reminders[0].dueDate?dueDate:null);assert(reminders[0].dueDateIncludesTime);
  const files=host.FileManager.local();files.writeString('/safe','first');files.move('/safe','/next');assert.equal(files.readString('/next'),'first');assert(!files.fileExists('/safe'));
  denied=true;await assert.rejects(()=>createHost(today).CalendarEvent.today());
  await assert.rejects(()=>new host.Request('http://api.open-meteo.com').loadJSON());
  await assert.rejects(()=>new host.Request('https://unapproved.example').loadJSON());
  assert.equal(requests,0,'Invalid destinations are rejected before sending');
  assert.equal((await new host.Request('https://api.open-meteo.com/v1/forecast').loadJSON()).ok,true);
  const intent=load('app_intents').SelectDay;const now=new Date();
  await intent.perform({date:select.localDay(now)});assert.equal(reloads,1);assert(!store.has('selected-day'));
  await intent.perform({date:'2020-01-01'});assert.equal(reloads,2);assert(!store.has('selected-day'));
  const header=Array.from({length:7},(_,i)=>({date:`2026-10-${18+i}`,label:'Dia',x:i*156,y:4,width:150,height:100}));
  const view=load('timeline-view').TimelineView({model:{width:1092,height:510,image:{},header},width:364,height:170});
  assert.equal(view.children[1].type,'Link');assert.equal(view.children[1].props.url,'scripting://run_single/Calendar%20Timeline%20Scripting?refresh=1','Charts request reload through the foreground Calendar handoff');
  assert(!JSON.stringify(view).includes('CalendarTimelineSelectDay'),'Seven headers have no day action');
  const masked=load('graph-view').GraphView({image:{size:{width:1092,height:510},ops:[],outerClip:[['moveTo',4,4],['lineTo',1088,4],['closePath']]},width:364,height:170});
  assert.equal(masked.props.mask.type,'Canvas','Root graphic uses a contour mask');
  const clipCalls=[],clipContext=new Proxy({}, {get:(_,key)=>(...args)=>clipCalls.push([key,...args])});
  masked.props.mask.props.draw(clipContext,{width:364,height:170});
  assert(clipCalls.some(c=>c[0]==='moveTo'&&c[1]===4));assert(clipCalls.some(c=>c[0]==='fill'));
  // Syntax-check every entry and adapter, without fabricated Scripting declarations.
  for(const filename of fs.readdirSync(dir).filter(n=>/\.(ts|tsx|js)$/.test(n))){
    const result=ts.transpileModule(fs.readFileSync(path.join(dir,filename),'utf8'),{fileName:filename,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
    assert.equal(result.diagnostics.length,0,filename);
  }
  console.log('PASS: native globals/module separation, bitmap adapter, diagnostics, selection/reset/invalid dates, native data mapping, denied permission, cache move, network allowlist, day intent, source syntax.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
