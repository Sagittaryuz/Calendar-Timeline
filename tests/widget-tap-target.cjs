const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /widget\.url\s*=\s*calendarURL\(now\);/);
assert.match(source, /widget\.refreshAfterDate\s*=\s*new Date\(/);
assert.match(
  source,
  /function calendarURL\(date\)[\s\S]*?return `calshow:\$\{secondsSinceReference\}`;/
);
assert.doesNotMatch(source, /widget\.url\s*=\s*refreshURL/);

console.log('OK: toque abre o Calendário diretamente e a atualização programada continua ativa.');
