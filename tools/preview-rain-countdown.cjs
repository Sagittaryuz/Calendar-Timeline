// Draw production thermal/rain functions with fictional weather and mock Scriptable APIs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const [beforeFile,afterFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw Error('Uso: node tools/preview-rain-countdown.cjs antes depois saída.json');
const directory=path.join(__dirname,'..','tests');
const harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0].replace(/const source=fs.readFileSync[^;]+;/,'const source=SOURCE_TEXT;').replace('assert(start>=0,name);','if(start<0)return;');
const names=fs.readFileSync(path.join(directory,'rain-countdown.cjs'),'utf8').match(/for\(const name of (\[[^\n]+\])/)[1];
const extra=['drawCompactThermalBand','drawThermalRainBars','drawRainBar','drawRainTopMarker','rainTopMarkerTopY','solarLineY','timelineChartTop','drawThermalArea','drawThermalCurve','thermalTemperatureColor','thermalSmoothstep'];
const result=[];
for(const [label,file] of [['ANTES',beforeFile],['DEPOIS',afterFile]])vm.runInNewContext(harness+`
for(const name of ${names})load(name);for(const name of ${JSON.stringify(extra)})load(name);
c.windowHours=24;c.Color.white=()=>new Color('#fff');c.timelineStartLineItems=()=>[];
ctx.drawTextInRect=(text,rect)=>ops.push({textRect:{text,rect,size:font},color});ctx.setTextAlignedCenter=()=>{};
const paintBar=c.drawRainBar;let bars=[];c.drawRainBar=(ctx,rect,color)=>{bars.push(rect);return paintBar(ctx,rect,color);};
const H=3600000;const cases=[{name:'Chuva significativa futura',hour:0,rain:{4:3,5:4}},
 {name:'Barras pequenas / garoa',hour:0,rain:{4:0.2,5:0.5}},
 {name:'Chuva ja iniciada',hour:0,rain:{0:4,1:4}},
 {name:'Chuva depois da meia-noite',hour:23,rain:{3:4,4:4}}];
for(const fixture of cases) {
 c.windowStart=new Date(2026,9,11,fixture.hour);c.windowEnd=new Date(+c.windowStart+24*H);
 const weather={hours:Array.from({length:27},(_,i)=>{const hour=i-1;return {timestamp:+c.windowStart+hour*H,rainStartTimestamp:+c.windowStart+(hour-1)*H,temperature:22+5*Math.sin(hour*Math.PI/24),rainMM:fixture.rain[hour]??0,rainChance:80,symbol:fixture.rain[hour]?'d5':'d1'};})};
 texts=[];paths=[];icons=[];ops=[];bars=[];
 const layout=label==='DEPOIS'?c.rainCountdownLayout(weather,[]):null;
 c.drawCompactThermalBand(ctx,weather,layout?.rect);const curve=paths.at(-1).path.points;c.drawThermalRainBars(ctx,weather.hours,c.weatherStripBottomY()+run('TITLE_TIMELINE_GAP_ADJUSTMENT'),c.thermalBandBottomY());
 if(label==='DEPOIS')c.drawRainCountdown(ctx,layout);
 OUTPUT.push({label,name:fixture.name,layout,bars,curve,top:c.thermalTemperatureLabelTopY()-12,bottom:c.thermalBandBottomY()+25,ops});
}
`,{require,__dirname:directory,SOURCE_TEXT:fs.readFileSync(file,'utf8'),OUTPUT:result,label});
assert(result.filter(r=>r.label==='DEPOIS'&&r.layout).length===2);
for(let i=0;i<4;i++){assert.equal(JSON.stringify(result[i].bars),JSON.stringify(result[i+4].bars),'Barras conservam volume, posição e altura.');assert.equal(JSON.stringify(result[i].curve),JSON.stringify(result[i+4].curve),'Curva conserva todos os pontos.');}
fs.writeFileSync(outputFile,JSON.stringify(result));console.log('OK: quatro pares de chuva/garoa/em curso/meia-noite, funções reais e dados fictícios.');
