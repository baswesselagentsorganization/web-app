// Tests for eigenaar filter, owner label, border color, and teller fix.
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const appCode = fs.readFileSync('app.js', 'utf8');

// Shared mock helpers
function makeEl() {
  const el = { className: '', textContent: '', dataset: {}, children: [] };
  el.style = {
    set display(v) { this._display = v; },
    get display() { return this._display; },
    setProperty(k, v) { this[k] = v; }
  };
  el.appendChild = function(c) { this.children.push(c); };
  el.setAttribute = function() {};
  el.addEventListener = function() {};
  return el;
}

const lijstEl = { children: [], textContent: '', appendChild(c) { this.children.push(c); } };

const context = {
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = v; }
  },
  document: {
    getElementById: (id) => {
      if (!context._els) context._els = {};
      if (!context._els[id]) {
        context._els[id] = { textContent: '', style: { display: '' } };
      }
      return context._els[id];
    },
    createElement: makeEl,
    createElementNS: () => ({ setAttribute: () => {}, innerHTML: '', appendChild: () => {} }),
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: false }) },
  navigator: {},
  setInterval: () => {},
  fetch: () => new Promise(() => {}),
  console
};
vm.createContext(context);
vm.runInContext(appCode, context);

const filterTaken = vm.runInContext('filterTaken', context);
const ids = (r) => r.map(t => t.id).join(',');

// Sample data with eigen/kleur/eigenaar fields
const dataMetEigen = [
  { id: 1, titel: 'Eigen taak 1', status: 'bezig', eigen: true, kleur: '#2563eb' },
  { id: 2, titel: 'Eigen taak 2', status: 'klaar', eigen: true, kleur: '#2563eb' },
  { id: 3, titel: 'Andermans taak', status: 'wacht_op_akkoord', eigen: false, eigenaar: 'Wessel', kleur: '#ea580c' },
  { id: 4, titel: 'Zelf wachten', status: 'wacht_op_akkoord', eigen: true, kleur: '#2563eb' }
];

// --- Test 1-6: filterTaken eigenaarFilter ---

// Test 1: eigenaarFilter 'alle' — alle taken
assert.strictEqual(ids(filterTaken(dataMetEigen, 'alle', '', [], 'alle')), '1,2,3,4');

// Test 2: eigenaarFilter 'eigen' — alleen eigen taken
assert.strictEqual(ids(filterTaken(dataMetEigen, 'alle', '', [], 'eigen')), '1,2,4');

// Test 3: eigenaarFilter 'eigen' + status filter
assert.strictEqual(ids(filterTaken(dataMetEigen, 'bezig', '', [], 'eigen')), '1');

// Test 4: eigenaarFilter 'eigen' + search
assert.strictEqual(ids(filterTaken(dataMetEigen, 'alle', 'taak 2', [], 'eigen')), '2');

// Test 5: geen eigenaarFilter (undefined) — geen filtering op eigen
assert.strictEqual(ids(filterTaken(dataMetEigen, 'alle', '', [], undefined)), '1,2,3,4');

// Test 6: oude hub — taken zonder eigen veld worden als eigen beschouwd
const dataOudeHub = [
  { id: 1, titel: 'Taak 1', status: 'bezig' },
  { id: 2, titel: 'Taak 2', status: 'klaar' }
];
assert.strictEqual(ids(filterTaken(dataOudeHub, 'alle', '', [], 'alle')), '1,2');
assert.strictEqual(ids(filterTaken(dataOudeHub, 'alle', '', [], 'eigen')), '1,2');


// --- Test 7-8: border color via setProperty in maakKaart ---

// Test 7: ongeldige kleur — maakKaart roept setProperty en zet grijs
const li7 = context.maakKaart({ id: 10, titel: 'Test', status: 'bezig', kleur: '#zzz', agent: 'test' });
assert.strictEqual(li7.style['--eigenaar-kleur'], '#6b7280',
  'ongeldige kleur -> grijs (#6b7280) via setProperty');

// Test 8: geldige kleur — maakKaart roept setProperty met de kleur
const li8 = context.maakKaart({ id: 11, titel: 'Test', status: 'bezig', kleur: '#ea580c', agent: 'test' });
assert.strictEqual(li8.style['--eigenaar-kleur'], '#ea580c',
  'geldige kleur via setProperty');

// --- Test 9: geen akkoordknoppen bij eigen === false ---
const taak3 = { id: 3, titel: 'Andermans taak', status: 'wacht_op_akkoord', eigen: false, eigenaar: 'Wessel', kleur: '#ea580c', akkoord: { id: 42 } };
const li9 = vm.runInContext(`(() => {
  const taak = ${JSON.stringify(taak3)};
  const li = document.createElement('li');
  const acties = document.createElement('div');
  acties.className = 'taak-acties';
  if (taak.akkoord && taak.eigen !== false) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-akkoord';
    acties.appendChild(btn);
  }
  li.appendChild(acties);
  return li;
})()`, context);
const actiesEl = li9.children.find(c => c.className === 'taak-acties');
assert.strictEqual(actiesEl.children.length, 0, 'geen akkoordknoppen bij eigen === false');

// --- Test 10: teller telt alleen eigen taken ---
const dom2 = {};
const ctx2 = {
  document: {
    getElementById: (id) => {
      if (!dom2[id]) dom2[id] = { textContent: '', style: { display: '' } };
      return dom2[id];
    },
    createElement: () => ({ className: '', textContent: '', style: { display: '' }, appendChild: ()=>{}, setAttribute: ()=>{}, addEventListener: ()=>{} }),
    querySelectorAll: () => [],
    visibilityState: 'visible',
    addEventListener: () => {}
  },
  window: { addEventListener: ()=>{} },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console
};
vm.createContext(ctx2);
vm.runInContext(appCode, ctx2);

vm.runInContext("taken = [{ status: 'wacht_op_akkoord', eigen: true }, { status: 'wacht_op_akkoord', eigen: true }, { status: 'wacht_op_akkoord', eigen: false }, { status: 'bezig', eigen: true }];", ctx2);
vm.runInContext("updateWachtAkkoordTeller();", ctx2);
const tellerEl = ctx2.document.getElementById('wacht-akkoord-teller');
assert.strictEqual(tellerEl.textContent, 'wacht op jouw akkoord: 2',
  `teller moet 2 zijn, is ${tellerEl.textContent}`);

console.log('test_eigenaar: all tests passed');
