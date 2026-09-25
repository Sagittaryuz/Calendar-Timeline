const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

class Point { constructor(x, y) { Object.assign(this, { x, y }); } }
class Rect { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
class Path {
  move() {}
  addLine() {}
  addCurve() {}
  closeSubpath() {}
}

const context = {
  Point,
  Rect,
  Path,
  Color: class {},
  SETTINGS: { maxItems: 5 },
};
vm.createContext(context);
vm.runInContext(
  source.slice(
    source.indexOf('const WIDGET_CANVAS_HEIGHT'),
    source.indexOf('const now =')
  ),
  context
);

function loadFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Função ausente: ${name}`);
  const tail = source.slice(start + 1);
  const end = tail.search(/\n(?:async )?function /);
  vm.runInContext(
    source.slice(start, end < 0 ? source.length : start + 1 + end),
    context
  );
}

for (const name of [
  'bottomLegendCenterY',
  'isCompactMode',
  'thermalBandBottomY',
  'thermalBandTopY',
  'thermalTemperatureLabelTopY',
  'weatherStripBottomY',
  'timelineChartTop',
  'timelineChartBottom',
  'timelineRowHeight',
  'timelineHeight',
]) {
  loadFunction(name);
}

const run = (expression) => vm.runInContext(expression, context);
const closeTo = (actual, expected, message) => {
  assert(Math.abs(actual - expected) < 1e-9, message);
};

const thermalBottom = run('thermalBandBottomY()');
const thermalTop = run('thermalBandTopY()');
const temperatureLabelsTop = run('thermalTemperatureLabelTopY()');
const chartTop = run('timelineChartTop()');
const chartBottom = run('timelineChartBottom()');
const rowHeight = run('timelineRowHeight()');
const oldGap = run('scaleVertical(5)');
const oldCurveHeight = run('scaleVertical(30)');
const oldTemperatureLabelHeight = run('scaleVertical(32)');
const releasedHeight =
  oldGap - 0.34 +
  oldCurveHeight - 30.67 +
  oldTemperatureLabelHeight - 30.67;
const previousChartBottom =
  thermalBottom - oldCurveHeight - oldTemperatureLabelHeight - oldGap;
const previousRowHeight =
  (previousChartBottom - chartTop) / context.SETTINGS.maxItems;

closeTo(thermalBottom - thermalTop, 30.67, 'Curva térmica limitada a 30,67 px.');
closeTo(thermalTop - temperatureLabelsTop, 30.67, 'Faixa dos rótulos mede 30,67 px.');
closeTo(temperatureLabelsTop - chartBottom, 0.34, 'Vão antes dos rótulos mede 0,34 px.');
closeTo(rowHeight, previousRowHeight + releasedHeight / 5, 'Espaço liberado dividido igualmente entre cinco linhas.');
closeTo(
  chartTop,
  run('weatherStripBottomY()+scaleVertical(5)-TIMELINE_GRID_TOP_EXTENSION+TITLE_TIMELINE_GAP_ADJUSTMENT'),
  'O topo do grid e os limites anteriores permanecem intactos.'
);
closeTo(run('TIMELINE_GRID_TOP_EXTENSION'), 6, 'Extensão superior preservada.');
closeTo(run('TIMELINE_GRID_BOTTOM_EXTENSION'), 4, 'Extensão inferior preservada.');
closeTo(run('timelineHeight()'), 396.1845231404958, 'Altura total do painel preservada.');
closeTo(
  run('CANVAS.timelineTop+bottomLegendCenterY()+DAY_CHANGE_CIRCLE_DIAMETER/2'),
  506,
  'Alinhamento do círculo inferior preservado.'
);

console.log(
  `OK: vão 0,34 px; curva e rótulos 30,67 px; cinco linhas com ${rowHeight.toFixed(2)} px cada; limites externos preservados.`
);
