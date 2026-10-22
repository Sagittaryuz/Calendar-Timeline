// Builds the Scripting edition from the tracked Scriptable source, never a remote eval.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Calendar Timeline'), 'utf8');
const dest = path.join(root, 'scripting', 'scripts', 'Calendar Timeline Scripting');
fs.mkdirSync(dest, {recursive:true});
let code = source;
function replaceOnce(from, to) {
  if (!code.includes(from)) throw new Error('Source contract changed: ' + from.slice(0, 100));
  code = code.replace(from, to);
}
replaceOnce('const now = new Date();', 'const now = new Date(options.now ?? Date.now());');
replaceOnce('const windowStart = new Date(now);', 'const windowStart = new Date(options.focusDate ?? now);');
replaceOnce('const loadResult = await loadWindow();', 'const loadResult = options.loadResult ?? await loadWindow();');
replaceOnce('const astronomy = await loadAstronomy();', 'const astronomy = options.astronomy ?? await loadAstronomy();');
replaceOnce('const hourlyWeather = isAccessoryFamily(widgetFamily)', 'const hourlyWeather = options.hourlyWeather ?? (isAccessoryFamily(widgetFamily)');
replaceOnce(': await loadHourlyWeather(astronomy);', ': await loadHourlyWeather(astronomy));');
replaceOnce('const automaticHolidayDates = await loadAutomaticHolidays(astronomy);', 'const automaticHolidayDates = options.holidayDates ?? await loadAutomaticHolidays(astronomy);');
const finishStart = code.indexOf('// URL explícita abre diretamente');
const finishEnd = code.indexOf('Script.complete();', finishStart) + 'Script.complete();'.length;
if (finishStart < 0 || finishEnd < finishStart) throw new Error('Missing entry boundary');
code = code.slice(0, finishStart) + `
const header = [];
const focusDay = startOfDay(windowStart);
for (let offset = -6; offset <= 6; offset++) {
  const date = addDays(focusDay, offset);
  const rect = titleDayCardRect(titleTodayCardIndex() + offset);
  const left = Math.max(0, rect.x), right = Math.min(CANVAS.width, rect.x + rect.width);
  if (right > left) header.push({date: dateKey(date), label: shortWeekday(date),
    x: left, y: rect.y, width: right-left, height: rect.height, selected: offset === 0});
}
return {image: widget.backgroundImage, header, width: CANVAS.width, height: CANVAS.height,
  version: WIDGET_BUILD_VERSION, focusDate: dateKey(windowStart),
  sourceStatus: {schedule: loadResult.sourceStatus, partialErrors: loadResult.partialErrors,
    weather: hourlyWeather.freshness}, weatherSnapshot: hourlyWeather, locationSnapshot: astronomy};
` + code.slice(finishEnd);
// Preserve the original downsample blur intent as a separate native blurred layer.
const softStart = code.indexOf('function softenTimelineImage(');
const softEnd = code.indexOf('\nfunction currentDayBoundaryBadgeCenterY', softStart);
if (softStart < 0 || softEnd < 0) throw new Error('Missing blur boundary');
code = code.slice(0, softStart) + `function softenTimelineImage(image, width, height) {
  return {...image, blurRadius: 1 / Math.max(0.12, Number(SETTINGS.futureTimelineBlurDownsampleFactor) || 0.24)};
}
` + code.slice(softEnd);
// Replace the WebView-dependent capsule with an equivalent native Canvas draw.
const capsuleStart=code.indexOf('async function drawDayEndCapsules(');
const capsuleEnd=code.indexOf('\nfunction shouldBlurFutureTimeline',capsuleStart);
if(capsuleStart<0||capsuleEnd<0)throw new Error('Missing capsule boundary');
code=code.slice(0,capsuleStart)+`async function drawDayEndCapsules(ctx) {
  const entries = dayEndCapsuleEntries();
  if (!entries.length) return;
  ctx.flushRects?.();
  ctx.ops.push({type:'capsules',entries,height:DAY_CHANGE_CIRCLE_DIAMETER,
    width:scaleVertical(24),fontSize:scaleFontSize(24),
    centerY:CANVAS.timelineTop+(weatherIconCenterY()+bottomLegendCenterY())/2});
}
`+code.slice(capsuleEnd);
// Extract the project's original browser-Canvas diagonal typography at build
// time. The resulting module is ordinary reviewed source, with no runtime eval.
const rasterStart=source.indexOf('async function rasterizeDiagonalWeekdayLabels(');
const expressionStart=source.indexOf('const javascript = [',rasterStart)+'const javascript = '.length;
const expressionEnd=source.indexOf('].join("\\n");',expressionStart)+'].join("\\n")'.length;
if(expressionStart<0||expressionEnd<expressionStart)throw new Error('Missing diagonal Canvas expression');
const expression=source.slice(expressionStart,expressionEnd);
let nativeDrawing=new Function('entries','width','height','scaleFontSize','isCompactMode','isExtendedDetailedMode','VERTICAL_LAYOUT_SCALE',
  'return '+expression)([],1092,510,n=>n,()=>false,()=>false,1);
nativeDrawing=nativeDrawing.slice(nativeDrawing.indexOf('  const gridTop'),nativeDrawing.lastIndexOf("  return canvas.toDataURL"));
nativeDrawing=nativeDrawing.replace('const minFontSize = 30','const minFontSize = options.minFontSize')
 .replace('const minDateFontSize = 12','const minDateFontSize = options.minDateFontSize')
 .replace('const maxFontSize = 132','const maxFontSize = options.maxFontSize')
 .replace('const verticalScale = 1.05','const verticalScale = options.verticalScale');
fs.writeFileSync(path.join(dest,'diagonal-canvas.js'),`// @ts-nocheck\n// Generated from original rasterizeDiagonalWeekdayLabels. No runtime eval.\nexport function drawDiagonal(context, entries, options) {\nconst canvasWidth=options.width;\n${nativeDrawing}\n}\n`);
const diagonalStart=code.indexOf('async function drawDiagonalWeekdayLabels(ctx)');
const diagonalEnd=code.indexOf('\nasync function rasterizeDiagonalWeekdayLabels',diagonalStart);
if(diagonalStart<0||diagonalEnd<0)throw new Error('Missing diagonal entry');
code=code.slice(0,diagonalStart)+`async function drawDiagonalWeekdayLabels(ctx) {
  if(!shouldBlurFutureTimeline())return;
  const boundaryX=Math.max(0,timeToX(addDays(startOfDay(windowStart),1)));
  const entries=diagonalWeekdayLabelEntries().filter(e=>e.x1>boundaryX)
    .map(e=>({...e,x0:Math.max(e.x0,boundaryX)}));
  ctx.flushRects?.();
  if(entries.length)ctx.ops.push({type:'diagonal',entries,options:{width:timelineWidth(),
    minFontSize:scaleFontSize(isCompactMode()?26:30),minDateFontSize:scaleFontSize(12),
    maxFontSize:scaleFontSize(isCompactMode()?92:isExtendedDetailedMode()?108:132),
    verticalScale:1.05*VERTICAL_LAYOUT_SCALE}});
}
`+code.slice(diagonalEnd);
const symbols = ['DrawContext','Size','Point','Rect','Path','Color','Font','DateFormatter',
 'CalendarEvent','Reminder','FileManager','Keychain','Location','Request','SFSymbol','Data','Image','Timer'];
const output = `// @ts-nocheck\n// Generated by tools/build-scripting.cjs; edit the generator or original source.\n// Source SHA-256: ${crypto.createHash('sha256').update(source).digest('hex')}\nexport async function renderOriginal(host, options = {}) {\nconst {${symbols.join(',')}} = host;\nconst config = {runsInWidget: true, widgetFamily: 'medium'};\nconst args = {queryParameters: {}, widgetParameter: options.hours ?? '24'};\nconst Script = {name: () => 'Calendar Timeline Scripting'};\nconst ListWidget = class {setPadding() {}};\n${code}\n}\n`;
fs.writeFileSync(path.join(dest, 'original-engine.js'), output.replace(/[\t ]+$/gm,''));
console.log('Built original-engine.js from tracked source (' + output.length + ' chars)');
