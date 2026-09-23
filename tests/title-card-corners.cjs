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
let blurEnabled = true;
class Rect {
  constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); }
}
class Color {
  constructor(hex, opacity) { Object.assign(this, {hex, opacity}); }
}
const holidayDates = new Set(['2026-9-22']);
const context = {
  Color, Rect,
  SETTINGS: {
    timelineBackgroundColor: '#000000',
    nonTodayTimelineOverlayColor: '#3B3C3E',
    saturdayTimelineBackgroundColor: '#0D3F68',
    sundayTimelineBackgroundColor: '#521720',
    holidayTimelineBackgroundColor: '#3A2A00',
  },
  CANVAS: { marginX: 30 },
  TITLE_CARD_OUTER_CORNER_RADIUS: 48,
  TITLE_CARD_STANDARD_CORNER_RADIUS: 48,
  scaleVertical: x => x,
  startOfDay: date => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  addDays: (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days),
  dateKey: date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
  windowStart: new Date(2026, 8, 18),
  shouldBlurFutureTimeline: () => blurEnabled,
  fillTitleCardShape: (_, rect, radii, color) => shapes.push({rect, radii, color}),
  loadResult: {holidayDates},
  titleWeekdayColor: () => { throw stop; },
};
vm.createContext(context);
const backgroundStart = source.indexOf('function timelineBackgroundColorForDate(');
const backgroundEnd = source.indexOf('function drawTimelineBackground(', backgroundStart);
assert(backgroundStart >= 0 && backgroundEnd > backgroundStart, 'Localizar as cores de fundo por dia.');
vm.runInContext(source.slice(backgroundStart, backgroundEnd), context);
vm.runInContext(source.slice(start, end), context);
for (const selected of [false, true]) {
  for (const last of [false, true]) {
    const offsets = selected ? [0] : [1, 2];
    for (const offset of offsets) {
      const cardDate = new Date(2026, 8, 18 + offset);
      shapes = [];
      try {
        context.drawTitleDayCard({}, cardDate, new Rect(290, 30, 240, 96), selected, last);
        assert.fail('Esperado alcançar a fase de textos.');
      } catch (error) { assert.equal(error, stop); }
      if (selected) {
        assert.equal(shapes.length, 0, 'Hoje mantém sua forma contínua, sem repintura.');
      } else {
        assert.equal(shapes.length, 2, 'Contorno e preenchimento interno.');
        shapes.forEach(({radii}, shapeIndex) => {
          assert.equal(
            radii.bottomLeft,
            0,
            'Todos os quadros futuros mantêm a base perpendicular.'
          );
          assert.equal(radii.bottomRight, 0);
          assert.equal(radii.topLeft, 0, 'Junções internas à esquerda ficam retas.');
          assert.equal(
            radii.topRight,
            last ? (shapeIndex === 0 ? 48 : 46) : 0,
            'Somente a extremidade direita mantém o raio externo.'
          );
        });
      }
    }
  }
}

shapes = [];
try {
  context.drawTitleDayCard(
    {},
    new Date(2026, 8, 21),
    new Rect(30, 30, 240, 96),
    false,
    false
  );
  assert.fail('Esperado alcançar a fase de textos.');
} catch (error) { assert.equal(error, stop); }
assert.equal(shapes[0].radii.topLeft, 48, 'O canto externo esquerdo conserva seu raio.');
assert.equal(shapes[0].radii.topRight, 0, 'O canto interno do primeiro quadro fica reto.');

function cardFillColor(day, blur) {
  blurEnabled = blur;
  shapes = [];
  try {
    context.drawTitleDayCard(
      {},
      new Date(2026, 8, day),
      new Rect(290, 30, 240, 96),
      false,
      false
    );
    assert.fail('Esperado alcançar a fase de textos.');
  } catch (error) { assert.equal(error, stop); }
  return shapes[1].color;
}

const normalDayWithoutBlur = cardFillColor(21, false);
const normalDayWithBlur = cardFillColor(21, true);
assert.equal(normalDayWithoutBlur.hex, '#3B3C3E', 'Dia útil sem blur usa o cinza pedido.');
assert.equal(normalDayWithoutBlur.opacity, 1, 'O preenchimento normal não recebe transparência.');
assert.equal(normalDayWithBlur.hex, '#232327', 'Dia útil durante o blur usa a cor exata pedida.');
assert.equal(normalDayWithBlur.opacity, 1, 'O preenchimento com blur permanece opaco.');
assert.equal(cardFillColor(19, false).hex, '#0D3F68', 'Sábado mantém a cor especial.');
assert.equal(cardFillColor(20, false).hex, '#521720', 'Domingo mantém a cor especial.');
assert.equal(cardFillColor(22, false).hex, '#3A2A00', 'Feriado mantém a cor especial.');
assert.equal(cardFillColor(19, true).hex, '#0D3F68', 'Sábado não muda com o blur.');
assert.equal(cardFillColor(20, true).hex, '#521720', 'Domingo não muda com o blur.');
assert.equal(cardFillColor(22, true).hex, '#3A2A00', 'Feriado não muda com o blur.');
assert.match(source, /nonTodayTimelineOverlayColor:\s*"#3B3C3E"/);
console.log('OK: cores exatas e opacas nos dias úteis; sábados, domingos e feriados preservados.');
