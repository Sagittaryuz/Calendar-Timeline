// Actual rain arbitration, countdown, thermal geometry and drawing; no live data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const directory=__dirname,harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0];
vm.runInNewContext(harness+`
for(const name of ['usesEvenHourCadence','isCompactMode','thermalRainEntries','rainQuarterKnownDry','nextSignificantRainEntry','rainCountdownText','rainRectsOverlap','temperatureRectAboveRain','rainCountdownLayout','drawRainCountdown','timelineRainSourceHours','buildThermalSamples','smoothThermalCurve','thermalTemperatureY','drawVisibleDailyExtremes','dailyTemperatureExtremes','orderedWeatherSamples','temperatureAtTimestamp','floorToHour','ceilToHour','finiteWeatherNumber','rainEvidenceForForecast','rainMillimetersForHour','weatherSymbolGroup','firstTickAtDisplayInterval','weatherDisplayIntervalHours','isSecondaryNightLegendHour','secondaryNightLegendColor','thermalBandTopY','thermalBandBottomY','thermalTemperatureLabelTopY','bottomLegendCenterY','estimatedTextWidth','weatherStripBottomY'])load(name);
c.windowHours=24;c.Color.white=()=>new Color('#fff');c.timelineStartLineItems=items=>items;
const H=3600000,Q=900000;
c.windowStart=new Date(2026,9,11);c.windowEnd=new Date(+c.windowStart+24*H);
function weather(rain={},radar=[]) {return {hours:Array.from({length:27},(_,i)=>{const hour=i-1;return {timestamp:+c.windowStart+hour*H,rainStartTimestamp:+c.windowStart+(hour-1)*H,temperature:22+5*Math.sin(hour*Math.PI/24),rainMM:rain[hour]??0,rainChance:80,symbol:rain[hour]?'d5':'d1',rainIntervals:radar.filter(r=>r.timestamp>=+c.windowStart+(hour-1)*H&&r.timestamp<+c.windowStart+hour*H)};})};}
const significant=weather({4:3,5:4});
assert.equal(c.nextSignificantRainEntry(significant.hours).timestamp,+c.windowStart+3*H);
assert.equal(c.rainCountdownText(+c.windowStart+3*H),'Chuva em 3h');
let layout=c.rainCountdownLayout(significant,[]);

assert(layout,'Legenda significativa tem espaço na curva térmica.');
assert.equal(layout.rect.x+layout.rect.width/2,c.timelineWidth()/2);
assert.equal(layout.targetX,c.timeToX(new Date(+c.windowStart+3*H)));
for(const amount of [0,0.1,0.5,1,2.99])assert.equal(c.nextSignificantRainEntry(weather({4:amount}).hours),null,'Barra pequena sem indicação.');
assert.equal(c.nextSignificantRainEntry(weather({0:4,1:4}).hours),null,'Chuva já iniciada.');
assert.equal(c.nextSignificantRainEntry(weather({1:4,5:4}).hours),null,'Chuva atual não recebe Chuva em, mesmo havendo episódio posterior.');
assert.equal(c.rainCountdownLayout(weather({4:4,13:4}),[]),null,'Não cobre barras grandes no centro.');
assert.equal(c.nextSignificantRainEntry(weather({1:0.5,2:4}).hours),null,'Intensificação não vira novo início.');
assert.equal(c.nextSignificantRainEntry([{timestamp:+c.windowStart+4*H,rainMM:4}]),null,'Não presume início com lacuna anterior.');
assert.equal(c.nextSignificantRainEntry(weather().hours.map(h=>({...h,rainMM:null,symbol:'d6',rainChance:100}))),null,'Probabilidade e símbolo não fabricam volume.');
assert.equal(c.rainCountdownLayout({hours:[]}),null);
assert.equal(c.rainCountdownLayout({hours:{invalid:true}}),null,'Cache incompleto não lança exceção.');
assert.equal(c.timelineRainSourceHours({hours:[null,{timestamp:+c.windowStart,temperature:null}]}).length,0);
assert.equal(c.rainCountdownLayout({hours:significant.hours.map(h=>({...h,temperature:null}))}),null,'Curva indisponível.');
assert.deepEqual(c.thermalRainEntries(significant.hours),c.thermalRainEntries(JSON.parse(JSON.stringify(significant.hours))),'Cache serializado conserva horários e volumes.');
const radarStart=+c.windowStart+3*H+Q;
const radar=[{timestamp:radarStart-Q,coveredMinutes:15,rainMM:0,rainRate:0,hasRain:false},
 {timestamp:radarStart,coveredMinutes:15,rainMM:3,rainRate:12,hasRain:true}];
assert.equal(c.nextSignificantRainEntry(weather({},radar).hours).timestamp,radarStart,'Nowcast respeita início de 15min.');
const duplicateRadar=weather({},[radar[0],radar[1],{...radar[1],rainMM:'3',rainRate:'12'}]);
assert.equal(c.thermalRainEntries(duplicateRadar.hours).find(r=>r.timestamp===radarStart).amount,3,'Radar duplicado não infla barra.');
assert.equal(c.rainCountdownLayout(weather({},[{timestamp:+c.windowStart,coveredMinutes:15,rainMM:0,rainRate:0,hasRain:false},{timestamp:+c.windowStart+Q,coveredMinutes:15,rainMM:3,rainRate:12,hasRain:true}]),[]),null,'Barra fora do contorno não recebe conexão sem alvo visível.');
const collision={start:new Date(+c.windowStart+12*H)};
assert.equal(c.rainCountdownLayout(significant,[collision]),null,'Linha de evento no centro tem prioridade.');
const drawn=[];const drawing={setFillColor(c){this.color=c;},fillRect(r){drawn.push({rect:r,color:this.color});},setTextAlignedCenter(){},setFont(){},setTextColor(){},drawTextInRect(t,r){drawn.push({text:t,rect:r});}};
c.drawRainCountdown(drawing,layout);
assert(drawn.some(v=>v.text==='Chuva em 3h'));
assert(drawn.filter(v=>!v.text).length>2,'Tracejado real até a barra.');
assert(!layout.obstacles.some(r=>c.rainRectsOverlap(r,layout.rect,1)),'Não colide com temperaturas/linhas.');
c.windowStart=new Date(2026,9,11,23);c.windowEnd=new Date(+c.windowStart+24*H);
assert.equal(c.rainCountdownText(+c.windowStart+2*H),'Chuva em 2h');
assert(c.rainCountdownLayout(weather({3:4}),[]),'Amanhã mantém contagem desde agora.');
`,{require,__dirname:directory,console});
console.log('OK: significativo/pequeno/em curso/ausente, início conhecido, radar/dedup, cache, dados incompletos, colisões, desenho e meia-noite.');
