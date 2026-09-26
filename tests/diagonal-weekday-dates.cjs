// Valida a data pequena nos dois caminhos de renderização do rótulo diagonal.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'Calendar Timeline'), 'utf8');
const entryStart = source.indexOf('function diagonalWeekdayLabelEntries(');
const entryEnd = source.indexOf('\nasync function drawDiagonalWeekdayLabels(', entryStart);
const fallbackStart = source.indexOf('function drawDiagonalWeekdayLabelsFallback(');
const fallbackEnd = source.indexOf('\nfunction drawTimelineDayBoundariesOnTop(', fallbackStart);
assert(entryStart >= 0 && entryEnd > entryStart, 'Localizar os dados de cada dia.');
assert(fallbackStart >= 0 && fallbackEnd > fallbackStart, 'Localizar o desenho alternativo.');

const windowStart = new Date(2026, 8, 30, 18);
const windowEnd = new Date(2026, 9, 2, 6);
const entriesContext = {
  Date,
  windowStart,
  windowEnd,
  SETTINGS: { daylightStartHour: 6, daylightEndHour: 18 },
  startOfDay: date => new Date(
    date.getFullYear(), date.getMonth(), date.getDate()
  ),
  addDays: (date, days) => new Date(
    date.getFullYear(), date.getMonth(), date.getDate() + days
  ),
  dateAtHour: (date, hour) => new Date(
    date.getFullYear(), date.getMonth(), date.getDate(), hour
  ),
  timeToX: date => (+date - +windowStart) / 3600000,
  solarLineY: () => 20,
  thermalBandBottomY: () => 200,
  diagonalWeekdayLabelColor: () => '#FFFFFF',
};
vm.createContext(entriesContext);
vm.runInContext(source.slice(entryStart, entryEnd), entriesContext);
const entries = Array.from(entriesContext.diagonalWeekdayLabelEntries());
assert.deepEqual(entries.map(entry => entry.label), ['QUARTA', 'QUINTA', 'SEXTA']);
assert.deepEqual(entries.map(entry => entry.dateLabel), ['30/09', '01/10', '02/10']);

let currentFontSize = 0;
let currentColor = null;
const fontSizes = [];
const visibleGlyphs = [];
class Rect {
  constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
}
class Color {
  constructor(hex, opacity) { Object.assign(this, { hex, opacity }); }
}
const fallbackContext = {
  Date,
  Rect,
  Color,
  Font: { blackRoundedSystemFont: size => ({ size }) },
  scaleFontSize: size => size,
  scaleVertical: size => size,
  isCompactMode: () => false,
  isExtendedDetailedMode: () => false,
  setTextAlignedCenter() {},
  setFont(font) {
    currentFontSize = font.size;
    fontSizes.push(font.size);
  },
  setTextColor(color) { currentColor = color.hex; },
  drawTextInRect(text, rect) {
    if (currentColor === '#FFFFFF') {
      visibleGlyphs.push({
        text,
        size: currentFontSize,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      });
    }
  },
};
vm.createContext(fallbackContext);
vm.runInContext(source.slice(fallbackStart, fallbackEnd), fallbackContext);
fallbackContext.drawDiagonalWeekdayLabelsFallback(
  fallbackContext,
  [{
    label: 'QUARTA',
    dateLabel: '24/09',
    x0: 0,
    x1: 240,
    top: 10,
    bottom: 110,
    centerX: 120,
    centerY: 60,
    color: '#FFFFFF',
  }]
);

const weekday = visibleGlyphs.slice(0, 6);
const date = visibleGlyphs.slice(6);
assert.equal(weekday.map(glyph => glyph.text).join(''), 'QUARTA');
assert.equal(date.map(glyph => glyph.text).join(''), '24/09');
assert(fontSizes.length === 2 &&
  fontSizes[1] >= fontSizes[0] * 0.35 &&
  fontSizes[1] < fontSizes[0] * 0.5,
  'A data aumenta de tamanho e permanece menor que o dia da semana.');
const average = glyphs => ({
  x: glyphs.reduce((sum, glyph) => sum + glyph.x, 0) / glyphs.length,
  y: glyphs.reduce((sum, glyph) => sum + glyph.y, 0) / glyphs.length,
});
const weekdayCenter = average(weekday);
const dateCenter = average(date);
const diagonalLength = Math.hypot(240, 100);
const tangent = { x: 240 / diagonalLength, y: -100 / diagonalLength };
const normal = { x: 100 / diagonalLength, y: 240 / diagonalLength };
const localOffset = center => ({
  tangent: (center.x - 120) * tangent.x + (center.y - 60) * tangent.y,
  normal: (center.x - 120) * normal.x + (center.y - 60) * normal.y,
});
const weekdayOffset = localOffset(weekdayCenter);
const dateOffset = localOffset(dateCenter);
assert(dateOffset.normal > weekdayOffset.normal,
  'A data fica abaixo e acompanha a mesma inclinação.');
assert(Math.abs(weekdayOffset.tangent) < 1e-9);
assert(Math.abs(dateOffset.tangent) < 1e-9,
  'As duas linhas permanecem centradas no eixo horizontal inclinado.');
const dateGap = Math.max(2, fontSizes[1] * 0.2);
const groupTop = weekdayOffset.normal - fontSizes[0] / 2;
const groupBottom = dateOffset.normal + fontSizes[1] / 2;
assert(Math.abs((groupTop + groupBottom) / 2) < 1e-9,
  'A caixa total de dia e data fica centrada verticalmente, apesar dos tamanhos diferentes.');
assert(Math.abs((dateOffset.normal - fontSizes[1] / 2) -
  (weekdayOffset.normal + fontSizes[0] / 2) - dateGap) < 1e-9,
  'O intervalo entre as duas linhas preserva a folga definida.');
const slope = glyphs =>
  (glyphs.at(-1).y - glyphs[0].y) / (glyphs.at(-1).x - glyphs[0].x);
assert(Math.abs(slope(weekday) - slope(date)) < 1e-9,
  'Nome do dia e data seguem o mesmo alinhamento diagonal.');

const rasterizerStart = source.indexOf('async function rasterizeDiagonalWeekdayLabels(');
const rasterizerEnd = source.indexOf('\nfunction drawDiagonalWeekdayLabelsFallback(', rasterizerStart);
const rasterizer = source.slice(rasterizerStart, rasterizerEnd);
assert(rasterizer.includes('typography.dateFontSize'));
assert(rasterizer.includes('context.fillText(entry.dateLabel, 0, dateCenterY)'));
assert(rasterizer.includes("context.textAlign = 'center'"));

let generatedCanvasCode = '';
class WebView {
  async loadHTML() {}
  async evaluateJavaScript(code) {
    generatedCanvasCode = code;
    return 'data:image/png;base64,AAAA';
  }
}
const rasterContext = {
  WebView,
  Data: { fromBase64String: value => value },
  Image: { fromData: value => value },
  timelineWidth: () => 400,
  timelineHeight: () => 220,
  scaleFontSize: size => size,
  isCompactMode: () => false,
  isExtendedDetailedMode: () => false,
  VERTICAL_LAYOUT_SCALE: 1,
};
vm.createContext(rasterContext);
vm.runInContext(rasterizer, rasterContext);
(async function verifyRasterizedRenderer() {
  await rasterContext.rasterizeDiagonalWeekdayLabels([{
  label: 'QUARTA',
  dateLabel: '24/09',
  x0: 0,
  x1: 240,
  top: 10,
  bottom: 110,
  centerX: 120,
  centerY: 60,
  color: '#FFFFFF',
  }]);
  new vm.Script(generatedCanvasCode);
  const rasterizedGlyphs = [];
  const canvasContext = {
  save() {},
  restore() {},
  beginPath() {},
  rect() {},
  clip() {},
  translate() {},
  rotate() {},
  scale() {},
  measureText(text) {
    const size = Number(this.font.match(/\d+(?:\.\d+)?px/)[0].replace('px', ''));
    return { width: text.length * size * 0.62 };
  },
  strokeText() {},
  fillText(text, x, y) {
    rasterizedGlyphs.push({
      text,
      font: this.font,
      align: this.textAlign,
      x,
      y,
    });
  },
  };
  const canvas = {
    getContext: () => canvasContext,
    toDataURL: () => 'data:image/png;base64,AAAA',
  };
  vm.runInNewContext(generatedCanvasCode, {
    document: { getElementById: () => canvas },
    Math,
    Number,
  });
  assert.deepEqual(rasterizedGlyphs.map(glyph => glyph.text), ['QUARTA', '24/09']);
  assert.equal(rasterizedGlyphs[0].align, 'center');
  assert.equal(rasterizedGlyphs[1].align, 'center');
  const weekdayRaster = rasterizedGlyphs[0];
  const dateRaster = rasterizedGlyphs[1];
  const rasterFontSize = glyph =>
    Number(glyph.font.match(/\d+(?:\.\d+)?px/)[0].replace('px', ''));
  const rasterWeekdaySize = rasterFontSize(weekdayRaster);
  const rasterDateSize = rasterFontSize(dateRaster);
  assert(weekdayRaster.font.startsWith('900 '));
  assert(rasterDateSize >= rasterWeekdaySize * 0.35 &&
    rasterDateSize < rasterWeekdaySize * 0.5,
    'A data maior também é aplicada no caminho rasterizado.');
  assert.equal(weekdayRaster.x, 0);
  assert.equal(dateRaster.x, 0,
    'As duas linhas rasterizadas compartilham o centro horizontal.');
  assert(weekdayRaster.y < 0 && dateRaster.y > 0,
    'A data fica abaixo do dia da semana no caminho rasterizado.');
  const weekdayHeight = rasterWeekdaySize * 1.05 +
    Math.max(2.6, rasterWeekdaySize * 0.07) * 2;
  const dateHeight = rasterDateSize * 1.05 +
    Math.max(1, rasterDateSize * 0.07) * 2;
  const lineGap = Math.max(2, rasterDateSize * 0.2);
  assert(Math.abs(weekdayRaster.y + (lineGap + dateHeight) / 2) < 1e-9);
  assert(Math.abs(dateRaster.y - (weekdayHeight + lineGap) / 2) < 1e-9);
  assert(Math.abs(
    (weekdayRaster.y - weekdayHeight / 2 +
      dateRaster.y + dateHeight / 2) / 2
  ) < 1e-9,
  'O agrupamento rasterizado permanece centrado verticalmente.');
  console.log('OK: dd/MM maior, grupo centralizado e alinhamento diagonal nos dois caminhos.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
