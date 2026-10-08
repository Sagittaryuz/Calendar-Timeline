const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /widget\.url\s*=\s*nativeCalendarURL\(\);/);
assert.match(source, /widget\.refreshAfterDate\s*=\s*new Date\(/);
assert.match(source, /function nativeCalendarURL\(\)[\s\S]*?return "calshow:\/\/";/);
assert.doesNotMatch(source, /across/i);
assert.doesNotMatch(source, /widget\.url\s*=\s*refreshURL/);
// Run the production completion branch with Scriptable API doubles.
// This verifies dispatch/order, not native iOS URL handling.
const vm = require('node:vm');
const branch = source.slice(source.indexOf('if (config.runsInWidget || config.runsWithSiri) {'), source.indexOf('async function loadWindow()'));
const widgetURL = source.slice(source.indexOf('widget.url ='), source.indexOf('widget.refreshAfterDate'));
const launch = source.slice(source.indexOf('function nativeCalendarURL() {'), source.indexOf('function addURLParameter'));
(async () => {
  let cases = 0;
  for (const runsInWidget of [false, true]) {
    for (const runsWithSiri of [false, true]) {
      for (const refreshRequested of [false, true]) {
        for (const error of [null, new Error('permission')]) {
          const calls = [];
          const widget = { url: 'legacy-third-party://', presentMedium: async () => calls.push('preview') };
          const context = {
            config: { runsInWidget, runsWithSiri, tapURL: 'legacy-third-party://' }, refreshRequested,
            args: {queryParameters:{tapURL:'legacy-third-party://'}},
            Keychain: {contains:()=>{assert.fail('Destino não deve ler ou apagar preferências salvas.');}},
            loadResult: { error }, widget,
            showPermissionHelp: async () => calls.push('permission'),
            Script: { setWidget: value => { assert.equal(value, widget); calls.push('widget'); }, complete: () => calls.push('complete') },
            Safari: { open: url => calls.push(url) }
          };
          await vm.runInNewContext(`(async () => {${launch}${widgetURL}${branch}})()`, context);
          const expected = runsInWidget || runsWithSiri
            ? ['widget', 'complete']
            : [...(error ? ['permission'] : []), ...(refreshRequested ? ['widget', 'calshow://'] : ['preview']), 'complete'];
          assert.deepEqual(calls, expected);
          assert.equal(widget.url, 'calshow://', 'URL explícita substitui o destino antigo sem alterar preferências.');
          cases++;
        }
      }
    }
  }
  console.log(`OK: ${cases} tap/background/Siri/preview/permission variants; widget refresh precedes Calendar launch from legacy refresh links.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
