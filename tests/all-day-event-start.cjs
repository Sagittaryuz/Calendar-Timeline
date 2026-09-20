// Verifica o início visual dos eventos de dia inteiro sem acessar o EventKit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
const start = source.indexOf('function timelineItemDisplayStart(');
const end = source.indexOf('function drawTimelineItem(', start);
assert(start >= 0 && end > start, 'Localizar o início visual do evento.');

const context = {
  Date,
  ALL_DAY_EVENT_DISPLAY_START_HOUR: 6,
  startOfDay: date =>
    new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )),
  dateAtHour: (date, hour) =>
    new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour
    )),
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const midnight = new Date('2026-09-20T00:00:00Z');
const allDayEvent = {
  kind: 'event',
  isAllDay: true,
  start: midnight,
};
const displayStart = context.timelineItemDisplayStart(allDayEvent);
assert.equal(
  displayStart.toISOString(),
  '2026-09-20T06:00:00.000Z',
  'Evento de dia inteiro deve começar visualmente às 06:00.'
);
assert.equal(
  allDayEvent.start.toISOString(),
  '2026-09-20T00:00:00.000Z',
  'O início bruto não deve ser alterado.'
);

const timedStart = new Date('2026-09-20T08:30:00Z');
const timedEvent = {
  kind: 'event',
  isAllDay: false,
  start: timedStart,
};
assert.equal(
  context.timelineItemDisplayStart(timedEvent),
  timedStart,
  'Evento com horário deve manter o início original.'
);

console.log('OK: eventos de dia inteiro começam visualmente às 06:00 sem alterar seus dados.');
