// Testa a prioridade da agenda sem executar o acesso nativo ao Calendário.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
const start = source.indexOf('function isBirthdayItem(');
const end = source.indexOf('async function makeWidget(', start);
assert(start >= 0 && end > start, 'Localizar o motor de seleção da agenda.');

function makeContext(sourceText = source) {
  const context = {
    Date,
    SETTINGS: {
      birthdayChartColor: '#000000',
      overflowColor: '#636366',
      minimumChartWidth: 34,
      compactMinimumChartWidth: 18,
    },
    TIMELINE_ROW_SHARE_GAP_MS: 6 * 60 * 60 * 1000,
    ALL_DAY_REMINDER_DISPLAY_START_HOUR: 6,
    windowStart: new Date(2026, 8, 18, 0),
    windowEnd: new Date(2026, 8, 19, 0),
    normalizeSearchText: value => String(value).toLocaleLowerCase('pt-BR'),
    startOfDay: date =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    addDays: (date, days) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
    dateKey: date =>
      `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
    timelineWidth: () => 1024,
    scaleVertical: value => value * 510 / 484,
    scaleFontSize: value => Math.round(value * 510 / 484),
  };
  context.timeToX = date =>
    (date.getTime() - context.windowStart.getTime()) /
    (context.windowEnd.getTime() - context.windowStart.getTime()) *
    context.timelineWidth();
  vm.createContext(context);
  vm.runInContext(sourceText.slice(sourceText.indexOf('function isBirthdayItem('), sourceText.indexOf('async function makeWidget(')), context);
  vm.runInContext(sourceText.slice(
    sourceText.indexOf('function timelineDayBoundaryGap('),
    sourceText.indexOf('function timelineItemDisplayStart(')
  ), context);
  vm.runInContext(sourceText.slice(
    sourceText.indexOf('function reminderPriorityPrefix('),
    sourceText.indexOf('function timelineItemStatus(')
  ), context);
  vm.runInContext(sourceText.slice(
    sourceText.indexOf('function estimatedTextWidth('),
    sourceText.indexOf('function drawPermissionState(')
  ), context);
  return context;
}

function fixture(hour, tomorrowCount, rows = 6, day = new Date(2026, 9, 10)) {
  const d = n => new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
  const start = d(0); start.setHours(0, 0, 0, Math.round(hour * 3600000));
  const tasks = (count, offset) => Array.from({length:count}, (_, i) => ({
    kind:'reminder', identifier:`day-${offset}-${i}`,
    title:offset === 0 && i === rows-1 ? 'TÍTULO LONGO DE HOJE '.repeat(10) : `${offset ? "B" : "A"}${i}`,
    start:d(offset), end:d(offset+1), sourceIsAllDay:true, color:'#0088ff',
  }));
  return {start, end:new Date(+start+86400000), input:[...tasks(rows+2,0),...tasks(tomorrowCount,1)], d};
}
function selectFixture(f, text = source, rows = 6) {
  const c=makeContext(text); c.windowStart=f.start;c.windowEnd=f.end;
  const result=c.chooseItems(f.input,f.start,rows);
  return {c,result};
}
const badges = result => result.filter(i=>i.isOverflow);
let cases=0;
for(const rows of [5,6]) for(const hour of [0,6,12,19.5,20.58,21,22,23.999]) {
  for(const n of [0,1,rows,rows+1,rows+2,rows+4]) {
    const f=fixture(hour,n,rows), original=JSON.stringify(f.input);
    const {c,result}=selectFixture(f,source,rows);
    assert.equal(JSON.stringify(f.input),original,'A seleção não modifica os registros fonte.');
    const today=badges(result).filter(i=>+i.overflowDayStart===+f.d(0));
    const next=badges(result).filter(i=>+i.overflowDayStart===+f.d(1));
    // Até o título curto pode alcançar amanhã quando restam poucos pixels
    // de hoje. A última linha com badge, porém, deve estar sempre liberada.
    if(hour>0 && hour<=21) {
      assert.equal(result.filter(i=>i.identifier?.startsWith('day-1')).length,Math.min(rows,n),`rows=${rows} hour=${hour} n=${n}`);
      if(hour>=12) assert.deepEqual(Array.from(next,i=>i.title),n>rows?[`+${n-rows}`]:[]);
    }
    for(const b of badges(result)) {
      assert(+b.overflowDayEnd>+b.overflowDayStart);
      if(b.isOverlay) {
        assert(b.markerX>=Math.max(0,c.timeToX(b.overflowDayStart)+c.timelineDayBoundaryGap()));
        assert(b.markerX+62<=Math.min(c.timelineWidth(),c.timeToX(b.overflowDayEnd)-c.timelineDayBoundaryGap()));
        const anchor=result.find(i=>!i.isOverflow&&i.gridRow===b.gridRow&&i.overflowBadgeRight===b.markerX+62);
        assert(anchor,'O badge tem uma âncora com reserva correspondente.');
      }
    }
    if(hour<=21) assert.equal(today.length,1);
    if(hour===23.999) assert.equal(today.length,0,'Um badge completo não cabe em hoje e não invade amanhã.');
    cases++;
  }
}
// A mesma contagem em ambos os dias é legítima quando existem oito tarefas
// diferentes em cada dia; não se deduplica pelo texto do badge.
{
  const {result}=selectFixture(fixture(19.5,8));
  assert.deepEqual(Array.from(badges(result),i=>i.title),['+2','+2']);
  assert(badges(result).every(i=>i.isOverlay));
}
// Depois da meia-noite as pendências são reapresentadas pelo carregador;
// aqui a nova janela não recebe um badge residual do dia encerrado.
for(const day of [new Date(2026,9,31),new Date(2026,11,31),new Date(2026,2,8),new Date(2026,10,1)]) {
  const f=fixture(19.5,6,6,day);
  const {result}=selectFixture(f);
  assert.equal(badges(result).length,1);
  const c=makeContext();c.windowStart=f.d(1);c.windowEnd=f.d(2);
  assert.equal(badges(c.chooseItems(f.input,c.windowStart,6)).length,0);
  cases++;
}
// Um evento real atravessando a meia-noite conserva sua duração, linha e
// reserva. Finalizar badges não libera uma continuação temporal verdadeira.
{
  const f=fixture(19.5,6);f.input=f.input.filter(i=>i.identifier!=='day-0-0');
  const event={kind:'event',identifier:'overnight',title:'Evento',start:new Date(+f.d(0)+18*3600000),
    end:new Date(+f.d(1)+12*3600000),isAllDay:false,color:'#ff0000'};
  f.input.unshift(event);
  const {result}=selectFixture(f);
  assert.equal(result.find(i=>i.identifier==='overnight').end,event.end);
  assert.equal(result.find(i=>i.identifier==='overnight').gridRow,0);
  assert(result.filter(i=>i.identifier?.startsWith('day-1')).every(i=>i.gridRow!==0));
  assert.equal(badges(result).find(i=>+i.overflowDayStart===+f.d(1)).title,'+1');
}
// Exercita o renderer real nos recortes: limites diários e curvas do canvas.
function markerRects(c,result) {
  const rects=[];
  c.Color=class {static white(){return 'white';}};
  c.Font={blackRoundedSystemFont:size=>({size})};
  c.Rect=class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}};
  c.timelineBarHeight=()=>30;
  c.timelineItemDisplayStart=c.timelineItemCollisionStart;
  c.timelineVisibleContentBounds=()=>({left:18,right:1000});
  c.drawTimelineBar=(_,rect)=>rects.push(rect);
  const start=source.indexOf('function drawTimelineItem('),end=source.indexOf('\nfunction drawTimelineTitleClipped(',start);
  vm.runInContext(source.slice(start,end),c);
  const ctx={setTextAlignedCenter(){},setFont(){},setTextColor(){},drawTextInRect(){}};
  for(const b of badges(result)) {
    const before=rects.length;c.drawTimelineItem(ctx,b,300,40);
    for(const rect of rects.slice(before)) {
      assert(rect.x>=Math.max(18,c.timeToX(b.overflowDayStart)+c.timelineDayBoundaryGap()));
      assert(rect.x+rect.width<=Math.min(1000,c.timeToX(b.overflowDayEnd)-c.timelineDayBoundaryGap()));
    }
  }
  return rects;
}
for(const hour of [0,0.001,6,12,19.5,22,23.999]) {
  const {c,result}=selectFixture(fixture(hour,8));markerRects(c,result);cases++;
}
console.log(`OK: ${cases} casos de overflow diário, reservas finais, zero/múltiplos, movimento, extremos, meia-noite e eventos multi-dia; TZ=${process.env.TZ||'local'}.`);

for(const hours of [1,12,24,48,96]) {
  const f=fixture(19.5,8);f.end=new Date(+f.start+hours*3600000);
  const {c,result}=selectFixture(f);
  markerRects(c,result);
  assert.equal(JSON.stringify(f.input),JSON.stringify(fixture(19.5,8).input));
}
{
  const f=fixture(19.5,5),c=makeContext();c.windowStart=f.start;c.windowEnd=f.end;
  const rowCounts=c.prepareTimelineRowCounts(f.input);
  const result=c.chooseItems(f.input,f.start,6,rowCounts);
  assert.equal(rowCounts[c.dateKey(f.d(0))],6);
  assert.equal(rowCounts[c.dateKey(f.d(1))],5);
  assert.equal(result.filter(i=>i.identifier?.startsWith('day-1')).length,5,
    'A grade de seis linhas de hoje não cria reservas falsas nas cinco de amanhã.');
  assert.equal(badges(result).length,1);
}
console.log('OK: janelas 1/12/24/48/96h e grades diárias 6→5.');

// Opcional: compara o motor da revisão base com o atual usando os mesmos
// registros anônimos. SVG é uma projeção das geometrias, não captura iPhone.
if(process.env.OVERFLOW_PREVIEW && process.env.OVERFLOW_BASE) {
  const base=fs.readFileSync(process.env.OVERFLOW_BASE,'utf8');
  const snapshots=[];
  for(const n of [7,6]) {
    const f=fixture(19.5,n);
    for(const [label,text] of [['ANTES',base],['DEPOIS',source]]) {
      const {c,result}=selectFixture(f,text);
      snapshots.push({label,n,result:result.map(i=>({...i})),midnight:c.timeToX(f.d(1)),
        geometry:result.map(i=>({id:i.identifier,title:i.isOverflow?i.title:`Tarefa ${i.identifier}`,
          row:i.gridRow,overflow:!!i.isOverflow,overlay:!!i.isOverlay,
          x:i.isOverflow?(i.markerX??Math.max(0,c.timeToX(i.start))-1):c.timelineItemVisualFootprint(i).left,
          right:i.isOverflow?(i.markerX??Math.max(0,c.timeToX(i.start))-1)+62:c.timelineItemVisualFootprint(i).barRight}))});
    }
  }
  assert.deepEqual(snapshots.map(s=>Array.from(s.geometry.filter(i=>i.overflow),i=>i.title)),
    [['+2','+2'],['+2','+1'],['+2','+1'],['+2']], 'A revisão base reproduz a omissão artificial.');
  const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;');
  let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1250"><rect width="1120" height="1250" fill="#101820"/><g font-family="DejaVu Sans" fill="white"><text x="24" y="30" font-size="20">Overflow por dia — simulação geométrica com dados fictícios</text><text x="24" y="56" font-size="14">Motor real de seleção; fontes e desenho ilustrativos. Não é captura do iPhone.</text>';
  snapshots.forEach((s,k)=>{
    const top=90+k*285;
    svg+=`<g transform="translate(40 ${top})"><text y="0" font-size="18">${s.label} · hoje 8 tarefas / amanhã ${s.n} · 19h30</text><rect y="16" width="1024" height="230" fill="#183550"/><rect x="${s.midnight}" y="16" width="${1024-s.midnight}" height="230" fill="#402b32"/><line x1="${s.midnight}" x2="${s.midnight}" y1="16" y2="246" stroke="white"/><text x="${s.midnight+8}" y="40" font-size="13">00h · amanhã</text>`;
    for(const i of s.geometry.filter(i=>!i.overflow))svg+=`<rect x="${i.x}" y="${55+i.row*29}" width="${Math.max(1,i.right-i.x)}" height="24" fill="#0876ae"/><text x="${i.x+5}" y="${72+i.row*29}" font-size="12">${escape(i.title)}</text>`;
    for(const i of s.geometry.filter(i=>i.overflow))svg+=`<rect x="${i.x}" y="${55+i.row*29}" width="62" height="24" fill="#636366"/><text x="${i.x+18}" y="${73+i.row*29}" font-size="19">${i.title}</text><rect x="${i.x-3}" y="${52+i.row*29}" width="68" height="30" fill="none" stroke="${s.label==='ANTES'?'#ff6262':'#5dff94'}" stroke-width="3"/>`;
    svg+=`<text y="268" font-size="14">${s.label==='ANTES'?'Título de hoje ainda reserva a última linha de amanhã.':'Badge de hoje recorta o título antes de selecionar amanhã.'}</text></g>`;
  });
  svg+='</g></svg>';
  fs.writeFileSync(process.env.OVERFLOW_PREVIEW,svg);
  fs.writeFileSync(process.env.OVERFLOW_PREVIEW.replace(/\.svg$/,'.json'),JSON.stringify(snapshots,null,2));
}


