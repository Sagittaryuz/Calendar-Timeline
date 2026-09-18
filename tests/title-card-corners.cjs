// Teste estrutural; não substitui a comparação de imagens no Scriptable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'Calendar Timeline'), 'utf8');
const start = source.indexOf('function drawTitleDayCard(');
const end = source.indexOf('function titleDailyTemperatureForDay(', start);
assert(start >= 0 && end > start, 'Localizar função real, sem copiar sua implementação.');
const stop = new Error('Fim da geometria; textos não são objeto deste teste.');
let shapes = [];
class Rect {
  constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); }
}
const context = {
  Color: class {}, Rect,
  SETTINGS: { timelineBackgroundColor: '#000000', nonTodayTimelineOverlayColor: '#5A5A5F' },
  CANVAS: { marginX: 30 },
  TITLE_CARD_OUTER_CORNER_RADIUS: 48,
  TITLE_CARD_STANDARD_CORNER_RADIUS: 48,
  scaleVertical: x => x,
  timelineBackgroundColorForDate: () => '#000000',
  shouldBlurFutureTimeline: () => true,
  fillTitleCardShape: (_, rect, radii) => shapes.push({rect, radii}),
  loadResult: {holidayDates: new Set()},
  titleWeekdayColor: () => { throw stop; },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
for (const selected of [false, true]) {
  for (const last of [false, true]) {
    shapes = [];
    try {
      context.drawTitleDayCard({}, new Date(2026, 8, 18), new Rect(290, 30, 240, 96), selected, last);
      assert.fail('Esperado alcançar a fase de textos.');
    } catch (error) { assert.equal(error, stop); }
    if (selected) {
      assert.equal(shapes.length, 0, 'Hoje mantém sua forma contínua, sem repintura.');
    } else {
      assert.equal(shapes.length, 2, 'Contorno e preenchimento interno.');
      for (const {radii} of shapes) {
        assert.equal(radii.bottomLeft, 0);
        assert.equal(radii.bottomRight, 0);
        assert(radii.topLeft > 0 && radii.topRight > 0);
      }
    }
  }
}
console.log('OK: bases perpendiculares; topo preservado; hoje não repintado.');
