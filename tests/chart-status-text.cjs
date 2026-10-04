// Charts sem contagem auxiliar de tempo; números legítimos do título intactos.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'Calendar Timeline'), 'utf8');
const now = new Date('2026-10-03T10:00:00Z');
const context = {now, SETTINGS: {showEventMetadataIcons: true}};
vm.createContext(context);
function load(name) {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const next = source.slice(start + 1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start, next < 0 ? source.length : start + next + 1), context);
}
for (const name of ['currentEventCountdown', 'timelineItemStatus', 'eventMetadataText',
  'reminderPriorityPrefix', 'drawTimelineItem']) load(name);
for (const [minutes, expected] of [[-1, '0 MIN'], [0, '0 MIN'], [0.1, '1 MIN'],
  [59, '59 MIN'], [59.1, '1H'], [60, '1H'], [61, '1H1'], [125, '2H5'], [240, '4H']]) {
  const end = new Date(now.getTime() + minutes * 60000);
  assert.equal(context.currentEventCountdown(end), expected);
  assert.equal(context.timelineItemStatus({isCurrentEvent: true, end}), '');
}
assert.equal(context.timelineItemStatus({isCurrentEvent: true,
  end: new Date(now.getTime() + 125 * 60000), conflictCount: 2}), '×3');
assert.equal(context.timelineItemStatus({isNextEvent: true}), '');
assert.equal(context.timelineItemStatus({kind: 'reminder', isOverdue: true}), '');
assert.equal(context.timelineItemStatus({kind: 'reminder', conflictCount: 1}), '×2');
assert.equal(context.eventMetadataText({kind: 'event', location: 'Local fictício',
  hasVideoLink: true, attendeeCount: 2, availability: 'tentative'}), '⌖  ▶  ◉  ?');

class Rect { constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); } }
class Point { constructor(x, y) { Object.assign(this, {x, y}); } }
class Color { static white() { return new Color(); } }
const titles = [], statuses = [], bars = [], styles = [];
Object.assign(context, {Rect, Point, Color,
  Font: {blackRoundedSystemFont: size => size},
  isCompactMode: () => false, scaleFontSize: size => size, scaleVertical: size => size,
  isBirthdayGroup: () => false, isBirthdayItem: () => false,
  timelineBarHeight: () => 36,
  timelineItemBarSegmentsForDisplay: () => [{x: 100, width: 700}],
  timelineVisibleContentBounds: () => ({left: 4, right: 1088}),
  estimatedTextWidth: (text, size) => text.length * size * 0.62,
  drawTimelineBar: (_, rect) => bars.push(rect),
  drawReminderMarker() {}, drawPendingDayCarryoverBorder() {},
  drawTimelineTitleClipped: (_, title, point, size, style) => {
    titles.push({title, point, size}); styles.push(style);
  },
  drawOutlinedTimelineTextInRect: (_, text) => statuses.push(text),
});
const ctx = {setTextAlignedCenter() {}, setFont() {}, setTextColor() {},
  drawTextInRect: text => statuses.push(text)};
context.currentEventCountdown = () => assert.fail('O chart não deve pedir contagem de tempo.');
for (const [kind, state] of [['event', 'current'], ['event', 'soon'],
  ['event', 'normal'], ['reminder', 'overdue']]) {
  titles.length = statuses.length = bars.length = styles.length = 0;
  const item = {kind, title: 'Agora e depois · Em casa', layoutRows: 5,
    color: '#FF0000', end: new Date(now.getTime() + 125 * 60000),
    isCurrentEvent: state === 'current', isStartingSoon: state === 'soon',
    isOverdue: state === 'overdue', priority: 0};
  const original = JSON.stringify(item);
  context.drawTimelineItem(ctx, item, 40, 44);
  const prefix = kind === 'reminder' ? '!! ' : '';
  assert.equal(titles[0].title, prefix + 'AGORA E DEPOIS · EM CASA',
    'Palavras legítimas do título permanecem intactas.');
  assert.equal(titles[0].size, 28);
  assert.equal(bars[0].x, 100);
  assert.equal(bars[0].width, 700);
  assert.equal(JSON.stringify(item), original);
  assert.deepEqual(statuses, []);
  assert.equal(styles[0].emphasized, state === 'current' || state === 'soon');
  assert.equal(styles[0].fillColor, state === 'soon' ? '#FF1F1F' : '#FFFFFF');
  assert.equal(styles[0].outlineColor, state === 'soon' ? '#FFFFFF' : '#000000');
}
// Minutos, horas exatas, horas+minutos e horizontes longos nos dois layouts.
let cases = 0;
for (const compact of [false, true]) for (const rows of [5, 6]) {
  context.isCompactMode = () => compact;
  context.compactTimelineFontSize = size => size;
  for (const minutes of [0, 0.1, 59, 60, 61, 125, 240, 1440, 5760]) {
    for (const state of ['current', 'next', 'soon']) {
      titles.length = statuses.length = bars.length = styles.length = 0;
      const title = 'Curso 2H5 · 10:30 · 59 MIN';
      context.drawTimelineItem(ctx, {kind: 'event', title, color: '#FF0000',
        layoutRows: rows, end: new Date(now.getTime() + minutes * 60000),
        isCurrentEvent: state === 'current', isNextEvent: state === 'next',
        isStartingSoon: state === 'soon'}, 40, 44);
      assert.equal(titles[0].title, title.toLocaleUpperCase('pt-BR'));
      assert.deepEqual(statuses, [], 'Nenhuma contagem é sobreposta ao título.');
      assert.equal(bars[0].width, 700);
      cases++;
    }
  }
}
context.isCompactMode = () => false;
statuses.length = 0;
context.drawTimelineItem(ctx, {kind: 'event', title: 'Curso 10:30', color: '#FF0000',
  layoutRows: 5, isCurrentEvent: true, conflictCount: 1,
  location: 'Local fictício', hasVideoLink: true, attendeeCount: 2,
  availability: 'tentative', end: new Date(now.getTime() + 125 * 60000)}, 40, 44);
assert.deepEqual(statuses, ['×2', '⌖  ▶  ◉  ?'],
  'Contadores e ícones não relacionados ao tempo permanecem no renderer.');
console.log(`OK: ${cases} variantes sem tempo auxiliar nos charts; números dos títulos, conflitos, ícones e estados visuais preservados.`);
