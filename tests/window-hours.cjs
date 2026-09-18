// Verifica o contrato da janela móvel sem executar o bloco principal do Scriptable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'Calendar Timeline'),
  'utf8'
);

const context = {
  SETTINGS: {
    defaultWindowHours: 24,
    maximumWindowHours: 96,
  },
};
vm.createContext(context);

const start = source.indexOf('function parseWindowHours(');
const end = source.indexOf('function calendarURL(', start);
assert(start >= 0 && end > start, 'Localizar parser da janela.');
vm.runInContext(source.slice(start, end), context);

const cases = [
  [undefined, 24],
  ['', 24],
  ['texto', 24],
  ['0', 24],
  ['-1', 24],
  ['1.5', 24],
  ['1', 1],
  ['12', 12],
  ['24', 24],
  ['25', 25],
  ['36', 36],
  ['48', 48],
  ['72', 72],
  ['96', 96],
  ['97', 96],
  ['168', 96],
  [' 24 ', 24],
];

for (const [input, expected] of cases) {
  assert.equal(
    context.parseWindowHours(input),
    expected,
    `Janela inválida para ${String(input)}`
  );
}

console.log('OK: janela aceita 1–96 horas e limita entradas fora do contrato.');
