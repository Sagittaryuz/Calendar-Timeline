// Verifica a seleção da guia de chegada sem executar o desenho nativo do Scriptable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
assert.match(source, /const EVENT_ARRIVAL_GUIDE_LEFT_MARGIN = 15;/);
assert.match(source, /const EVENT_ARRIVAL_GUIDE_LABEL_GAP = 2;/);
const start = source.indexOf('function formatEventArrivalHours(');
const end = source.indexOf('function drawEventStartLines(', start);
assert(start >= 0 && end > start, 'Localizar a guia de chegada.');

const now = new Date('2026-09-20T18:00:00Z');
const context = {
  Date,
  now,
  windowStart: now,
  SETTINGS: {
    maxItems: 5,
    minimumChartWidth: 34,
    compactMinimumChartWidth: 18,
  },
  EVENT_ARRIVAL_GUIDE_LEFT_MARGIN: 15,
  EVENT_ARRIVAL_GUIDE_SEPARATOR_WIDTH: 45,
  EVENT_ARRIVAL_GUIDE_LABEL_GAP: 2,
  EVENT_ARRIVAL_GUIDE_LABEL_FONT_SIZE: 21,
  EVENT_ARRIVAL_GUIDE_LINE_WIDTH: 2,
  EVENT_ARRIVAL_GUIDE_DASH_WIDTH: 8,
  EVENT_ARRIVAL_GUIDE_GAP_WIDTH: 7,
  EVENT_ARRIVAL_GUIDE_COLOR: '#FF9F0A',
  EVENT_STARTING_SOON_WINDOW_MS: 30 * 60 * 1000,
  ALL_DAY_REMINDER_DISPLAY_START_HOUR: 6,
  timelineWidth: () => 1024,
  scaleFontSize: value => value,
  scaleVertical: value => value,
  estimatedTextWidth: (text, fontSize) => text.length * fontSize * 0.62,
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
const collisionStart = source.indexOf('function timelineItemCollisionStart(');
vm.runInContext(source.slice(
  collisionStart,
  source.indexOf('function itemsOverlap(', collisionStart)
), context);
const displayStart = source.indexOf('function timelineItemDisplayStart(');
vm.runInContext(source.slice(
  displayStart,
  source.indexOf('function drawTimelineItem(', displayStart)
), context);
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
assert.equal(editedEventGuide[0].label, '5,9h');

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
  '10m',
  'O formato não oculta a contagem: a geometria decide se ela cabe.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19, 30), now),
  '1,5h',
  'Horas e meia usam o formato decimal compacto.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 20, 30), now),
  '2,5h',
  'Duas horas e meia devem aparecer como 2,5h.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 59), now),
  '50m',
  'A partir de 30 minutos, abaixo de uma hora deve aparecer somente a contagem em minutos.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 29), now),
  '30m',
  'Abaixo de uma hora permanece o formato em minutos.'
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
  'Cada guia deve usar o formato compacto.'
);
const timedReminder = {
  kind: 'reminder',
  title: 'Consulta marcada',
  start: at(20, 19, 40),
  end: at(21, 0),
  gridRow: 4,
  isAllDay: false,
  sourceIsAllDay: false,
};
const allDayReminder = {
  ...timedReminder,
  title: 'Sem horário',
  start: at(20, 0),
  sourceIsAllDay: true,
};
const timedReminderGuides = context.todayEventArrivalGuides(
  [next, timedReminder, allDayReminder],
  now
);
assert.deepEqual(
  Array.from(timedReminderGuides, guide => guide.label),
  ['30m', '1,7h'],
  'Lembrete com horário deve usar a mesma contagem do evento; o de dia inteiro não.'
);
assert.equal(timedReminderGuides[1].row, 4);
assert.equal(timedReminderGuides[1].event, timedReminder);
assert.equal(
  context.eventArrivalGuideLabelWidth('5h e 50m'),
  Math.ceil(context.estimatedTextWidth('5h e 50m', 21)),
  'A largura reservada deve terminar junto ao texto para aplicar a folga de 2 unidades.'
);
const labelSource = source.slice(
  source.indexOf('function drawEventArrivalGuideLabel('),
  source.indexOf('function drawEventArrivalGuides(')
);
assert(labelSource.includes('ctx.drawText(label, new Point('));
assert(!labelSource.includes('ctx.drawTextInRect('),
  'O texto da contagem não deve ser cortado pelo próprio retângulo.');
const tomorrowLayout =
  context.eventArrivalGuideLayout('tomorrow', 500, 40);
assert.equal(tomorrowLayout.labelX, 515);
assert.equal(
  tomorrowLayout.lineStartX,
  557,
  'A guia de amanhã deve reservar a largura completa do rótulo antes do tracejado.'
);
const todayLayout = context.eventArrivalGuideLayout('today', 0, 40);
assert.equal(todayLayout.labelX, 15);
assert.equal(
  todayLayout.lineStartX,
  57,
  'A guia de hoje deve manter a margem da borda esquerda.'
);
assert.equal(
  context.eventArrivalGuideLayout('today', 0, 80).lineStartX,
  97,
  'A coluna reservada deve acompanhar o rótulo mais largo e manter uma origem comum.'
);
assert.equal(
  context.eventArrivalGuideLayout('tomorrow', 500, 80).lineStartX,
  597,
  'Todas as guias de amanhã devem começar depois da mesma largura reservada.'
);
assert.equal(
  context.eventArrivalGuideTrackCenterY(100, 90, 0, 2),
  130,
  'A primeira guia ocupa o terço superior (2/3 medidos a partir da base).'
);
assert.equal(
  context.eventArrivalGuideTrackCenterY(100, 90, 1, 2),
  160,
  'A segunda guia ocupa o terço inferior (1/3 medido a partir da base).'
);

class MockPoint {
  constructor(x, y) { Object.assign(this, { x, y }); }
}
class MockRect {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}
class MockColor {
  constructor(hex, alpha) { Object.assign(this, { hex, alpha }); }
}
context.Point = MockPoint;
context.Rect = MockRect;
context.Color = MockColor;
context.Font = { blackRoundedSystemFont: size => ({ size }) };
context.isCompactMode = () => false;
context.timelineChartTop = () => 100;
context.timelineRowHeight = () => 90;
context.timeToX = date =>
  (date.getTime() - context.windowStart.getTime()) /
  (24 * 60 * 60 * 1000) * context.timelineWidth();
context.timelineItemBarSegmentsForDisplay = item => {
  const x = context.timeToX(context.arrivalGuideStart(item)) - 1;
  return [{ x, width: Math.max(34, context.timeToX(item.end) - 1 - x) }];
};
const drawnArrivalLabels = [];
const drawnArrivalDashes = [];
const mockDrawContext = {
  setFillColor() {},
  setTextAlignedLeft() {},
  setFont() {},
  setTextColor() {},
  drawText(text, point) { drawnArrivalLabels.push({ text, ...point }); },
  fillRect(rect) { drawnArrivalDashes.push(rect); },
};
context.drawEventArrivalGuides(
  mockDrawContext,
  [
    event('Segundo', at(20, 23), at(21, 0), 2),
    event('Primeiro', at(20, 22), at(20, 23), 2),
  ],
  'today'
);
assert.deepEqual(
  drawnArrivalLabels.map(({ text }) => text),
  ['4h', '5h'],
  'Os rótulos da mesma faixa seguem a ordem dos eventos.'
);
assert.equal(drawnArrivalLabels[0].x, 15);
assert.ok(
  drawnArrivalLabels[1].x > drawnArrivalLabels[0].x,
  'Os números em uma faixa compartilhada ficam em colunas distintas.'
);
assert.ok(
  drawnArrivalLabels[0].y === drawnArrivalLabels[1].y,
  'Todos os números ficam no mesmo alinhamento vertical.'
);
assert.ok(
  drawnArrivalDashes.some(rect => rect.width === 8 && rect.x === 44),
  'O tracejado começa 2 px depois do primeiro número.'
);
assert.ok(
  drawnArrivalDashes.some(rect => rect.x >= 133),
  'As extensões dos tracejados começam após a coluna de números e o vão de 2 px.'
);
assert.deepEqual(
  [...new Set(drawnArrivalDashes.map(rect => rect.y))],
  [309, 339],
  'Os tracejados de eventos na mesma faixa nunca se sobrepõem.'
);

assert.equal(drawnArrivalLabels[1].x, 104,
  'Após o texto há 2 px, 45 px de tracejado e novamente 15 px de margem.');
assert.deepEqual(
  drawnArrivalDashes.filter(rect => rect.y === 309 && rect.x < 104)
    .map(rect => [rect.x, rect.width]),
  [[44, 8], [59, 8], [74, 8]],
  'O separador ocupa 45 px; os 15 px seguintes ficam livres antes do número.'
);
assert.equal(context.formatEventArrivalHours(at(20, 19, 10), now), '1,2h');
assert.equal(context.formatDayEndCountdown(at(20, 20, 30), now), '2h e 30m');

function drawLabelsFor(items, day = 'today') {
  drawnArrivalLabels.length = 0;
  drawnArrivalDashes.length = 0;
  context.drawEventArrivalGuides(mockDrawContext, items, day);
  return drawnArrivalLabels.map(({ text }) => text);
}
assert.deepEqual(drawLabelsFor([
  event('Distante', at(20, 23), at(21, 0), 2),
  event('Próximo', at(20, 21), at(20, 22), 2),
]), ['3h'], 'Quando o par não cabe, fica somente a contagem mais próxima.');
assert.deepEqual(drawLabelsFor([
  event('Uma hora', at(20, 19), at(20, 20), 0),
]), [], 'Uma contagem sozinha também some quando o chart comprime o espaço.');
assert.deepEqual(drawLabelsFor([
  event('Duas horas', at(20, 20), at(20, 21), 0),
]), ['2h'], 'A contagem sozinha aparece quando cabe antes do chart.');
assert.deepEqual(drawLabelsFor([
  event('Terceiro', at(20, 23), at(21, 0), 1),
  event('Primeiro', at(20, 22), at(20, 23), 1),
  event('Segundo', at(20, 22, 30), at(20, 23), 1),
]), ['4h', '4,5h'], 'Com vários eventos, mantém o maior prefixo cronológico que cabe.');
assert.deepEqual([...new Set(drawnArrivalDashes.map(rect => rect.y))],
  [211.5, 234, 256.5], 'Os três tracejados preservam a distribuição N+1.');
assert.deepEqual(drawLabelsFor([
  event('Amanhã', at(21, 1), at(21, 2), 0),
], 'tomorrow'), [], 'A margem de amanhã também entra na decisão de caber.');
assert.deepEqual(drawLabelsFor([
  event('Em andamento', at(20, 17), at(20, 20), 0),
  event('Depois', at(20, 22), at(20, 23), 0),
]), [], 'Um chart em andamento na mesma faixa também impede sobrepor o número.');
const normalTimeToX = context.timeToX;
context.timeToX = date => normalTimeToX(date) * 2;
assert.deepEqual(drawLabelsFor([
  event('Uma hora em janela ampliada', at(20, 19), at(20, 20), 0),
]), ['1h'], 'A regra é geométrica: uma hora pode aparecer quando há espaço.');
context.timeToX = normalTimeToX;

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
const tomorrowNoTimeReminder = {
  kind: 'reminder',
  title: 'Pegar suporte',
  start: new Date(2026, 8, 21, 0),
  end: new Date(2026, 8, 22, 0),
  gridRow: 1,
  isAllDay: false,
  sourceIsAllDay: true,
};
const previousWindowStart = context.windowStart;
const previousStartOfDay = context.startOfDay;
context.windowStart = new Date(2026, 8, 20, 0);
context.startOfDay = date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const tomorrowReminderGuide = context.tomorrowEventArrivalGuides(
  [tomorrowNoTimeReminder]
)[0];
assert.equal(tomorrowReminderGuide.label, '6h');
assert.equal(tomorrowReminderGuide.end.getTime(), new Date(2026, 8, 21, 6).getTime());
assert.equal(tomorrowReminderGuide.event, tomorrowNoTimeReminder);
assert.equal(tomorrowNoTimeReminder.start.getTime(), new Date(2026, 8, 21, 0).getTime(),
  'A guia visual não pode modificar a data original do lembrete.');
const todayNoTimeReminder = {
  ...tomorrowNoTimeReminder,
  start: new Date(2026, 8, 20, 0),
  end: new Date(2026, 8, 21, 0),
};
assert.equal(
  context.todayEventArrivalGuides([todayNoTimeReminder], new Date(2026, 8, 20, 1))[0].label,
  '5h'
);
assert.equal(
  context.todayEventArrivalGuides([todayNoTimeReminder], new Date(2026, 8, 20, 6)).length,
  0,
  'A contagem desaparece quando o chart do lembrete já começou.'
);
context.windowStart = previousWindowStart;
context.startOfDay = previousStartOfDay;

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
  1,
  'Evento iminente mantém a guia; o desenho só mostra o número se couber.'
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
assert.equal(context.eventArrivalGuideLayout('tomorrow', 250, 80).labelX, 265);
assert.equal(context.eventArrivalGuideLayout('tomorrow', 250, 80).lineStartX, 347);

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
    itemLayer.indexOf('drawTimelineItem(ctx,'),
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
