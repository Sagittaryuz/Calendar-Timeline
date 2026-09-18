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

  let requestMode = 'partial';
  const storedCache = JSON.stringify({
    updatedAt: 0,
    expiresAt: 0,
    dates: ['2026-06-01'],
  });
  const regionalFileManager = {
    documentsDirectory: () => '/documents',
    joinPath: (...parts) => parts.join('/'),
    fileExists: () => true,
    readString: () => storedCache,
    writeString: () => {},
  };
  const regionalContext = {
    Date,
    SETTINGS: { holidayCacheDays: 30 },
    FileManager: { local: () => regionalFileManager },
    Request: class {
      constructor(url) {
        this.url = url;
      }

      async loadJSON() {
        if (requestMode === 'all-fail' || this.url.includes('/estadual/')) {
          throw new Error('fonte indisponível');
        }
        return [{ codigo_ibge: 5211909, data: '2026-06-02' }];
      }
    },
    holidayDateKey: value => value,
  };
  vm.createContext(regionalContext);
  const regionalStart = source.indexOf('async function loadRegionalHolidayDates(');
  const regionalEnd = source.indexOf('function brazilianNationalHolidayDates(', regionalStart);
  assert(regionalStart >= 0 && regionalEnd > regionalStart, 'Localizar cache regional.');
  vm.runInContext(source.slice(regionalStart, regionalEnd), regionalContext);

  const partial = await regionalContext.loadRegionalHolidayDates(2026, {
    uf: 'GO',
    ibgeCode: 5211909,
  });
  assert(partial.has('2026-06-01'));
  assert(partial.has('2026-06-02'));

  requestMode = 'all-fail';
  const offline = await regionalContext.loadRegionalHolidayDates(2026, {
    uf: 'GO',
    ibgeCode: 5211909,
  });
  assert.deepEqual([...offline], ['2026-06-01']);

  console.log('OK: virada do ano e cache regional preservado em sucesso parcial/offline.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
