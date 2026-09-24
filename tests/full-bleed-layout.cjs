const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  require('node:path').join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /marginX: 0,/);
assert.match(source, /plotLeft: 0,/);
assert.match(source, /plotRight: 1092,/);
assert.match(source, /const TIMELINE_OUTER_BORDER_WIDTH = 2;/);
assert.match(source, /const TITLE_CARD_SPACING = 1\.2287;/);
assert.match(
  source,
  /const TITLE_CARD_BASE_CLEAR_GAP = Math\.max\([\s\S]*?TIMELINE_OUTER_BORDER_WIDTH \/ 2\s*\);/
);
assert.match(source, /TITLE_CARD_SPACING - TITLE_CARD_BASE_CLEAR_GAP/);
assert.match(source, /const cardsLeft = CANVAS\.marginX;/);
assert.match(source, /const cardsRight = CANVAS\.width - CANVAS\.marginX;/);

console.log('OK: conteúdo horizontal ocupa o canvas e usa vão livre igual de 1,2287 px.');
