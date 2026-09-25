const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(
  source,
  /let refreshURL\s*=\s*addURLParameter\(\s*URLScheme\.forRunningScript\(\),\s*"refresh",\s*"1"\s*\);/
);
assert.match(
  source,
  /refreshURL\s*=\s*addURLParameter\(refreshURL,\s*"hours",\s*String\(windowHours\)\);/
);
assert.match(source, /widget\.url\s*=\s*refreshURL;/);
assert.match(source, /widget\.refreshAfterDate\s*=\s*new Date\(/);
assert.match(
  source,
  /function calendarURL\(date\)[\s\S]*?return `calshow:\$\{secondsSinceReference\}`;/
);
assert.match(
  source,
  /if\s*\(refreshRequested\)\s*\{[\s\S]*?Script\.setWidget\(widget\);[\s\S]*?Safari\.open\(calendarURL\(now\)\);/
);

console.log('OK: toque executa o script, atualiza o widget e depois abre o Calendário.');
