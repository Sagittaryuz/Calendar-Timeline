// Real engine with synthetic forecasts. No personal weather or calendar data.
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {compile,fixture,flatten,raw}=require('./scripting-rolling.cjs');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baseline=cp.execFileSync('git',['show','2347d27:'+engine],{encoding:'utf8'});
const probe=s=>compile(s.replace('return {temporal:',`return {weatherGeometry:{
  astro:weatherIconCenterY()+weatherIconSize()/2,
  moon:weatherIconCenterY()+dayBoundaryAstroOuterRadius(),
  bottom:thermalBandBottomY(), panelY:CANVAS.timelineTop,
  ticks:weatherConditionTicks(hourlyWeather).map(({tick}) => ({
    timestamp:+tick,x:timeToX(tick),hour:tick.getHours()
  })),
  top:timelineChartTop(), axis:typeof timelineWeatherGridTopY==="function"?timelineWeatherGridTopY():solarLineY(), solar:solarLineY(), bottomChart:timelineChartBottom()},temporal:`));
const before=probe(baseline),after=probe(raw);
const h=3600000;
const temperatures=[[-6,'1261C9'],[18,'0A84FF'],[20,'12A9D8'],[22,'20B7A5'],[24,'51B866'],[27,'E8C229'],[29,'FF9500'],[34,'FF1F1F']];
const close=(a,b)=>Math.abs(a-b)<1e-6;
const rain=op=>op.type==='fillRect'&&op.state?.fill?.hex==='17BAEC'&&op.state.fill.alpha===1&&op.rect.width<=8;
async function main(){
 const {d,host,options}=await fixture();
 let scenes=0,labels=0,bars=0;
 for(const [year,month,day,hour,minute] of [[2026,10,22,0,0],[2026,10,22,6,17],[2026,10,22,11,0],[2026,10,22,18,0],[2026,11,31,23,59]])
 for(const mode of ['dry','varied rain','missing']){
  const now=new Date(year,month,day,hour,minute),start=new Date(now);start.setMinutes(0,0,0);
  const weather={daily:{},hours:mode==='missing'?[]:Array.from({length:32},(_,i)=>{
   const amount=mode==='dry'?0:[0,0.4,2,4,10,13,0,0][i%8];
   return {timestamp:+start+i*h,temperature:temperatures[i%8][0],rainRate:amount,rainMM:amount,
     rainChance:amount?100:0,cloudiness:amount?90:15,symbol:amount?'d5':'d0'};
  })};
  const midnight=new Date(now);midnight.setHours(0,0,0,0);
  const items=Array.from({length:7},(_,i)=>({kind:'event',identifier:'agenda-'+i,
    title:'SYNTHETIC EVENT '+i,start:new Date(+now+h),end:new Date(+now+6*h),color:'#FF9F0A',isAllDay:false}));
  items.push({kind:'event',identifier:'allday',title:'SYNTHETIC ALL-DAY',start:midnight,
    end:new Date(+midnight+24*h),color:'#FF4500',isAllDay:true});
  const config=options(now,items,{hourlyWeather:weather});
  const [old,next]=await Promise.all([before(host,config),after(host,config)]);
  for(const field of ['header','hourLegend','thermalBand','temporal'])
   assert.deepEqual(next[field],old[field],field+' unchanged');
  const inset=32;
  const {top,bottomChart,solar,...stable}=next.weatherGeometry;
  const {top:oldTop,bottomChart:oldBottom,solar:oldSolar,...oldStable}=old.weatherGeometry;
  assert(solar>oldSolar,"Solar line shifts down to center of capsules");
  assert.deepEqual(stable,oldStable,'No clock, astro or grid movement');
  assert(close(top,oldTop+inset)&&close(bottomChart,oldBottom+inset),'Move only the chart band, preserving its height');
  assert(close(next.touchSplit.y,old.touchSplit.y+inset),'Tap boundary follows the adjusted chart band');
  const moved=next.touchSplit.charts.map(r=>({...r,y:r.y-inset}));
  assert(moved.length>=5,'Dense agenda fills the chart band');
  for(let i=0;i<moved.length;i++)for(const prop of ['x','y','width','height'])
   assert(close(moved[i][prop],old.touchSplit.charts[i][prop]),'Chart geometry changes only by the fixed y translation');
  assert.deepEqual(next.panel,old.panel,'All-day/event selection and counts unchanged');
  const ops=flatten(next.image),earlier=flatten(old.image);
  const printed=ops.filter(op=>op.type==='text'&&/^-?\d+°$/.test(op.text)&&next.weatherGeometry.ticks.some(t=>close(t.x,op.rect.x+op.rect.width/2)&&close(op.rect.y,next.weatherGeometry.panelY+next.weatherGeometry.astro+510/484)));
  assert.equal(ops.filter(op=>op.type==='text'&&/^-?\d+º$/.test(op.text)&&op.rect&&op.rect.y>=next.weatherGeometry.bottom-65&&op.rect.y<next.weatherGeometry.bottom).length,0,'No duplicate lower thermal labels');
  assert.equal(ops.filter(op=>op.type==='strokePath'&&op.state?.stroke?.hex==='FFFFFF'&&op.state.stroke.alpha===0.95&&op.path?.length>100).length,0,'No lower thermal curve path');
  if(mode==='missing') assert.equal(printed.length,0,'Do not fabricate temperatures');
  else {
   assert(printed.length>=11&&printed.length<=13,'One temperature per visible astro that has weather data');
   for(const op of printed){
    const x=op.rect.x+op.rect.width/2;
    const tick=next.weatherGeometry.ticks.find(t=>close(t.x,x));
    assert(tick,'Text centered on actual astro timestamp');
    const source=weather.hours.find(candidate=>candidate.timestamp===tick.timestamp);
    assert(source,'Fixture has a forecast at the timestamp');
    assert.equal(op.text,source.temperature+'°');
    const base=next.weatherGeometry.panelY+next.weatherGeometry.astro;
    assert(op.rect.y>base&&op.rect.y<base+4,'One shared top below regular astro, including midnight');
    assert(close(op.rect.y+op.rect.height/2,next.weatherGeometry.panelY+solar),'Solar line hits every capsule center');
    assert(op.rect.y+op.rect.height<=next.weatherGeometry.panelY+top,'Weather labels stop above all charts');
    const fill=temperatures.find(([t])=>t===source.temperature)[1];
    assert(ops.some(p=>p.type==='fillEllipse'&&p.state?.fill?.hex?.toUpperCase()===fill&&p.rect.y>base&&p.rect.y<base+3&&p.rect.x>=op.rect.x-1e-6&&p.rect.x<op.rect.x+op.rect.width),JSON.stringify({x,base,fill, op: op.rect, ellipses:ops.filter(p=>p.type==='fillEllipse'&&p.state?.fill?.hex?.toUpperCase()===fill).slice(-10).map(p=>p.rect)}));
    const hourFont=ops.find(p=>p.type==='text'&&/^\d+h$/.test(p.text)).state.font.size;
    assert.equal(op.state.font.size,hourFont,'Temperature shares the hour font size');
    if(mode==='dry')assert.equal(op.state.text.hex,['1261C9'].includes(fill)?'FFFFFF':'000000');
   }
  }
  const previousBars=earlier.filter(rain),newBars=ops.filter(op=>rain(op)&&close(op.rect.y,solar));
  assert.equal(newBars.length,previousBars.length,'Precipitation evidence/quarter frequency unchanged');
  if(mode==='varied rain') {
   assert(newBars.length>0&&new Set(newBars.map(b=>b.rect.height)).size>2);
   for(let i=0;i<newBars.length;i++){
    const b=newBars[i].rect,old=previousBars[i].rect;
    assert(close(b.y,solar),'All bars start at solar line');
    assert(close(old.y+old.height,next.weatherGeometry.bottom),'Previous bars grew up from below');
    assert.equal(b.x,old.x);assert.equal(b.width,old.width);assert.equal(b.height,old.height);
   }
  } else assert.equal(newBars.length,0,'No rain inferred from dry/missing data');
  scenes++; labels+=printed.length; bars+=newBars.length;
 }
 // Reproduce the weak, short bar precisely under the 08h capsule; compare the
 // composed pixel inside the badge, not only the presence of a background op.
 const {createCanvas}=require('@napi-rs/canvas');
 const collisionOld=probe(cp.execFileSync('git',['show','31fefa3:'+engine],{encoding:'utf8'}));
 const now=new Date(2026,10,22,6);
 let dryPixel;
 for(const amount of [0,0.4,2,10]){
  const weather={hours:Array.from({length:26},(_,i)=>({timestamp:+now+i*h,temperature:22,rainMM:amount,rainRate:amount,
    rainChance:amount?100:0,cloudiness:amount?90:0,symbol:amount?'d5':'d0'})),daily:{}};
  const opt=options(now,[],{hourlyWeather:weather});
  const [old,result]=await Promise.all([collisionOld(host,opt),after(host,opt)]);
  const x=91, y=Math.ceil(result.weatherGeometry.panelY+result.weatherGeometry.solar);
  const near=(r)=>r&&r.x<=x&&r.x+r.width>x&&r.y<=y&&r.y+r.height>y;
  const sample=model=>{
   const canvas=createCanvas(1092,510),ctx=canvas.getContext('2d');
   const bridge=new Proxy(ctx,{set(o,k,v){o[k]=k==='font'&&typeof v==='object'?`${v.size}px monospace`:v;return true;},get(o,k){const v=o[k];return typeof v==='function'?v.bind(o):v;}});
   const localY=y-model.weatherGeometry.panelY;
   // Repaint the relevant bar rectangle then the actual foreground ops in order.
   for(const bar of flatten(model.image).filter(op=>rain(op)&&(close(op.rect.y,model.weatherGeometry.solar)||close(op.rect.y,model.weatherGeometry.astro))&&op.rect.x<=x&&op.rect.x+op.rect.width>x&&op.rect.y+op.rect.height>localY)){
    ctx.fillStyle='#17BAEC';ctx.fillRect(bar.rect.x,bar.rect.y+model.weatherGeometry.panelY,bar.rect.width,bar.rect.height);
   }
   d.replay(bridge,model.image.ops.filter(op=>near(op.rect)&&['fillRect','fillEllipse','text'].includes(op.type)),1092,510,1092,510,()=>null);
   return [...ctx.getImageData(x,y,1,1).data];
  };
  const pixel=sample(result);
  if(!amount) dryPixel=pixel;
  assert.deepEqual(pixel,dryPixel,`Capsule color not covered by rain at 08h (amount ${amount})`);
  assert.notDeepEqual(pixel,[23,186,236,255]);
  assert.equal(result.image.ops.filter(op=>rain(op)&&near(op.rect)).length,0,'No foreground rain redraw inside capsule');
  if(amount)assert(old.image.ops.some(rain),'0.3.50 repainted rain above capsule; 0.3.51 does not');
  const markers=ops=>ops.filter(o=>o.type==='fillPath'&&o.state?.fill?.hex?.toUpperCase()==='17BAEC');
  const strokes=ops=>ops.filter(o=>o.type==='strokePath'&&o.state?.stroke?.hex?.toUpperCase()==='17BAEC');
  if(amount){assert.equal(markers(flatten(result.image)).length,0);assert.equal(strokes(flatten(result.image)).length,0);}
 }
 console.log(JSON.stringify({scenes,labels,bars,finalPixelCases:4,geometry:'clock, astro and grid unchanged; midnight capsule matches all others; solar line exact center, rain behind with lengths/timing unchanged',physicalIOS:'not tested'}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
