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
  '0,5h',
  'Meia hora deve usar vírgula decimal.'
);
assert.equal(
  context.formatEventArrivalHours(at(20, 19), now),
  '1h',
  'Hora inteira não deve receber zero decimal.'
);

const next = event('Próximo', at(20, 18, 30), at(20, 19, 30), 2);
const later = event('Depois', at(20, 20), at(20, 21), 3);
const selected = context.todayEventArrivalGuide([later, next]);
assert.equal(selected.event, next, 'A guia deve escolher o próximo evento.');
assert.equal(selected.row, 2, 'A guia deve acompanhar a linha do evento.');
assert.equal(selected.label, '0,5h');
assert.equal(selected.end, next.start);

const endedEvent = event('Encerrado', at(20, 16), at(20, 17), 0);
const birthday = event(
  '🎂 Ana',
  at(20, 0),
  at(21, 0),
  2,
  { isAllDay: true, isBirthday: true }
);
const fallback = context.todayEventArrivalGuide([endedEvent, birthday]);
assert.equal(fallback.event, null, 'Sem evento futuro, deve usar fallback.');
assert.equal(fallback.row, 1, 'Fallback deve ocupar a primeira linha livre.');
assert.equal(fallback.label, '', 'Fallback não deve inventar contagem.');
assert.equal(
  fallback.end.getTime(),
  at(21, 0).getTime(),
  'Fallback deve seguir até a meia-noite.'
);

const tomorrowOnly = context.todayEventArrivalGuide([
  event('Amanhã', at(21, 10), at(21, 11), 3),
]);
assert.equal(tomorrowOnly.row, 0, 'Evento de amanhã não ocupa a linha de hoje.');
assert.equal(tomorrowOnly.end.getTime(), at(21, 0).getTime());

const occupied = Array.from(
  { length: 5 },
  (_, row) => event(`Ocupado ${row}`, at(20, 10), at(20, 11), row)
);
assert.equal(
  context.todayEventArrivalGuide(occupied),
  null,
  'Sem linha livre, a guia não deve sobrepor um chart.'
);

console.log('OK: guia de chegada escolhe o próximo evento e usa a primeira linha livre no fim do dia.');
