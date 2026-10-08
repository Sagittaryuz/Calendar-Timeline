// Limite diário dos charts de lembretes; dados fictícios, sem APIs pessoais.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','Calendar Timeline'),'utf8');
assert.doesNotMatch(source,/PENDING_DAY_CARRYOVER_CUTOFF_HOUR|PENDING_DAY_CARRYOVER_END_HOUR|function pendingDayCarryoverEnd\(/);
const c={Date,SETTINGS:{minimumChartWidth:34,compactMinimumChartWidth:18},
  EVENT_STARTING_SOON_WINDOW_MS:30*60000,ALL_DAY_REMINDER_DISPLAY_START_HOUR:6,
  startOfDay:d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()),
  addDays:(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n),
  isCompactMode:()=>false,timelineDayBoundaryGap:()=>9,timelineWidth:()=>1024};
vm.createContext(c);
for(const name of ['limitReminderChartToDay','prepareTimelineItems',
  'timelineItemCollisionStart','effectiveItemEnd','itemsOverlap',
  'timelineBarSegments','timelineItemBarSegmentsForDisplay']) {
  const begin=source.indexOf('function '+name+'(');
  const end=source.indexOf('\nfunction ',begin+10);
  assert(begin>=0&&end>begin,name);
  vm.runInContext(source.slice(begin,end),c);
}
function at(day,hour,minute=0){return new Date(2026,9,day,hour,minute);}
let cases=0;
for(const reference of [at(8,11,59),at(8,12),at(8,12,1),at(8,23,59),at(9,0)]) {
  c.now=reference;c.windowStart=reference;
  for(const hours of [1,24,48,96]) {
    c.windowEnd=new Date(reference.getTime()+hours*3600000);
    c.timeToX=d=>(d-c.windowStart)/(c.windowEnd-c.windowStart)*1024;
    const day=c.startOfDay(reference),dayEnd=c.addDays(day,1);
    for(const sourceIsAllDay of [false,true]) for(const isOverdue of [false,true]) {
      const start=isOverdue?c.addDays(day,-1):new Date(day);
      if(!sourceIsAllDay)start.setHours(10);
      const input={kind:'reminder',title:'TAREFA DE TESTE',start,
        end:new Date(dayEnd.getTime()+6*3600000),sourceIsAllDay,isOverdue,
        priority:1,isAllDay:false,isPendingDayCarryover:true};
      const original=JSON.stringify(input);
      const copy=c.prepareTimelineItems([input],reference)[0];
      assert.equal(copy.end.getTime(),dayEnd.getTime());
      assert.equal(copy.start.getTime(),input.start.getTime());
      assert.equal(copy.priority,1);assert.equal(copy.sourceIsAllDay,sourceIsAllDay);
      assert.equal(copy.isPendingDayCarryover,undefined);
      assert.equal(JSON.stringify(input),original,'Não altera o objeto da fonte.');
      const segments=c.timelineItemBarSegmentsForDisplay(copy);
      assert(segments.every(segment=>segment.x+segment.width<=c.timeToX(dayEnd)),
        'O chart não atravessa a meia-noite.');
      cases++;
    }
    // Lembrete de amanhã não herda o limite do dia de referência.
    const future={kind:'reminder',title:'AMANHÃ',start:c.addDays(day,1),
      end:c.addDays(day,2),sourceIsAllDay:true};
    const prepared=c.prepareTimelineItems([future],reference)[0];
    assert.equal(prepared.end.getTime(),c.addDays(day,2).getTime());
    // Intervalo menor é preservado; não há extensão nem mesmo até meia-noite.
    const short={kind:'reminder',title:'CURTO',start:at(day.getDate(),10),
      end:at(day.getDate(),11),sourceIsAllDay:false};
    assert.equal(c.prepareTimelineItems([short],reference)[0].end.getTime(),short.end.getTime());
    // Eventos reais podem continuar atravessando a virada.
    const event={kind:'event',title:'EVENTO',start:at(day.getDate(),23),
      end:at(day.getDate()+1,3),isAllDay:false};
    const real=c.prepareTimelineItems([event],reference)[0];
    assert.equal(real.start.getTime(),event.start.getTime());
    assert.equal(real.end.getTime(),event.end.getTime());
    // Um lembrete diário libera sua linha exatamente na virada.
    const today={kind:'reminder',start:day,end:dayEnd,sourceIsAllDay:false};
    const tomorrow={kind:'reminder',start:dayEnd,end:c.addDays(day,2),sourceIsAllDay:false};
    assert.equal(c.itemsOverlap(today,tomorrow),false);
  }
}
// Limites normais antes, em e depois das 12h não mudam.
for(const hour of [0,10,12,13,23]) {
  const item={kind:'reminder',title:'NORMAL',start:at(8,hour),end:at(9,0),sourceIsAllDay:false};
  for(const reference of [at(8,11,59),at(8,12),at(8,12,1)]) {
    assert.equal(c.prepareTimelineItems([item],reference)[0].end.getTime(),at(9,0).getTime());
  }
}
console.log('OK: '+cases+' cenários de término diário; meio-dia, virada, futuros, atrasados, sem horário, janelas e eventos preservados.');
