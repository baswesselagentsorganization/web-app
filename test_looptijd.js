const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const appCode = fs.readFileSync('app.js', 'utf8');

function makeEl() {
  return {
    className: '', textContent: '', dataset: {}, children: [], style: { setProperty() {} },
    appendChild(child) { this.children.push(child); },
    setAttribute() {}, addEventListener() {}, querySelector() { return null; }
  };
}

const context = {
  document: {
    createElement: makeEl,
    createElementNS: () => makeEl(),
    querySelectorAll: () => [],
    getElementById: () => makeEl(),
    addEventListener() {},
    documentElement: { classList: { add() {} } }
  },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }), self: {}, top: {} },
  navigator: {}, setInterval() {}, fetch: () => Promise.resolve({ ok: true }), console,
  localStorage: { getItem: () => null }
};
vm.createContext(context);
vm.runInContext(appCode, context);

const format = vm.runInContext('formatLooptijd', context);
const nu = '2025-01-01T02:00:00Z';
const startFor = minutes => new Date(Date.parse(nu) - minutes * 60000).toISOString();
assert.strictEqual(format(startFor(0.5), nu), '<1 min');
assert.strictEqual(format(startFor(1), nu), '1 min');
assert.strictEqual(format(startFor(12), nu), '12 min');
assert.strictEqual(format(startFor(59), nu), '59 min');
assert.strictEqual(format(startFor(60), nu), '1 u');
assert.strictEqual(format(startFor(65), nu), '1 u 5 min');
assert.strictEqual(format(startFor(120), nu), '2 u');
assert.strictEqual(format('ongeldig', nu), '');
assert.strictEqual(format('', nu), '');
assert.strictEqual(format('2025-01-01T03:00:00Z', nu), '<1 min');

const maakKaart = vm.runInContext('maakKaart', context);
const NativeDate = Date;
context.Date = class extends NativeDate {
  constructor(value) { super(value === undefined ? nu : value); }
  static parse(value) { return NativeDate.parse(value); }
};
const findDuration = kaart => kaart.children
  .flatMap(child => child.children || [])
  .find(child => child.className === 'taak-looptijd');
const bezig = maakKaart({ id: 1, titel: 'Bezig', status: 'bezig', agent: 'test', bezig_sinds: startFor(12) });
assert.strictEqual(findDuration(bezig).textContent, 'Bezig: 12 min');
const klaar = maakKaart({ id: 2, titel: 'Klaar', status: 'klaar', agent: 'test', bezig_sinds: startFor(12) });
assert.strictEqual(findDuration(klaar), undefined);
const zonderStart = maakKaart({ id: 3, titel: 'Bezig zonder start', status: 'bezig', agent: 'test' });
assert.strictEqual(findDuration(zonderStart), undefined);

console.log('test_looptijd.js: all tests passed');
