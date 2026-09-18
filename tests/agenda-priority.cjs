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
    },
    TIMELINE_ROW_SHARE_GAP_MS: 6 * 60 * 60 * 1000,
    windowStart: new Date(2026, 8, 18, 0),
    windowEnd: new Date(2026, 8, 19, 0),
    normalizeSearchText: value => String(value).toLocaleLowerCase('pt-BR'),
    startOfDay: date =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    addDays: (date, days) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
    dateKey: date =>
      `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
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

function select(items) {
  return makeContext().chooseItems(
    items,
    new Date(2026, 8, 18, 8),
    5
  );
}

const fiveEvents = Array.from(
  { length: 5 },
  (_, index) => timedEvent(index + 1, index * 2)
);
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
  'Aniversário deve ficar na linha inferior quando ela estiver livre.'
);

const saturated = select([
  ...Array.from({ length: 6 }, (_, index) => timedEvent(index + 1, 8)),
]);
for (const marker of saturated.filter(item => item.isOverflow)) {
  for (const item of saturated.filter(
    candidate => !candidate.isOverflow && candidate.gridRow === marker.gridRow
  )) {
    assert(!contextItemsOverlap(marker, item), 'Overflow não pode cobrir chart.');
  }
}

function contextItemsOverlap(first, second) {
  return first.start < second.end && second.start < first.end;
}

console.log('OK: eventos prioritários preservados; aniversários só usam linha livre; overflow sem colisão.');
