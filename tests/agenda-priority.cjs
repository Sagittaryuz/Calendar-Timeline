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

function select(items) {
  return makeContext().chooseItems(
    items,
    new Date(2026, 8, 18, 8),
    5
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

const allDayBeforeBirthday = select([
  allDayEvent(),
  birthday(),
]);
assert.equal(
  allDayBeforeBirthday.find(item => item.title === 'Evento de dia inteiro').gridRow,
  3,
  'Evento de dia inteiro fica acima do aniversário.'
);
assert.equal(
  allDayBeforeBirthday.find(item => item.isBirthdayGroup).gridRow,
  4,
  'Aniversário fica abaixo do evento de dia inteiro.'
);

const allDayBirthdayHoliday = select([
  allDayEvent(),
  birthday(),
  allDayEvent('Feriado', 0, true),
]);
assert.equal(
  allDayBirthdayHoliday.find(item => item.title === 'Evento de dia inteiro').gridRow,
  2,
  'Evento de dia inteiro permanece acima do aniversário e do feriado.'
);
assert.equal(
  allDayBirthdayHoliday.find(item => item.isBirthdayGroup).gridRow,
  3,
  'Aniversário fica abaixo do evento de dia inteiro.'
);
assert.equal(
  allDayBirthdayHoliday.find(item => item.title === 'Feriado').gridRow,
  4,
  'Aniversário fica acima do feriado.'
);

const birthdayTakesPriorityOverHoliday = select([
  ...Array.from({ length: 4 }, (_, index) => timedEvent(index + 1, index * 2)),
  birthday(),
  allDayEvent('Feriado', 0, true),
]);
assert.equal(
  birthdayTakesPriorityOverHoliday.filter(item => item.isBirthdayGroup).length,
  1,
  'Aniversário usa a última linha livre antes do feriado.'
);
assert.equal(
  birthdayTakesPriorityOverHoliday.filter(item => item.title === 'Feriado').length,
  0,
  'Feriado não toma a única linha disponível do aniversário.'
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
  remindersTogether.find(item => item.title === 'Lembrete de hoje').gridRow <
    remindersTogether.find(item => item.title === 'Lembrete atrasado').gridRow,
  'Lembretes vencendo hoje devem ocupar as linhas antes dos atrasados.'
);

const crowdedReminderDay = currentTimeContext.chooseItems(
  [
    timedEvent(1, 8),
    timedEvent(2, 10),
    timedEvent(3, 12),
    timedEvent(4, 14),
    reminder('Lembrete de hoje', at(0), at(0, 1)),
    reminder('Lembrete atrasado', at(0), at(0, 1), {
      isOverdue: true,
    }),
  ],
  currentTime,
  5
);
assert.equal(
  crowdedReminderDay.filter(item => item.isOverflow).length,
  1,
  'Uma linha ocupada por lembretes deve poder virar o indicador de excedentes.'
);
assert.equal(
  crowdedReminderDay.find(item => item.isOverflow).title,
  '+2',
  'O indicador deve contar os dois lembretes ocultos, inclusive o atrasado.'
);
assert.equal(
  crowdedReminderDay.filter(item => item.kind === 'event').length,
  4,
  'O indicador de excedentes não pode remover eventos.'
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
