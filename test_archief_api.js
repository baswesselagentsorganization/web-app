// Tests for server-side archive, localStorage migration, approval buttons on
// other people's tasks and the counter from open_akkoorden (fake fetch, no dependencies).
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function makeEl() {
  const el = {
    className: '', textContent: '', style: { setProperty() {} }, children: [], attrs: {},
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(evt, fn) { (this.handlers ??= {})[evt] = fn; },
    dataset: {}, classList: { add() {}, remove() {} }
  };
  return el;
}

// Fresh VM per test: apiData is the /api/taken answer, archiefStatus the status for POST .../archief
function setup({ apiData, store, archiefStatus = 200 }) {
  const dom = {};
  const calls = [];
  const alerts = [];
  const kaarten = [];
  const ls = { ...store };
  const context = {
    localStorage: {
      getItem: (k) => (k in ls ? ls[k] : null),
      setItem: (k, v) => { ls[k] = v; },
      removeItem: (k) => { delete ls[k]; }
    },
    document: {
      getElementById: (id) => (dom[id] ??= makeEl()),
      createElement: (tag) => { const e = makeEl(); e.tagName = tag; if (tag === 'li') kaarten.push(e); return e; },
      createElementNS: () => Object.assign(makeEl(), { innerHTML: '' }),
      querySelectorAll: () => [],
      addEventListener() {}
    },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    navigator: {}, setInterval() {}, console,
    alert: (m) => alerts.push(m),
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      if (opts && opts.method === 'POST') {
        return { ok: archiefStatus === 200, status: archiefStatus, json: async () => ({ ok: archiefStatus === 200 }) };
      }
      return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(context.apiData)) };
    },
    apiData
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { context, dom, calls, alerts, ls, kaarten };
}

const kaart = (t) => ({ id: 1, titel: 'T', status: 'klaar', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z', eigen: true, ...t });
const archiefCalls = (calls) => calls.filter(c => c.opts && c.opts.method === 'POST');

async function main() {
  // 1. Archive via the API: list changes only after a 200
  {
    const { context, calls, alerts } = setup({ apiData: { eigenaar: 'Bas', kleuren: {}, taken: [kaart({ gearchiveerd: false })] } });
    await context.laadTaken();
    const taak = vm.runInContext('taken[0]', context);
    await context.zetGearchiveerd(taak, true);
    const [c] = archiefCalls(calls);
    assert.strictEqual(c.url, '/api/taken/1/archief');
    assert.strictEqual(c.opts.headers['X-Hub'], 'web');
    assert.strictEqual(c.opts.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(c.opts.body), { gearchiveerd: true });
    assert.strictEqual(taak.gearchiveerd, true);
    assert.strictEqual(alerts.length, 0);
    assert.strictEqual(context.gearchiveerdeIds().join(','), '1');
    await context.zetGearchiveerd(taak, false);
    assert.deepStrictEqual(JSON.parse(archiefCalls(calls)[1].opts.body), { gearchiveerd: false });
    assert.strictEqual(taak.gearchiveerd, false);
  }

  // 2. Error (409): task stays as it was, short message
  {
    const { context, alerts } = setup({ apiData: { eigenaar: 'Bas', kleuren: {}, taken: [kaart({ gearchiveerd: false })] }, archiefStatus: 409 });
    await context.laadTaken();
    const taak = vm.runInContext('taken[0]', context);
    await context.zetGearchiveerd(taak, true);
    assert.strictEqual(taak.gearchiveerd, false);
    assert.strictEqual(alerts.length, 1);
  }

  // 3. Migration: only finished, not yet archived tasks that are in the list; key removed; list reloaded
  {
    const { context, calls, ls } = setup({
      store: { 'verborgen-taken': '["1","2","3","4","99"]' },
      apiData: { eigenaar: 'Bas', kleuren: {}, taken: [
        kaart({ id: 1, status: 'klaar', gearchiveerd: false }),
        kaart({ id: 2, status: 'mislukt', gearchiveerd: true }),
        kaart({ id: 3, status: 'bezig', gearchiveerd: false }),
        kaart({ id: 4, status: 'geannuleerd', gearchiveerd: false })
      ] }
    });
    await context.laadTaken();
    assert.deepStrictEqual(archiefCalls(calls).map(c => c.url), ['/api/taken/1/archief', '/api/taken/4/archief']);
    assert.ok(archiefCalls(calls).every(c => JSON.parse(c.opts.body).gearchiveerd === true));
    assert.ok(!('verborgen-taken' in ls));
    assert.strictEqual(calls.filter(c => c.url === '/api/taken').length, 2); // reloaded once
    await context.laadTaken();
    assert.strictEqual(archiefCalls(calls).length, 2); // nothing more to migrate
  }

  // 3b. Corrupt localStorage value: no crash, no POST
  {
    const { context, calls } = setup({
      store: { 'verborgen-taken': 'geen json' },
      apiData: { eigenaar: 'Bas', kleuren: {}, taken: [kaart({ gearchiveerd: false })] }
    });
    await context.laadTaken();
    assert.strictEqual(archiefCalls(calls).length, 0);
  }

  // 4. Approval buttons also on someone else's task when taak.akkoord is set
  {
    const { context, kaarten } = setup({ apiData: {
      eigenaar: 'Bas', kleuren: { Wessel: '#f00' }, open_akkoorden: 1,
      taken: [
        kaart({ id: 7, status: 'wacht_op_akkoord', eigen: false, eigenaar: 'Wessel', akkoord: { id: 55 } }),
        kaart({ id: 8, status: 'wacht_op_akkoord', eigen: false, eigenaar: 'Wessel' })
      ]
    } });
    await context.laadTaken();
    const labels = (id) => {
      const li = kaarten.find(c => String(c.dataset.id) === String(id));
      const acties = li.children.find(c => c.className === 'taak-acties');
      return acties ? acties.children.filter(c => String(c.className).includes('btn-akkoord') || String(c.className).includes('btn-afwijs')).length : 0;
    };
    assert.strictEqual(labels(7), 2);
    assert.strictEqual(labels(8), 0);
  }

  // 5. Counter from open_akkoorden, fallback to own tasks
  {
    const { context, dom } = setup({ apiData: { eigenaar: 'Bas', kleuren: {}, open_akkoorden: 3, taken: [kaart({ status: 'wacht_op_akkoord' })] } });
    await context.laadTaken();
    assert.strictEqual(dom['wacht-akkoord-teller'].textContent, 'wacht op akkoord: 3');
    assert.strictEqual(dom['wacht-akkoord-teller'].style.display, 'block');
  }
  {
    const { context, dom } = setup({ apiData: { eigenaar: 'Bas', kleuren: {}, open_akkoorden: 0, taken: [kaart({ status: 'wacht_op_akkoord' })] } });
    await context.laadTaken();
    assert.strictEqual(dom['wacht-akkoord-teller'].style.display, 'none');
  }
  {
    const { context, dom } = setup({ apiData: { eigenaar: 'Bas', kleuren: {}, taken: [
      kaart({ id: 1, status: 'wacht_op_akkoord' }), kaart({ id: 2, status: 'wacht_op_akkoord', eigen: false }) ] } });
    await context.laadTaken();
    assert.strictEqual(dom['wacht-akkoord-teller'].textContent, 'wacht op akkoord: 1');
  }
  console.log('test_archief_api: all tests passed');
}
main().catch(e => { console.error(e); process.exit(1); });
