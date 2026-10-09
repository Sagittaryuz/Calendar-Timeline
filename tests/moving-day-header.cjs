// Actual header functions under a synthetic Scriptable drawing API; no personal data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','Calendar Timeline'),'utf8');
class Point{constructor(x,y){Object.assign(this,{x,y});}}
class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
class Path{constructor(){this.points=[];}move(p){this.points.push(p);}addLine(p){this.points.push(p);}addCurve(p,a,b){const s=this.points.at(-1);for(let i=1;i<=32;i++){const t=i/32,u=1-t;this.points.push(new Point(u*u*u*s.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*p.x,u*u*u*s.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*p.y));}}closeSubpath(){this.closed=true;}}
class Color{constructor(hex,opacity=1){Object.assign(this,{hex,opacity});}}
const c={Point,Rect,Path,Color,Date,SETTINGS:{maxItems:5},windowStart:new Date(2026,9,9),windowEnd:new Date(2026,9,10),loadResult:{holidayDates:new Set()},hourGridLineColor:()=>new Color('#fff'),shouldBlurFutureTimeline:()=>true,Font:{blackMonospacedSystemFont:s=>s},titleDailyTemperatureForDay:()=>({minimum:-12,maximum:105}),finiteWeatherNumber:v=>v===null?null:Number(v),titleForecastForDay:()=>({}),titleWeekdayColor:()=>new Color('#fff')};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const THEME_MODE'),source.indexOf('const now =')),c);
function load(name){const start=source.indexOf('function '+name+'(');assert(start>=0,name);const end=source.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(source.slice(start,start+1+end),c);}
for(const n of ['startOfDay','addDays','dateKey','timeToX','timelineWidth','titleCardGap','titleDayCardRect','drawDatePanel','dayBoundaryLineWidth','weatherIconSize','weatherIconCenterY','dayBoundaryMoonBorderTopY','currentDayFrameMetrics','currentDayLeftBridgeMetrics','appendCurrentDayBridgeCurve','appendContourArc','buildCurrentDayUpperPath','currentDayUnifiedShape','currentDayUnifiedPolygon','insideCurrentDayUnifiedShape','widgetLeftContourPoints','widgetContourInsetAtY','widgetVisibleContentBounds','titleCardContentBounds','titleBridgeXAtY','offsetTitleBridgePoints','drawAdjacentTitleCardCurve','drawCurrentDayFrame','currentDayFrameHorizontalDirection','drawCurrentDayRoundedTopRightFrame','timelineBackgroundColorForDate','fillTitleCardShape','shortWeekday','drawTitleDayCard','restoreWidgetBackgroundSpan','widgetGradientColorAtY','interpolateHexColor','hexToRGB'])load(n);
const run=s=>vm.runInContext(s,c);let texts=[],paths=[],font=0,color,selectedPath,icons=[],ops=[];
const ctx={setFont(s){font=s;},setTextColor(v){color=v;},setFillColor(v){color=v;},setStrokeColor(v){color=v;},setLineWidth(){},setTextAlignedLeft(){},drawText(t,p){texts.push({t,p,size:font});ops.push({text:{t,p,size:font}});},fillRect(r){const last=ops.at(-1);if(last?.rect&&last.color?.hex===color?.hex&&last.rect.y===r.y&&last.rect.height===r.height&&Math.abs(last.rect.x+last.rect.width-r.x)<1e-8)last.rect.width+=r.width;else ops.push({rect:{...r},color});},addPath(p){selectedPath=p;},fillPath(){paths.push({path:selectedPath,color});ops.push({path:selectedPath,color});},strokePath(){paths.push({path:selectedPath,color,stroke:true});ops.push({path:selectedPath,color,stroke:true});}};
c.drawTitleWeatherIcon=(_,forecast,x,y,size)=>icons.push({x,y,size});
let count=0;const snapshots=[];
for(const width of [960,1014,1092,1200])for(const date of [[2026,9,9],[2026,9,31],[2026,9,11],[2026,11,31],[2027,0,1]])for(const hour of [0,6,12,18,20.5,24*6/7-0.0001,24*6/7,21,23,23.999]){
  c.windowStart=new Date(date[0],date[1],date[2]);c.windowStart.setTime(+c.windowStart+hour*3600000);c.windowEnd=new Date(+c.windowStart+24*3600000);run(`CANVAS.width=${width};CANVAS.plotRight=${width};`);
  texts=[];paths=[];icons=[];ops=[];c.currentDayUnifiedPolygon.points=null;
  const todayIndex=c.titleTodayCardIndex(),card=c.titleDayCardRect(todayIndex),boundary=c.timeToX(c.addDays(c.startOfDay(c.windowStart),1)),step=width/7;
  assert(Math.abs(card.width-step)<1e-8);assert(card.x>=-1e-8&&card.x+card.width<=width+1e-8);
  if(hour<24*6/7)assert(Math.abs(card.x+card.width-boundary)<1e-7,'Right edge follows the real midnight line');else assert(Math.abs(card.x)<1e-4,'Frozen complete first card');
  assert.equal(c.timeToX(c.windowStart),0,'Event time origin unchanged');
  const drawn=[];const original=c.drawTitleDayCard;c.drawTitleDayCard=(ctx,d,r,selected,last,bg,txt)=>{if(txt)drawn.push({d,r,selected});return original(ctx,d,r,selected,last,bg,txt);};
  c.drawDatePanel(ctx,new Set());c.drawTitleDayCard=original;c.drawCurrentDayFrame(ctx);
  assert.equal(drawn.filter(v=>v.selected).length,1);
  const ordered=drawn.slice().sort((a,b)=>a.d-b.d);
  for(let i=1;i<ordered.length;i++){
    if(!ordered[i].selected&&!ordered[i-1].selected)assert(ordered[i].r.x>=ordered[i-1].r.x+ordered[i-1].r.width-1e-8,'Moving cards do not overlap');
    assert.equal(+c.addDays(ordered[i-1].d,1),+ordered[i].d,'Consecutive dates across year/month/week');
  }
  if(hour===12){assert(ordered[0].r.x<0,'Partial left card is drawn');assert(ordered.at(-1).r.x+ordered.at(-1).r.width>width,'Partial right card is drawn');}
  const tomorrow=c.titleDayCardRect(todayIndex+1);
  assert(Math.abs(tomorrow.x-(boundary+c.titleCardGap()))<1e-8,'Tomorrow keeps real position even when HOJE is frozen');
  const previousTime=new Date(+c.windowStart-60000),start=c.windowStart,end=c.windowEnd;
  c.windowStart=previousTime;c.windowEnd=new Date(+previousTime+86400000);
  const previousTomorrow=c.titleDayCardRect(c.titleTodayCardIndex()+1);
  c.windowStart=start;c.windowEnd=end;
  if(hour>0)assert(Math.abs((tomorrow.x-previousTomorrow.x)+width/1440)<1e-8,'Exact same minute displacement as the day boundary');
  assert.equal(texts.length,drawn.length*7,'Full weekday, full date and both temperatures');
  for(let i=0;i<drawn.length;i++){
    const {d,r,selected}=drawn[i],entries=texts.slice(i*7,i*7+7);
    assert.equal(entries.slice(0,3).map(t=>t.t).join(''),c.shortWeekday(d));
    assert.equal(entries.slice(3,5).map(t=>t.t).join(''),String(d.getDate()).padStart(2,'0'));
    const weatherLeft=entries[5].p.x,weatherRight=entries[6].p.x+entries[6].t.length*entries[6].size*0.62;
    assert(Math.abs((weatherLeft+weatherRight)/2-r.x-r.width/2)<1e-8,'Weather stays centered in its card');
    if(d.getDay()===0||d.getDay()===6)assert(Math.abs(entries[0].p.x+c.titleCardTypography().titleWidth/2-(weatherLeft+weatherRight)/2)<1e-8,'SAB/DOM share the weather center');
    if(selected || r.x>=card.x+card.width || r.x+r.width<=card.x) assert.equal(c.insideCurrentDayUnifiedShape(r.x+r.width/2,r.y+r.height/2),selected,'Unified background covers today');
    assert.equal(entries[5].size,texts[5].size,'Uniform temperature font');
    assert.equal(entries[5].p.y,texts[5].p.y,'Uniform second line height');
  }
  const leftPath=paths.at(-2).path.points;
  assert(leftPath.length>60,'The lower left corner retains its measured curve');
  assert(leftPath.every(p=>p.y>=card.y),'No top left arc');
  for(let i=0;i<drawn.length;i++)for(const t of texts.slice(i*7,i*7+7)){const r=drawn[i].r;assert(t.p.x>=r.x-0.1&&t.p.x+t.t.length*t.size*0.62<=r.x+r.width+0.1,'Full text stays inside its own card');assert(t.p.y+t.size*1.15<=r.y+r.height+0.1);}
  const m=c.currentDayFrameMetrics();const upper=c.buildCurrentDayUpperPath(null,card,m.bridgeY,m.lineWidth,{},'right',boundary,m.frameRadius,new Path(),2,m.frameRadius).path;
  assert.equal(upper.points[1].x,card.x+card.width);assert.equal(upper.points[1].y,card.y);assert.equal(upper.points[2].x,card.x+card.width);assert.equal(upper.points[2].y,m.bridgeY,'Straight right edge');
  assert(paths.every(v=>v.path.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
  if(width===1092&&date[2]===9&&[0,12,21,23.999].includes(hour))snapshots.push({hour,card,boundary,texts:structuredClone(texts),paths:paths.map(v=>({points:v.path.points,stroke:v.stroke,color:v.color})),icons:structuredClone(icons),ops:structuredClone(ops)});
  count++;
}
// Midnight restarts at the right, and the date advances locally.
c.windowStart=new Date(2026,11,31,23,59,59);c.windowEnd=new Date(+c.windowStart+86400000);const last=c.titleDayCardRect(c.titleTodayCardIndex());c.windowStart=new Date(2027,0,1);c.windowEnd=new Date(+c.windowStart+86400000);const first=c.titleDayCardRect(c.titleTodayCardIndex());assert.equal(last.x,0);assert(Math.abs(first.x+first.width-run('CANVAS.width'))<1e-8);
// Other configured windows keep the same event transformation, with a complete header clamp.
for(const hours of [1,12,24,48,96]){c.windowStart=new Date(2026,9,9,12);c.windowEnd=new Date(+c.windowStart+hours*3600000);const r=c.titleDayCardRect(c.titleTodayCardIndex());assert(r.x>=0&&r.x+r.width<=run('CANVAS.width'));assert.equal(c.timeToX(c.windowEnd),run('timelineWidth()'));
 const next=c.titleDayCardRect(c.titleTodayCardIndex()+1);const start=c.windowStart;
 c.windowStart=new Date(+start+60000);c.windowEnd=new Date(+c.windowStart+hours*3600000);
 const moved=c.titleDayCardRect(c.titleTodayCardIndex()+1);
 assert(Math.abs((moved.x-next.x)+run('timelineWidth()')/(hours*60))<1e-8,'Moving days use existing window speed before and after clamp');
}
if(process.env.HEADER_SVG){
 const escape=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;');
 const paint=o=>o.text ? '<text x="'+o.text.p.x+'" y="'+(o.text.p.y+o.text.size)+'" font-family="monospace" font-weight="bold" font-size="'+o.text.size+'" fill="white">'+escape(o.text.t)+'</text>'
 : o.rect ? '<rect x="'+o.rect.x+'" y="'+o.rect.y+'" width="'+o.rect.width+'" height="'+o.rect.height+'" fill="'+o.color.hex+'"/>'
 : '<'+(o.stroke?'polyline':'polygon')+' points="'+o.path.points.map(p=>p.x+','+p.y).join(' ')+'" fill="'+(o.stroke?'none':o.color?.hex||'#222')+'" stroke="'+(o.stroke?'white':'none')+'" stroke-width="4"/>';
 const rows=snapshots.map((s,i)=>'<g transform="translate(0 '+(i*180)+')"><text x="8" y="18" fill="white">'+s.hour.toFixed(3)+'h — meia-noite '+s.boundary.toFixed(1)+'</text><svg x="0" y="30" width="1092" height="150" viewBox="0 0 1092 150">'+s.ops.map(paint).join('')+'<line x1="'+s.boundary+'" x2="'+s.boundary+'" y1="100" y2="140" stroke="#f88"/></svg></g>').join('');
 fs.writeFileSync(process.env.HEADER_SVG,'<svg xmlns="http://www.w3.org/2000/svg" width="1092" height="720"><rect width="1092" height="720" fill="#111"/>'+rows+'</svg>');
}
console.log(`OK: ${count} moving headers, 4 widths, dates/month/year, midnight, 1/7 clamp, full texts, straight corners and unchanged event coordinates.`);


