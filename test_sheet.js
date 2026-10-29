// Tests for the reject bottom sheet (reason input, cancel, backdrop, Escape) and the filter menu.
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function makeEl() {
  const el = {
    className: '', textContent: '', value: '', hidden: false, style: { setProperty() {} }, children: [], attrs: {}, dataset: {},
    handlers: {},
    classList: { add() {}, remove() {} },
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(evt, fn) { (this.handlers[evt] ??= []).push(fn); },
    click() { (this.handlers.click || []).forEach(fn => fn({ stopPropagation() {} })); },
    focus() { dom.active = this; }
  };
  return el;
}
const dom = {};
const posts = [];
const context = {
  localStorage: { getItem: () => null, setItem() {} },
  document: {
    getElementById: (id) => (dom[id] ??= makeEl()),
    createElement: makeEl, createElementNS: makeEl,
    querySelectorAll: () => [], addEventListener() {},
    get activeElement() { return dom.active; }
  },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }), confirm() { throw new Error('confirm must not be used'); } },
  navigator: {}, setInterval() {}, console,
  alert() { throw new Error('alert must not be used'); },
  fetch: async (url, opts) => {
    if (opts && opts.method === 'POST') { posts.push({ url, body: JSON.parse(opts.body) }); return { ok: true, status: 200, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => ({ eigenaar: 'Bas', kleuren: {}, taken: [] }) };
  },
  setTimeout() {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const taak = { id: 7, status: 'wacht_op_akkoord', titel: 'Taak', agent: 'a', bijgewerkt: '2026-01-01T00:00:00Z', eigen: true, akkoord: { id: 3, vragen: 1 } };
const tick = () => new Promise(r => setImmediate(r));
const afwijsKnop = (k) => k.children.find(c => c.className === 'taak-acties').children.find(c => c.className === 'btn btn-afwijs');

async function main() {
  // index.html has the ids the code relies on
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['afwijs-sheet', 'afwijs-reden', 'afwijs-bevestig', 'afwijs-annuleer', 'btn-filtermenu', 'filter-menu', 'btn-toon-gearchiveerd']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.ok(html.includes('data-eigenaarfilter="eigen"'));

  // 1. Afwijzen opens the sheet; nothing is sent yet
  const knop = afwijsKnop(context.maakKaart(taak));
  knop.click();
  await tick();
  assert.strictEqual(dom['afwijs-sheet'].hidden, false);
  assert.strictEqual(dom['afwijs-taak'].textContent, 'Taak');
  assert.strictEqual(dom.active, dom['afwijs-reden']);
  assert.strictEqual(posts.length, 0);

  // 2. Annuleren closes the sheet without a request
  dom['afwijs-annuleer'].click();
  await tick();
  assert.strictEqual(dom['afwijs-sheet'].hidden, true);
  assert.strictEqual(posts.length, 0);

  // 3. Backdrop and Escape also cancel
  knop.click(); await tick();
  dom['afwijs-backdrop'].click(); await tick();
  assert.strictEqual(dom['afwijs-sheet'].hidden, true);
  knop.click(); await tick();
  dom['afwijs-sheet'].handlers.keydown[0]({ key: 'Escape', preventDefault() {} }); await tick();
  assert.strictEqual(dom['afwijs-sheet'].hidden, true);
  assert.strictEqual(posts.length, 0);

  // 4. Confirm sends the decision with the trimmed reason and shows a toast
  knop.click(); await tick();
  dom['afwijs-reden'].value = '  te riskant ';
  dom['afwijs-bevestig'].click();
  await tick(); await tick();
  assert.strictEqual(dom['afwijs-sheet'].hidden, true);
  assert.deepStrictEqual(posts, [{ url: '/api/akkoorden/3', body: { besluit: 'afwijzen', reden: 'te riskant' } }]);
  assert.strictEqual(dom.toasts.children[0].textContent, 'Taak afgewezen');

  // 5. Empty reason: body stays { besluit } as before
  knop.click(); await tick();
  dom['afwijs-bevestig'].click();
  await tick(); await tick();
  assert.deepStrictEqual(posts[1].body, { besluit: 'afwijzen' });

  // 6. Filter menu: toggles hidden/aria-expanded; button marks an active secondary filter
  context.document.getElementById('filter-menu').hidden = true;
  context.document.getElementById('btn-filtermenu');
  context.setFiltermenu(true);
  assert.strictEqual(dom['filter-menu'].hidden, false);
  assert.strictEqual(dom['btn-filtermenu'].attrs['aria-expanded'], 'true');
  context.setFiltermenu(false);
  assert.strictEqual(dom['filter-menu'].hidden, true);
  assert.ok(!dom['btn-filtermenu'].className.includes('actief'));
  context.setToonGearchiveerd(true);
  assert.ok(dom['btn-filtermenu'].className.includes('actief'));
  assert.strictEqual(dom['btn-toon-gearchiveerd'].textContent, 'Verberg gearchiveerd');
  context.setToonGearchiveerd(false);
  context.setEigenaarFilter('eigen');
  assert.ok(dom['btn-filtermenu'].className.includes('actief'));

  console.log('test_sheet: all tests passed');
}
main().catch(e => { console.error(e); process.exit(1); });
