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
  'timelineChartTop','bottomLegendCenterY','dayChangeLegendCenterY','hourLegendVisibleBoundsAtY',
  'drawCurrentDayRoundedSideFrame','fillTitleCardShape']) load(name);
c.startOfDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
c.addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
c.timeToX=()=>1092;
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
const font=c.titleHeaderFontSize();
const layout=c.titleCardTypography();
const titleY=layout.titleY;
assert(font>23, 'O título abreviado deve usar uma fonte maior.');
const lowerCircleEdge=run('CANVAS.timelineTop + dayChangeLegendCenterY() + DAY_CHANGE_CIRCLE_DIAMETER/2');
assert(Math.abs(lowerCircleEdge-505)<1e-9);
const lowerFrameInnerEdge=run('CANVAS.height-WIDGET_CONTOUR.strokeInset-dayBoundaryLineWidth()/2');
assert(Math.abs(lowerCircleEdge-lowerFrameInnerEdge-1)<1e-9,
  'A extremidade do círculo sobrepõe 1 px do traço inferior de 4 px.');
// Moving-header rendering and corners are covered by moving-day-header.cjs.
const ctx={setStrokeColor(){},setLineWidth(){},addPath(){},strokePath(){},setFillColor(){},fillPath(){}};
const textCtx={...ctx,fillRect(){},fillEllipse(){},setTextAlignedLeft(){},setTextColor(){},setFont(){},drawText(){}};
c.Font={blackMonospacedSystemFont:size=>size};
c.loadResult={holidayDates:new Set()};
c.shortWeekday=()=> 'SEX';
c.hourGridLineColor=()=>({});
c.dayBoundaryMoonBorderTopY=()=>run('CANVAS.timelineTop+scaleVertical(8)');
for(const name of ['currentDayFrameMetrics','weatherIconSize','currentDayFrameHorizontalDirection']) load(name);
console.log('OK: contorno, margens, espaçamento, altura do cabeçalho e encaixe inferior preservados.');

let shiftLayer;
c.DrawContext=class {
  constructor() { shiftLayer=this; this.rects=[]; this.images=[]; }
  setFillColor() {}
  fillRect(rect) { this.rects.push(rect); }
  drawImageInRect(image,rect) { this.images.push({image,rect}); }
  getImage() { return 'shifted-widget'; }
};
c.Size=class { constructor(width,height) { Object.assign(this,{width,height}); } };
c.widgetGradientColorAtY=()=>({});
load('shiftWidgetImage');
assert.equal(c.shiftWidgetImage('rendered-widget'),'shifted-widget');
assert.equal(shiftLayer.rects.length,run('CANVAS.height'));
assert(shiftLayer.rects.every(rect=>rect.x===0&&rect.width===1));
assert.equal(shiftLayer.images[0].image,'rendered-widget');
assert.equal(shiftLayer.images[0].rect.x,1);
assert.equal(shiftLayer.images[0].rect.width,run('CANVAS.width-1'));
assert.equal(shiftLayer.images[0].rect.y,0);
assert.equal(shiftLayer.images[0].rect.height,run('CANVAS.height'));
const retractedRect=shiftLayer.images[0].rect;
const mapX=x=>retractedRect.x+x*retractedRect.width/run('CANVAS.width');
assert.equal(mapX(0),1, 'A borda esquerda recua 1 px.');
assert.equal(mapX(run('CANVAS.width')),run('CANVAS.width'),
  'A borda direita permanece fixa.');
console.log('OK: borda esquerda retraída 1 px com as demais bordas fixas.');

// O círculo recomposto tem âncora própria; a régua e o gráfico não sobem nem descem.
for (const name of ['currentDayBoundaryBadgeCenterY','drawCurrentDayBoundaryBadgeOnForeground',
  'timelineLegendCenterX','dayLegendCircleRect','centeredDayLegendTextRect','legendTextHeight','isCompactMode',
  'isExtendedDetailedMode']) load(name);
c.futureTimelineBlurMetrics=()=>({width:10});
c.dayBadgeStyle=()=>({background:{},text:{}});
c.Font.blackRoundedSystemFont=size=>size;
c.timeToX=()=>400;
let foregroundCircle;
c.drawCurrentDayBoundaryBadgeOnForeground({...textCtx,
  fillEllipse(rect){foregroundCircle=rect;},setTextAlignedCenter(){},drawTextInRect(){}});
const frame=c.currentDayFrameMetrics();
assert(Math.abs(foregroundCircle.y+foregroundCircle.height-frame.bottomLineCenterY-1)<1e-9);
assert.equal(foregroundCircle.height,run('DAY_CHANGE_CIRCLE_DIAMETER'));
assert.equal(foregroundCircle.x+foregroundCircle.width/2,run('CANVAS.plotLeft')+400);
assert.equal(run('CANVAS.timelineTop+dayChangeLegendCenterY()+DAY_CHANGE_CIRCLE_DIAMETER/2'),505,
  'A posição das outras legendas continua igual.');
assert(Math.abs(foregroundCircle.y+foregroundCircle.height-(frame.bottomLineCenterY-frame.lineWidth/2)-3)<1e-9,
  'O disco desce mais 1 px, sobrepondo 3 px da moldura branca.');
console.log('OK: somente o círculo da próxima virada desce mais 1 px, com 3 px de sobreposição.');
