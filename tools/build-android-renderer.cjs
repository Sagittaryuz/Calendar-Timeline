// Keep the original Scriptable distribution untouched. Only replace its platform entry point.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Calendar Timeline'), 'utf8');
const start = source.indexOf('const now = new Date();');
const end = source.indexOf('async function loadWindow()');
if (start < 0 || end < start) throw Error('Scriptable entry point changed; review Android adapter.');
const entry = `
const now = new Date(input.now || Date.now()); now.setSeconds(0,0);
const refreshRequested = false;
SETTINGS.useCurrentLocation = false;
SETTINGS.automaticHolidays = false;
const windowHours = parseWindowHours(input.hours);
const windowStart = new Date(now);
const windowEnd = new Date(+now + windowHours * 3600000);
const loadResult = await loadLiveWindow();
if (loadResult.error) throw Error(loadResult.error);
const astronomy = {latitude:input.latitude ?? SETTINGS.fallbackLatitude, longitude:input.longitude ?? SETTINGS.fallbackLongitude};
let weather = {hours:[],daily:{}};
if (input.weatherResponse) weather = await loadOpenMeteoWeather(astronomy);
if (input.weather) weather = input.weather;
const hourlyWeather = buildHourlyWeather(weather.hours, weather.daily);
const nightTextures = emptyNightTextures();
const preparedItems = prepareTimelineItems(loadResult.items, now);
const timelineRowCounts = prepareTimelineRowCounts(preparedItems);
const selectedItems = chooseItems(preparedItems, now, SETTINGS.maxItems, timelineRowCounts);
const image = await renderWidget(selectedItems, null);
return {image, count:loadResult.items.length, version:WIDGET_BUILD_VERSION, weatherHours:weather.hours.length, weatherDays:Object.keys(weather.daily).length};
`;
let compatibleSource = source.slice(end);
// Android 11's bundled WebView 83 understands ES2020, before logical assignment.
// These collectors are not invoked on Android, but their syntax must still parse.
for (const [before, after] of [
  ['live.sourceStatus ??= {event: false, reminder: false};', 'if (live.sourceStatus == null) live.sourceStatus = {event: false, reminder: false};'],
  ['live.scheduleCountsByDay[day] ??= {events: 0, reminders: 0};', 'if (live.scheduleCountsByDay[day] == null) live.scheduleCountsByDay[day] = {events: 0, reminders: 0};'],
  ['interval.storm ||= /thunder|storm/.test(precipitationType);', 'if (!interval.storm) interval.storm = /thunder|storm/.test(precipitationType);'],
]) {
  if (compatibleSource.split(before).length !== 2) throw Error('Review Android syntax adaptation: ' + before);
  compatibleSource = compatibleSource.replace(before, after);
}
if (/\?\?=|\|\|=|&&=/.test(compatibleSource)) throw Error('New ES2021 syntax requires Android review.');
const output = path.join(root, 'android/app/src/main/assets');fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'renderer.js'), '/* Generated from Calendar Timeline; do not edit. */\nwindow.renderTimeline = async function(input) {\n' + source.slice(0,start).replace('const THEME_MODE = "black";', 'const THEME_MODE = input.theme === "dark" ? "dark" : "black";') + entry + compatibleSource + '\n};\n');
for (const f of ['index.html','scriptable-adapter.js','demo.js']) fs.copyFileSync(path.join(root,'android/renderer',f),path.join(output,f));
fs.writeFileSync(path.join(output,'renderer-origin.json'),JSON.stringify({source:'Calendar Timeline',sha256:crypto.createHash('sha256').update(source).digest('hex')})+'\n');
