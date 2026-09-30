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

load('drawOutlinedTimelineTextInRect');
// Evento curto: o nome completo tem espaço além do retângulo do chart.
bars.length=0; labels.length=0;
c.timelineItemBarSegmentsForDisplay=()=>[{x:100,width:34}];
c.drawTimelineItem(ctx,{kind:'event',title:'Natação',color:'#FF0000',layoutRows:5,isCurrentEvent:true},localY,height);
const swimming=labels.find(entry=>entry.text==='NATAÇÃO');
assert(swimming);
assert(swimming.rect.width>7*30*0.7,
  'O título completo deve caber mesmo com chart de apenas 34 px.');
assert(swimming.rect.x+swimming.rect.width>bars[0].x+bars[0].width);
assert.equal(bars[0].width,34);

// Dois aniversariantes num trecho curto antes da meia-noite permanecem juntos.
load('drawBirthdayGroupLabel');
Object.assign(c,{windowEnd:new Date(2026,9,1,20),
  timeToX:date=>date.getTime()===c.windowStart.getTime()?0:180,
  cleanTitle:text=>text,
  birthdayLabelWidth:(text,size)=>text.length*size*0.7,
});
c.SETTINGS.birthdayLabelGap=30;
labels.length=0;
c.drawBirthdayGroupLabel(ctx,{start:c.windowStart,end:new Date(2026,9,1),
  layoutRows:5,birthdayItems:[{title:'🎂 Lays M. (39)'},{title:'🎂 Thiago A. (31)'}]},localY,height);
const birthdayNames=[...new Set(labels.map(entry=>entry.text))];
assert.deepEqual(birthdayNames,['🎂 Lays M. (39)','🎂 Thiago A. (31)']);
const second=labels.find(entry=>entry.text.includes('Thiago'));
assert(second.rect.x>180,'O segundo nome pode atravessar o limite do dia.');
assert(second.rect.width>second.text.length*30*0.7);

// O recorte térmico usa a altura global, mas desenha na camada do rodapé.
for(const name of ['hourLegendVisibleBoundsAtY','hourLegendRectIsFullyVisible','drawHourLegendLabelClipped']) load(name);
let output;
const offset=280;
c.drawHourLegendLabelClipped({setTextAlignedCenter(){},setFont(){},setTextColor(){},
  drawTextInRect(_,rect){output=rect;}},'23º',new Rect(400,350,50,24),{}, {},offset);
assert.equal(output.y,70);
assert.equal(output.x,400);
console.log('OK: margens seguem as curvas; chart, marcador temporal e temperaturas mantêm os eixos.');
