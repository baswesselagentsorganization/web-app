// Tests for showing/hiding archived tasks (filterTaken + toggle button).
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const btn = { textContent: 'Toon gearchiveerd', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
const context = {
  localStorage: { getItem: () => '["2"]', setItem: () => {} },
  document: {
    getElementById: (id) => id === 'btn-toon-gearchiveerd' ? btn : { appendChild() {}, set textContent(v) {}, style: {} },
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }),
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: false }) },
  navigator: {}, setInterval: () => {}, console,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [] }) })
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const filterTaken = vm.runInContext('filterTaken', context);

const data = [
  { id: 1, status: 'klaar', titel: 'Alpha' },
  { id: 2, status: 'klaar', titel: 'Beta' },
  { id: 3, status: 'mislukt', titel: 'Gamma' },
  { id: 4, status: 'bezig', titel: 'Beta twee' }
];
const ids = (l) => l.map(t => t.id).join(',');

// Default: archived (id 2) hidden
assert.strictEqual(ids(filterTaken(data, 'alle', '', ['2'], 'alle')), '1,3,4');
assert.strictEqual(ids(filterTaken(data, 'alle', '', ['2'], 'alle', false)), '1,3,4');
// Shown
assert.strictEqual(ids(filterTaken(data, 'alle', '', ['2'], 'alle', true)), '1,2,3,4');
// Combined with search and status filter
assert.strictEqual(ids(filterTaken(data, 'alle', 'beta', ['2'], 'alle', false)), '4');
assert.strictEqual(ids(filterTaken(data, 'alle', 'beta', ['2'], 'alle', true)), '2,4');
assert.strictEqual(ids(filterTaken(data, 'klaar', '', ['2'], 'alle', true)), '1,2');
assert.strictEqual(ids(filterTaken(data, 'klaar', '', ['2'], 'alle', false)), '1');

// Toggle button text and state
assert.strictEqual(vm.runInContext('toonGearchiveerd', context), false);
context.setToonGearchiveerd(true);
assert.strictEqual(btn.textContent, 'Verberg gearchiveerd');
assert.strictEqual(btn.attrs['aria-pressed'], 'true');
assert.strictEqual(vm.runInContext('toonGearchiveerd', context), true);
context.setToonGearchiveerd(false);
assert.strictEqual(btn.textContent, 'Toon gearchiveerd');
assert.strictEqual(btn.attrs['aria-pressed'], 'false');

console.log('test_toon_gearchiveerd: all tests passed');
