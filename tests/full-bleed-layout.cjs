const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  require('node:path').join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /marginX: 0,/);
assert.match(source, /plotLeft: 0,/);
assert.match(source, /plotRight: 1092,/);
assert.match(
  source,
  /return verticalGap \* \(timelineWidth\(\) \/ 1032\);/
);
assert.match(source, /const cardsLeft = CANVAS\.marginX;/);
assert.match(source, /const cardsRight = CANVAS\.width - CANVAS\.marginX;/);

console.log('OK: conteúdo horizontal ocupa 100% do canvas e conserva a distribuição proporcional.');
