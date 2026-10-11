// Real drawing functions; date-keyed fictional weather, synthetic fonts/icons.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const [beforeFile,afterFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw Error('Uso: node tools/preview-shared-header-motion.cjs antes depois saída.json');
const directory=path.join(__dirname,'..','tests');
const harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0].replace(/const source=fs.readFileSync[^;]+;/,'const source=SOURCE_TEXT;');
const result=[];
for(const [label,file] of [['ANTES',beforeFile],['DEPOIS',afterFile]]) {
 vm.runInNewContext(harness+`
 for(const n of ['titleDailyWeatherForDay','titleDailyTemperatureForDay','titleForecastForDay','dailyTemperatureExtremes','finiteWeatherNumber','weatherSymbolGroup','dateAtHour'])load(n);
 c.hourlyWeather={hours:[],daily:Object.fromEntries(Array.from({length:8},(_,i)=>['2026-10-'+(10+i),{minimum:19+i%3,maximum:29+i%3,symbol:'d1'}]))};
 c.drawTitleWeatherIcon=(_,forecast,x,y,size)=>{if(forecast){icons.push({x,y,size});ops.push({icon:{x,y,size}});}};
 for(const [day,hour,minute] of [[11,0,0],[11,0,54],[11,12,0],[11,20,34.27],[11,20,34.30],[11,23,59],[12,0,0]]) {
  c.windowStart=new Date(+new Date(2026,9,day,hour)+minute*60000);c.windowEnd=new Date(+c.windowStart+86400000);c.currentDayUnifiedPolygon.points=null;
  texts=[];paths=[];icons=[];ops=[];const cards=[];
  const original=c.drawTitleDayCard;c.drawTitleDayCard=(ctx,date,rect,selected,last,bg,txt)=>{if(txt)cards.push({date:c.dateKey(date),rect,selected});return original(ctx,date,rect,selected,last,bg,txt);};
  c.drawDatePanel(ctx,new Set());c.drawTitleDayCard=original;c.drawCurrentDayFrame(ctx);
  OUTPUT.push({label,day,hour,minute,staticHeader:c.titleDayCardRect(c.titleTodayCardIndex()).x===0,card:c.titleDayCardRect(c.titleTodayCardIndex()),midnight:c.timeToX(c.addDays(c.startOfDay(c.windowStart),1)),cards,ops,icons,left:paths.at(-2).path.points,upper:paths.at(-1).path.points});
 }
 `,{require,__dirname:directory,SOURCE_TEXT:fs.readFileSync(file,'utf8'),OUTPUT:result,label});
}
const before=result.filter(r=>r.label==='ANTES'),after=result.filter(r=>r.label==='DEPOIS'),plain=v=>JSON.parse(JSON.stringify(v));
for(let i=0;i<after.length;i++) {
 assert.deepEqual(plain(after[i].card),plain(before[i].card));assert.equal(after[i].midnight,before[i].midnight);
 assert.deepEqual(plain(after[i].left),plain(before[i].left),'Moldura e cantos preservados.');assert.deepEqual(plain(after[i].upper),plain(before[i].upper));
 const ordered=after[i].cards.slice().sort((a,b)=>a.rect.x-b.rect.x);
 assert(ordered[0].rect.x<=1.23,'Sem reserva precoce na primeira posição.');
 for(let j=1;j<ordered.length;j++)assert(ordered[j].date>ordered[j-1].date,'Cronologia na ordem visual.');
}
fs.writeFileSync(outputFile,JSON.stringify(result));console.log('OK: sete pares, início/meio/limite±segundos/fim/virada; cronologia contínua, mesma moldura de HOJE e régua.');
