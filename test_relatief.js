// Tests for relative time ("5 min geleden") and the full date as title on task cards.
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function makeEl() {
  return {
    className: '', textContent: '', style: { setProperty() {} }, children: [], attrs: {}, dataset: {},
    classList: { add() {}, remove() {} },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener() {}
  };
}
const context = {
  localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: () => makeEl(), createElement: makeEl, createElementNS: makeEl, querySelectorAll: () => [], addEventListener() {} },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
  navigator: {}, setInterval() {}, console, fetch: () => Promise.resolve({ ok: true })
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const nu = new Date('2026-10-29T12:00:00Z');
const voor = (ms) => new Date(nu.getTime() - ms).toISOString();
const MIN = 60000, UUR = 60 * MIN, DAG = 24 * UUR;

assert.strictEqual(context.formatRelatief(voor(10 * 1000), nu), 'zojuist');
assert.strictEqual(context.formatRelatief(voor(5 * MIN), nu), '5 min geleden');
assert.strictEqual(context.formatRelatief(voor(59 * MIN), nu), '59 min geleden');
assert.strictEqual(context.formatRelatief(voor(3 * UUR + 20 * MIN), nu), '3 u geleden');
assert.strictEqual(context.formatRelatief(voor(2 * DAG), nu), '2 d geleden');
// Older than a week, future and invalid values fall back to the full date / original value
assert.strictEqual(context.formatRelatief(voor(10 * DAG), nu), context.formatDatum(voor(10 * DAG)));
assert.strictEqual(context.formatRelatief(new Date(nu.getTime() + DAG).toISOString(), nu), context.formatDatum(new Date(nu.getTime() + DAG).toISOString()));
assert.strictEqual(context.formatRelatief('geen datum', nu), 'geen datum');

// Card: relative text in a span with the full date as title, repo still shown
const kaart = context.maakKaart({ id: 1, status: 'klaar', titel: 'T', agent: 'codeur', repo: 'web-app', bijgewerkt: new Date(Date.now() - 5 * MIN).toISOString() });
const acties = kaart.children;
const meta = acties.find(c => c.className === 'taak-meta');
const tijd = meta.children.find(c => c.className === 'taak-tijd');
assert.strictEqual(tijd.textContent, '5 min geleden');
assert.strictEqual(tijd.title, context.formatDatum(tijd.dataset.tijd));
assert.ok(meta.children.some(c => c.textContent.includes('Repo: web-app')));
assert.ok(meta.textContent.startsWith('Agent: codeur • Bijgewerkt: '));

console.log('test_relatief: all tests passed');
