// Verifica que o limite da legenda varia por altura e segue a curva real.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);
const start = source.indexOf('function hourLegendCornerRadius(');
const end = source.indexOf('function hourLabelMetrics(', start);
assert(start >= 0 && end > start, 'Localizar geometria da legenda.');

const context = {
  TITLE_CARD_OUTER_CORNER_RADIUS: 48,
  DAY_CHANGE_CIRCLE_DIAMETER: 52,
  titleDayCardRect: () => ({ width: 240, height: 96 }),
  timelineWidth: () => 1000,
  bottomLegendCenterY: () => 438,
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const upper = context.hourLegendVisibleBoundsAtY(450);
const lower = context.hourLegendVisibleBoundsAtY(480);
assert(upper.left < lower.left, 'A curva deve recuar mais na altura inferior.');
assert.equal(
  upper.left + upper.right,
  1000,
  'Os limites devem permanecer simétricos.'
);
assert.equal(
  lower.left + lower.right,
  1000,
  'Os limites inferiores devem permanecer simétricos.'
);

const clipStart = source.indexOf('function drawHourLegendLabelClipped(');
const clipEnd = source.indexOf('function hourLabelMetrics(', clipStart);
const clipSource = source.slice(clipStart, clipEnd);
assert(clipSource.includes('cropTransparentCanvasImage'));
assert(!clipSource.includes('ctx.fillRect'));

console.log('OK: recorte da legenda usa limites por faixa e camada transparente.');
