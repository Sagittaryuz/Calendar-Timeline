// Verifica a seleção da guia de chegada sem executar o desenho nativo do Scriptable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
const start = source.indexOf('function formatEventArrivalHours(');
const end = source.indexOf('function drawEventStartLines(', start);
assert(start >= 0 && end > start, 'Localizar a guia de chegada.');

const now = new Date('2026-09-20T18:00:00Z');
const context = {
  Date,
  now,
  windowStart: now,
  SETTINGS: { maxItems: 5 },
  EVENT_ARRIVAL_GUIDE_LEFT_MARGIN: 8,
  EVENT_ARRIVAL_GUIDE_LABEL_GAP: 6,
  EVENT_STARTING_SOON_WINDOW_MS: 30 * 60 * 1000,
  startOfDay: date =>
    new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )),
  addDays: (date, days) =>
    new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
  isBirthdayItem: item =>
    item?.isBirthday === true || item?.isBirthdayGroup === true,
  dateKey: date =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
};
vm.createContext(context);

const allDayInferenceStart = source.indexOf('function calendarEventIsAllDay(');
const allDayInferenceEnd = source.indexOf(
  'function calculateScheduleSummary(',
  allDayInferenceStart
);
assert(
  allDayInferenceStart >= 0 && allDayInferenceEnd > allDayInferenceStart,
  'Localizar a normalização da flag de dia inteiro.'
);
vm.runInContext(
  source.slice(allDayInferenceStart, allDayInferenceEnd),
  context
);
vm.runInContext(source.slice(start, end), context);
context.applyPendingDayCarryover = () => {};
context.itemsOverlap = () => false;
const prepareStart = source.indexOf('function prepareTimelineItems(');
const prepareEnd = source.indexOf(
  'function isPendingDayCarryoverCandidate(',
  prepareStart
);
assert(prepareStart >= 0 && prepareEnd > prepareStart);
vm.runInContext(source.slice(prepareStart, prepareEnd), context);

function at(day, hour, minute = 0) {
  return new Date(Date.UTC(2026, 8, day, hour, minute));
}

function event(title, startDate, endDate, gridRow, extra = {}) {
  return {
    kind: 'event',
    title,
    start: startDate,
    end: endDate,
    gridRow,
    isAllDay: false,
    ...extra,
  };
}

const editedAllDayEvent = {
  isAllDay: true,
  startDate: at(20, 7),
  endDate: at(20, 11),
};
const editedAllDayFlag = context.calendarEventIsAllDay(
  editedAllDayEvent,
  editedAllDayEvent.startDate,
  editedAllDayEvent.endDate
);
assert.equal(
  editedAllDayFlag,
  false,
  'Uma flag antiga de dia inteiro não deve sobrepor um intervalo explícito de 07h a 11h.'
);
const editedEventInterval = context.calendarEventDisplayInterval(
  editedAllDayEvent,
  true,
  at(21, 0)
);
assert.equal(editedEventInterval.isAllDay, false);
assert.equal(
  editedEventInterval.end.getTime(),
  at(20, 11).getTime(),
  'O evento convertido não deve ser estendido até a meia-noite.'
);
const editedEventGuide = context.todayEventArrivalGuides(
  [event(
    'Bimestral de Português',
    editedEventInterval.start,
    editedEventInterval.end,
    1,
    { isAllDay: editedEventInterval.isAllDay }
  )],
  at(20, 1, 7)
);
assert.equal(
  editedEventGuide.length,
  1,
  'Evento convertido para 07h–11h deve voltar a receber linha de chegada.'
);
assert.equal(editedEventGuide[0].label, '6h');

const convertedOccurrence = {
  identifier: 'bimestral-portugues',
  title: 'Bimestral de Português',
  isAllDay: false,
  startDate: at(20, 7),
  endDate: at(20, 11),
};
const staleTodayOccurrence = {
  ...convertedOccurrence,
  isAllDay: true,
  endDate: at(21, 7),
};
const convertedView = {
  event: convertedOccurrence,
  ...context.calendarEventDisplayInterval(
    convertedOccurrence,
    false,
    null
  ),
  occursToday: false,
};
const staleTodayView = {
  event: staleTodayOccurrence,
  ...context.calendarEventDisplayInterval(
    staleTodayOccurrence,
    true,
    at(21, 0)
  ),
  occursToday: true,
};
assert.equal(
  context.preferCalendarEventView(convertedView, staleTodayView),
  convertedView,
  'A cópia antiga de dia inteiro não pode substituir a versão 07h–11h retornada pela consulta por intervalo.'
);
const reconciledViews = context.removeSupersededCalendarEventViews([
  staleTodayView,
  convertedView,
]);
assert.equal(reconciledViews.length, 1);
assert.equal(reconciledViews[0], convertedView);
assert.equal(reconciledViews[0].end.getTime(), at(20, 11).getTime());

const convertedGuide = context.todayEventArrivalGuides(
  [event(
    'Bimestral de Português',
    reconciledViews[0].start,
    reconciledViews[0].end,
    1,
    { isAllDay: reconciledViews[0].isAllDay }
  )],
  at(20, 6, 24)
);
assert.equal(
  convertedGuide.length,
  1,
  'A ocorrência convertida deve ter novamente a linha de chegada.'
);
assert.equal(convertedGuide[0].label, '40m');

const zeroDurationAllDay = context.calendarEventDisplayInterval(
  { isAllDay: true, startDate: at(20, 0), endDate: at(20, 0) },
  true,
  at(21, 0)
);
assert.equal(zeroDurationAllDay.isAllDay, true);
assert.equal(
  zeroDurationAllDay.end.getTime(),
  at(21, 0).getTime(),
  'Fim bruto zero continua sendo estendido para eventos de dia inteiro.'
);
assert.equal(
  context.calendarEventIsAllDay({
    isAllDay: true,
    startDate: at(20, 0),
    endDate: at(21, 0),
  }),
  true,
  'Eventos de dia inteiro com duração de 24 horas preservam a classificação.'
);

assert.equal(
  context.formatEventArrivalHours(at(20, 18, 30), now),
  '30m',
  'Meia hora deve ser exibida em minutos inteiros.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19), now),
  '1h',
  'Hora inteira deve omitir os minutos zerados.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 5), now),
  '',
  'A contagem regressiva deve sumir antes dos 30 minutos.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19, 30), now),
  '1h e 30m',
  'Horas e meia devem usar o mesmo formato da cápsula.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 20, 30), now),
  '2h e 30m',
  'A linha tracejada deve usar o mesmo rótulo de duas horas e meia.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 59), now),
  '50m',
  'A partir de 30 minutos, abaixo de uma hora deve aparecer somente a contagem em minutos.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 29), now),
  '',
  'A contagem não deve aparecer com 29 minutos restantes.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 30), now),
  '30m',
  'A contagem deve aparecer exatamente quando faltam 30 minutos.'
);

const next = event('Próximo', at(20, 18, 30), at(20, 19, 30), 2);
const later = event('Depois', at(20, 20), at(20, 21), 3);
const selected = context.todayEventArrivalGuide([later, next]);
assert.equal(selected.event, next, 'A guia deve escolher o próximo evento.');
assert.equal(selected.row, 2, 'A guia deve acompanhar a linha do evento.');
assert.equal(selected.label, '30m');
assert.equal(selected.end, next.start);

const todayGuides = context.todayEventArrivalGuides([next, later]);
assert.equal(
  todayGuides.length,
  2,
  'Cada evento futuro de hoje deve receber sua própria guia.'
);
assert.deepEqual(
  todayGuides.map(guide => guide.event.title),
  ['Próximo', 'Depois']
);
assert.deepEqual(
  todayGuides.map(guide => guide.label),
  ['30m', '2h'],
  'Cada guia deve usar o formato da cápsula.'
);
const tomorrowLayout =
  context.eventArrivalGuideLayout('tomorrow', 500, 40);
assert.equal(tomorrowLayout.labelX, 508);
assert.equal(
  tomorrowLayout.lineStartX,
  554,
  'A guia de amanhã deve reservar a largura completa do rótulo antes do tracejado.'
);
const todayLayout = context.eventArrivalGuideLayout('today', 0, 40);
assert.equal(todayLayout.labelX, 8);
assert.equal(
  todayLayout.lineStartX,
  54,
  'A guia de hoje deve manter a margem da borda esquerda.'
);
assert.equal(
  context.eventArrivalGuideLayout('today', 0, 80).lineStartX,
  94,
  'A coluna reservada deve acompanhar o rótulo mais largo e manter uma origem comum.'
);
assert.equal(
  context.eventArrivalGuideLayout('tomorrow', 500, 80).lineStartX,
  594,
  'Todas as guias de amanhã devem começar depois da mesma largura reservada.'
);

const tomorrowGuides = context.tomorrowEventArrivalGuides([
  event('Amanhã cedo', at(21, 10), at(21, 11), 3),
  event('Amanhã tarde', at(21, 13), at(21, 14), 4),
]);
assert.equal(
  tomorrowGuides.length,
  2,
  'Eventos de amanhã também devem receber guias individuais.'
);
assert.deepEqual(
  tomorrowGuides.map(guide => guide.label),
  ['10h', '13h'],
  'As guias de amanhã devem usar o formato da cápsula.'
);

const tomorrowAllDay = event(
  'Feriado futuro',
  at(21, 0),
  at(22, 0),
  1,
  { isAllDay: true }
);
const tomorrowAllDayGuides =
  context.tomorrowEventArrivalGuides([tomorrowAllDay]);
assert.equal(
  tomorrowAllDayGuides.length,
  0,
  'Evento de dia inteiro não deve gerar linha tracejada.'
);

const endedEvent = event('Encerrado', at(20, 16), at(20, 17), 0);
const birthday = event(
  '🎂 Ana',
  at(20, 0),
  at(21, 0),
  2,
  { isAllDay: true, isBirthday: true }
);
assert.deepEqual(
  Array.from(context.todayEventArrivalGuides([endedEvent, birthday]), guide => guide.event.title),
  [],
  'Sem evento futuro com horário definido, não deve existir tracejado.'
);

const tomorrowOnly = context.todayEventArrivalGuide([
  event('Amanhã', at(21, 10), at(21, 11), 3),
]);
assert.equal(tomorrowOnly, null, 'Evento de amanhã não cria tracejado no dia de hoje.');
assert.equal(
  context.tomorrowEventArrivalGuides([
    event('Amanhã', at(21, 10), at(21, 11), 3),
  ]).length,
  1,
  'O mesmo evento deve criar tracejado no dia em que ocorre.'
);

const occupied = Array.from(
  { length: 5 },
  (_, row) => event(`Ocupado ${row}`, at(20, 10), at(20, 11), row)
);
assert.equal(
  context.todayEventArrivalGuide(occupied),
  null,
  'Sem linha livre, a guia não deve sobrepor um chart.'
);

const imminent = event('Em breve', at(20, 18, 29), at(20, 19, 29), 1);
assert.equal(
  context.todayEventArrivalGuides([imminent]).length,
  0,
  'Evento a menos de 30 minutos não mantém rótulo nem tracejado.'
);
const startingInThirty = event(
  'Em meia hora',
  at(20, 18, 30),
  at(20, 19, 30),
  1
);
assert.equal(
  context.todayEventArrivalGuides([startingInThirty])[0].label,
  '30m',
  'Evento a exatamente 30 minutos ainda recebe rótulo e tracejado.'
);

const startingSoon = context.prepareTimelineItems([imminent], now)[0];
const exactlyThirtyMinutes = context.prepareTimelineItems(
  [startingInThirty],
  now
)[0];
const inProgress = context.prepareTimelineItems(
  [event('Agora', at(20, 17), at(20, 19), 1)],
  now
)[0];
assert.equal(startingSoon.isStartingSoon, true);
assert.equal(exactlyThirtyMinutes.isStartingSoon, false);
assert.equal(inProgress.isCurrentEvent, true);
assert.equal(inProgress.isStartingSoon, false);

const barStart = source.indexOf('function drawTimelineBar(');
const barSource = source.slice(
  barStart,
  source.indexOf('function reminderPriorityPrefix(', barStart)
);
assert(barSource.includes('item.kind === "event" && item.isCurrentEvent'));
assert(barSource.includes('new Color("#FFFFFF", 1.0)'));
const itemStart = source.indexOf('function drawTimelineItem(');
const itemSource = source.slice(
  itemStart,
  source.indexOf('function drawOutlinedTimelineText(', itemStart)
);
assert(itemSource.includes('if (item.isStartingSoon)'));
assert(itemSource.includes('"#FF1F1F"'));
assert(itemSource.includes('"#FFFFFF"'));
assert(itemSource.includes('"#000000"'));

console.log('OK: linhas tracejadas aparecem somente para eventos futuros com horário no dia correspondente.');

assert.equal(context.tomorrowEventArrivalGuides([]).length, 0);
const lateNow = at(20, 23, 45);
assert.equal(context.tomorrowEventArrivalGuides([
  event('Amanhã', at(21, 10), at(21, 11), 0)
], lateNow)[0].label, '10h');
assert.equal(context.formatEventArrivalHours(at(21, 0), at(21, 0)), '');
assert.equal(context.eventArrivalGuideLayout('tomorrow', 250, 80).labelX, 258);
assert.equal(context.eventArrivalGuideLayout('tomorrow', 250, 80).lineStartX, 344);

const panel = source.slice(
  source.indexOf('async function renderTimelinePanel('),
  source.indexOf('function timelineItemsStartingToday(')
);
const itemLayer = source.slice(
  source.indexOf('function drawTimelineItemLayer('),
  source.indexOf('function diagonalWeekdayLabelColor(')
);
assert.equal(
  itemLayer.match(/drawEventArrivalGuides\(/g)?.length,
  1,
  'Rótulos e tracejados devem ser desenhados uma única vez, atrás dos charts.'
);
assert(
  itemLayer.indexOf('drawEventArrivalGuides(') <
    itemLayer.indexOf('rowItems.forEach('),
  'O chart e o título precisam cobrir a guia de chegada.'
);
const markerSource = source.slice(
  source.indexOf('function drawReminderMarker('),
  source.indexOf('function drawTimelineBar(', source.indexOf('function drawReminderMarker('))
);
assert(markerSource.includes('ctx.setStrokeColor(Color.white())'));
assert(markerSource.includes('ctx.strokeEllipse('));
assert(!markerSource.includes('fillEllipse('), 'O aro dos lembretes deve ser vazado.');
assert(
  panel.lastIndexOf('drawEventStartLines(ctx, timelineItemsStartingToday(items))') >
    panel.lastIndexOf('drawTimelineItemLayer('),
  'A linha vertical dos eventos deve ser recomposta acima dos charts.'
);
assert(
  panel.indexOf('drawBottomHourLegend(baseCtx)') >= 0 &&
    panel.indexOf('drawBottomHourLegend(baseCtx)') <
      panel.indexOf('const baseImage = baseCtx.getImage()'),
  'A legenda inferior deve entrar na imagem-base para receber o blur de amanhã.'
);
assert(
  !panel.includes('drawBottomHourLegend(ctx)'),
  'A legenda não deve ser redesenhada nítida sobre a região desfocada.'
);
