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
  (_, index) => timedEvent(index + 1, 8)
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
  ...Array.from({ length: 4 }, (_, index) => timedEvent(index + 1, 8)),
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
  [shortPortuguese, dentist], lateWindow.windowStart, 5
);
assert.notEqual(
  lateLayout[0].gridRow,
  lateLayout[1].gridRow,
  'Pouco antes das 11h, Dentista deve descer se o texto Português impedir.'
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
