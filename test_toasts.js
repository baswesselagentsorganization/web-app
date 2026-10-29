// Tests for toasts: aria-live container, error role, cap, outcomes of approve/reject (fake DOM, fake fetch).
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function makeEl() {
  const el = {
    className: '', textContent: '', style: { setProperty() {} }, children: [], attrs: {}, dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener() {}, focus() {}
  };
  return el;
}

function setup(postStatus = 200) {
  const dom = {};
  const timers = [];
  const alerts = [];
  const context = {
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      getElementById: (id) => (dom[id] ??= makeEl()),
      createElement: () => makeEl(),
      createElementNS: () => makeEl(),
      querySelectorAll: () => [],
      addEventListener() {}
    },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }), confirm: () => true },
    navigator: {}, setInterval() {}, console,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    alert: (m) => alerts.push(m),
    fetch: async (url, opts) => {
      if (opts && opts.method === 'POST') return { ok: postStatus === 200, status: postStatus, json: async () => ({ fout: 'nee' }) };
      return { ok: true, status: 200, json: async () => ({ eigenaar: 'Bas', kleuren: {}, taken: [] }) };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { context, dom, timers, alerts };
}

async function main() {
  // 1. A toast lands in the aria-live container; errors get role=alert
  {
    const { context, dom } = setup();
    assert.strictEqual(fs.readFileSync('index.html', 'utf8').includes('id="toasts" class="toasts" aria-live="polite"'), true);
    const ok = context.toonToast('Akkoord gegeven');
    const fout = context.toonToast('Kapot', 'fout');
    assert.strictEqual(dom.toasts.children.length, 2);
    assert.strictEqual(ok.textContent, 'Akkoord gegeven');
    assert.strictEqual(ok.attrs.role, 'status');
    assert.strictEqual(fout.attrs.role, 'alert');
    assert.ok(fout.className.includes('toast-fout'));
  }

  // 2. Toast disappears after its timeout; at most 3 stay on screen
  {
    const { context, dom, timers } = setup();
    // A real HTMLCollection has no includes(); do not let the fake hide that
    dom.toasts = makeEl();
    dom.toasts.children.includes = undefined;
    for (let i = 0; i < 5; i++) context.toonToast('t' + i);
    assert.strictEqual(dom.toasts.children.length, 3);
    assert.strictEqual(dom.toasts.children[0].textContent, 't2');
    timers.forEach(t => t.fn());
    assert.strictEqual(dom.toasts.children.length, 0);
  }

  // 3. Approve and reject outcomes as toasts, failures as error toast, never alert()
  {
    const { context, dom, alerts } = setup();
    await context.stuurAkkoord(5, 'akkoord', makeEl(), makeEl());
    await context.stuurAkkoord(5, 'afwijzen', makeEl(), makeEl());
    assert.deepStrictEqual(dom.toasts.children.map(c => c.textContent), ['Akkoord gegeven', 'Taak afgewezen']);
    assert.strictEqual(alerts.length, 0);
  }
  {
    const { context, dom, alerts } = setup(500);
    await context.stuurAkkoord(5, 'akkoord', makeEl(), makeEl());
    assert.strictEqual(dom.toasts.children[0].textContent, 'Actie mislukt: nee');
    assert.ok(dom.toasts.children[0].className.includes('toast-fout'));
    assert.strictEqual(alerts.length, 0);
  }
  console.log('test_toasts: all tests passed');
}
main().catch(e => { console.error(e); process.exit(1); });
