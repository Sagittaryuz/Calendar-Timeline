// Usa o carregador e o programa completo publicados. Consultas e rasterização
// são doubles Scriptable; não é validação física no iPhone.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const loader=fs.readFileSync(path.join(root,'Calendar Timeline Loader'),'utf8');
const production=fs.readFileSync(path.join(root,'Calendar Timeline'),'utf8');
const files=new Map();let serial=0,requests=0,mode='offline',remote=production,status=200;
let writes=0,delivered=[],completed=0,probe={previews:0,calendarOpens:0,rainbow:0};
const cachePath='/documents/Calendar-Timeline-loader-code-v1.json';
const fm={documentsDirectory:()=>'/documents',joinPath:(...p)=>p.join('/'),fileExists:p=>files.has(p),
 readString:p=>{if(!files.has(p))throw Error('missing');return files.get(p);},
 writeString:(p,v)=>{files.set(p,v);writes++;},remove:p=>files.delete(p),
 move:(a,b)=>{files.set(b,files.get(a));files.delete(a);}};
const args={widgetParameter:'48',queryParameters:{refresh:'1',hours:'48',rainbow:'connect',custom:'café'},shortcutParameter:{keep:'value'}};
const config={runsInWidget:true,runsWithSiri:false,widgetFamily:'medium'};
const c={Date,Math,args,config,__probe:probe,FileManager:{local:()=>fm},UUID:{string:()=>String(++serial)},
 console:{log(){},error(){}},
 Script:Object.freeze({name:()=> 'Meu Calendário + Timeline',setWidget:w=>{delivered.push(w);},complete:()=>{assert(c.readCalendarCodeSnapshots(fm,cachePath).length>0,'Código válido é persistido antes de complete.');completed++;},setShortcutOutput(){}}),
 Safari:{open:url=>{assert.equal(url,'calshow://');probe.calendarOpens++;if(probe.failVersion===delivered.at(-1)?.version)throw Error('runtime after widget');}},
 Request:class {constructor(url){assert.equal(url,'https://raw.githubusercontent.com/Sagittaryuz/Calendar-Timeline/main/Calendar%20Timeline');this.response={statusCode:status};}
   async loadString(){requests++;assert.equal(this.timeoutInterval,8);assert.equal(this.headers['Cache-Control'],'no-cache');if(mode==='offline')throw Error('offline/timeout');return remote;}},
};
vm.createContext(c);
vm.runInContext(loader.replace('await runCalendarLoader();',''),c);
assert.equal(vm.runInContext('BUNDLED_CALENDAR_CODE',c),production,'Bootstrap incluído coincide byte a byte com o programa atual.');
assert.equal(vm.runInContext('BUNDLE_SHA256',c),crypto.createHash('sha256').update(production).digest('hex'));
// Toda compilação passa pela função original; apenas as operações nativas
// de coleta e desenho são substituídas, conservando a entrada principal real.
const compile=c.compileCalendarCode;
const doubles=`
async function configureRainbowKey(){__probe.rainbow++;}
async function loadWindow(){return {items:[],holidayDates:new Set(),error:null,freshness:{}};}
async function loadAstronomy(){return {latitude:-17.8,longitude:-51.7};}
async function loadHourlyWeather(){return {hours:[],daily:{},freshness:{}};}
async function loadAutomaticHolidays(){return new Set();}
async function makeWidget(){return {version:WIDGET_BUILD_VERSION,argsRef:args,configRef:config,scriptName:Script.name(),
  presentMedium:async()=>{__probe.previews++;}};}
`;
c.compileCalendarCode=code=>{const compiled=compile(code);return {...compiled,
 program:new compiled.program.constructor('args','config','Script',code+doubles)};};
const checkDelivery=()=>{
 const widget=delivered.at(-1);assert.equal(widget.argsRef,args);assert.equal(widget.configRef,config);
 assert.equal(widget.url,'calshow://');assert.equal(widget.scriptName,'Meu Calendário + Timeline');
 assert(widget.refreshAfterDate instanceof Date);
};
(async()=>{
 // Primeira inicialização offline funciona mesmo sem cache de código anterior.
 await c.runCalendarLoader();checkDelivery();assert.equal(delivered.at(-1).version,'2026.10.11.4');
 assert.equal(completed,1);assert.equal(requests,1);
 const first=files.get(cachePath),firstStamp=JSON.parse(first).fetchedAt;
 // Um cache antigo não pode reintroduzir o modal de refresh ou o rodapé.
 const obsoleteCode=production.replace('"2026.10.11.4"','"2026.10.10.3"');
 assert.throws(()=>c.compileCalendarCode(obsoleteCode),/anterior aos quadros fixos/);
 assert.throws(()=>c.compileCalendarCode(production.replace('"2026.10.11.4"','"2026.10.11.3"')),/anterior aos quadros fixos/,'Fallback anterior ao alinhamento também é recusado.');
 const obsolete={...JSON.parse(first),code:obsoleteCode,version:'2026.10.10.3',
   checksum:c.calendarCodeChecksum(obsoleteCode),fetchedAt:Date.now()};
 files.set(cachePath,JSON.stringify(obsolete));
 await c.runCalendarLoader();checkDelivery();assert.equal(delivered.at(-1).version,'2026.10.11.4');
 assert.equal(JSON.parse(files.get(cachePath)).fetchedAt,firstStamp);
 const before=writes;await c.runCalendarLoader();assert.equal(files.get(cachePath),first);
 assert.equal(writes,before,'Offline repetido não rejuvenesce nem troca o código bom.');
 assert.equal(requests,3,'Ainda tenta a fonte nova a cada execução.');
 assert.equal(JSON.parse(first).fetchedAt,firstStamp);
 // Online atualiza uma revisão nova; próxima execução offline usa essa revisão.
 mode='online';remote=production.replace('"2026.10.11.4"','"2026.10.11.5"');
 await c.runCalendarLoader();assert.equal(delivered.at(-1).version,'2026.10.11.5');
 const latest=files.get(cachePath);assert(files.has(cachePath+'.backup'));
 mode='offline';await c.runCalendarLoader();assert.equal(delivered.at(-1).version,'2026.10.11.5');assert.equal(files.get(cachePath),latest);
 // Respostas HTTP/HTML/JSON/vazias/truncadas/sintaticamente inválidas mantêm o último programa bom.
 for(const [body,http] of [[production,500],['<html>offline</html>',200],['{"error":"bad"}',200],['',200],
   [production.slice(0,3000),200],[production+'\nconst invalid = ;',200]]) {
  mode='online';remote=body;status=http;
  await c.runCalendarLoader();assert.equal(files.get(cachePath),latest);assert.equal(delivered.at(-1).version,'2026.10.11.5');
 }
 // Sintaxe válida, mas execução quebrada após setWidget: restaura o widget anterior e não promove código ruim.
 status=200;remote=production.replace('"2026.10.11.4"','"2026.10.11.9"');
 config.runsInWidget=false;probe.failVersion='2026.10.11.9';
 const deliveredBefore=delivered.length;await c.runCalendarLoader();
 assert.equal(delivered.length,deliveredBefore+2);assert.equal(delivered.at(-1).version,'2026.10.11.5');
 assert.equal(files.get(cachePath),latest);delete probe.failVersion;config.runsInWidget=true;
 // Corrupção ou ausência do arquivo principal recupera o backup; ambos inválidos usam o bundle.
 mode='offline';files.set(cachePath,'{corrupt');await c.runCalendarLoader();assert.equal(delivered.at(-1).version,'2026.10.11.4');
 files.delete(cachePath);await c.runCalendarLoader();assert.equal(delivered.at(-1).version,'2026.10.11.4');
 files.set(cachePath,latest);const tampered=JSON.parse(latest);tampered.code+='\n// corrupção';
 files.set(cachePath,JSON.stringify(tampered));files.set(cachePath+'.backup','invalid');
 await c.runCalendarLoader();assert.equal(delivered.at(-1).version,'2026.10.11.4');
 // Arquivo temporário corrompido e falha na instalação nunca perdem a cópia anterior.
 files.set(cachePath,latest);files.set(cachePath+'.backup',first);
 const candidate=c.calendarCodeSnapshot(production,JSON.parse(latest).fetchedAt+1);
 const move=fm.move;fm.move=()=>{throw Error('disk failure');};
 assert.equal(c.persistCalendarCode(fm,cachePath,candidate),false);fm.move=move;
 assert.equal(c.readCalendarCodeSnapshots(fm,cachePath)[0].version,'2026.10.11.5');
 assert(![...files.keys()].some(p=>p.endsWith('.tmp')));
 assert.equal(c.persistCalendarCode(fm,cachePath,c.calendarCodeSnapshot(production,1)),false);
 // Nome, queryParameters, parâmetro do widget e Atalhos atravessam o carregador sem mutação.
 files.set(cachePath,latest);config.runsInWidget=false;config.runsWithSiri=false;
 const argsBefore=JSON.stringify(args);await c.runCalendarLoader();checkDelivery();
 assert.equal(JSON.stringify(args),argsBefore);assert(probe.calendarOpens>0);assert(probe.rainbow>0);
 args.queryParameters={};await c.runCalendarLoader();assert(probe.previews>0);
 config.runsWithSiri=true;await c.runCalendarLoader();assert.equal(delivered.at(-1).argsRef.shortcutParameter,args.shortcutParameter);
 console.log('OK: inicialização offline sem cache, código novo primeiro, offline→online, backup/checksum, HTTP/HTML/JSON/sintaxe/runtime, escrita interrompida, args/config/nome, toque/prévia/Siri e complete após persistência.');
})().catch(e=>{console.error(e);process.exitCode=1;});
