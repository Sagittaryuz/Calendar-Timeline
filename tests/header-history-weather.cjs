// Uses real date-keyed weather selectors and drawing code; no live sources.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const directory=__dirname;
const harness=fs.readFileSync(path.join(directory,'moving-day-header.cjs'),'utf8').split('let count=0;const snapshots=[];')[0];
vm.runInNewContext(harness+`
for(const name of ['titleDailyWeatherForDay','titleDailyTemperatureForDay','titleForecastForDay','dailyTemperatureExtremes','finiteWeatherNumber','weatherSymbolGroup','dateAtHour'])load(name);
c.windowStart=new Date(2026,9,11,0,20);c.windowEnd=new Date(+c.windowStart+86400000);
c.hourlyWeather={daily:{'2026-10-10':{minimum:18,maximum:27,symbol:'d3'},'2026-10-12':{minimum:24,maximum:33,symbol:'d1'}},hours:[]};
assert.equal(c.titleDailyTemperatureForDay(new Date(2026,9,10)).maximum,27);
assert.equal(c.titleForecastForDay(new Date(2026,9,10)).symbol,'d3');
assert.equal(c.titleDailyTemperatureForDay(new Date(2026,9,9)),null,'Sem histórico não usa a previsão futura.');
assert.equal(c.titleForecastForDay(new Date(2026,9,9)),null);
c.hourlyWeather.daily['2026-10-09']={minimum:null,maximum:null};
c.hourlyWeather.hours=[{timestamp:+new Date(2026,9,9,12),temperature:null},{timestamp:+new Date(2026,9,12,12),temperature:33,symbol:'d1'}];
assert.equal(c.titleDailyTemperatureForDay(new Date(2026,9,9)),null,'Null não vira zero nem extrema inventada.');
texts=[];icons=[];c.drawTitleWeatherIcon=(_,forecast,x,y,size)=>{if(forecast)icons.push({forecast,x,y,size});};
c.drawTitleDayCard(ctx,new Date(2026,9,9),c.titleDayCardRect(c.titleTodayCardIndex()-2,4),false,false,false,true);
assert.deepEqual(texts.slice(-2).map(t=>t.t),['--º','--º'],'Ausência histórica fica visível.');assert.equal(icons.length,0);
`,{require,__dirname:directory});
console.log('OK: clima histórico por data, nenhum futuro emprestado, null sem zero e --º sem ícone quando ausente.');
