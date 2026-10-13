// Tests for motor label in maakKaart.
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const appCode = fs.readFileSync('app.js', 'utf8');

function makeEl() {
  return {
    className: '', textContent: '', innerHTML: '', dataset: {}, children: [],
    style: { setProperty() {} },
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

const maakKaart = vm.runInContext('maakKaart', context);

/** Helper: find the first child with className 'motor-label' on a kaart */
function findMotorLabel(kaart) {
  return kaart.children.find(c => c.className && c.className.includes('motor-label'));
}

/** Helper: find the first child with className 'motor-label' that has a specific modifier */
function findMotorLabelModifier(kaart, modifier) {
  return kaart.children.find(c => c.className && c.className.includes('motor-label-' + modifier));
}

// --- Test 1: motor "claude" geeft een label met die tekst ---
const kaart1 = maakKaart({ id: 1, titel: 'Test', status: 'bezig', agent: 'test', motor: 'claude' });
const label1 = findMotorLabel(kaart1);
assert.ok(label1, 'Test 1: motor-label moet bestaan voor "claude"');
assert.strictEqual(label1.textContent, 'claude', 'Test 1: tekst moet "claude" zijn');

// --- Test 2: elk van de vier bekende motoren ---
const bekendeMotoren = ['codex', 'gemini', 'lokaal', 'claude'];
for (const m of bekendeMotoren) {
  const kaart = maakKaart({ id: 42, titel: 'Test', status: 'bezig', agent: 'test', motor: m });
  const lbl = findMotorLabel(kaart);
  assert.ok(lbl, `Test 2: motor-label voor "${m}" moet bestaan`);
  assert.strictEqual(lbl.textContent, m, `Test 2: tekst moet "${m}" zijn`);
  const mod = findMotorLabelModifier(kaart, m);
  assert.ok(mod, `Test 2: modifier class "motor-label-${m}" moet aanwezig zijn`);
}

// --- Test 3: taak zonder motor -> geen label ---
const kaart3a = maakKaart({ id: 3, titel: 'Test', status: 'bezig', agent: 'test' });
assert.strictEqual(findMotorLabel(kaart3a), undefined, 'Test 3: geen motor -> geen label');

// --- Test 4: taak met lege motor -> geen label ---
const kaart4 = maakKaart({ id: 4, titel: 'Test', status: 'bezig', agent: 'test', motor: '' });
assert.strictEqual(findMotorLabel(kaart4), undefined, 'Test 4: lege motor -> geen label');

// --- Test 5: taak met null motor -> geen label ---
const kaart5 = maakKaart({ id: 5, titel: 'Test', status: 'bezig', agent: 'test', motor: null });
assert.strictEqual(findMotorLabel(kaart5), undefined, 'Test 5: null motor -> geen label');

// --- Test 6: onbekende motor -> alleen "motor-label", geen modifier ---
const kaart6 = maakKaart({ id: 6, titel: 'Test', status: 'bezig', agent: 'test', motor: 'onbekend' });
const label6 = findMotorLabel(kaart6);
assert.ok(label6, 'Test 6: onbekende motor -> nog steeds label');
assert.strictEqual(label6.textContent, 'onbekend', 'Test 6: tekst is onbekend');
assert.ok(!label6.className.includes('motor-label-onbekend'), 'Test 6: geen modifier voor onbekende motor');

// --- Test 7: motor met HTML-tekens -> veilig getoond via textContent ---
const kaart7 = maakKaart({ id: 7, titel: 'Test', status: 'bezig', agent: 'test', motor: '<b>x</b>' });
const label7 = findMotorLabel(kaart7);
assert.ok(label7, 'Test 7: label bestaat');
assert.strictEqual(label7.textContent, '<b>x</b>', 'Test 7: HTML-tekens als gewone tekst');
assert.ok(!label7.innerHTML.includes('<b>'), 'Test 7: geen innerHTML — geen <b> tag');

console.log('test_motor.js: all tests passed');
