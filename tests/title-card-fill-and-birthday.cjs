// Verifica duas regras visuais que podem ser testadas sem o runtime do Scriptable:
// o núcleo dos quadros é preenchido e aniversários não criam uma faixa opaca.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

class Rect {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}

class Point {
  constructor(x, y) {
    Object.assign(this, { x, y });
  }
}

class Color {}

const context = {
  WIDGET_CONTOUR: {extentX:102, extentY:101, exponent:2.45},
  Path: class {
    constructor() { this.points = []; }
    move(p) { this.points.push(p); }
    addLine(p) { this.points.push(p); }
    closeSubpath() {}
  },
  CANVAS: {width: 1092, height: 510},
  SETTINGS: { birthdayLabelGap: 30 },
  Rect,
  Point,
  Color,
  Font: {
    blackRoundedSystemFont: size => ({ size }),
  },
  scaleVertical: value => value,
  scaleFontSize: value => value,
  compactTimelineFontSize: value => value,
  isCompactMode: () => false,
  cleanTitle: value => String(value),
  estimatedTextWidth: (value, size) => String(value).length * size * 0.62,
  birthdayLabelWidth: (value, size) => String(value).length * size * 0.62,
  timelineWidth: () => 100,
  windowStart: new Date(2026, 8, 18),
  windowEnd: new Date(2026, 8, 19),
  timeToX: date =>
    date.getTime() === new Date(2026, 8, 18).getTime() ? 0 : 100,
};

const fillStart = source.indexOf('function fillTitleCardShape(');
const fillEnd = source.indexOf('function titleDayMonthLabel(', fillStart);
assert(fillStart >= 0 && fillEnd > fillStart, 'Localizar helper dos quadros.');
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function appendContourArc('),
  source.indexOf('function widgetContourInsetAtY(')), context);
vm.runInContext(source.slice(fillStart, fillEnd), context);

const fillRects = [];
const filledPaths = [];
const fillContext = {
  addPath: path => filledPaths.push(path),
  fillPath() {},
  setFillColor() {},
  fillRect: rect => fillRects.push(rect),
  fillEllipse() {},
};
context.fillTitleCardShape(
  fillContext,
  new Rect(10, 20, 100, 50),
  { topLeft: 10, topRight: 12, bottomRight: 0, bottomLeft: 0 },
  {}
);

const polygon = filledPaths[0].points;
function contains(x, y) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i], b=polygon[j];
    if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
assert(contains(60,45), 'O núcleo do caminho preenchido deve cobrir o centro.');
assert(contains(11,69) && contains(109,69), 'Cantos inferiores retos preenchidos.');

const birthdayStart = source.indexOf('function drawBirthdayGroupLabel(');
const birthdayEnd = source.indexOf('function birthdayLabelWidth(', birthdayStart);
assert(
  birthdayStart >= 0 && birthdayEnd > birthdayStart,
  'Localizar renderer dos aniversários.'
);
vm.runInContext(source.slice(birthdayStart, birthdayEnd), context);

const drawnTexts = [];
const birthdayContext = {
  setTextAlignedLeft() {},
  setFont() {},
  setTextColor() {},
  drawText: (text, point) => drawnTexts.push({ text, point }),
};

context.drawBirthdayGroupLabel(
  birthdayContext,
  {
    start: new Date(2026, 8, 18),
    end: new Date(2026, 8, 19),
    birthdayItems: [
      { title: 'Ana' },
      { title: 'Bruno' },
    ],
  },
  0,
  40
);

assert(drawnTexts.some(entry => entry.text === 'Ana'));
assert(drawnTexts.some(entry => entry.text === 'Bruno'));
console.log('OK: quadros preenchidos; aniversários sem chart opaco.');
