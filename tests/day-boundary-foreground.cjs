// Executa a composição real com desenho simulado; não rasteriza no iPhone.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'Calendar Timeline'), 'utf8');
class Point { constructor(x, y) { Object.assign(this, {x, y}); } }
class Rect { constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); } }
class Size { constructor(width, height) { Object.assign(this, {width, height}); } }
class DrawContext {
  constructor() { this.shapes = []; this.events = []; }
  setFillColor(color) { this.color = color; }
  fillRect(rect) { this.shapes.push({rect, color: this.color}); this.events.push(this.color); }
  drawImageAtPoint(image) { this.shapes.push(...image.shapes); this.events.push(...image.events); }
  getImage() { return {shapes: this.shapes.slice(), events: this.events.slice()}; }
}
const c = {Date, Rect, Point, Size, DrawContext,
  CANVAS: {timelineTop: 100}, SETTINGS: {showSolarGlow: true}, hourlyWeather: [],
  DAY_CHANGE_CIRCLE_DIAMETER: 52,
  timelineWidth: () => 1092, timelineHeight: () => 410,
  weatherIconCenterY: () => 20, dayBoundaryAstroOuterRadius: () => 10,
  dayChangeLegendCenterY: () => 350, dayBoundaryLineWidth: () => 8,
  hourGridLineColor: () => 'boundary',
  currentDayFrameMetrics: () => ({boundaryX: 123.4, lineWidth: 8, lineColor: 'white'}),
  currentDayBoundaryBadgeCenterY: () => 450,
  // Rejeita a estratégia antiga de abrir lacunas nos cruzamentos.
  chartsCrossingDayBoundaryVerticalSpans() { assert.fail('Linha não deve excluir charts.'); },
};
vm.createContext(c);
function load(name, async = false) {
  const start = source.indexOf((async ? 'async ' : '') + 'function ' + name + '(');
  assert(start >= 0, name);
  const next = source.slice(start + 1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start, next < 0 ? source.length : start + next + 1), c);
}
load('renderTimelinePanel', true);
load('drawTimelineDayBoundariesOnTop');
load('drawCurrentDayBoundaryVerticalOverlay');
const record = name => ctx => ctx.events.push(name);
Object.assign(c, {
  drawTimelineBackground: record('background'),
  drawWeatherConditionStrip: record('weather'), drawHourAxis: record('hours'),
  drawTimelineRainOverlay: ctx => {
    ctx.setFillColor('rain'); ctx.fillRect(new Rect(0,130,1092,200));
  },
  drawFixedDaylightGlow: record('solar'), drawCompactThermalBand: record('thermal'),
  drawBottomHourLegend: record('legend'), drawEventStartLines: record('event-start'),
  drawDiagonalWeekdayLabels: async ctx => ctx.events.push('weekday-labels'),
  drawWeekdayBadgesOnTop: record('badges'), drawDayBoundaryMoonsOnTop: record('moons'),
  drawPermissionState: record('permission'),
  timelineItemsStartingTomorrow: items => items.filter(item => item.day === 'tomorrow'),
  timelineItemsStartingToday: items => items.filter(item => item.day === 'today'),
  drawFutureTimelineBlurLayer: ctx => {
    ctx.setFillColor('blur'); ctx.fillRect(new Rect(0, 0, 1092, 410));
  },
  drawTimelineItemLayer: (ctx, items, day) => {
    for (const item of items) {
      ctx.setFillColor(`${day}-${item.kind}`);
      ctx.fillRect(new Rect(0, 140, 1092, 36));
    }
  },
});
function topColor(image, x, y) {
  return image.shapes.filter(({rect: r}) =>
    x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height).at(-1)?.color;
}
(async () => {
  let cases = 0;
  for (const hours of [24, 48, 72, 96]) for (const blur of [false, true]) {
    c.shouldBlurFutureTimeline = () => blur;
    const start = new Date(2026, 9, 3, 12);
    const end = new Date(+start + hours * 3600000);
    const ticks = [];
    for (let date = new Date(+start); date <= end; date = new Date(+date + 12 * 3600000)) ticks.push(date);
    c.hourTicks = () => ticks;
    c.timelineLegendCenterX = date => (+date - +start) / (+end - +start) * 1092;
    const items = [{kind: 'event', day: 'today'}, {kind: 'reminder', day: 'today'},
      {kind: 'event', day: 'tomorrow'}, {kind: 'reminder', day: 'tomorrow'}];
    for (const error of [false, true]) {
      const image = await c.renderTimelinePanel(items, error);
      for (const tick of ticks.filter(date => date.getHours() === 0)) {
        const x = c.timelineLegendCenterX(tick);
        assert.equal(topColor(image, x, 150), 'boundary',
          'Divisão de dia prevalece no cruzamento com qualquer barra.');
        const shape = image.shapes.find(s => s.color === 'boundary' &&
          s.rect.x === Math.round(x - 4));
        assert.equal(shape.rect.width, 8);
        assert.equal(shape.rect.y, 30);
        assert.equal(shape.rect.height, 320);
      }
      const firstBoundary = image.events.indexOf('boundary');
      const rain = image.events.indexOf('rain');
      assert.equal(topColor(image, 17, 150), 'rain',
        'Chuva opaca cobre o chart no cruzamento, acima de hoje/amanhã/blur.');
      assert(rain > image.events.indexOf('thermal'));
      assert(firstBoundary > rain);
      if (blur) assert(rain > image.events.indexOf('blur'));
      if (!error) {
        for (const chart of ['today-event', 'today-reminder', 'tomorrow-event', 'tomorrow-reminder'])
          assert(rain > image.events.lastIndexOf(chart));
        assert(image.events.indexOf('event-start') > rain);
      }
      assert(firstBoundary > image.events.indexOf('legend'));
      if (!error) {
        for (const label of ['today-event', 'today-reminder', 'tomorrow-event', 'tomorrow-reminder', 'event-start']) {
          assert(firstBoundary > image.events.lastIndexOf(label));
        }
      }
      if (blur) assert(firstBoundary > image.events.indexOf('blur'));
      assert(image.events.indexOf('badges') > image.events.lastIndexOf('boundary'));
      assert(image.events.indexOf('moons') > image.events.indexOf('badges'));
      cases++;
    }
  }
  for (const items of [[], [{kind: 'event'}], [{kind: 'reminder', isPendingDayCarryover: true}]]) {
    const ctx = new DrawContext();
    c.drawCurrentDayBoundaryVerticalOverlay(ctx, items);
    assert.equal(ctx.shapes.length, 1, 'Próxima virada é contínua, sem lacunas de charts.');
    assert.deepEqual(ctx.shapes[0].rect, new Rect(119, 130, 8, 294));
    assert.equal(ctx.shapes[0].color, 'white');
  }
  console.log(`OK: ${cases} composições, divisões acima dos charts/blur e próxima virada contínua; geometria preservada.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
