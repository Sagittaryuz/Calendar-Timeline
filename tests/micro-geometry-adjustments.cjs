const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /const DAY_CHANGE_CIRCLE_VERTICAL_OFFSET = 2;/);
assert.match(
  source,
  /return bottomLegendCenterY\(\) \+ DAY_CHANGE_CIRCLE_VERTICAL_OFFSET;/
);
assert.match(source, /const HOUR_LEGEND_HEIGHT_REDUCTION = 2;/);
assert.match(
  source,
  /legendTextHeight\(\) - HOUR_LEGEND_HEIGHT_REDUCTION/
);
assert.match(source, /const DAY_CARD_TEXT_VERTICAL_OFFSET = -4;/);
assert.match(source, /DAY_CARD_TEXT_VERTICAL_OFFSET/);

// A linha inferior da moldura continua ancorada no limite calibrado.
assert.match(
  source,
  /const bottomLineCenterY = CANVAS\.height - WIDGET_CONTOUR\.strokeInset;/
);

console.log(
  'OK: círculo/horas +2 px, caixa superior das horas -2 px e textos dos quadros -4 px.'
);
