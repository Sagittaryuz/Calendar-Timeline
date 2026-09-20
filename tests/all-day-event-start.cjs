// Verifica o início visual dos lembretes de dia inteiro sem acessar o EventKit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
const start = source.indexOf('function timelineItemCollisionStart(');
const end = source.indexOf('function drawTimelineItem(', start);
assert(start >= 0 && end > start, 'Localizar o início visual do item.');

const context = {
  Date,
  ALL_DAY_REMINDER_DISPLAY_START_HOUR: 6,
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

const midnight = new Date(2026, 8, 20, 0, 0, 0, 0);
const allDayEvent = {
  kind: 'event',
  isAllDay: true,
  start: midnight,
};
const eventDisplayStart = context.timelineItemDisplayStart(allDayEvent);
assert.equal(
  `${eventDisplayStart.getFullYear()}-${eventDisplayStart.getMonth()}-${eventDisplayStart.getDate()}-${eventDisplayStart.getHours()}`,
  '2026-8-20-0',
  'Evento de dia inteiro deve continuar começando à meia-noite.'
);
assert.equal(
  `${allDayEvent.start.getFullYear()}-${allDayEvent.start.getMonth()}-${allDayEvent.start.getDate()}-${allDayEvent.start.getHours()}`,
  '2026-8-20-0',
  'O início bruto não deve ser alterado.'
);

const allDayReminder = {
  kind: 'reminder',
  sourceIsAllDay: true,
  start: midnight,
};
const reminderDisplayStart =
  context.timelineItemDisplayStart(allDayReminder);
assert.equal(
  `${reminderDisplayStart.getFullYear()}-${reminderDisplayStart.getMonth()}-${reminderDisplayStart.getDate()}-${reminderDisplayStart.getHours()}`,
  '2026-8-20-6',
  'Lembrete de dia inteiro deve começar visualmente às 06:00.'
);

const timedStart = new Date(2026, 8, 20, 8, 30);
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

console.log('OK: eventos de dia inteiro começam à meia-noite; lembretes sem horário começam às 06:00.');
