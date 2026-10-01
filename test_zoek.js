// Tests for search + status filtering (filterTaken) and the empty-state message.
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const appCode = fs.readFileSync('app.js', 'utf8');
const lijstEl = { children: [], textContent: '', appendChild(c) { this.children.push(c); } };
const makeEl = () => ({ className: '', textContent: '', style: {}, dataset: {}, children: [],
  appendChild(c) { this.children.push(c); }, setAttribute() {}, addEventListener() {} });
const context = {
  localStorage: { getItem: () => '[]', setItem: () => {} },
  document: {
    getElementById: () => lijstEl,
    createElement: makeEl,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: { addEventListener: () => {} },
  navigator: {},
  setInterval: () => {},
  fetch: () => new Promise(() => {}),
  console
};
vm.createContext(context);
vm.runInContext(appCode, context);
const filterTaken = vm.runInContext('filterTaken', context);
const ids = (r) => r.map(t => t.id).join(',');

const data = [
  { id: 1, titel: 'Bouw Zoekveld', status: 'bezig' },
  { id: 2, titel: 'Fix login', status: 'klaar' },
  { id: 3, titel: 'zoek bug in export', status: 'mislukt' },
  { id: 4, titel: 'Nieuwe taak', status: 'nieuw' },
  { id: 5, titel: 'Oude zoektocht', status: 'klaar' },
  { id: 6, titel: 'Geannuleerd ding', status: 'geannuleerd' },
  { id: 7, titel: 'Wacht', status: 'wacht_op_akkoord' }
];

// search (case-insensitive, substring of the title, trimmed)
assert.strictEqual(ids(filterTaken(data, 'alle', 'ZOEK', [])), '1,3,5');
assert.strictEqual(ids(filterTaken(data, 'alle', '  login ', [])), '2');
assert.strictEqual(ids(filterTaken(data, 'alle', '', [])), '1,2,3,4,5,6,7');
assert.strictEqual(ids(filterTaken(data, 'alle', 'bestaatniet', [])), '');
assert.strictEqual(ids(filterTaken(data, 'alle', 'klaar', [])), ''); // title only, not status

// each status choice (no search)
assert.strictEqual(ids(filterTaken(data, 'alle', '', [])), '1,2,3,4,5,6,7');
assert.strictEqual(ids(filterTaken(data, 'bezig', '', [])), '1,4');
assert.strictEqual(ids(filterTaken(data, 'klaar', '', [])), '2,5');
assert.strictEqual(ids(filterTaken(data, 'mislukt', '', [])), '3,6');

// combination: both must match
assert.strictEqual(ids(filterTaken(data, 'klaar', 'zoek', [])), '5');
assert.strictEqual(ids(filterTaken(data, 'bezig', 'zoek', [])), '1');
assert.strictEqual(ids(filterTaken(data, 'mislukt', 'zoek', [])), '3');
assert.strictEqual(ids(filterTaken(data, 'klaar', 'login', [])), '2');
assert.strictEqual(ids(filterTaken(data, 'mislukt', 'login', [])), '');

// archived tasks stay hidden
assert.strictEqual(ids(filterTaken(data, 'klaar', 'zoek', ['5'])), '');

// empty state in renderLijst
vm.runInContext("taken = [{id:1,titel:'a',status:'bezig'}]; zoekTekst = 'zzz'; renderLijst();", context);
assert.strictEqual(lijstEl.children.length, 1);
assert.strictEqual(lijstEl.children[0].textContent, 'Geen taken gevonden');

console.log('test_zoek: all tests passed');
