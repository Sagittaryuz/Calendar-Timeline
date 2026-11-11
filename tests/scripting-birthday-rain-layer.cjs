const assert=require('node:assert/strict');
const cp=require('node:child_process');
const path=require('node:path');
const {fixture,probe,flatten,raw}=require('./scripting-rolling.cjs');

const root=path.resolve(__dirname,'..');
const engine='scripting/scripts/Calendar Timeline Scripting/original-engine.js';
const baselineRaw=cp.execFileSync('git',['show',`0873ed9:${engine}`],{cwd:root,encoding:'utf8'});
const birthdayColor='ff69b4';
const rainColor='17baec';

function birthday(title,date){
  const start=new Date(date);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);
  return{kind:'event',identifier:`birthday-${title}`,title,isBirthday:true,isAllDay:true,start,end,color:'#000000'};
}
function event(index,start){
  const end=new Date(+start+6*60*60*1000);
  return{kind:'event',identifier:`event-${index}`,title:`SYNTHETIC EVENT ${index}`,start:new Date(start),end,color:'#FF9F0A',isAllDay:false};
}
function weather(now){
  return{daily:{},hours:Array.from({length:49},(_,index)=>{
    const raining=true;
    return{
      timestamp:+now+index*60*60*1000,
      temperature:18+8*Math.sin(index/4),
      rainChance:raining?100:0,
      rainMM:raining?10:0,
      rainRate:raining?10:0,
      cloudiness:raining?90:15,
      symbol:raining?'d5':'d0',
    };
  })};
}
function walk(image,pathParts=[],found=[]){
  if(!image||!Array.isArray(image.ops))return found;
  for(const op of image.ops){
    if(op.type==='text')found.push({op,path:pathParts});
    if(op.type==='image'&&op.image?.ops){
      walk(op.image,[...pathParts,op.image],found);
    }
  }
  return found;
}
function intersects(a,b){
  return a&&b&&a.x<b.x+b.width&&a.x+a.width>b.x&&
    a.y<b.y+b.height&&a.y+a.height>b.y;
}

async function main(){
  const panel=raw.slice(raw.indexOf('async function renderTimelinePanel'),raw.indexOf('\nfunction timelineItemsStartingToday'));
  assert(panel.indexOf('drawTimelineRainOverlay(ctx, hourlyWeather)')<panel.indexOf('drawTimelineBirthdayLabelsAfterRain(ctx, items)'),
    'The actual timeline rain overlay is painted before birthday labels');
  assert(panel.indexOf('drawTimelineBirthdayLabelsAfterRain(ctx, items)')<panel.indexOf('drawEventStartLines(ctx,'),
    'Event start guides and day-boundary overlays retain foreground priority');
  const birthdayPainter=raw.slice(raw.indexOf('function drawTimelineBirthdayLabelsAfterRain'),raw.indexOf('\nfunction diagonalWeekdayLabelColor'));
  assert(birthdayPainter.includes('softenTimelineImage(cropped'),
    'Tomorrow birthday text keeps the existing future blur treatment');
  assert(birthdayPainter.includes('drawTimelineBirthdayLayer(ctx, todayBirthdays, sourceItems)'),
    'Today birthday text stays sharp after the rain overlay');

  const {host,options}=await fixture();
  const before=probe(baselineRaw),after=probe(raw);
  const snapshots=[['00:00',0,0],['06:00',6,0],['12:00',12,0],['18:00',18,0],['23:59',23,59]];
  const results=[];
  for(const [label,hour,minute] of snapshots){
    const now=new Date(2026,10,10,hour,minute);
    const dayStart=new Date(now);dayStart.setHours(0,0,0,0);
    const nextDay=new Date(dayStart);nextDay.setDate(nextDay.getDate()+1);
    const agenda=[event(1,new Date(+now+60*60*1000)),event(2,new Date(+now+2*60*60*1000)),
      event(3,new Date(+now+3*60*60*1000)),birthday('SYNTHETIC TODAY',dayStart),
      birthday('SYNTHETIC TOMORROW',nextDay)];
    const opts=options(now,agenda,{hourlyWeather:weather(now)});
    const oldModel=await before(host,opts),model=await after(host,opts);
    const oldIds=oldModel.test.chosen.filter(item=>!item.birthday).map(item=>item.identifier).sort();
    const newIds=model.test.chosen.filter(item=>!item.birthday).map(item=>item.identifier).sort();
    assert.deepEqual(newIds,oldIds,`${label}: chart selection is unchanged`);

    const operations=flatten(model.image);
    const treeTexts=walk(model.image);
    const oldTexts=flatten(oldModel.image).filter(op=>op.type==='text'&&
      op.state?.text?.hex?.toLowerCase()===birthdayColor);
    const birthdayTexts=treeTexts.filter(({op})=>op.type==='text'&&
      op.state?.text?.hex?.toLowerCase()===birthdayColor);
    const visibleNames=birthdayTexts.map(({op})=>op.text);
    const expectedNames=agenda.filter(item=>item.isBirthday&&item.start<new Date(model.temporal.windowEnd))
      .filter(item=>item.end>new Date(model.temporal.windowStart))
      .map(item=>item.title);
    for(const name of expectedNames){
      assert.equal(visibleNames.filter(text=>text===name).length,1,`${label}: ${name} is drawn exactly once`);
      const oldText=oldTexts.find(op=>op.text===name);
      const newText=birthdayTexts.find(({op})=>op.text===name)?.op;
      assert(oldText&&newText,`${label}: ${name} exists in both compared builds`);
      for(const key of ['x','y','width','height']){
        assert.equal(newText.rect[key],oldText.rect[key],`${label}: ${name} keeps its original ${key} geometry`);
      }
    }

    const rainBars=operations.filter(op=>op.type==='fillRect'&&
      op.state?.fill?.hex?.toLowerCase()===rainColor);
    assert(rainBars.length>0,`${label}: synthetic rain bars are actually rendered`);
    for(const {op} of birthdayTexts){
      const overlap=rainBars.find(bar=>intersects(op.rect,bar.rect));
      assert(overlap,`${label}: a real rain-bar rectangle crosses ${op.text}`);
    }
    let lastRainIndex=-1,firstBirthdayIndex=Number.POSITIVE_INFINITY;
    operations.forEach((op,index)=>{
      if(op.type==='fillRect'&&op.state?.fill?.hex?.toLowerCase()===rainColor)lastRainIndex=index;
      if(op.type==='text'&&op.state?.text?.hex?.toLowerCase()===birthdayColor)
        firstBirthdayIndex=Math.min(firstBirthdayIndex,index);
    });
    assert(lastRainIndex<firstBirthdayIndex,`${label}: every rain bar is behind the birthday labels`);

    const tomorrowText=treeTexts.find(({op})=>op.type==='text'&&
      op.text==='SYNTHETIC TOMORROW'&&op.state?.text?.hex?.toLowerCase()===birthdayColor);
    if(tomorrowText){
      const shouldBlur=model.test.blur===true;
      if(shouldBlur)assert(tomorrowText.path.some(image=>Number(image.blurRadius)>0),
        `${label}: tomorrow's label remains in the softened future layer`);
    }
    const today=treeTexts.find(({op})=>op.type==='text'&&
      op.text==='SYNTHETIC TODAY'&&op.state?.text?.hex?.toLowerCase()===birthdayColor);
    assert(today,`${label}: today's label remains visible over rain`);
    results.push({time:label,rainBars:rainBars.length,birthdayNames:visibleNames,
      todayOverlaysRain:lastRainIndex<firstBirthdayIndex,
      tomorrowBlurred:tomorrowText?.path.some(image=>Number(image.blurRadius)>0)??null});
  }
  console.log(JSON.stringify({scenes:results,deviceRender:'not tested; Canvas/Scripting drawing-contract simulation only'},null,2));
  console.log('PASS: birthday labels render once, stay on their thermal-band position, and are composed after intersecting rain bars.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
