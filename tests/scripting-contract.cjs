// Local behavioral checks. These do not stand in for iOS type/host validation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const root=path.join(__dirname,'..'),dir=path.join(root,'scripting/scripts/Calendar Timeline Scripting');
const store=new Map();
const storage={get:k=>store.get(k)??null,set:(k,v)=>{store.set(k,v);return true},contains:k=>store.has(k),remove:k=>store.delete(k)};
const modules=new Map();let reloads=0,writes=0,denied=false,requests=0;
const calendar={identifier:'cal',title:'Pessoal',color:'#0088FF'};
const dueDate=new Date(2026,9,23,9,30);
const native={
  CalendarEvent:{getAll:async()=>{if(denied)throw Error('Permissão negada');return [{identifier:'event',title:'Teste',startDate:dueDate,endDate:new Date(+dueDate+3600000),isAllDay:false,calendar}]}},
  Reminder:{getIncompletes:async()=>[{identifier:'reminder',title:'Tarefa',dueDateComponents:{date:dueDate,hour:9,minute:30},calendar,isCompleted:false,priority:5}]},
  AppIntentProtocol:{AppIntent:0},AppIntentManager:{register:spec=>spec},Widget:{reloadAll:()=>reloads++},
  fetch:async()=>{requests++;return {status:200,ok:true,text:async()=>'{"ok":true}'}}
};
function load(name){
  if(modules.has(name))return modules.get(name);
  const file=['.ts','.tsx','.js'].map(ext=>path.join(dir,name+ext)).find(fs.existsSync);
  const text=fs.readFileSync(file,'utf8');
  const result=ts.transpileModule(text,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'createElement'},reportDiagnostics:true});
  assert.equal(result.diagnostics.length,0,'Syntax diagnostics: '+name);
  const module={exports:{}};modules.set(name,module.exports);
  vm.runInNewContext(result.outputText,{module,exports:module.exports,Storage:storage,Date,URL,console,setTimeout,clearTimeout,
    require:id=>id==='scripting'?native:id==='./drawing'?{DrawContext:class{}}:load(id.replace('./',''))},{filename:file});
  modules.set(name,module.exports);return module.exports;
}
async function main(){
  const select=load('selection'),today=new Date(2026,9,22,12);
  assert.equal(select.localDay(select.resolveFocus(null,today)),'2026-10-22');
  assert.equal(select.localDay(select.resolveFocus({date:'2026-10-23',selectedOn:'2026-10-22'},today)),'2026-10-23');
  assert.equal(select.localDay(select.resolveFocus({date:'2026-10-23',selectedOn:'2026-10-21'},today)),'2026-10-22');
  for(const bad of ['2026-02-30','2026-13-01','invalid',null,{},'2020-01-01'])assert.throws(()=>select.validateSelection(bad,today));
  const {createHost}=load('host'),host=createHost(today);
  const events=await host.CalendarEvent.between(today,new Date(+today+86400000));
  assert.equal(events[0].title,'Teste');assert.equal(events[0].calendar.color.hex,'0088FF');
  const reminders=await host.Reminder.incompleteDueToday();assert.equal(reminders[0].dueDate,+dueDate===+reminders[0].dueDate?dueDate:null);assert(reminders[0].dueDateIncludesTime);
  const files=host.FileManager.local();files.writeString('/safe','first');files.move('/safe','/next');assert.equal(files.readString('/next'),'first');assert(!files.fileExists('/safe'));
  denied=true;await assert.rejects(()=>createHost(today).CalendarEvent.today());
  await assert.rejects(()=>new host.Request('http://api.open-meteo.com').loadJSON());
  await assert.rejects(()=>new host.Request('https://unapproved.example').loadJSON());
  assert.equal(requests,0,'Invalid destinations are rejected before sending');
  assert.equal((await new host.Request('https://api.open-meteo.com/v1/forecast').loadJSON()).ok,true);
  const intent=load('app_intents').SelectDay;const now=new Date();
  await intent.perform({date:select.localDay(now)});assert.equal(reloads,1);assert.equal(store.get('selected-day').selectedOn,select.localDay(now));
  await assert.rejects(()=>intent.perform({date:'2020-01-01'}));assert.equal(reloads,1);
  // Syntax-check every entry and adapter, without fabricated Scripting declarations.
  for(const filename of fs.readdirSync(dir).filter(n=>/\.(ts|tsx|js)$/.test(n))){
    const result=ts.transpileModule(fs.readFileSync(path.join(dir,filename),'utf8'),{fileName:filename,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
    assert.equal(result.diagnostics.length,0,filename);
  }
  console.log('PASS: selection/reset/invalid dates, native data mapping, denied permission, cache move, network allowlist, day intent, source syntax.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
