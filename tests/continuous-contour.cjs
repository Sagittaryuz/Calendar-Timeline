// Geometria real com APIs de desenho simuladas; não acessa agenda nem rede.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'Calendar Timeline'), 'utf8');
class Point { constructor(x,y) { Object.assign(this,{x,y}); } }
class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
class Path {
  constructor() { this.points=[]; }
  move(p) { this.points.push(p); }
  addLine(p) { this.points.push(p); }
  addCurve(p,a,b) { this.points.push(a,b,p); }
  closeSubpath() {}
}
const c = {Point, Rect, Path, Color: class {}, SETTINGS:{maxItems:5}, windowStart: new Date(2026,8,20)};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('const WIDGET_CANVAS_HEIGHT'), source.indexOf('const now =')), c);
function load(name) {
  const start=source.indexOf('function '+name+'(');
  assert(start>=0, name);
  const tail=source.slice(start+1);
  const end=tail.search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start,end<0?source.length:start+1+end),c);
}
for(const name of ['dayBoundaryLineWidth','timelineWidth','timelineHeight',
  'titleCardGap','titleDayCardRect','timelineOuterBorderTopY',
  'weatherStripBottomY','weatherIconCenterY',
  'timelineChartTop','bottomLegendCenterY','hourLegendVisibleBoundsAtY',
  'drawCurrentDayRoundedSideFrame','fillTitleCardShape']) load(name);
const run=s=>vm.runInContext(s,c);
const adjustment=run('TITLE_TIMELINE_GAP_ADJUSTMENT');
const originalTimelineTop=run('CANVAS.timelineTop')-adjustment;
const regularCardBottom=run('WIDGET_CONTOUR.strokeInset-DAY_BOUNDARY_LINE_WIDTH/2+TITLE_CARD_HEIGHT');
const originalClearGap=originalTimelineTop-regularCardBottom-
  run('TIMELINE_OUTER_BORDER_WIDTH/2');
const actualClearGap=run('CANVAS.timelineTop')-regularCardBottom-
  run('TIMELINE_OUTER_BORDER_WIDTH/2');
const expectedGap=run('TITLE_CARD_SPACING');
assert(Math.abs(actualClearGap-expectedGap)<1e-9,
  'O espaçamento nominal da timeline permanece igual ao vão entre cartões.');
const borderCenter=c.timelineOuterBorderTopY();
const gapCenter=regularCardBottom+expectedGap/2;
assert(Math.abs(borderCenter-gapCenter)<1e-9,
  'A linha superior da moldura deve ter seu eixo no centro do vão.');
assert(Math.abs((borderCenter-run('TIMELINE_OUTER_BORDER_WIDTH/2'))-
  regularCardBottom+(run('TIMELINE_OUTER_BORDER_WIDTH')-expectedGap)/2)<1e-9,
  'A sobreposição subpixel decorre somente da linha ser mais larga que o vão.');
assert(Math.abs(c.titleCardGap()-expectedGap)<1e-9,
  'Vão horizontal entre cartões mantém 1,2287 px.');
assert(Math.abs(adjustment-(expectedGap-originalClearGap))<1e-9);
for(let i=0;i<3;i++) {
  const current=c.titleDayCardRect(i), next=c.titleDayCardRect(i+1);
  assert(Math.abs(next.x-(current.x+current.width)-expectedGap)<1e-9,
    'Vãos horizontais dos cartões são iguais.');
}
assert(Math.abs(run('CANVAS.timelineTop+weatherIconCenterY()')-
  (originalTimelineTop+run('ASTRO_CENTER_TARGET_24H')))<1e-9,
  'O centro dos astros não se desloca.');
assert(Math.abs(run('CANVAS.timelineTop+weatherStripBottomY()')-
  (originalTimelineTop+run('WEATHER_ASTRO_STRIP_HEIGHT_24H')))<1e-9,
  'A base da faixa dos astros não se desloca.');
const oldChartTop=originalTimelineTop+
  run('WEATHER_ASTRO_STRIP_HEIGHT_24H+scaleVertical(5)-TIMELINE_GRID_TOP_EXTENSION');
assert(Math.abs(run('CANVAS.timelineTop+timelineChartTop()')-
  (oldChartTop+adjustment))<1e-9,'Só o topo dos charts desce pelo ajuste.');
const oldTimelineHeight=run('CANVAS.timelineBottom')-originalTimelineTop;
assert(Math.abs(run('timelineHeight()')-(oldTimelineHeight-adjustment))<1e-9,
  'A altura retirada vem da área dos charts.');
// Four corners measured independently; these synthetic coordinates contain
// only silhouette samples, no personal content from the supplied capture.
const measured=[[20,120],[30,101],[40,90],[60,77],[80,71],[100,69]];
for(const [y,x] of measured) {
  const logicalY=(y-13.6)*510/492.8;
  const expected=(x-68.2)*1092/1048;
  assert(Math.abs(c.widgetContourInsetAtY(logicalY)-expected)<1.6,'Fit to capture');
}
const points=c.widgetLeftContourPoints();
for(const p of points) {
  assert(p.x>=4 && p.y>=4 && p.y<=506);
  assert(Math.abs(p.x-c.widgetContourInsetAtY(p.y,4))<0.001,'Path and clip coincide');
  // Sample a disk around the white stroke centre, including antialiasing.
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/16) {
    const x=p.x+2.5*Math.cos(angle), y=p.y+2.5*Math.sin(angle);
    assert(x>=c.widgetContourInsetAtY(y)-0.1,'Stroke inside measured contour');
  }
}
for(let i=0;i<7;i++) assert(c.titleDayCardRect(i).y>=0,'No negative card position');
const font=c.titleHeaderFontSize(), width=8.5*font*0.60;
const visibleTop=font*run('TITLE_CARD_TEXT_VISIBLE_TOP_RATIO');
const titleY=c.titleSafeTextY(width+4,font*1.15,6,
  run('WIDGET_CONTOUR.textClearance'),visibleTop);
const left=(c.titleDayCardRect(0).width-width-4)/2;
assert(left>=c.widgetContourInsetAtY(titleY+visibleTop)+8);
const lowerCircleEdge=run('CANVAS.timelineTop + bottomLegendCenterY() + DAY_CHANGE_CIRCLE_DIAMETER/2');
assert(Math.abs(lowerCircleEdge-506)<1e-9);
const paths=[];
const ctx={setStrokeColor(){},setLineWidth(){},addPath(p){paths.push(p);},strokePath(){},setFillColor(){},fillPath(){}};
for(const boundary of [1,50,102,500,1092,2000]) {
  c.drawCurrentDayRoundedSideFrame(ctx,c.titleDayCardRect(0),506,4,{},'left',52,52,boundary);
  assert(paths.at(-1).points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
}
const last=c.titleDayCardRect(6);
c.fillTitleCardShape(ctx,last,{topLeft:52,topRight:52,bottomLeft:0,bottomRight:0},{});
assert(paths.at(-1).points.every(p=>p.x<=1092&&p.y>=0));
// Execute the actual title renderer with synthetic weather and no calendars.
c.windowStart=new Date(2026,8,20);
c.loadResult={holidayDates:new Set()};
c.startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
c.addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
c.dateKey=d=>d.toISOString().slice(0,10);
c.timelineBackgroundColorForDate=()=>c.SETTINGS.timelineBackgroundColor;
c.shouldBlurFutureTimeline=()=>true;
c.titleWeekdayColor=()=>({});
c.shortWeekday=()=> 'TER';
c.titleDayMonthLabel=()=> '22/09';
c.titleDailyTemperatureForDay=()=>({minimum:21,maximum:33});
c.titleScheduleCountsForDay=()=>({events:1,reminders:3});
c.titleForecastForDay=()=>({});
c.Font={blackMonospacedSystemFont:size=>size,regularMonospacedSystemFont:size=>size};
const a=source.indexOf('function drawTitleDayCard(');
vm.runInContext(source.slice(a,source.indexOf('function titleDailyTemperatureForDay(',a)),c);
let fontSize=0;
const texts=[],icons=[];
c.drawTitleWeatherIcon=(_,forecast,x,y,size)=>icons.push({x,y,size});
const textCtx={...ctx,fillRect(){},fillEllipse(){},setTextAlignedLeft(){},setTextColor(){},
  setFont(s){fontSize=s;},drawText(t,p){texts.push({t,p,size:fontSize});}};
for(let i=0;i<7;i++) {
  c.drawTitleDayCard(textCtx,c.addDays(c.windowStart,i),c.titleDayCardRect(i),i===0,i===6);
}
for(const {t,p,size} of texts) {
  const visualTop=p.y+(['TER','22/09'].includes(t)?
    size*run('TITLE_CARD_TEXT_VISIBLE_TOP_RATIO'):0);
  for(const y of [visualTop,p.y+size*1.15]) {
    const inset=c.widgetContourInsetAtY(y);
    const cellWidth=size*(['TER','22/09'].includes(t)?0.60:0.62);
    assert(p.x>=inset && p.x+t.length*cellWidth<=1092-inset, 'Title text inside curve');
  }
}
assert(icons.every(icon=>icon.y+icon.size/2<last.y+last.height));
assert.equal(new Set(texts.filter(t=>t.t==='TER').map(t=>t.p.y)).size,1,'Titles aligned');
console.log('Calibration: header font '+font+'; title y '+titleY+'; circle edge '+lowerCircleEdge);
console.log('OK: contorno medido, máscara, traços internos, títulos, rodapé e viradas próximas da borda.');

for (const name of ['currentDayBridgeMetrics','appendCurrentDayBridgeCurve',
  'buildCurrentDayUpperPath']) load(name);
const card=c.titleDayCardRect(0);
for (const boundary of [0,1,50,card.width-4,card.width+1,500,1092]) {
  const {path,bridge}=c.buildCurrentDayUpperPath(null,card,120,4,{},'right',boundary,52,new Path(),2,54);
  assert(path.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  for(let i=1;i<path.points.length;i++) {
    assert(path.points[i].y>=path.points[i-1].y-1e-6,'Sem retorno vertical na ponte');
  }
  assert(Math.abs(path.points.at(-1).x-bridge.endpointX)<1e-6);
  assert(Math.abs(path.points.at(-1).y-120)<1e-6);
  const pathInset=run('titleDayCardRect(0).x===CANVAS.plotLeft?WIDGET_CONTOUR.strokeInset:2');
  const rightEdge=card.x+card.width-pathInset;
  assert.equal(path.points[1].x,rightEdge,'O canto interno superior termina na lateral, sem arco.');
  assert.equal(path.points[1].y,card.y,'A linha superior chega ao canto em 90 graus.');
  assert.equal(path.points[2].x,rightEdge,'A lateral começa no mesmo canto quadrado.');
  assert.equal(path.points[2].y,bridge.startY);
}

const weekdayTitles=texts.filter(({t})=>t==='TER');
const dateTitles=texts.filter(({t})=>t==='22/09');
assert.equal(weekdayTitles.length,7);
assert.equal(dateTitles.length,7);
for(let i=0;i<7;i++) {
  const card=c.titleDayCardRect(i);
  const titleStart=card.x+(card.width-8.5*font*0.60)/2;
  assert(Math.abs(weekdayTitles[i].p.x-titleStart)<1e-6);
  assert(Math.abs(dateTitles[i].p.x-(titleStart+3.5*font*0.60))<1e-6);
}
for(const text of texts) assert(text.p.y+text.size*1.15<=last.y+last.height,
  'As três linhas cabem na altura original.');
assert(source.includes('const RAIN_TOP_MARKER_VERTICAL_OFFSET = -10;'),
  'Gotas acumulam mais 5 unidades de deslocamento');
assert(source.includes('solarLineY() + scaleVertical(12) + RAIN_TOP_MARKER_VERTICAL_OFFSET,'),
  'Gotas usam o deslocamento vertical centralizado');
console.log('OK: canto interno reto, títulos centralizados, ponte sem cruzamento e gotas -10 no total.');

// Posições fixas em todos os dias, inclusive na semana que cruza o ano.
for (const name of ['drawDatePanel','currentDayFrameMetrics',
  'currentDayUnifiedShape','currentDayUnifiedPolygon','insideCurrentDayUnifiedShape',
  'drawCurrentDayBottomLineUnderlay','currentDayFrameHorizontalDirection',
  'currentDayBottomBridgeMetrics']) load(name);
c.shortWeekday=d=>['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()];
c.titleDayMonthLabel=d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
c.timeToX=()=>400;
c.hourGridLineColor=()=>({});
c.dayBoundaryMoonBorderTopY=()=>run('CANVAS.timelineTop+scaleVertical(8)');
for(let day=0;day<7;day++) {
  c.windowStart=new Date(2026,11,27+day,10);
  texts.length=0; icons.length=0;
  c.drawDatePanel(textCtx,new Set());
  const metrics=c.currentDayFrameMetrics();
  const current=c.titleDayCardRect(day);
  assert.equal(metrics.todayCard.x,current.x,'A moldura seleciona a coluna de hoje.');
  assert.equal(texts.filter(t=>['DOM','SEG','TER','QUA','QUI','SEX','SAB'].includes(t.t)).map(t=>t.t).join(','),
    'DOM,SEG,TER,QUA,QUI,SEX,SAB');
  assert.equal(texts.filter(t=>/^\d{2}\/\d{2}$/.test(t.t)).map(t=>t.t).join(','),
    '27/12,28/12,29/12,30/12,31/12,01/01,02/01');
  assert.equal(new Set(texts.filter(t=>/^\d{2}\/\d{2}$/.test(t.t)).map(t=>t.p.y)).size,1);
  for(let i=0;i<7;i++) {
    const card=c.titleDayCardRect(i);
    const entries=texts.slice(i*8,(i+1)*8);
    assert.equal(entries.length,8);
    assert(entries[0].p.y<entries[2].p.y && entries[2].p.y<entries[4].p.y,
      'Título, temperaturas e contadores usam três linhas.');
    assert(entries.every(t=>t.p.x>=card.x && t.p.x+t.t.length*t.size*0.62<=card.x+card.width+1));
    assert(entries.every(t=>t.p.y+t.size*1.15<=card.y+card.height));
    assert.equal(entries.slice(4).map(t=>t.t).join(''),'E: 1 | L: 3');
  }
  c.currentDayUnifiedPolygon.points=null;
  for(let i=0;i<7;i++) {
    const card=c.titleDayCardRect(i);
    assert.equal(c.insideCurrentDayUnifiedShape(card.x+card.width/2,card.y+card.height/2),i===day,
      'O fundo integrado da moldura cobre somente o quadro selecionado.');
  }
  paths.length=0;
  c.drawCurrentDayBottomLineUnderlay(ctx);
  if(day>0) assert(paths.every(path=>path.points.every(p=>p.y>=metrics.bridgeY)),
    'A moldura da timeline não seleciona domingo quando hoje está em outra coluna.');
  const {path}=c.buildCurrentDayUpperPath(null,current,metrics.bridgeY,metrics.lineWidth,{},'right',400,
    metrics.frameRadius,new Path(),metrics.lineWidth/2,metrics.frameRadius);
  assert(path.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  assert(path.points.every(p=>p.x<=1092 && p.x>=0));
}
console.log('OK: sete colunas fixas, três linhas, seleção diária e semana na virada do ano.');
