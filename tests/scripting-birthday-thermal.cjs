const assert=require('node:assert/strict');
const cp=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const {fixture,compile,flatten,raw}=require('./scripting-rolling.cjs');

const root=path.resolve(__dirname,'..');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baselineRaw=cp.execFileSync('git',['show',`bff4c71:${engine}`],{cwd:root,encoding:'utf8'});
const inspectSource=source=>source.replace('return {temporal:',
  'return {debug:{selected:selectedItems.map(item=>({identifier:item.identifier,kind:item.kind,birthday:isBirthdayItem(item),group:isBirthdayGroup(item),row:item.gridRow,layoutRows:item.layoutRows,start:item.start.getTime(),names:(item.birthdayItems??[]).map(x=>x.title)})),rowCounts:timelineRowCounts,thermal:{top:thermalBandTopY(),bottom:thermalBandBottomY(),canvasTop:CANVAS.timelineTop,bounds:timelineVisibleContentBounds(thermalBandTopY(),thermalBandBottomY()-thermalBandTopY(),4),offset5:scaleVertical(2),offset6:scaleVertical(1)}},temporal:');

function birthday(title,date){
  const start=new Date(date);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);
  return {kind:'event',identifier:`birthday-${title}`,title,isBirthday:true,isAllDay:true,start,end,color:'#000000'};
}
function agenda(now){
  const start=new Date(now);start.setMinutes(0,0,0);start.setHours(start.getHours()+1);
  const end=new Date(+start+6*60*60*1000);
  const day=new Date(start);day.setHours(0,0,0,0);
  const items=[];
  for(let i=0;i<6;i++)items.push({kind:'event',identifier:`event-${i}`,title:`SYNTHETIC EVENT ${i+1}`,start:new Date(start),end,color:['#FF9F0A','#0A84FF','#30D158','#BF5AF2','#FF453A','#64D2FF'][i],isAllDay:false});
  for(let i=0;i<4;i++)items.push({kind:'reminder',identifier:`reminder-${i}`,title:`SYNTHETIC REMINDER ${i+1}`,start:new Date(start),end:new Date(+start+3600000),color:'#FF9F0A',isAllDay:false,isCompleted:false});
  const birthdayDay=new Date(now);birthdayDay.setHours(0,0,0,0);
  items.push(birthday('🎂 Alice Silva',birthdayDay),birthday('🎂 Bruno Costa',birthdayDay),birthday('🎂 Camila Lima',birthdayDay));
  const next=new Date(birthdayDay);next.setDate(next.getDate()+1);
  items.push(birthday('🎂 Davi Rocha',next));
  return items;
}
function pinkOps(model){
  return flatten(model.image).filter(op=>op.type==='text'&&/ff69b4/i.test(op.state?.text?.hex??''));
}
function inkBounds(ops,d){
  const canvas=createCanvas(1092,510),ctx=canvas.getContext('2d');
  const bridge=new Proxy(ctx,{set(target,key,value){if(key==='font'&&value&&typeof value==='object')target.font=`${value.size}px BirthdayHeavy`;else target[key]=value;return true;},get(target,key){const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  d.replay(bridge,ops,1092,510,1092,510,()=>null);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let top=canvas.height,bottom=-1,left=canvas.width,right=-1;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const i=(y*canvas.width+x)*4;if(pixels[i+3]<32)continue;
    top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);
  }
  assert(bottom>=top,`Birthday text produces visible glyph pixels in the Canvas substitute: ${JSON.stringify(ops.map(op=>({text:op.text,rect:op.rect,font:op.state?.font,color:op.state?.text?.css?.()})))}`);
  return {top,bottom,left,right,center:(top+bottom)/2};
}

async function main(){
  GlobalFonts.registerFromPath('/usr/share/fonts/truetype/open-sans/OpenSans-ExtraBold.ttf','BirthdayHeavy');
  const thermalDraw=raw.indexOf('drawCompactThermalBand(baseCtx, hourlyWeather');
  const tomorrowLayer=raw.indexOf('drawTimelineItemLayer(\n      baseCtx');
  const itemLayer=raw.slice(raw.indexOf('function drawTimelineItemLayer'),raw.indexOf('\n\nfunction diagonalWeekdayLabelColor'));
  assert(thermalDraw>=0&&tomorrowLayer>thermalDraw,'The thermal curve is painted before the birthday layer');
  assert(itemLayer.indexOf('drawBirthdayGroupLabel')<itemLayer.indexOf('drawTimelineItem(ctx'),'Birthday labels precede event chart painting');
  const {d,host,options}=await fixture();
  const before=compile(inspectSource(baselineRaw)),after=compile(inspectSource(raw));
  const snapshots=[['00:00',0,0],['06:00',6,0],['12:00',12,0],['18:00',18,0],['23:59',23,59]];
  let fullAgendaComparison=null;
  const measurements=[];
  for(const [label,hour,minute] of snapshots){
    const now=new Date(2026,9,27,hour,minute),items=agenda(now);
    const weather={hours:Array.from({length:49},(_,i)=>({timestamp:+now+i*3600000,temperature:19+7*Math.sin(i/4),rainChance:0,rainMM:0,symbol:'d0'})),daily:{}};
    const o=options(now,items,{hourlyWeather:weather});
    const [oldModel,newModel]=await Promise.all([before(host,o),after(host,o)]);
    const oldNormal=oldModel.debug.selected.filter(i=>!i.birthday).map(i=>i.identifier).sort();
    const newNormal=newModel.debug.selected.filter(i=>!i.birthday).map(i=>i.identifier).sort();
    assert.deepEqual(newNormal,oldNormal,`${label}: birthday rendering cannot evict any event, reminder or existing overflow marker`);
    const expectedToday=items.filter(i=>i.identifier.startsWith('birthday-')&&i.start.toDateString()===new Date(now).toDateString()).map(i=>i.title);
    const selectedToday=newModel.debug.selected.filter(i=>i.group&&i.names.length).flatMap(i=>i.names);
    for(const name of expectedToday)assert(selectedToday.includes(name),`${label}: selectedItems keeps ${name} even with all chart rows occupied`);
    const ops=pinkOps(newModel);
    for(const name of expectedToday)assert(ops.some(op=>op.text===name),`${label}: visible birthday label ${name}`);
    assert(ops.length>0,`${label}: synthetic birthdays remain visible`);
    const center=(newModel.debug.thermal.top+newModel.debug.thermal.bottom)/2;
    for(const op of ops){
      assert(op.rect&&op.rect.width>0&&op.rect.x>=newModel.debug.thermal.bounds.left&&op.rect.x+op.rect.width<=newModel.debug.thermal.bounds.right,`${label}: birthday text rect clips to the rounded widget's thermal-band bounds`);
      const group=newModel.debug.selected.find(item=>item.group&&item.names.includes(op.text));
      const offset=group?.layoutRows===5?newModel.debug.thermal.offset5:newModel.debug.thermal.offset6;
      assert(Number.isFinite(offset),`${label}: birthday group has a measured layout row count`);
      assert(Math.abs(op.rect.y+op.rect.height/2-(center+offset))<1e-7,`${label}: text box center matches the per-font optical correction`);
    }
    const graphOrBase=flatten(newModel.image).findIndex(op=>op.type==='strokePath'||op.type==='fillPath');
    const firstBirthday=flatten(newModel.image).findIndex(op=>op.type==='text'&&/ff69b4/i.test(op.state?.text?.hex??''));
    const eventTitle=flatten(newModel.image).findIndex(op=>op.type==='text'&&op.text==='SYNTHETIC EVENT 1');
    assert(graphOrBase>=0&&firstBirthday>graphOrBase,`${label}: thermal drawing precedes the birthday layer`);
    assert(eventTitle>firstBirthday,`${label}: event title is drawn over the birthday layer`);
    const todayPinkOps=ops.filter(op=>expectedToday.includes(op.text));
    const ink=inkBounds(todayPinkOps,d);
    const inkDelta=ink.center-center;
    const groupBounds=newModel.debug.selected.filter(item=>item.group).sort((a,b)=>a.start-b.start).map(group=>{
      const groupOps=ops.filter(op=>group.names.includes(op.text));
      assert(groupOps.length>0,`${label}: each birthday date group has visible text`);
      const bounds=inkBounds(groupOps,d);
      assert(Math.abs(bounds.center-center)<=0.6,`${label}: each day's visible group is centered on the thermal band`);
      return {start:group.start,left:bounds.left,right:bounds.right,names:group.names};
    });
    for(let i=1;i<groupBounds.length;i++)assert(groupBounds[i-1].right<groupBounds[i].left,`${label}: adjacent birthday day groups do not overlap horizontally`);
    measurements.push({time:label,bandCenter:center,inkCenter:ink.center,inkDelta});
    // This checks the actual Canvas-substitute ink, not just its nominal rect.
    // A small renderer-specific difference is expected versus native iOS fonts.
    assert(Math.abs(inkDelta)<=0.6,`${label}: measured visible glyph center stays within 0.6 logical px of thermal-band center in the Canvas substitute (got ${inkDelta})`);
    if(label==='12:00')fullAgendaComparison={oldNormal,newNormal,expectedToday,visibleToday:ops.filter(op=>expectedToday.includes(op.text)).map(op=>op.text),visibleTomorrow:ops.filter(op=>op.text==='🎂 Davi Rocha').length>0};
  }
  assert.deepEqual(fullAgendaComparison.oldNormal,fullAgendaComparison.newNormal);
  assert.equal(fullAgendaComparison.expectedToday.length,3,'Multiple birthdays on the same date are grouped independently from chart rows');
  assert(fullAgendaComparison.visibleToday.length>=3,'All three synthetic birthday labels are rendered with six occupied event rows and reminders still present');
  const noon=new Date(2026,9,27,12,0),baseItems=agenda(noon);
  const fiveEvents=baseItems.filter(item=>/^event-[0-4]$/.test(item.identifier));
  const fiveEventsAndBirthdays=baseItems.filter(item=>/^event-[0-4]$/.test(item.identifier)||item.identifier.startsWith('birthday-'));
  const withoutBirthdays=await after(host,options(noon,fiveEvents,{hourlyWeather:{hours:[],daily:{}}}));
  const withBirthdays=await after(host,options(noon,fiveEventsAndBirthdays,{hourlyWeather:{hours:[],daily:{}}}));
  assert.equal(withBirthdays.debug.rowCounts['2026-10-27'],withoutBirthdays.debug.rowCounts['2026-10-27'],'Birthday labels do not change chart row count or compress the event layout');
  console.log(JSON.stringify({scenes:snapshots.length,fullAgendaComparison,measurements,deviceRender:'not tested; Canvas substitute only'},null,2));
  console.log('PASS: birthdays stay centered on the thermal band and behind events at five local times, including fully occupied agenda rows.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
