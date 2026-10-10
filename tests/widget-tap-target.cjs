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
assert.match(source, /refreshSeconds: 15 \* 60/);
assert.doesNotMatch(source, /drawWidgetBuildVersion|sourceFreshnessText|showRefreshResult|refreshWidgetURL/);
assert.deepEqual(Array.from(source.matchAll(/\b(\w+)\.url\s*=/g),match=>match[1]),['widget'],
  'Nenhuma URL em elemento filho sobrepõe o Calendário.');
// Run the production completion branch with Scriptable API doubles.
// This verifies dispatch/order, not native iOS URL handling.
const vm = require('node:vm');
const branch = source.slice(source.indexOf('if (config.runsInWidget || config.runsWithSiri) {'), source.indexOf('async function loadWindow()'));
const widgetURL = source.slice(source.indexOf('widget.url ='), source.indexOf('widget.refreshAfterDate'));
function declaration(name) {
 const start=source.indexOf('function '+name+'(');
 const end=source.slice(start+1).search(/\n(?:async )?function /);
 return source.slice(start,start+end+1);
}
const launch=declaration('nativeCalendarURL');
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
            windowHours:48,
            args: {queryParameters:{tapURL:'legacy-third-party://'}},
            Keychain: {contains:()=>{assert.fail('Destino não deve ler ou apagar preferências salvas.');}},
            loadResult: { error }, widget,
            showPermissionHelp: async () => calls.push('permission'),
            showRefreshResult:async()=>assert.fail('Não deve abrir alerta de atualização.'),
            hourlyWeather:{},
            Script: { name:()=> 'Calendário + Timeline', setWidget: value => { assert.equal(value, widget); calls.push('widget'); }, complete: () => calls.push('complete') },
            Safari: { open: url => calls.push(url) }
          };
          await vm.runInNewContext(`(async () => {${launch}${widgetURL}${branch}})()`, context);
          const expected = runsInWidget || runsWithSiri
            ? ['widget', 'complete']
            : [...(error && !refreshRequested ? ['permission'] : []), ...(refreshRequested ? ['widget', 'calshow://'] : ['preview']), 'complete'];
          assert.deepEqual(calls, expected);
          assert.equal(widget.url,'calshow://', 'O toque abre o Calendário diretamente sem Scriptable.');
          cases++;
        }
      }
    }
  }
  console.log(`OK: ${cases} variantes; toque direto no Calendário, links antigos sem alerta/prévia, nenhuma URL filha e nenhum texto visual de versão/frescor.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
