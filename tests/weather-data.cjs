// Testa cobertura, normalização, resumos diários e horizonte do clima.
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
  WEATHER_HOUR_MS: 60 * 60 * 1000,
  WEATHER_EDGE_TOLERANCE_MS: 90 * 60 * 1000,
  WEATHER_MAX_INTERPOLATION_GAP_MS: 2 * 60 * 60 * 1000,
  WEATHER_SAMPLE_ORDER_CACHE: new WeakMap(),
  SETTINGS: { openMeteoForecastDays: 5 },
  TITLE_CARD_COUNT: 4,
  windowStart: new Date(2026, 8, 18, 10, 37),
  windowEnd: new Date(2026, 8, 19, 10, 37),
  startOfDay: date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  floorToHour: date => {
    const result = new Date(date);
    result.setMinutes(0, 0, 0);
    return result;
  },
  addDays: (date, days) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
  dateKey: date =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
};
vm.createContext(context);

const weatherStart = source.indexOf('function finiteWeatherNumber(');
const weatherEnd = source.indexOf('async function showForecaConnectionError(', weatherStart);
assert(weatherStart >= 0 && weatherEnd > weatherStart, 'Localizar funções de clima.');
vm.runInContext(source.slice(weatherStart, weatherEnd), context);

const buildStart = source.indexOf('function buildHourlyWeather(');
const buildEnd = source.indexOf('async function loadNightTextures(', buildStart);
assert(buildStart >= 0 && buildEnd > buildStart, 'Localizar normalização horária.');
vm.runInContext(source.slice(buildStart, buildEnd), context);

const temperatureStart = source.indexOf('function orderedWeatherSamples(');
const temperatureEnd = source.indexOf('function thermalTemperatureY(', temperatureStart);
assert(temperatureStart >= 0 && temperatureEnd > temperatureStart, 'Localizar interpolação de clima.');
vm.runInContext(source.slice(temperatureStart, temperatureEnd), context);

const hour = 60 * 60 * 1000;
const requiredStart = context.floorToHour(context.windowStart).getTime();
const requiredEnd = Math.max(
  context.windowEnd.getTime(),
  context.addDays(context.startOfDay(context.windowStart), 4).getTime()
);

assert.equal(
  context.weatherCacheCoversRequiredWindow([
    { timestamp: requiredEnd - hour, temperature: 20 },
  ]),
  false,
  'Uma amostra no fim não prova cobertura.'
);

const completeHours = [];
for (let timestamp = requiredStart; timestamp <= requiredEnd; timestamp += hour) {
  completeHours.push({ timestamp, temperature: 20 });
}
assert.equal(
  context.weatherCacheCoversRequiredWindow(completeHours),
  true,
  'Série horária contínua deve cobrir a janela.'
);

const gapHours = completeHours.filter(
  hourSample =>
    hourSample.timestamp < requiredStart + 20 * hour ||
    hourSample.timestamp > requiredStart + 23 * hour
);
assert.equal(
  context.weatherCacheCoversRequiredWindow(gapHours),
  false,
  'Lacuna central grande invalida a cobertura.'
);

const daily = context.buildHourlyWeather(
  [{
    timestamp: new Date(2026, 8, 18, 12).getTime(),
    temperature: 30,
  }],
  { '2026-09-18': { minimum: 18, maximum: 35 } }
);
assert.deepEqual(
  {
    minimum: daily.daily['2026-09-18'].minimum,
    maximum: daily.daily['2026-09-18'].maximum,
  },
  { minimum: 18, maximum: 35 },
  'Resumo diário válido deve prevalecer sobre uma hora parcial.'
);

const nullTemperature = context.buildHourlyWeather([
  { timestamp: requiredStart, temperature: null },
]);
assert.equal(nullTemperature.hours.length, 0, 'null não pode virar 0°C.');

const base = new Date(2026, 8, 18).getTime();
assert.equal(
  context.temperatureAtTimestamp([
    { timestamp: base, temperature: 25 },
  ], base + 24 * hour),
  null,
  'Amostra antiga não pode ser extrapolada por 24 horas.'
);
assert.equal(
  context.temperatureAtTimestamp([
    { timestamp: base, temperature: 20 },
    { timestamp: base + 3 * hour, temperature: 30 },
  ], base + hour),
  null,
  'Lacuna longa não deve gerar curva contínua.'
);
assert.equal(
  context.temperatureAtTimestamp([
    { timestamp: base, temperature: 20 },
    { timestamp: base + 2 * hour, temperature: 30 },
  ], base + hour).temperature,
  25,
  'Interpolação horária válida deve permanecer.'
);

const symbolStart = source.indexOf('function weatherSymbolGroup(');
const symbolEnd = source.indexOf('function isNightWeatherHour(', symbolStart);
vm.runInContext(source.slice(symbolStart, symbolEnd), context);
const iconStart = source.indexOf('function drawTitleWeatherIcon(');
const iconEnd = source.indexOf('function drawTemperatureFooter(', iconStart);
vm.runInContext(source.slice(iconStart, iconEnd), context);
let sunCalls = 0;
let overlayCalls = 0;
context.weatherSunRadius = () => 10;
context.drawWeatherSun = () => { sunCalls++; };
context.drawCelestialWeatherOverlay = () => { overlayCalls++; };
context.drawTitleWeatherIcon({}, { temperature: 25, symbol: '' }, 0, 0, 40);
assert.equal(sunCalls, 0, 'Símbolo ausente não pode desenhar Sol.');
assert.equal(overlayCalls, 1, 'Dados sem símbolo mantêm o espaço neutro.');

console.log('OK: cobertura, resumos, null, lacunas, horizonte e ícones sem símbolo.');
