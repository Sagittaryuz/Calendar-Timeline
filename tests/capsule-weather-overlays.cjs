const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'Calendar Timeline'), 'utf8');
const context = {
  Date, now: new Date('2026-09-22T18:00:00Z'),
  windowStart: new Date('2026-09-22T18:00:00Z'),
  windowEnd: new Date('2026-09-24T18:00:00Z'),
  CANVAS: {plotLeft: 30}, loadResult: {holidayDates: new Set()},
  startOfDay: d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())),
  addDays: (d,n) => new Date(+d+n*86400000),
  timeToX: d => (+d-Date.parse('2026-09-22T18:00:00Z'))/3600000,
  dayBoundaryLineColor: () => ({hex: 'FFFFFF'}),
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function formatEventArrivalHours('), source.indexOf('function eventArrivalGuidesForDay(')), context);
vm.runInContext(source.slice(source.indexOf('function dayEndCapsuleEntries('), source.indexOf('async function drawDayEndCapsules(')), context);
const entries = context.dayEndCapsuleEntries();
assert.deepEqual(Array.from(entries, e => e.label), ['6 h', '24 h']);
assert.equal(entries[0].x, 36);
assert.equal(entries[0].color, 'FFFFFF');
const widget = source.slice(source.indexOf('async function renderWidget('), source.indexOf('function dayEndCapsuleEntries('));
assert(widget.indexOf('await drawDayEndCapsules(contentCtx)') > widget.indexOf('drawDayBoundaryMoonBordersOnForeground(contentCtx)'));
assert(widget.indexOf('drawCurrentDayBoundaryBadgeOnForeground(contentCtx)') > widget.indexOf('drawCurrentDayFrameOverlay(contentCtx, items)'));
const badges = source.slice(source.indexOf('function drawWeekdayBadgesOnTop('), source.indexOf('function drawFixedDaylightGlow('));
assert(badges.includes('dateKey(tick)') && badges.includes('continue;'));
assert(source.includes('g.rotate(Math.PI / 2)'));
assert(source.includes('const height = DAY_CHANGE_CIRCLE_DIAMETER;'));
assert(source.includes('let fontSize = ${scaleFontSize(24)}'));
assert(source.includes('const labelScale = Math.min(1'));
const diagonal = source.slice(source.indexOf('async function drawDiagonalWeekdayLabels('), source.indexOf('async function rasterizeDiagonalWeekdayLabels('));
assert(diagonal.includes('if (!shouldBlurFutureTimeline()) return;'));
assert(diagonal.includes('Math.max(entry.x0, boundaryX)'));
const calls = [];
context.Point = class { constructor(x,y) {this.x=x;this.y=y;} };
context.Path = class {
  move(p) {calls.push(['move',p]);} addLine(p) {calls.push(['line',p]);}
  addCurve(...p) {calls.push(['curve',...p]);} closeSubpath() {}
};
vm.runInContext(source.slice(source.indexOf('function drawRainTopMarker('), source.indexOf('function drawThermalRainBars(')), context);
const ctx = {setFillColor() {},addPath() {},fillPath() {}};
context.drawRainTopMarker(ctx, 50, 20, 15, 6, false, 'blue');
assert.equal(calls[0][1].y,20);
assert.equal(calls.filter(c=>c[0]==='curve').length,2);
calls.length=0;
context.drawRainTopMarker(ctx, 50, 20, 20, 6, true, 'blue');
assert.equal(calls[0][1].y,20);
assert.equal(calls.filter(c=>c[0]==='curve').length,0);
assert.equal(calls.filter(c=>c[0]==='line').length,5);
assert(source.includes('Math.floor(entry.timestamp / quarterHourMilliseconds) % 2 === 0'));
console.log('OK: cápsula, camadas, condição de blur, geometria das gotas e raios.');
