const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /const WIDGET_CONTENT_TOP_MARGIN = 0;/);
assert.match(source, /const WIDGET_CONTENT_BOTTOM_MARGIN = 0;/);
assert.match(
  source,
  /\(WIDGET_CANVAS_HEIGHT\s*-\s*WIDGET_CONTENT_TOP_MARGIN\s*-\s*WIDGET_CONTENT_BOTTOM_MARGIN\)\s*\/\s*\(LEGACY_CONTENT_BOTTOM_EDGE\s*-\s*LEGACY_CONTENT_TOP\)/
);
assert.match(
  source,
  /timelineBottom:\s*mapLegacyContentY\(LEGACY_CONTENT_BOTTOM_EDGE\)/
);
assert.match(source, /footerBottom:\s*WIDGET_CANVAS_HEIGHT/);
assert.match(
  source,
  /CANVAS\.height\s*-\s*WIDGET_CONTENT_BOTTOM_MARGIN\s*-\s*WIDGET_CONTOUR\.strokeInset\s*-\s*CANVAS\.timelineTop\s*-\s*DAY_CHANGE_CIRCLE_DIAMETER\s*\/\s*2/
);

console.log(
  'OK: layout vertical ocupa o canvas completo e alinha a borda inferior ao círculo.'
);
