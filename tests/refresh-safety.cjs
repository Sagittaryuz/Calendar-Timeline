// Fontes reais sob doubles Scriptable: nenhuma agenda pessoal ou rede.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','Calendar Timeline'),'utf8');
const files=new Map();let writes=0,id=0,requests=0;
const fm={documentsDirectory:()=>'/data',joinPath:(...p)=>p.join('/'),
 fileExists:p=>files.has(p),readString:p=>{if(!files.has(p))throw Error('missing');return files.get(p);},
 writeString:(p,v)=>{files.set(p,v);writes++;},remove:p=>files.delete(p),
 move:(a,b)=>{files.set(b,files.get(a));files.delete(a);}};
const now=new Date(2026,9,10,19,30),day=new Date(2026,9,10),end=new Date(2026,9,11);
const c={Date,UUID:{string:()=>String(++id)},FileManager:{local:()=>fm},
 SETTINGS:{showOverdueReminders:true,selectedCalendarIdentifiers:[],excludedCalendars:[],weatherCacheMinutes:30,rainbowCacheMinutes:15},
 now,windowStart:now,windowEnd:new Date(+now+86400000),
 startOfDay:d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()),
 addDays:(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),
 dateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
 normalizeSearchText:v=>v,titleWeekStart:()=>day,TITLE_CARD_COUNT:7,
 WEATHER_HOUR_MS:3600000,WEATHER_QUARTER_MS:900000,WEATHER_SAMPLE_ORDER_CACHE:new WeakMap()};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('async function loadWindow('),source.indexOf('async function loadAstronomy(')),c);
vm.runInContext(source.slice(source.indexOf('function finiteWeatherNumber('),source.indexOf('async function showForecaConnectionError(')),c);
function load(name){const start=source.indexOf('function '+name+'(');const next=source.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(source.slice(start,start+next+1),c);}
load('sourceFreshnessText');load('emptyHourlyWeather');
const item=(kind,title)=>({kind,title,identifier:title,start:new Date(+now+60000),end,color:'#0088ff'});
const live=(event=true,reminder=true)=>({items:[...(event?[item('event','Evento')]:[]),...(reminder?[item('reminder','Tarefa')]:[])],
 scheduleCountsByDay:{'2026-10-10':{events:event?1:0,reminders:reminder?1:0}},holidayDates:new Set(),
 todayEventCount:event?1:0,todayReminderCount:reminder?1:0,todayBusyMinutes:30,todayFreeMinutes:1410,
 partialErrors:event&&reminder?[]:['permission'],error:event||reminder?null:'permission',sourceStatus:{event,reminder}});
const eventPath='/data/Calendar-Timeline-event-snapshot-v1.json';
const weatherPath='/data/Calendar-Timeline-weather-v3.json';
(async()=>{
 let state=live();c.loadLiveWindow=async()=>structuredClone(state);
 const good=await c.loadWindow();assert.equal(good.items.length,2);
 assert(files.has(eventPath));const valid=files.get(eventPath),saved=JSON.parse(valid).fetchedAt;
 state=live(false,false);const before=writes;
 const offline=await c.loadWindow();assert.equal(offline.items.length,2);
 assert(offline.items.every(i=>i.isCached&&i.start instanceof Date));
 assert.equal(offline.freshness.event.fetchedAt,saved);assert.equal(writes,before);
 assert.match(c.sourceFreshnessText('C',offline.freshness.event),/cache/);
 state=live(false,true);state.items[0].title='Tarefa atual';
 const partial=await c.loadWindow();assert(partial.items.some(i=>i.title==='Tarefa atual'));
 assert(partial.items.some(i=>i.title==='Evento'&&i.isCached));assert.equal(files.get(eventPath),valid);
 // Cache corrompido recupera a cópia anterior sem trocar a data original.
 files.set(eventPath+'.backup',valid);files.set(eventPath,'{bad JSON');state=live(false,false);
 const corrupted=await c.loadWindow();assert(corrupted.items.some(i=>i.title==='Evento'));
 files.delete(eventPath);assert((await c.loadWindow()).items.some(i=>i.title==='Evento'));
 // Sem cache e sem permissão: ausência explícita, sem inventar fontes.
 files.clear();assert.equal((await c.loadWindow()).items.length,0);
 assert.equal((await c.loadWindow()).freshness.event.source,'missing');
 state=live();await c.loadWindow();state=live();state.items=[];state.scheduleCountsByDay={};
 const empty=await c.loadWindow();assert.equal(empty.items.length,0,'Agenda vazia válida substitui uma cópia antiga.');
 assert.equal(JSON.parse(files.get(eventPath)).items.length,0);
 // Uma resposta inválida jamais substitui a última cópia boa.
 state=live();await c.loadWindow();const prior=files.get(eventPath);
 state.items[0].start=new Date(NaN);state.sourceStatus.event=true;
 const bad=await c.loadWindow();assert.equal(files.get(eventPath),prior);assert.equal(bad.freshness.event.source,'cache');
 // Execução fora de ordem não regride o snapshot.
 const current=JSON.parse(prior);assert.equal(c.writeSafeSnapshot(fm,eventPath,{...current,fetchedAt:current.fetchedAt-1},c.validScheduleSnapshot),false);
  assert.equal(c.validScheduleSnapshot({...current,items:[{...current.items[0],start:null}]}),false);
  const move=fm.move;fm.move=()=>{throw Error('interrupted write');};
  assert.equal(c.writeSafeSnapshot(fm,eventPath,{...current,fetchedAt:current.fetchedAt+1},c.validScheduleSnapshot),false);
  assert.equal(c.readSafeSnapshot(fm,eventPath,c.validScheduleSnapshot).fetchedAt,current.fetchedAt,
    'Falha na instalação do arquivo mantém a cópia anterior recuperável.');
  fm.move=move;
 // Revalida filtros do usuário antes de usar dados salvos.
 c.SETTINGS.excludedCalendars=['Outra lista'];state=live(false,false);
 assert.equal((await c.loadWindow()).items.length,0);c.SETTINGS.excludedCalendars=[];
 // Clima sempre tenta as fontes antes da cópia; falhas conservam conteúdo e data.
 const location={latitude:-17.8,longitude:-51.7};
 let mode='good',temp=23;
 c.loadRainbowKey=()=>null;c.loadStoredForecaCredentials=()=>null;
 c.loadOpenMeteoWeather=async()=>{requests++;if(mode==='throw')throw Error('timeout/JSON');if(mode==='invalid')return {hours:[],daily:{}};return {hours:[{timestamp:+now,temperature:temp}],daily:{}};};
 c.loadMetNorwayWeather=async()=>null;c.buildHourlyWeather=(hours,daily)=>({hours,daily});
 const weather=await c.loadHourlyWeather(location);assert.equal(weather.freshness.source,'live');
 assert(files.has(weatherPath));const weatherGood=files.get(weatherPath),weatherSaved=weather.freshness.fetchedAt;
 for(const failure of ['throw','invalid']) {
  mode=failure;const before=writes,oldRequests=requests;
  const fallback=await c.loadHourlyWeather(location);
  assert.equal(requests,oldRequests+1);assert.equal(writes,before);
  assert.equal(fallback.freshness.source,'cache');assert.equal(fallback.freshness.fetchedAt,weatherSaved);
  assert.equal(files.get(weatherPath),weatherGood);
 }
 mode='good';temp=28;const updated=await c.loadHourlyWeather(location);
 assert.equal(updated.hours[0].temperature,28,'Online substitui imediatamente o cache ainda recente.');
 files.set(weatherPath,'corrupt');mode='throw';
 assert.equal((await c.loadHourlyWeather(location)).freshness.source,'cache','Recupera o backup meteorológico.');
 files.clear();const missing=await c.loadHourlyWeather(location);assert.equal(missing.freshness.source,'missing');assert.equal(missing.hours.length,0);
 // Provedor HTTP 500 com JSON aparentemente aproveitável é rejeitado.
 load('parseWeatherTimestamp');c.SETTINGS.openMeteoForecastDays=5;
 c.Request=class{constructor(){this.response={statusCode:500};}async loadJSON(){return {hourly:{time:[now.toISOString()],temperature_2m:[25]}};}};
 const start=source.indexOf('async function loadOpenMeteoWeather('),next=source.slice(start+1).search(/\n(?:async )?function /);
 vm.runInContext(source.slice(start,start+next+1),c);
 await assert.rejects(()=>c.loadOpenMeteoWeather(location),/HTTP 500/);
 // Timeout local não apaga snapshots e o Timer é invalidado.
 let invalidated=0;c.Timer={schedule:(_,__,callback)=>{queueMicrotask(callback);return {invalidate(){invalidated++;}};}};
 await assert.rejects(()=>c.boundedLocalRead(new Promise(()=>{})),/Tempo/);assert.equal(invalidated,1);
 console.log('OK: rede primeiro, clique repetido, offline→online, fontes independentes, vazio válido, permissão, timeout, HTTP/JSON, corrupção/backup, filtros e ordem de execução.');
})().catch(e=>{console.error(e);process.exitCode=1;});
