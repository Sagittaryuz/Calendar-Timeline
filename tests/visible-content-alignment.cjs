// Geometria real com desenho simulado: margens seguras sem mover o tempo.
const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','Calendar Timeline'),'utf8');
class Rect { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}); } }
class Point { constructor(x,y) { Object.assign(this,{x,y}); } }
class Color { static white() { return new Color(); } }
const c={Rect,Point,Color,SETTINGS:{maxItems:6},windowStart:new Date(2026,8,30)};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('const WIDGET_CANVAS_HEIGHT'),source.indexOf('const now =')),c);
function load(name) {
  const start=source.indexOf('function '+name+'(');
  const next=source.slice(start+1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start,next<0?source.length:start+next+1),c);
}
load('timelineWidth');
const run=s=>vm.runInContext(s,c);
const globalY=460, height=36;
const safe=c.widgetVisibleContentBounds(globalY,height,4);
assert(safe.left>4 && safe.right<run('CANVAS.width')-4);
for(let y=globalY;y<=globalY+height;y+=0.5) {
  const edge=c.widgetContourInsetAtY(y,4);
  assert(safe.left>=edge+4 && safe.right<=run('CANVAS.width')-edge-4);
}
const localY=globalY-run('CANVAS.timelineTop');
const local=c.timelineVisibleContentBounds(localY,height,4);
assert.equal(local.left,safe.left);
assert.equal(local.right,safe.right);

// A barra mantém sua extensão; somente marcador e texto recebem margem.
load('drawTimelineItem');
const bars=[],labels=[],markers=[];
Object.assign(c,{
  Font:{blackRoundedSystemFont:size=>size},
  isCompactMode:()=>false,
  isBirthdayItem:()=>false,isBirthdayGroup:()=>false,
  timelineBarHeight:()=>height,
  timelineItemBarSegmentsForDisplay:()=>[{x:-20,width:1150}],
  reminderPriorityPrefix:()=>'',timelineItemStatus:()=>'',eventMetadataText:()=>'',
  drawTimelineBar:(_,rect)=>bars.push(rect),
  drawReminderMarker:(_,x,y,diameter)=>markers.push({x,y,diameter}),
});
const ctx={setTextAlignedLeft(){},setFont(){},setTextColor(){},
  drawTextInRect(text,rect){labels.push({text,rect});}};
c.drawTimelineItem(ctx,{kind:'reminder',title:'Título longo até a borda',color:'#0088FF',layoutRows:5},localY,height);
assert.equal(bars[0].x,-20);
assert.equal(bars[0].width,1150);
assert.equal(bars[0].y,localY);
assert(labels.length>0);
for(const {rect} of labels) {
  const bounds=c.timelineVisibleContentBounds(rect.y,rect.height,2);
  assert(rect.x>=bounds.left && rect.x+rect.width<=bounds.right,
    'Texto e sombra permanecem no contorno útil.');
}
assert(markers[0].x-markers[0].diameter/2>=safe.left);
assert.equal(markers[0].y,localY+height/2);

// O recorte térmico usa a altura global, mas desenha na camada do rodapé.
for(const name of ['hourLegendVisibleBoundsAtY','hourLegendRectIsFullyVisible','drawHourLegendLabelClipped']) load(name);
let output;
const offset=280;
c.drawHourLegendLabelClipped({setTextAlignedCenter(){},setFont(){},setTextColor(){},
  drawTextInRect(_,rect){output=rect;}},'23º',new Rect(400,350,50,24),{}, {},offset);
assert.equal(output.y,70);
assert.equal(output.x,400);
console.log('OK: margens seguem as curvas; chart, marcador temporal e temperaturas mantêm os eixos.');
