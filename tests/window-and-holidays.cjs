// Verifica datas do cabeçalho e a preservação de feriados em falha de rede.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

const context = {
  Date,
  SETTINGS: { automaticHolidays: true },
  TITLE_CARD_COUNT: 4,
  windowStart: new Date(2026, 11, 30, 10),
  windowEnd: new Date(2026, 11, 31, 10),
  startOfDay: date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  addDays: (date, days) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
  resolveBrazilianRegion: async () => null,
  brazilianNationalHolidayDates: year => [`${year}-01-01`],
};
vm.createContext(context);

const holidaysStart = source.indexOf('async function loadAutomaticHolidays(');
const holidaysEnd = source.indexOf('async function resolveBrazilianRegion(', holidaysStart);
assert(holidaysStart >= 0 && holidaysEnd > holidaysStart, 'Localizar cálculo de feriados.');
vm.runInContext(source.slice(holidaysStart, holidaysEnd), context);

(async () => {
  const dates = await context.loadAutomaticHolidays({});
  assert(dates.has('2026-01-01'));
  assert(dates.has('2027-01-01'));
  console.log('OK: feriados cobrem o fim dos quatro cartões, inclusive a virada do ano.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
