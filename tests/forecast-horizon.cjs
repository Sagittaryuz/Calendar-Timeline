process.env.TZ='America/Sao_Paulo';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','Calendar Timeline'),'utf8');
const c={Date,Intl,TITLE_CARD_COUNT:7,SETTINGS:{openMeteoForecastDays:5,openMeteoBaseURL:'https://api.open-meteo.com/v1/forecast'},windowStart:new Date(2026,9,9,18)};
vm.createContext(c);
function load(name){const re=new RegExp('(?:async )?function '+name+'\\('),m=re.exec(source);assert(m,name);const start=m.index,end=source.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(source.slice(start,start+1+end),c);}
for(const n of ['startOfDay','addDays','dateKey','dateAtHour','finiteWeatherNumber','weatherSymbolGroup','weatherCacheCoversFutureHeaderDays','parseWeatherTimestamp','openMeteoWeatherSymbol','loadOpenMeteoWeather','titleDailyWeatherForDay','titleDailyTemperatureForDay','titleForecastForDay'])load(n);
let response,requestedURL;
c.Request=class{constructor(url){requestedURL=url;}async loadJSON(){return response;}};
(async()=>{
 const times=Array.from({length:8},(_,n)=>c.dateKey(c.addDays(c.startOfDay(c.windowStart),n)));
 response={hourly:{time:times.map(t=>t+'T12:00'),temperature_2m:times.map(()=>25),weather_code:times.map(()=>3)},daily:{time:times,temperature_2m_min:times.map(()=>20),temperature_2m_max:times.map(()=>30),weather_code:times.map(()=>3)}};
 const weather=await c.loadOpenMeteoWeather({latitude:-23,longitude:-46});
 assert(requestedURL.includes('forecast_days=8'));assert(requestedURL.includes('timezone=America%2FSao_Paulo'));
 assert.deepEqual(Object.keys(weather.daily),times);assert.equal(new Date(weather.hours[0].timestamp).getHours(),12,'Local hourly noon stays noon');
 c.hourlyWeather=weather;
 const monday=new Date(2026,9,12);assert.equal(c.titleDailyTemperatureForDay(monday).maximum,30);assert.equal(c.titleForecastForDay(monday).symbol,'d3');assert.equal(c.dateKey(new Date(c.titleForecastForDay(monday).timestamp)),'2026-10-12');
 const now=Date.now(),cache={daily:Object.fromEntries(Object.entries(weather.daily).map(([k,v])=>[k,{...v,fetchedAt:now}])),hours:weather.hours};
 assert.equal(c.weatherCacheCoversFutureHeaderDays(cache,1800000,now),true);
 delete cache.daily['2026-10-12'];assert.equal(c.weatherCacheCoversFutureHeaderDays(cache,1800000,now),false,'Hourly coverage cannot conceal a missing daily forecast');
 cache.daily['2026-10-12']={...weather.daily['2026-10-12'],fetchedAt:now-3600000};assert.equal(c.weatherCacheCoversFutureHeaderDays(cache,1800000,now),false,'Old daily values cannot be refreshed by newer hours');
 // Absence is null, not invented next-day weather.
 c.hourlyWeather={hours:[],daily:{}};assert.equal(c.titleForecastForDay(monday),null);c.dailyTemperatureExtremes=()=>({});assert.equal(c.titleDailyTemperatureForDay(monday),null);
 for(const base of [new Date(2026,9,31),new Date(2026,11,31),new Date(2027,0,1)]){
   c.windowStart=base;const daily={};for(let n=0;n<8;n++)daily[c.dateKey(c.addDays(base,n))]={minimum:20,maximum:30,symbol:'d1',fetchedAt:now};
   assert(c.weatherCacheCoversFutureHeaderDays({daily},1800000,now));delete daily[c.dateKey(c.addDays(base,7))];assert.equal(c.weatherCacheCoversFutureHeaderDays({daily},1800000,now),false);
 }
 if(process.env.LIVE_FORECAST_JSON){response=JSON.parse(fs.readFileSync(process.env.LIVE_FORECAST_JSON,'utf8'));const live=await c.loadOpenMeteoWeather({latitude:-23,longitude:-46});c.hourlyWeather=live;assert(live.daily['2026-10-12']);assert(c.titleForecastForDay(monday));assert.equal(c.dateKey(new Date(c.titleForecastForDay(monday).timestamp)),'2026-10-12');console.log('LIVE: '+response.timezone+' daily '+Object.keys(live.daily)[0]+' to '+Object.keys(live.daily).at(-1)+'; Monday renders real API data.');}
 console.log('OK: 8 forecast days, local dates/noon, Monday, daily cache completeness/freshness, absent weather and month/year rollovers.');
})().catch(e=>{console.error(e);process.exitCode=1;});
