const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'Calendar Timeline'), 'utf8');
class Point { constructor(x,y) { Object.assign(this,{x,y}); } }
class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
class Path { move() {} addLine() {} }
class Color { constructor(hex,opacity) { Object.assign(this,{hex,opacity}); } }
const c = {Date,Point,Rect,Path,Color,
  windowStart: new Date(2026,8,30,10), windowEnd: new Date(2026,9,4,10),
  loadResult: {holidayDates: new Set()},
  startOfDay: d => new Date(d.getFullYear(),d.getMonth(),d.getDate()),
  addDays: (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),
  dateKey: d => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`,
  hourGridLineColor: () => ({}),
};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('const THEME_MODE'),source.indexOf('const now =')),c);
function load(name) {
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,name);
  const end=source.slice(start+1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start,start+1+end),c);
}
for(const name of ['dayBoundaryLineWidth','titleCardGap','titleDayCardRect',
  'timelineWidth','timelineHeight','weatherIconSize','weatherIconCenterY',
  'dayBoundaryMoonBorderTopY','currentDayFrameMetrics','currentDayBridgeMetrics',
  'currentDayLeftBridgeMetrics','appendCurrentDayBridgeCurve','buildCurrentDayUpperPath',
  'offsetTitleBridgePoints','titleBridgeXAtY','drawAdjacentTitleCardCurve',
  'timelineBackgroundColorForDate','drawTimelineBackground']) load(name);
const run=expr=>vm.runInContext(expr,c);
assert.equal(run('TITLE_CARD_HEIGHT_REDUCTION'),13,'A altura aprovada do cabeçalho permanece fixa.');
c.timeToX=()=>400;
assert(run('titleHeaderFontSize()')>30,'A fonte do cabeçalho deve ser maior que a revisão anterior.');
let clear=[],fills=[],currentColor;
c.restoreWidgetBackgroundSpan=(_,x,y,width)=>clear.push({x,y,width});
const ctx={setFillColor(color){currentColor=color;},fillRect(rect){fills.push({rect,color:currentColor});}};
let fixedLeft=null;
for(const boundary of [100,400,1092]) {
  c.timeToX=()=>boundary;
  clear=[];fills=[];
  const left=c.titleDayCardRect(2);
  if(left.x>=0) c.drawAdjacentTitleCardCurve(ctx,new Date(2026,8,29),left,{},{});
  if(fixedLeft && clear.length) assert.notDeepEqual(clear,fixedLeft,'O recorte acompanha o cartão em movimento.');
  if(clear.length) fixedLeft=clear.slice();
  assert(clear.every(span=>Number.isFinite(span.x)&&span.width>=0),'Recorte finito durante movimento e parada.');
  const right=c.titleDayCardRect(4);
  c.drawAdjacentTitleCardCurve(ctx,new Date(2026,9,1),right,{},{});
  assert(fills.every(({rect})=>Number.isFinite(rect.x)&&rect.width>=0&&rect.x>=0&&rect.x+rect.width<=1092));
  const m=c.currentDayFrameMetrics();
  const bridge=c.currentDayLeftBridgeMetrics(m.todayCard,m.bridgeY,m.framePathRadius,m.lineWidth/2);
  const offset=c.offsetTitleBridgePoints(bridge,m.bridgeY,m.todayCard.y,
    m.lineWidth/2+run('titleCardGap()'),'left');
  assert(Math.abs(offset[0].x-(m.todayCard.x-run('titleCardGap()')))<1e-9,
    'O offset considera metade do traço branco e o espaçamento entre quadros.');
}

// Só os fundos dos dias úteis futuros mudam com o blur.
c.timeToX=d=>(d-c.windowStart)/(c.windowEnd-c.windowStart)*1092;
let blur=true;
c.shouldBlurFutureTimeline=()=>blur;
fills=[];c.drawTimelineBackground(ctx,true);
const colored=fills.map(({color})=>color.hex);
assert(colored.includes('#565759'));
assert(colored.includes('#0D3F68'));
assert(colored.includes('#521720'));
assert(!colored.includes('#000000'),'O fundo do dia atual continua transparente sobre o gradiente.');
blur=false;fills=[];c.drawTimelineBackground(ctx,true);
assert(fills.some(({color})=>color.hex==='#3B3C3E'));
assert(!fills.some(({color})=>color.hex==='#565759'));
blur=true;c.loadResult.holidayDates.add(c.dateKey(new Date(2026,9,1)));
fills=[];c.drawTimelineBackground(ctx,true);
assert(fills.some(({color})=>color.hex==='#3A2A00'),'Feriado preserva sua cor sob blur.');
console.log('OK: título maior, altura fixa, vizinhos seguem a curva com offset e apenas dias úteis futuros clareiam sob blur.');
