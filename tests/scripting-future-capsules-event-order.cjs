const assert=require('node:assert/strict');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');
const probe=compile(raw.replace('return {temporal:',
  'return {selected:selectedItems,blur:shouldBlurFutureTimeline(),temporal:'));
const h=3600000;
const at=(day,hour=0)=>new Date(2026,10,day,hour);
const t=(id,start,end,extra={})=>({kind:'event',identifier:id,title:id,start,end,color:'#FF9500',isAllDay:false,...extra});
const temp=o=>o.type==='text'&&/^-?\d+°$/.test(o.text);
const equal=(a,b)=>Math.abs(a-b)<1e-6;

(async()=>{
 const {host,options}=await fixture(),now=at(24,12);
 const weather={daily:{},hours:Array.from({length:28},(_,i)=>({
   timestamp:+now+i*h,temperature:23,rainRate:2,rainMM:2,rainChance:100,cloudiness:20,symbol:'d5'
 }))};
 const ongoing=t('overnight',at(24,22),at(25,5));
 const clear=await probe(host,options(now,[],{hourlyWeather:weather}));
 assert(!clear.blur);
 assert(clear.image.ops.some(o=>temp(o)&&equal(o.rect.x+o.rect.width/2,clear.temporal.midnightX)));
 assert(!clear.image.ops.some(o=>o.image?.blurRadius&&flatten(o.image).some(temp)));

 const active=await probe(host,options(now,[ongoing],{hourlyWeather:weather}));
 assert(active.blur);
 const layer=active.image.ops.find(o=>o.image?.blurRadius&&flatten(o.image).some(temp));
 assert(layer,'Temperature foreground must receive native blur');
 const blurredTemps=layer.image.ops.filter(temp);
 assert(blurredTemps.length>1);
 assert(blurredTemps.every(o=>o.rect.x+o.rect.width/2>active.temporal.midnightX+1e-6),
   'Only pills after midnight belong in the blurred layer');
 assert(layer.image.ops.some(o=>o.type==='fillEllipse'&&o.state?.fill?.alpha===1
   &&blurredTemps.some(p=>equal(o.rect.y,p.rect.y))),
 'The pill background shares the same blurred surface as the digits');
 const sharpTemps=active.image.ops.filter(temp);
 assert(sharpTemps.some(o=>equal(o.rect.x+o.rect.width/2,active.temporal.midnightX)),
   'The midnight boundary capsule stays sharp');
 assert(sharpTemps.every(o=>o.rect.x+o.rect.width/2<=active.temporal.midnightX+1e-6));
 assert.equal(sharpTemps.length+blurredTemps.length,clear.image.ops.filter(temp).length);
 const old=clear.image.ops.filter(temp);
 for(const o of [...sharpTemps,...blurredTemps]){
   assert(old.some(p=>p.text===o.text&&equal(p.rect.x,o.rect.x)&&equal(p.rect.y,o.rect.y)
     &&equal(p.rect.width,o.rect.width)&&equal(p.rect.height,o.rect.height)));
 }
 const future=await probe(host,options(now,[ongoing],{hourlyWeather:weather,focusDate:+at(25)}));
 assert(!future.blur,'No extra blur when navigating explicitly to that day');
 assert(!future.image.ops.some(o=>o.image?.blurRadius&&flatten(o.image).some(temp)));

 const cross=t('ongoing all day',at(23),at(26),{isAllDay:true});
 const holiday=t('holiday',at(25),at(26),{isAllDay:true,isHoliday:true});
 const allDay=t('single all day',at(24),at(25),{isAllDay:true});
 const todayTimed=[t('timed 1',at(24,14),at(24,18)),t('timed 2',at(24,14),at(24,19))];
 const tomorrowTimed=[t('timed 3',at(25,1),at(25,5)),t('timed 4',at(25,3),at(25,7))];
 const items=[holiday,allDay,cross,...todayTimed,...tomorrowTimed,ongoing];
 const saved=JSON.stringify(items), view=await probe(host,options(now,items));
 assert.equal(JSON.stringify(items),saved,'Source agenda dates are untouched');
 for(const day of [24,25]){
   const start=at(day),end=at(day+1);
   const rows=view.selected.filter(i=>i.kind==='event'&& i.start<end&&i.end>start);
   const timed=rows.filter(i=>!i.isAllDay);
   const whole=rows.filter(i=>i.isAllDay);
   assert.equal(whole.length,2);
   assert(timed.length>1);
   assert(Math.max(...timed.map(i=>i.gridRow))<Math.min(...whole.map(i=>i.gridRow)));
   assert(whole.every(i=>+i.start===+start&&+i.end===+end));
 }
 console.log('PASS: future pill text+fill share native blur; boundary, current and selected day stay sharp; timed/overnight/all-day/holiday and multi-day order; source and pill geometry preserved.');
})().catch(e=>{console.error(e);process.exit(1)});
