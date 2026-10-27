const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),vm=require('node:vm'),{buildSync}=require('esbuild');
const relative='scripting/scripts/Calendar Timeline Scripting/',root=path.resolve(__dirname,'..'),dir=path.join(root,relative),base='565bba1';
const old=cp.execFileSync('git',['ls-tree','-r','--name-only',base,'--',relative],{cwd:root,encoding:'utf8'}).trim().split('\n').map(p=>path.basename(p));
assert.deepEqual(fs.readdirSync(dir).sort(),old.sort(),'Active package contains exactly the original 25 files');
const changed=new Set(['diagnostics.ts','script.json','widget.tsx','index.tsx','timeline-view.tsx','bridge-client.ts','bridge-real.ts','original-engine.js','app_intents.tsx','model.ts','drawing.js','widget-refresh.ts','selection.ts']);let identical=0;
for(const name of old)if(!changed.has(name)){assert(fs.readFileSync(path.join(dir,name)).equals(cp.execFileSync('git',['show',base+':'+relative+name],{cwd:root})),name+' must match the original byte for byte');identical++}
const descriptor=JSON.parse(fs.readFileSync(path.join(dir,'script.json'),'utf8'));assert(fs.readFileSync(path.join(dir,'diagnostics.ts'),'utf8').includes("VERSION='"+descriptor.version+"'"));
assert(!fs.readFileSync(path.join(dir,'index.tsx'),'utf8').includes('day-screen'));assert(!fs.readFileSync(path.join(dir,'widget.tsx'),'utf8').includes('pro-common'));
const moduleObject={exports:{}},values=new Map(),calendar={identifier:'list',title:'Boletos',type:'calDAV',allowsContentModifications:true};let saves=0;
const item={identifier:'r',title:'Fixture recorrente',calendar,hasRecurrenceRules:true,hasAttendees:false,isCompleted:false,dueDateComponents:{year:2026,month:10,day:23},recurrenceRules:[{frequency:'monthly'}],notes:'Preservar',alarms:['Preservar']};
const code=buildSync({entryPoints:[path.join(dir,'bridge-real.ts')],bundle:true,write:false,platform:'node',format:'cjs'}).outputFiles[0].text;
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,Date,Storage:{get:k=>values.get(k)??null,set:(k,v)=>{values.set(k,v);return true}},Calendar:{forReminders:async()=>[calendar],forEvents:async()=>[calendar]},Reminder:{getAll:async()=>[item]}});
item.save=async()=>{saves++};
(async()=>{
 const api=moduleObject.exports,baseline=api.projectReal('reminder',item),command={id:'one-completion',kind:'reminder',action:'complete',itemId:item.identifier,baseline,expectedRevision:api.writeRevision(baseline),payload:{}};
 const capabilities=await api.realCapabilities(descriptor.version);assert.equal(capabilities.protocol,1);assert(capabilities.features.includes('recurring-reminders-v1'));
 assert.equal((await api.executeReal(command)).status,'applied');assert(item.isCompleted);assert.equal(saves,1);assert.equal((await api.executeReal(command)).status,'applied');assert.equal(saves,1,'Retry must not complete another repetition');assert.deepEqual(item.recurrenceRules,[{frequency:'monthly'}]);assert.equal(item.notes,'Preservar');assert.deepEqual(item.alarms,['Preservar']);
 console.log(`PASS recovery: original 25-file structure, ${identical} byte-identical originals, coherent version, no Pro dependency, recurring completion/readback, rules/notes/alarms preserved, no duplicate write. Native iPhone compilation remains unverified.`);
})().catch(e=>{console.error(e);process.exitCode=1});
