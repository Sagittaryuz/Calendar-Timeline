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
assert.match(source, /function acrossURL\(\)[\s\S]*?return "across:\/\/";/);
assert.doesNotMatch(source, /calshow:/);

// Run the production completion branch with Scriptable API doubles.
// This verifies dispatch/order, not native iOS URL handling.
const vm = require('node:vm');
const branch = source.slice(source.indexOf('if (config.runsInWidget || config.runsWithSiri) {'), source.indexOf('async function loadWindow()'));
const launch = source.slice(source.indexOf('function acrossURL() {'), source.indexOf('function addURLParameter'));
(async () => {
  let cases = 0;
  for (const runsInWidget of [false, true]) {
    for (const runsWithSiri of [false, true]) {
      for (const refreshRequested of [false, true]) {
        for (const error of [null, new Error('permission')]) {
          const calls = [];
          const widget = { presentMedium: async () => calls.push('preview') };
          const context = {
            config: { runsInWidget, runsWithSiri }, refreshRequested,
            loadResult: { error }, widget,
            showPermissionHelp: async () => calls.push('permission'),
            Script: { setWidget: value => { assert.equal(value, widget); calls.push('widget'); }, complete: () => calls.push('complete') },
            Safari: { open: url => calls.push(url) }
          };
          await vm.runInNewContext(`(async () => {${launch}${branch}})()`, context);
          const expected = runsInWidget || runsWithSiri
            ? ['widget', 'complete']
            : [...(error ? ['permission'] : []), ...(refreshRequested ? ['widget', 'across://'] : ['preview']), 'complete'];
          assert.deepEqual(calls, expected);
          cases++;
        }
      }
    }
  }
  console.log(`OK: ${cases} tap/background/Siri/preview/permission variants; widget refresh precedes Across launch.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
