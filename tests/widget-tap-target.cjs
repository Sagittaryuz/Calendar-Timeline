const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

assert.match(source, /widget\.url\s*=\s*refreshWidgetURL\(\);/);
assert.match(source, /widget\.refreshAfterDate\s*=\s*new Date\(/);
assert.match(source, /function nativeCalendarURL\(\)[\s\S]*?return "calshow:\/\/";/);
assert.doesNotMatch(source, /across/i);
assert.match(source, /refreshSeconds: 15 \* 60/);
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
const launch=['nativeCalendarURL','refreshWidgetURL','addURLParameter'].map(declaration).join('\n');
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
            showRefreshResult:async()=>calls.push('freshness/calendar-choice'),
            hourlyWeather:{},
            Script: { name:()=> 'Calendário + Timeline', setWidget: value => { assert.equal(value, widget); calls.push('widget'); }, complete: () => calls.push('complete') },
            Safari: { open: url => calls.push(url) }
          };
          await vm.runInNewContext(`(async () => {${launch}${widgetURL}${branch}})()`, context);
          const expected = runsInWidget || runsWithSiri
            ? ['widget', 'complete']
            : [...(error ? ['permission'] : []), ...(refreshRequested ? ['widget', 'freshness/calendar-choice'] : ['preview']), 'complete'];
          assert.deepEqual(calls, expected);
          assert.equal(widget.url,'scriptable:///run?scriptName=Calend%C3%A1rio%20%2B%20Timeline&refresh=1&hours=48', 'O nome atual do carregador e a janela são preservados.');
          cases++;
        }
      }
    }
  }
  console.log(`OK: ${cases} tap/background/Siri/preview/permission variants; toque executa o carregador com refresh e janela preservada; Calendário separado no resultado.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
