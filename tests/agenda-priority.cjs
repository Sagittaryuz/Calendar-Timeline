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

function makeContext() {
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
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext(source.slice(
    source.indexOf('function timelineDayBoundaryGap('),
    source.indexOf('function timelineItemDisplayStart(')
  ), context);
  vm.runInContext(source.slice(
    source.indexOf('function reminderPriorityPrefix('),
    source.indexOf('function timelineItemStatus(')
  ), context);
  vm.runInContext(source.slice(
    source.indexOf('function estimatedTextWidth('),
    source.indexOf('function drawPermissionState(')
  ), context);
  return context;
}

function at(hour, dayOffset = 0) {
  return new Date(2026, 8, 18 + dayOffset, hour);
}

function timedEvent(index, hour, dayOffset = 0) {
  return {
    kind: 'event',
    title: `Evento ${index}`,
    start: at(hour, dayOffset),
    end: at(hour + 1, dayOffset),
    isAllDay: false,
    isBirthday: false,
  };
}

function birthday(dayOffset = 0, title = '🎂 Ana R. (8)') {
  return {
    kind: 'event',
    title,
    start: at(0, dayOffset),
    end: at(0, dayOffset + 1),
    isAllDay: true,
    isBirthday: true,
  };
}

function allDayEvent(title = 'Evento de dia inteiro', dayOffset = 0, isHoliday = false) {
  return {
    kind: 'event',
    title,
    start: at(0, dayOffset),
    end: at(0, dayOffset + 1),
    isAllDay: true,
    isBirthday: false,
    isHoliday,
  };
}

function reminder(title, start, end, extra = {}) {
  return {
    kind: 'reminder',
    title,
    start,
    end,
    isAllDay: false,
    sourceIsAllDay: true,
    priority: 0,
    ...extra,
  };
}

function select(items, limit = 5) {
  return makeContext().chooseItems(
    items,
    new Date(2026, 8, 18, 8),
    limit
  );
}

function selectAcrossMidnight(items) {
  const context = makeContext();
  context.windowStart = new Date(2026, 8, 18, 16);
  context.windowEnd = new Date(2026, 8, 20, 0);
  return context.chooseItems(
    items,
    new Date(2026, 8, 18, 16),
    5
  );
}

const fiveEvents = Array.from(
  { length: 5 },
  (_, index) => timedEvent(index + 1, 8)
);
const sixAgenda = select([...fiveEvents, timedEvent(6, 8)], 6);
assert.equal(sixAgenda.filter(item => !item.isOverflow).length, 6,
  'Seis eventos simultâneos devem ser exibidos sem virar excedente.');
assert.equal(new Set(sixAgenda.map(item => item.gridRow)).size, 6,
  'Cada evento simultâneo deve ocupar uma das seis linhas.');

// O último chart de hoje atravessa a meia-noite; amanhã precisa somente de cinco linhas.
const adaptiveContext = makeContext();
adaptiveContext.windowStart = at(8);
adaptiveContext.windowEnd = at(8, 1);
const crossMidnight = {...timedEvent(6, 8), title: 'Virada', end: at(4, 1)};
const adaptiveInput = [...fiveEvents, crossMidnight,
  ...Array.from({length: 4}, (_, index) => timedEvent(7 + index, 1, 1))];
const rowCounts = adaptiveContext.prepareTimelineRowCounts(adaptiveInput);
assert.deepEqual(Object.values(rowCounts), [6, 5]);
const adaptive = adaptiveContext.chooseItems(adaptiveInput, at(8), 6, rowCounts);
assert.equal(adaptive.filter(item => !item.isOverflow).length, 10,
  'As duas capacidades diárias não devem ocultar nenhum dos dez eventos.');
const carry = adaptive.find(item => item.title === 'Virada');
assert.equal(carry.gridRow, 5);
assert.equal(carry.layoutRows, 6);
assert.equal(carry.dayGridRows, undefined,
  'A continuação não deve receber outra linha na virada.');
const tomorrowRows = adaptive.filter(item => item.start >= at(0, 1)).map(item => item.gridRow);
assert.deepEqual([...tomorrowRows].sort(), [0,1,2,3],
  'Novos charts deixam livre o espaço da continuação fixa.');
const fiveTomorrow = [...adaptiveInput, timedEvent(11, 6, 1)];
assert.deepEqual(Object.values(adaptiveContext.prepareTimelineRowCounts(fiveTomorrow)), [6,5],
  'Cinco charts novos mais uma continuação não ativam seis linhas amanhã.');
const sixTomorrow = [...fiveTomorrow, timedEvent(12, 6, 1)];
assert.deepEqual(Object.values(adaptiveContext.prepareTimelineRowCounts(sixTomorrow)), [6,6],
  'Seis charts de origem do dia ativam seis linhas.');
adaptiveContext.timelineRowCounts = rowCounts;
adaptiveContext.timelineChartTop = () => 0;
adaptiveContext.timelineRowHeight = (date, count) => 300 / (count ?? adaptiveContext.timelineRowCountForDate(date));
adaptiveContext.drawEventStartLineAnchors = () => {};
const renderStart = source.indexOf('function drawTimelineItemLayer(');
const renderEnd = source.indexOf('\nfunction diagonalWeekdayLabelColor(', renderStart);
vm.runInContext(source.slice(renderStart, renderEnd), adaptiveContext);
const rendered = [];
adaptiveContext.drawTimelineItem = (_, item, y, rowHeight) => rendered.push({item, y, rowHeight});
adaptiveContext.drawTimelineItemLayer({}, adaptive);
assert(rendered.filter(entry => entry.item.layoutRows === 6).every(entry => entry.rowHeight === 50));
assert(rendered.filter(entry => entry.item.layoutRows === 5).every(entry => entry.rowHeight === 60));
const continuation = rendered.filter(entry => entry.item.title === 'Virada');
assert.equal(continuation.length, 1,
  'O chart que cruza a virada é desenhado uma única vez, sem repetir o título.');
assert.equal(continuation[0].y, 250);
assert.equal(continuation[0].rowHeight, 50);
assert.equal(continuation[0].item.end.getTime(), at(4, 1).getTime(),
  'A geometria inteira mantém seu fim no dia seguinte.');
assert.equal(continuation[0].item.layoutVisibleEnd, undefined);

// O sentido inverso também preserva a grade de origem (cinco para seis).
const reverseInput = [...fiveEvents.slice(0,4), {...crossMidnight, title:'Cinco para seis'},
  ...Array.from({length:6}, (_,index) => timedEvent(20+index,1,1))];
const reverseCounts = adaptiveContext.prepareTimelineRowCounts(reverseInput);
assert.deepEqual(Object.values(reverseCounts), [5,6]);
const reverse = adaptiveContext.chooseItems(reverseInput, at(8),6,reverseCounts);
const reverseCarry = reverse.find(item => item.title === 'Cinco para seis');
assert.equal(reverseCarry.layoutRows,5);
assert.equal(reverseCarry.gridRow,4);
assert.equal(reverseCarry.dayGridRows,undefined);
rendered.length=0;
adaptiveContext.drawTimelineItemLayer({},reverse);
const reverseDraw = rendered.find(entry => entry.item.title === 'Cinco para seis');
assert.equal(reverseDraw.rowHeight,60);
assert.equal(reverseDraw.y,240);
assert.equal(rendered.filter(entry => entry.item.title === 'Cinco para seis').length,1);
assert(reverse.filter(item => item.start >= at(0,1) && !item.isOverflow)
  .every(item => (item.gridRow+1)/6 <= reverseCarry.gridRow/5),
  'Os charts novos não sobrepõem a projeção do dia anterior.');
// Continuações de dia inteiro também ficam fixas quando entram aniversários.
const longAllDay = {...allDayEvent('Dia inteiro contínuo'), end: at(0,2)};
const bottomInput = [...fiveEvents, longAllDay, birthday(1)];
const bottomCounts = adaptiveContext.prepareTimelineRowCounts(bottomInput);
const bottomSelection = adaptiveContext.chooseItems(bottomInput, at(8),6,bottomCounts);
const bottomCarry = bottomSelection.find(item => item.title === longAllDay.title);
assert.equal(bottomCarry.gridRow,5);
assert.equal(bottomCarry.layoutRows,6);
assert.equal(bottomCarry.dayGridRows,undefined,
  'Aniversários do dia seguinte não reposicionam a continuação de dia inteiro.');
const fullAgenda = select([...fiveEvents, birthday()]);
assert.equal(
  fullAgenda.filter(item => item.kind === 'event' && !item.isBirthdayGroup).length,
  5,
  'Aniversário não pode expulsar evento prioritário.'
);
assert.equal(
  fullAgenda.filter(item => item.isBirthdayGroup).length,
  0,
  'Sem linha livre, aniversário não pode sobrepor a agenda.'
);
assert.equal(
  fullAgenda.filter(item => item.isOverflow).length,
  0,
  'O aniversário não deve gerar overflow artificial.'
);

const fourEvents = fiveEvents.slice(0, 4);
const agendaWithSpace = select([...fourEvents, birthday()]);
assert.equal(
  agendaWithSpace.filter(item => item.isBirthdayGroup).length,
  1,
  'Aniversário deve ocupar a linha livre depois da agenda.'
);
assert.equal(
  agendaWithSpace.find(item => item.isBirthdayGroup).gridRow,
  4,
  'Aniversário ocupa a próxima linha livre depois da agenda.'
);

const allDayBeforeBirthday = select([
  allDayEvent(),
  birthday(),
]);
assert.equal(
  allDayBeforeBirthday.find(item => item.title === 'Evento de dia inteiro').gridRow,
  0,
  'Evento de dia inteiro fica acima do aniversário.'
);
assert.equal(
  allDayBeforeBirthday.find(item => item.isBirthdayGroup).gridRow,
  1,
  'Aniversário fica abaixo do evento de dia inteiro.'
);

const allDayBirthdayHoliday = select([
  allDayEvent(),
  birthday(),
  allDayEvent('Feriado', 0, true),
]);
assert.equal(
  allDayBirthdayHoliday.find(item => item.title === 'Evento de dia inteiro').gridRow,
  1,
  'Evento de dia inteiro vem depois do feriado e antes do aniversário.'
);
assert.equal(
  allDayBirthdayHoliday.find(item => item.isBirthdayGroup).gridRow,
  2,
  'Aniversário fica abaixo do evento de dia inteiro.'
);
assert.equal(
  allDayBirthdayHoliday.find(item => item.title === 'Feriado').gridRow,
  0,
  'Feriado mantém prioridade sobre os dois tipos rebaixados.'
);

const holidayKeepsPriorityOverBirthday = select([
  ...Array.from({ length: 4 }, (_, index) => timedEvent(index + 1, 8)),
  birthday(),
  allDayEvent('Feriado', 0, true),
]);
assert.equal(
  holidayKeepsPriorityOverBirthday.filter(item => item.isBirthdayGroup).length,
  0,
  'Aniversário não desloca o feriado prioritário.'
);
assert.equal(
  holidayKeepsPriorityOverBirthday.filter(item => item.title === 'Feriado').length,
  1,
  'Feriado ocupa a última linha antes dos tipos rebaixados.'
);

const currentAllDayReminder = {
  kind: 'reminder',
  title: 'Lembrete de hoje',
  start: at(0),
  end: at(6, 1),
  isAllDay: false,
  sourceIsAllDay: true,
};
const tomorrowAllDayReminder = {
  kind: 'reminder',
  title: 'Lembrete de amanhã',
  start: at(0, 1),
  end: at(0, 2),
  isAllDay: false,
  sourceIsAllDay: true,
};
const midnightReflow = selectAcrossMidnight([
  currentAllDayReminder,
  tomorrowAllDayReminder,
]);
assert.equal(
  midnightReflow.find(item => item.title === 'Lembrete de amanhã').gridRow,
  0,
  'Lembrete de amanhã deve reutilizar a linha liberada às 06:00.'
);

const currentTime = new Date(2026, 8, 18, 8);
const currentTimeContext = makeContext();
currentTimeContext.windowStart = currentTime;
currentTimeContext.windowEnd = new Date(2026, 8, 19, 8);
const overdueReminder = reminder(
  'Lembrete atrasado',
  at(0),
  at(0, 1),
  { isOverdue: true }
);
const todaysReminder = reminder(
  'Lembrete de hoje',
  at(0),
  at(0, 1)
);
const remindersTogether = currentTimeContext.chooseItems(
  [
    timedEvent(1, 8),
    timedEvent(2, 10),
    timedEvent(3, 12),
    todaysReminder,
    overdueReminder,
  ],
  currentTime,
  5
);
assert(
  remindersTogether.find(item => item.title === 'Lembrete atrasado').gridRow <
    remindersTogether.find(item => item.title === 'Lembrete de hoje').gridRow,
  'O lembrete atrasado deve aparecer antes dos demais lembretes do dia.'
);

const crowdedReminderDay = currentTimeContext.chooseItems(
  [
    ...Array.from({ length: 4 }, (_, index) => timedEvent(index + 1, 8)),
    reminder('Lembrete atrasado', at(0), at(0, 1), {
      isOverdue: true,
    }),
    ...Array.from({ length: 6 }, (_, index) =>
      reminder(`Lembrete de hoje ${index + 1}`, at(0), at(0, 1))
    ),
  ],
  currentTime,
  5
);
assert.equal(
  crowdedReminderDay.filter(item => item.isOverflow).length,
  1,
  'Os seis lembretes ocultos devem gerar um único indicador de excedentes.'
);
assert.equal(
  crowdedReminderDay.find(item => item.isOverflow).title,
  '+6',
  'O indicador deve contar apenas os seis lembretes ocultos, não o atrasado visível.'
);
assert.equal(
  crowdedReminderDay.filter(item => item.kind === 'event').length,
  4,
  'O indicador de excedentes não pode remover eventos.'
);
const visibleOverdue = crowdedReminderDay.find(item => item.isOverdue);
const overflowBadge = crowdedReminderDay.find(item => item.isOverflow);
assert(visibleOverdue, 'O chart do lembrete atrasado deve permanecer visível.');
assert.equal(visibleOverdue.gridRow, 4);
assert.equal(overflowBadge.gridRow, visibleOverdue.gridRow);
assert.equal(overflowBadge.isOverlay, true);
assert(visibleOverdue.overflowBadgeRight >= 62);
assert.equal(
  crowdedReminderDay.filter(item =>
    item.kind === 'reminder' && !item.isOverdue
  ).length,
  0,
  'Os lembretes de hoje devem ficar ocultos neste cenário cheio.'
);

const lastRowBadge = currentTimeContext.chooseItems(
  [
    ...Array.from({ length: 3 }, (_, index) => timedEvent(index + 1, 8)),
    reminder('Lembrete atrasado', at(0), at(0, 1), {
      isOverdue: true,
    }),
    reminder('Ligar pra Ronan', at(0), at(0, 1)),
    reminder('Outro lembrete', at(0), at(0, 1)),
  ],
  currentTime,
  5
);
const lastBadge = lastRowBadge.find(item => item.isOverflow);
assert.equal(lastBadge.title, '+1');
assert.equal(lastBadge.gridRow, 4, 'O +1 deve ficar na última linha.');
assert.equal(lastBadge.isOverlay, true);
assert.equal(
  lastRowBadge.find(item => item.title === 'Ligar pra Ronan').gridRow,
  4,
  'O +1 deve acompanhar o chart da última linha, não o atrasado acima.'
);
assert.equal(
  lastRowBadge.find(item => item.title === 'Lembrete atrasado').gridRow,
  3
);

const shareContext = makeContext();
shareContext.windowStart = at(8);
shareContext.windowEnd = at(8, 1);
const portuguese = {
  ...timedEvent(1, 7),
  title: 'Bimestral de Português',
  end: at(11),
};
const dentist = {
  ...timedEvent(2, 16),
  title: 'Dentista',
};
const longTitles = shareContext.chooseItems(
  [portuguese, dentist], at(8), 5
);
assert.notEqual(
  longTitles[0].gridRow,
  longTitles[1].gridRow,
  'Bimestral de Português e Dentista não devem compartilhar linha com textos sobrepostos.'
);
const shortPortuguese = { ...portuguese, title: 'Português' };
const shortTitles = shareContext.chooseItems(
  [shortPortuguese, dentist], at(8), 5
);
assert.equal(
  shortTitles[0].gridRow,
  shortTitles[1].gridRow,
  'Português e Dentista devem dividir a primeira linha quando houver espaço.'
);
const lateWindow = makeContext();
lateWindow.windowStart = new Date(2026, 8, 18, 10, 59);
lateWindow.windowEnd = new Date(2026, 8, 19, 10, 59);
const lateLayout = lateWindow.chooseItems(
  [{...shortPortuguese, title: 'Português II'}, dentist], lateWindow.windowStart, 5
);
assert.notEqual(
  lateLayout[0].gridRow,
  lateLayout[1].gridRow,
  'Pouco antes das 11h, Dentista deve descer se o texto Português II impedir.'
);

const timedReminders = select([
  reminder('A', at(8), at(9), { sourceIsAllDay: false }),
  reminder('B', at(16), at(17), { sourceIsAllDay: false }),
]);
assert.equal(
  timedReminders[0].gridRow,
  timedReminders[1].gridRow,
  'Dois lembretes com horário podem compartilhar linha sem colisão visual.'
);
const overlappingTimedReminders = select([
  reminder('A', at(8), at(10), { sourceIsAllDay: false }),
  reminder('B', at(9), at(11), { sourceIsAllDay: false }),
]);
assert.notEqual(
  overlappingTimedReminders[0].gridRow,
  overlappingTimedReminders[1].gridRow,
  'Lembretes simultâneos não podem dividir a linha.'
);
const allDayReminders = select([
  reminder('A', at(0), at(0, 1)),
  reminder('B', at(0), at(0, 1)),
]);
assert.notEqual(
  allDayReminders[0].gridRow,
  allDayReminders[1].gridRow,
  'Lembretes de dia inteiro continuam em linhas separadas.'
);
const mixedNear = select([
  timedEvent(1, 8),
  reminder('Curto', at(14), at(15), { sourceIsAllDay: false }),
]);
assert.equal(
  mixedNear[0].gridRow,
  mixedNear[1].gridRow,
  'Evento e lembrete próximos ainda podem compartilhar se os textos couberem.'
);
const mixedFar = select([
  timedEvent(1, 8),
  reminder('Curto', at(16), at(17), { sourceIsAllDay: false }),
]);
assert.notEqual(
  mixedFar[0].gridRow,
  mixedFar[1].gridRow,
  'O limite existente de seis horas entre evento e lembrete deve permanecer.'
);

const saturated = select([
  ...Array.from({ length: 6 }, (_, index) => timedEvent(index + 1, 8)),
]);
assert.equal(
  saturated.filter(item => item.isOverflow).length,
  1,
  'Mesmo com cinco charts curtos, o excedente deve aparecer sobre um deles.'
);
for (const marker of saturated.filter(item => item.isOverflow)) {
  if (marker.isOverlay) {
    assert(
      saturated.some(item =>
        !item.isOverflow && item.gridRow === marker.gridRow &&
        item.overflowBadgeRight >= marker.markerX + 62
      ),
      'Indicador sobreposto deve reservar espaço no chart que o sustenta.'
    );
    continue;
  }
  for (const item of saturated.filter(
    candidate => !candidate.isOverflow && candidate.gridRow === marker.gridRow
  )) {
    assert(!contextItemsOverlap(marker, item), 'Overflow não pode cobrir chart.');
  }
}

function contextItemsOverlap(first, second) {
  return first.start < second.end && second.start < first.end;
}

console.log('OK: prioridade, compartilhamento por texto e excedentes sobre chart com título preservado.');

// Reproduz a ausência do +X: título integral da sexta tarefa excede o canvas.
for (const count of [4, 6, 7, 9]) {
  const c = makeContext();
  c.windowStart = at(8); c.windowEnd = at(8, 1);
  const input = Array.from({length: count}, (_, i) => reminder(
    i === 5 ? 'Pagar 1333,00 para Tiago PA Engenharia — título integral bastante longo '.repeat(3) : `Pendente ${i}`,
    at(0), at(0, 1), {identifier: `task-${i}`}));
  const result = c.chooseItems(input, at(8), 6);
  assert.equal(result.filter(i => !i.isOverflow).length, Math.min(6, count));
  const badges = result.filter(i => i.isOverflow);
  assert.equal(badges.length, count > 6 ? 1 : 0);
  if (badges.length) {
    assert.equal(badges[0].title, `+${count - 6}`);
    assert.equal(badges[0].gridRow, 5);
    assert(badges[0].markerX >= 0 && badges[0].markerX + 62 <= c.timelineWidth());
    assert.equal(result.find(i => i.identifier === 'task-5').title, input[5].title);
  }
}

// Lembretes com horário compartilham antes dos sem horário; excedentes são diários.
{
  const c = makeContext(); c.windowStart = at(8); c.windowEnd = at(8,1);
  const full = Array.from({length:6}, (_,i) => reminder(`Base ${i}`, at(0), at(0,1)));
  const hidden = [reminder('Depois A', at(12), at(13), {sourceIsAllDay:false}),
    reminder('Depois B', at(18), at(19), {sourceIsAllDay:false})];
  const result = c.chooseItems([...full, ...hidden], at(8),6);
  assert.deepEqual(Array.from(result.filter(i => i.isOverflow), i => i.title), ['+1']);
  assert.equal(result.filter(i => !i.isOverflow).length, 7);
  assert.equal(result.filter(i=>!i.sourceIsAllDay&&!i.isOverflow).length,2);
  assert.equal(result.filter(i=>i.sourceIsAllDay).length,5);
  // Outro dia na mesma linha recebe seu próprio badge.
  const nextDay = full.map(i => ({...i, start:at(0,1), end:at(0,2)}));
  c.windowEnd=at(8,2);
  const multi = c.chooseItems([...full,...hidden,...nextDay,
    reminder('Amanhã oculto',at(0,1),at(0,2))],at(8),6);
  assert.deepEqual(Array.from(multi.filter(i=>i.isOverflow),i=>i.title),['+2','+1']);
}

// Render real do ramo de overflow, com operações de desenho registradas.
{
  const c=makeContext();
  c.Color=class {static white(){return 'white';}};
  c.Font={blackRoundedSystemFont:size=>({size})};
  c.timelineBarHeight=()=>30;
  c.timelineVisibleContentBounds=()=>({left:18,right:1000});
  const bars=[],texts=[];
  c.drawTimelineBar=(_,rect)=>bars.push(rect);
  c.Rect=class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}};
  const start=source.indexOf('function drawTimelineItem(');
  const end=source.indexOf('\nfunction drawTimelineTitleClipped(',start);
  vm.runInContext(source.slice(start,end),c);
  const ctx={setTextAlignedCenter(){},setFont(font){assert(font.size>0);},
    setTextColor(color){assert.equal(color,'white');},
    drawTextInRect(text,rect){texts.push({text,rect});}};
  for(const x of [-1,0,980]) c.drawTimelineItem(ctx,
    {isOverflow:true,kind:'overflow',title:'+3',markerX:x,layoutRows:6,color:'#636366'},300,40);
  for(const rect of bars){assert(rect.x>=18);assert(rect.x+rect.width<=1000);}
  for(const {text,rect} of texts){assert.equal(text,'+3');assert.equal(rect.width,62);assert(rect.height>23);}
}

// Mocks reproduzem o contrato das APIs nativas de lembretes incompletos.
(async()=>{
  const c=makeContext(); c.now=at(8);c.windowStart=at(8);c.windowEnd=at(0,1);
  c.TITLE_CARD_COUNT=7;c.titleWeekStart=()=>at(0);
  Object.assign(c.SETTINGS,{showOverdueReminders:true,excludedCalendars:['Excluído']});
  c.isHolidayEvent=()=>false;
  c.removeSupersededCalendarEventViews=x=>x;
  c.cleanTitle=x=>x;c.safeCalendarColor=()=> '#FFFFFF';
  c.calculateScheduleSummary=()=>({busyMinutes:0,freeMinutes:1440});
  c.normalizedReminderDayStart=r=>r.dueDate?c.startOfDay(r.dueDate):null;
  const pending=Array.from({length:7},(_,i)=>({identifier:`p${i}`,title:`Pendente ${i}`,
    dueDate:at(0),dueDateIncludesTime:false,calendar:{title:'Tarefas'},isCompleted:false}));
  const raw=[...pending,{...pending[0],identifier:'completed',isCompleted:true},
    {...pending[0],identifier:'excluded',calendar:{title:'Excluído'}},
    {...pending[0],identifier:'tomorrow',dueDate:at(0,1)}];
  c.CalendarEvent={between:async()=>[],today:async()=>[]};
  c.Reminder={incompleteDueBetween:async()=>raw.filter(r=>!r.isCompleted),
    incompleteDueToday:async()=>raw.filter(r=>!r.isCompleted&&r.dueDate.getTime()===at(0).getTime()),
    scheduled:async()=>raw.filter(r=>!r.isCompleted)};
  const start=source.indexOf('async function loadWindow(');
  const end=source.indexOf('\nasync function loadAstronomy(',start);
  vm.runInContext(source.slice(start,end),c);
  const result=await c.loadWindow();
  assert.equal(result.error,null);
  assert.equal(result.items.length,7,'Hoje exclui concluídas, calendário excluído e amanhã fora da janela.');
  assert.equal(new Set(result.items.map(i=>i.identifier)).size,7,'Consultas repetidas não duplicam ocorrências.');
  const selected=c.chooseItems(result.items,at(8),6);
  assert.equal(selected.filter(i=>!i.isOverflow).length,6);
  assert.equal(selected.find(i=>i.isOverflow).title,'+1');
  console.log('OK: tarefas 4/6/7/9, títulos longos, +X diário, dias independentes, render no contorno e consultas deduplicadas.');
})().catch(error=>{console.error(error);process.exitCode=1;});

{
  const c=makeContext();c.windowStart=at(8);c.windowEnd=at(8,1);
  const events=Array.from({length:3},(_,i)=>({...timedEvent(i,8),conflictCount:99}));
  const tasks=Array.from({length:6},(_,i)=>reminder(`Tarefa ${i}`,at(0),at(0,1)));
  const mixed=c.chooseItems([...tasks,...events],at(8),6);
  assert.equal(mixed.filter(i=>i.kind==='event').length,3,'Eventos continuam prioritários.');
  assert.equal(mixed.filter(i=>i.kind==='reminder').length,3);
  assert.equal(mixed.find(i=>i.isOverflow).title,'+3','Conta omitidos, não conflitos.');
  const allDay=c.chooseItems([...Array.from({length:7},(_,i)=>allDayEvent(`Dia inteiro ${i}`))],at(8),6);
  assert.equal(allDay.filter(i=>!i.isOverflow).length,6);
  assert.equal(allDay.find(i=>i.isOverflow).title,'+1','Chart de dia inteiro também pode sustentar o badge.');
}

// Prioridade menor ocupa linhas contíguas, inclusive quando sozinha.
for (const limit of [1, 2, 3, 5, 6]) {
  assert.equal(select([birthday()], limit).find(i=>i.isBirthdayGroup).gridRow, 0);
  assert.equal(select([allDayEvent()], limit)[0].gridRow, 0);
  const days=Array.from({length:3},(_,i)=>allDayEvent('Dia '+i));
  const result=select([...days,birthday()],limit);
  assert.deepEqual(Array.from(result.filter(i=>!i.isOverflow),i=>i.gridRow),
    Array.from({length:Math.min(limit,4)},(_,i)=>i));
  assert.deepEqual(Array.from(result.filter(i=>!i.isOverflow&&!i.isBirthdayGroup),i=>i.title),
    days.slice(0,limit).map(i=>i.title), 'Empates preservam ordem de entrada.');
}
{
  const high=[timedEvent(1,8),reminder('Atrasado',at(0),at(0,1),{isOverdue:true}),
    reminder('Hoje',at(0),at(0,1))];
  const result=select([birthday(),allDayEvent(),...high],5);
  for(const [title,row] of [['Evento 1',0],['Atrasado',1],['Hoje',2],['Evento de dia inteiro',3],['Aniversários',4]])
    assert.equal(result.find(i=>i.title===title).gridRow,row);
  for(const limit of [1,2,3]) {
    const result=select([birthday(),allDayEvent(),...high],limit);
    assert(!result.some(i=>i.isBirthdayGroup||i.isAllDay&&!i.isOverflow));
  }
}
console.log('OK: prioridade compacta, itens isolados, truncamento e empates.');

// Badge no fim da barra dos lembretes, sem recuar bolinha/título.
{
  const c=makeContext();c.windowStart=at(8);c.windowEnd=at(8,1);
  const input=Array.from({length:7},(_,i)=>reminder('Tarefa '+i,at(18),at(0,1),
    {sourceIsAllDay:false,identifier:'task-'+i}));
  const result=c.chooseItems(input,at(8),6);
  const anchor=result.find(i=>i.identifier==='task-5');
  const badge=result.find(i=>i.isOverflow);
  const segment=c.timelineItemBarSegmentsForDisplay(anchor)[0];
  assert.equal(badge.title,'+1');assert.equal(badge.gridRow,anchor.gridRow);
  assert.equal(badge.markerX,segment.x+segment.width-62);
  assert.equal(anchor.overflowBadgeLeft,badge.markerX);
  assert.equal(anchor.overflowBadgeRight,badge.markerX+62);
  assert.equal(anchor.start.getTime(),at(18).getTime());
  assert.equal(anchor.end.getTime(),at(0,1).getTime());
}
console.log('OK: +N conserva contagem e linha, ancorado no fim do lembrete.');

// Horário definido precede dia inteiro, mesmo quando o sem horário está atrasado.
for(const limit of [1,2,3,5,6]) {
  const input=[
    reminder('Sem hora atrasado',at(0),at(0,1),{isOverdue:true}),
    reminder('Com hora hoje',at(18),at(0,1),{sourceIsAllDay:false}),
    reminder('Sem hora hoje',at(0),at(0,1)),
    reminder('Com hora atrasado',at(0),at(0,1),{sourceIsAllDay:false,isOverdue:true}),
  ];
  const original=JSON.stringify(input);
  const result=select(input,limit).filter(i=>!i.isOverflow);
  assert.deepEqual(Array.from(result,i=>i.title),
    ['Com hora atrasado','Com hora hoje','Sem hora atrasado','Sem hora hoje'].slice(0,limit));
  assert.deepEqual(Array.from(result,i=>i.gridRow),Array.from({length:Math.min(limit,4)},(_,i)=>i));
  assert.equal(JSON.stringify(input),original);
}
// Dentro da classe, atraso, início, fim e empate estável continuam valendo.
{
  const input=[
    reminder('Empate A',at(12),at(0,1),{sourceIsAllDay:false}),
    reminder('Sem hora',at(0),at(0,1)),
    reminder('Empate B',at(12),at(0,1),{sourceIsAllDay:false}),
    reminder('Fim menor',at(12),at(20),{sourceIsAllDay:false}),
    reminder('Começa antes',at(8),at(0,1),{sourceIsAllDay:false}),
    reminder('Atrasado',at(15),at(0,1),{sourceIsAllDay:false,isOverdue:true}),
  ];
  assert.deepEqual(Array.from(select(input,6).filter(i=>!i.isOverflow),i=>i.title),
    ['Atrasado','Começa antes','Fim menor','Empate A','Empate B','Sem hora']);
}
// Compartilhamento não deixa lacunas que permitam sem horário acima de com horário.
{
  const input=[timedEvent(1,8),
    reminder('A',at(14),at(15),{sourceIsAllDay:false}),
    reminder('B',at(19),at(0,1),{sourceIsAllDay:false}),
    ...Array.from({length:3},(_,i)=>reminder('Sem hora '+i,at(0),at(0,1)))];
  const result=select(input,5).filter(i=>!i.isOverflow);
  assert.equal(result.find(i=>i.title==='A').gridRow,0,'Compartilhamento existente preservado.');
  assert.equal(result.find(i=>i.title==='B').gridRow,1,'A próxima linha fica contígua.');
  const timed=result.filter(i=>i.kind==='reminder'&&!i.sourceIsAllDay);
  const noTime=result.filter(i=>i.sourceIsAllDay);
  assert(noTime.every(i=>timed.every(j=>i.gridRow>j.gridRow)));
  assert.deepEqual([...new Set(result.map(i=>i.gridRow))],[0,1,2,3,4]);
}
// Datas independentes; atrasados antigos pertencem visualmente a hoje.
{
  const c=makeContext();c.windowStart=at(8);c.windowEnd=at(8,2);
  const input=[reminder('Sem hora antigo',at(0,-1),at(0,1),{isOverdue:true}),
    reminder('Com hora hoje',at(18),at(0,1),{sourceIsAllDay:false}),
    reminder('Sem hora amanhã',at(0,1),at(0,2)),
    reminder('Com hora amanhã',at(18,1),at(0,2),{sourceIsAllDay:false}),
    reminder('Com hora antigo',at(0,-1),at(0,1),{sourceIsAllDay:false,isOverdue:true})];
  const result=c.chooseItems(input,at(8),6);
  assert.equal(result.find(i=>i.title==='Com hora antigo').gridRow,0);
  assert.equal(result.find(i=>i.title==='Com hora hoje').gridRow,1);
  assert.equal(result.find(i=>i.title==='Sem hora antigo').gridRow,2);
  assert.equal(result.find(i=>i.title==='Com hora amanhã').gridRow,0);
  assert.equal(result.find(i=>i.title==='Sem hora amanhã').gridRow,1);
}
console.log('OK: horário precede dia inteiro, atrasos por classe, empates, datas e linhas contíguas.');
