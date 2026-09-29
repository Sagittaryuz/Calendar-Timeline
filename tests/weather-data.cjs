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
  WEATHER_QUARTER_MS: 15 * 60 * 1000,
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

const consensusTimestamp = requiredStart + 4 * hour;
const fusedWeather = context.fuseWeatherForecasts({
  'open-meteo': [{ timestamp: consensusTimestamp, temperature: 29, rainMM: 0, rainChance: 15 }],
  foreca: [{ timestamp: consensusTimestamp, temperature: 31, rainMM: 0.1, rainChance: 35 }],
  'met-norway': [{ timestamp: consensusTimestamp, temperature: 30, rainMM: 0.5, rainChance: null }],
}, Date.now());
assert.equal(fusedWeather.length, 1, 'Funde fontes no mesmo horário.');
assert.equal(fusedWeather[0].rainMM, 0.1, 'A mediana robusta reduz o peso de um extremo isolado.');
assert.equal(fusedWeather[0].rainChance, 25, 'Combina probabilidades disponíveis sem inventar a do MET.');
assert.equal(fusedWeather[0].rainDispersionMM, 0.5, 'Registra a amplitude de dispersão entre os modelos.');
assert.equal(fusedWeather[0].rainAgreement, 'moderada', 'Marca dispersão moderada entre fontes.');
assert.equal(fusedWeather[0].sources.length, 3, 'Preserva a lista de fontes usadas.');
const normalizedConsensus = context.buildHourlyWeather(fusedWeather).hours[0];
assert.equal(normalizedConsensus.rainDispersionMM, 0.5, 'A normalização mantém a dispersão para a interface.');
assert.deepEqual(Array.from(normalizedConsensus.sources), ['open-meteo', 'foreca', 'met-norway']);

const radarStart = consensusTimestamp - hour;
const radarSamples = Array.from({ length: 4 }, (_, index) => ({
  timestampBegin: (radarStart + index * 15 * 60 * 1000) / 1000,
  timestampEnd: (radarStart + (index + 1) * 15 * 60 * 1000) / 1000,
  precipRate: 4,
  precipType: 'rain',
}));
const radarHours = context.rainbowNowcastHours({ forecast: radarSamples });
assert.equal(radarHours.length, 1, 'Agrega amostras de radar em um intervalo horário.');
assert.equal(radarHours[0].rainMM, 4, 'Integra a taxa mm/h pelo tempo coberto.');
assert.equal(radarHours[0].coveredMinutes, 60, 'Conserva a cobertura temporal do nowcast.');
assert.equal(radarHours[0].rainIntervals.length, 4, 'Mantém os quatro blocos do radar em 15 minutos.');
assert.equal(radarHours[0].rainIntervals[0].timestamp, radarStart);
assert.equal(radarHours[0].rainIntervals[0].coveredMinutes, 15);
const fusedWithRadar = context.fuseWeatherForecasts({
  'open-meteo': [{ timestamp: consensusTimestamp, temperature: 29, rainMM: 0, rainChance: 15 }],
  foreca: [{ timestamp: consensusTimestamp, temperature: 31, rainMM: 0.1, rainChance: 35 }],
  'met-norway': [{ timestamp: consensusTimestamp, temperature: 30, rainMM: 0.5, rainChance: null }],
  rainbow: radarHours,
}, Date.now())[0];
assert.ok(fusedWithRadar.rainMM >= 0.75, 'Preserva sinal forte do nowcast na chuva localizada.');
assert.ok(fusedWithRadar.sources.includes('rainbow'), 'Registra Rainbow na composição horária.');
assert.equal(fusedWithRadar.rainIntervals.length, 4, 'A fusão preserva o horário localizado do radar.');
const normalizedRadarWeather = context.buildHourlyWeather([fusedWithRadar]).hours[0];
assert.equal(normalizedRadarWeather.rainIntervals[0].timestamp, radarStart);

const localizedRadarStart = radarStart + 45 * 60 * 1000;
const localizedRadar = context.rainbowNowcastHours({
  forecast: Array.from({ length: 4 }, (_, index) => ({
    timestampBegin: (radarStart + index * 15 * 60 * 1000) / 1000,
    timestampEnd: (radarStart + (index + 1) * 15 * 60 * 1000) / 1000,
    precipRate: index === 3 ? 8 : 0,
    precipType: index === 3 ? 'rain' : 'none',
  })),
});
assert.equal(localizedRadar.length, 1);
assert.equal(localizedRadar[0].timestamp, consensusTimestamp);
assert.equal(localizedRadar[0].rainIntervals[3].timestamp, localizedRadarStart,
  'O nowcast mantém o quarto de hora previsto em vez de recuar para o começo da hora.');
const localizedFusion = context.fuseWeatherForecasts({
  'open-meteo': [{ timestamp: consensusTimestamp, temperature: 29, rainMM: 4, rainChance: 80 }],
  rainbow: localizedRadar,
}, Date.now());
const localizedCurtains = context.weatherRainCurtainForecasts(localizedFusion);
assert.equal(localizedCurtains.length, 1);
assert.equal(localizedCurtains[0].timestamp, localizedRadarStart,
  'A cortina de chuva é desenhada no horário do nowcast localizado.');

const rainBarsStart = source.indexOf('function drawThermalRainBars(');
const rainBarsEnd = source.indexOf('function drawRainBar(', rainBarsStart);
assert(rainBarsStart >= 0 && rainBarsEnd > rainBarsStart,
  'Localizar a distribuição das barras de chuva por quarto de hora.');
vm.runInContext(source.slice(rainBarsStart, rainBarsEnd), context);
context.rainEvidenceForForecast = forecast => ({
  hasRain: Number(forecast.rainMM) >= 0.2,
});
context.rainMillimetersForHour = forecast => Number(forecast.rainMM) || 0;
context.weatherSymbolGroup = () => 0;
context.scaleVertical = value => value;
context.isCompactMode = () => false;
context.timelineWidth = () => 1024;
context.solarLineY = () => 20;
context.timeToX = date =>
  (date.getTime() - context.windowStart.getTime()) /
  context.WEATHER_QUARTER_MS * 10;
context.SETTINGS = {
  rainEvidenceMinMM: 0.2,
  rainBarReferenceMMPerHour: 10,
  rainLineColor: '#00FFFF',
};
context.Rect = class MockWeatherRect {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
};
context.Color = class MockWeatherColor {};
context.drawRainBar = (drawContext, rect) => drawContext.bars.push(rect);
context.drawRainTopMarker = () => {};
const previousWeatherWindowStart = context.windowStart;
const previousWeatherWindowEnd = context.windowEnd;
context.windowStart = new Date(radarStart);
context.windowEnd = new Date(consensusTimestamp);
const localizedBars = { bars: [] };
context.drawThermalRainBars(localizedBars, localizedFusion, 0, 30);
assert.equal(localizedBars.bars.length, 1,
  'Os trechos secos cobertos pelo radar suprimem a hora inteira prevista pelos modelos.');
assert.equal(localizedBars.bars[0].x, 26,
  'A barra aparece no quarto de hora do radar, não no início da hora do modelo.');
context.windowStart = previousWeatherWindowStart;
context.windowEnd = previousWeatherWindowEnd;

const dryRadar = context.rainbowNowcastHours({
  forecast: Array.from({ length: 4 }, (_, index) => ({
    timestampBegin: (radarStart + index * 15 * 60 * 1000) / 1000,
    timestampEnd: (radarStart + (index + 1) * 15 * 60 * 1000) / 1000,
    precipRate: 0,
    precipType: 'none',
  })),
});
const dryConsensus = context.fuseWeatherForecasts({
  'open-meteo': [{ timestamp: consensusTimestamp, temperature: 29, rainMM: 4, rainChance: 80 }],
  rainbow: dryRadar,
}, Date.now());
assert.equal(context.weatherRainCurtainForecasts(dryConsensus).length, 0,
  'Cobertura seca do nowcast evita a coluna horária fora do intervalo observado.');

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
