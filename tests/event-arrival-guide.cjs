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
  EVENT_ARRIVAL_GUIDE_LEFT_MARGIN: 5,
  EVENT_ARRIVAL_GUIDE_LABEL_GAP: 6,
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
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

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

assert.equal(
  context.formatEventArrivalHours(at(20, 18, 30), now),
  '30 m',
  'Meia hora deve ser exibida em minutos inteiros.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19), now),
  '1 h',
  'Hora inteira não deve receber zero decimal.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 18, 5), now),
  '10 m',
  'Minutos devem ser arredondados em blocos de dez.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19, 30), now),
  '1,5 h',
  'Horas e meia devem usar vírgula e unidade separada.'
);

const next = event('Próximo', at(20, 18, 30), at(20, 19, 30), 2);
const later = event('Depois', at(20, 20), at(20, 21), 3);
const selected = context.todayEventArrivalGuide([later, next]);
assert.equal(selected.event, next, 'A guia deve escolher o próximo evento.');
assert.equal(selected.row, 2, 'A guia deve acompanhar a linha do evento.');
assert.equal(selected.label, '30 m');
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
  ['30 m', '2 h'],
  'Cada guia deve mostrar a unidade correspondente.'
);
const tomorrowLayout =
  context.eventArrivalGuideLayout('tomorrow', 500, 40);
assert.equal(tomorrowLayout.labelX, 505);
assert.equal(
  tomorrowLayout.lineStartX,
  500,
  'A guia de amanhã deve começar na mudança de dia e deixar o rótulo à esquerda.'
);
const todayLayout = context.eventArrivalGuideLayout('today', 0, 40);
assert.equal(todayLayout.labelX, 5);
assert.equal(
  todayLayout.lineStartX,
  51,
  'A guia de hoje deve manter a margem da borda esquerda.'
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
  ['10 h', '13 h'],
  'As guias de amanhã devem manter o sufixo h.'
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

console.log('OK: linhas tracejadas aparecem somente para eventos futuros com horário no dia correspondente.');

assert.equal(context.tomorrowEventArrivalGuides([]).length, 0);
const lateNow = at(20, 23, 45);
assert.equal(context.tomorrowEventArrivalGuides([
  event('Amanhã', at(21, 10), at(21, 11), 0)
], lateNow)[0].label, '10 h');
assert.equal(context.formatEventArrivalHours(at(21, 0), at(21, 0)), '0 m');
assert.equal(context.eventArrivalGuideLayout('tomorrow', 250, 80).labelX, 255);
