// Contrato Scriptable e composição geométrica com glifos sintéticos.
// Não substitui a conferência de rasterização/fonte no iPhone.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'Calendar Timeline'), 'utf8');
class Point { constructor(x, y) { Object.assign(this, {x, y}); } }
class Rect { constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); } }
class Size { constructor(width, height) { Object.assign(this, {width, height}); } }
class Color {
  constructor(hex, opacity = 1) { Object.assign(this, {hex, opacity}); }
  static white() { return new Color('#FFFFFF'); }
}
const layers = [];
const textCalls = [];
class DrawContext {
  constructor() { this.shapes = []; layers.push(this); }
  setTextAlignedLeft() {}
  setFont(font) { this.font = font; }
  setTextColor(color) { this.color = color; }
  drawTextInRect() { assert.fail('Títulos não podem usar layout retangular de texto.'); }
  drawText(text, point) {
    textCalls.push({text, point, size: this.font.size, color: this.color});
    let x = point.x;
    // Glifos de largura fixa permitem verificar partes de um caractere,
    // sem atribuir métricas reais a SF Rounded nem interpretar Unicode.
    for (const character of text) {
      if (character !== ' ') this.shapes.push({x, y: point.y + 4,
        width: 13, height: 12, color: this.color});
      x += 14;
    }
  }
  drawImageAtPoint(image, point) {
    for (const shape of image.shapes) {
      const x = Math.max(0, shape.x + point.x);
      const y = Math.max(0, shape.y + point.y);
      const right = Math.min(this.size.width, shape.x + point.x + shape.width);
      const bottom = Math.min(this.size.height, shape.y + point.y + shape.height);
      if (right > x && bottom > y) this.shapes.push({...shape, x, y,
        width: right - x, height: bottom - y});
    }
  }
  getImage() { return {shapes: this.shapes.map(shape => ({...shape}))}; }
}
const c = {Point, Rect, Size, Color, DrawContext,
  Font: {blackRoundedSystemFont: size => ({size})},
  SETTINGS: {maxItems: 6}, windowStart: new Date('2026-10-05T00:00:00Z')};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('const WIDGET_CANVAS_HEIGHT'),
  source.indexOf('const now =')), c);
function load(name) {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const next = source.slice(start + 1).search(/\n(?:async )?function /);
  vm.runInContext(source.slice(start, next < 0 ? source.length : start + next + 1), c);
}
for (const name of ['timelineWidth', 'timelineHeight', 'drawTimelineTitleClipped',
  'drawOutlinedTimelineText', 'cropTransparentCanvasImage', 'drawTimelineItem',
  'timeToX', 'estimatedTextWidth']) load(name);
const canvas = vm.runInContext('CANVAS', c);
const width = c.timelineWidth();
const height = c.timelineHeight();
const bars = [];
const markers = [];
let segments;
Object.assign(c, {
  isCompactMode: () => false,
  compactTimelineFontSize: value => value,
  timelineBarHeight: item => item.layoutRows === 5 ? 36 : 34,
  timelineItemBarSegmentsForDisplay: () => segments,
  isBirthdayItem: () => false, isBirthdayGroup: () => false,
  timelineItemStatus: () => '', eventMetadataText: () => '',
  reminderPriorityPrefix: item => item.kind === 'reminder' ? '!!! ' : '',
  drawTimelineBar: (_, rect) => bars.push(rect),
  drawPendingDayCarryoverBorder() {},
  drawReminderMarker: (_, x, y, diameter) => markers.push({x, y, diameter}),
});
const titles = ['Sol', 'Evento sintético com um título muito longo '.repeat(6),
  'Ação e Café 👩🏽‍💻 東京 e\u0301'];
let cases = 0;
for (const hours of [24, 48, 72, 96]) {
  c.windowEnd = new Date(c.windowStart.getTime() + hours * 3600000);
  assert.equal(c.timeToX(c.windowEnd), width);
  for (const rows of [5, 6]) for (const state of ['normal', 'current', 'soon', 'reminder']) {
    for (const title of titles) for (const edge of ['left', 'right', 'curve']) {
      const x = edge === 'left' ? -10 : edge === 'right' ? width - 160 : width - 230;
      const barWidth = state === 'reminder' ? 160 : 34;
      segments = [{x, width: barWidth}];
      const y = edge === 'curve' ? height - 50 : 45;
      const item = {kind: state === 'reminder' ? 'reminder' : 'event', title,
        color: '#FF0000', layoutRows: rows,
        isCurrentEvent: state === 'current', isStartingSoon: state === 'soon'};
      const original = JSON.stringify(item);
      layers.length = textCalls.length = bars.length = markers.length = 0;
      const output = new DrawContext();
      output.size = new Size(width, height);
      c.drawTimelineItem(output, item, y, 42);
      assert.equal(JSON.stringify(item), original, 'Dados e duração permanecem intactos.');
      assert.equal(bars[0].x, x);
      assert.equal(bars[0].width, barWidth, 'Nome não amplia o chart.');
      const expected = (state === 'reminder' ? '!!! ' : '') + title.toLocaleUpperCase('pt-BR');
      const fullCalls = textCalls.filter(call => call.text === expected);
      assert.equal(fullCalls.length, state === 'current' || state === 'soon' ? 9 : 2);
      assert(fullCalls.every(call => call.size === c.scaleFontSize(rows === 5 ? 28 : 26)));
      assert(textCalls.every(call => call.text === expected || call.text === '!!!'),
        'Nenhum prefixo truncado, elipse ou Unicode removido.');
      const color = state === 'soon' ? '#FF1F1F' : '#FFFFFF';
      const fill = output.shapes.filter(shape => shape.color.hex === color);
      assert(fill.length > 0);
      for (const shape of output.shapes) {
        for (let pixelY = Math.floor(shape.y); pixelY < Math.ceil(shape.y + shape.height); pixelY++) {
          const inset = c.widgetContourInsetAtY(canvas.timelineTop + pixelY + 0.5, 4);
          assert(shape.x >= Math.max(0, Math.floor(inset - canvas.plotLeft)));
          assert(shape.x + shape.width <= Math.min(width,
            Math.ceil(canvas.width - inset - canvas.plotLeft)), 'Sombras também seguem a curva.');
        }
      }
      if (title === titles[1] && state !== 'reminder') {
        assert(fill.some(shape => shape.x + shape.width > x + 34),
          'Título ocupa pixels além do chart curto.');
        assert(fill.some(shape => shape.width < 13),
          'O glifo na borda aparece parcialmente em vez de desaparecer inteiro.');
      }
      if (state === 'reminder') {
        assert(textCalls.some(call => call.text === '!!!' && call.color.hex === '#FF453A'));
        assert.equal(markers.length, 1);
        const right = x + barWidth - 7;
        assert(output.shapes.every(shape => shape.x + shape.width <= right),
          'Rótulo de lembrete não ultrapassa o fim da barra.');
      }
      cases++;
    }
  }
}
// A curva varia dentro da altura de uma letra; não vira margem retangular fixa.
layers.length = textCalls.length = 0;
const curvedOutput = new DrawContext();
curvedOutput.size = new Size(width, height);
c.drawTimelineTitleClipped(curvedOutput, 'W'.repeat(100),
  new Point(width - 220, height - 38), 28,
  {emphasized: false, priorityPrefix: ''});
const ends = new Set(curvedOutput.shapes.filter(shape => shape.color.hex === '#FFFFFF')
  .map(shape => shape.x + shape.width));
assert(ends.size > 10, 'Recorte acompanha a curva em alturas diferentes.');
assert(layers.slice(1).every(layer => !layer.opaque && !layer.respectScreenScale));
// Mesmo um único glifo com poucos pixels disponíveis precisa aparecer.
for (const x of [-8, width - 9]) {
  const output = new DrawContext();
  output.size = new Size(width, height);
  c.drawTimelineTitleClipped(output, 'W', new Point(x, 45), 28,
    {emphasized: false, priorityPrefix: ''});
  const fill = output.shapes.filter(shape => shape.color.hex === '#FFFFFF');
  assert(fill.length > 0 && fill.every(shape => shape.width > 0 && shape.width < 13));
}
// O caminho compacto conserva sua própria fonte e a largura curta de 18 px.
c.isCompactMode = () => true;
segments = [{x: 100, width: 18}];
for (const rows of [5, 6]) {
  textCalls.length = bars.length = 0;
  const output = new DrawContext();
  output.size = new Size(width, height);
  c.drawTimelineItem(output, {kind: 'event', title: titles[2],
    color: '#FF0000', layoutRows: rows}, 45, 42);
  assert.equal(bars[0].width, 18);
  assert(textCalls.every(call => call.size === (rows === 5 ? 21 : 20)));
  assert(textCalls.every(call => call.text === titles[2].toLocaleUpperCase('pt-BR')));
}
console.log(`OK: ${cases} casos, títulos integrais, fonte/duração/prioridade preservadas e glifos parciais no contorno.`);

// Regressão anônima: lembrete 18h–meia-noite, badge e título longo.
c.isCompactMode=()=>false;
for(const rows of [5,6]) for(const start of [-10,250,width-170]) {
  const end=Math.min(width,start+260);
  const badgeLeft=end-62;
  segments=[{x:start,width:end-start}];
  for(const extra of [{},{isCurrentEvent:true},{isStartingSoon:true},{isOverdue:true}]) {
    layers.length=textCalls.length=bars.length=markers.length=0;
    const output=new DrawContext();output.size=new Size(width,height);
    const item={kind:'reminder',title:'LEMBRETE DE TESTE LONGO '.repeat(8),
      color:'#0088FF',layoutRows:rows,sourceIsAllDay:false,
      start:new Date('2026-10-05T18:00:00Z'),end:new Date('2026-10-06T00:00:00Z'),
      overflowBadgeLeft:badgeLeft,overflowBadgeRight:end,...extra};
    const original=JSON.stringify(item);
    c.drawTimelineItem(output,item,45,42);
    const visibleLeft=Math.max(start,c.timelineVisibleContentBounds(49,34,4).left);
    assert.equal(markers[0].x,visibleLeft+8+c.scaleVertical(12)/2,
      'A bolinha permanece junto à margem esquerda, não depois do +N.');
    const titleCalls=textCalls.filter(call=>call.text.startsWith('!!! LEMBRETE'));
    assert(titleCalls.length>0);
    assert.equal(titleCalls[titleCalls.length-1].point.x,
      visibleLeft+7+c.scaleVertical(12)+5);
    assert(output.shapes.every(shape=>shape.x+shape.width<=Math.floor(badgeLeft-c.scaleVertical(4))),
      'Nem título, prefixo ou sombra invadem +N ou o próximo dia.');
    assert.equal(bars[0].x,start);assert.equal(bars[0].width,end-start);
    assert.equal(JSON.stringify(item),original,'Não muda título, prioridade ou horário.');
  }
}
// Sem badge: recorte termina na barra; com zero espaço não inventa título.
for(const barWidth of [1,18,34,100,260]) {
  layers.length=textCalls.length=markers.length=0;
  segments=[{x:250,width:barWidth}];
  const output=new DrawContext();output.size=new Size(width,height);
  c.drawTimelineItem(output,{kind:'reminder',title:'LEMBRETE DE TESTE LONGO',
    color:'#0088FF',layoutRows:6,sourceIsAllDay:false},45,42);
  assert(output.shapes.every(shape=>shape.x+shape.width<=250+barWidth-7));
  if(barWidth<=18) assert.equal(textCalls.length,0);
}
console.log('OK: margem de lembretes com badge no fim, recorte na barra e horários intactos.');

// O badge se desloca para dentro da curva; o título respeita sua posição final.
{
  c.isCompactMode=()=>false;
  const y=height-50,rowHeight=42,barHeight=34;
  const barY=y+(rowHeight-barHeight)/2;
  const bounds=c.timelineVisibleContentBounds(barY,barHeight);
  const visibleBadgeLeft=bounds.right-62;
  segments=[{x:width-320,width:320}];
  layers.length=textCalls.length=markers.length=0;
  const output=new DrawContext();output.size=new Size(width,height);
  c.drawTimelineItem(output,{kind:'reminder',title:'LEMBRETE DE TESTE LONGO '.repeat(8),
    color:'#0088FF',layoutRows:6,overflowBadgeLeft:width-62,overflowBadgeRight:width},y,rowHeight);
  assert(output.shapes.length>0);
  assert(output.shapes.every(shape=>shape.x+shape.width<=Math.floor(visibleBadgeLeft-c.scaleVertical(4))));
}
