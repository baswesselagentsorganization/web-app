const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync('app.js', 'utf8');

const dom = {};

function makeElement(tag) {
  const dataset = {};
  const attrs = {};
  const children = [];
  const el = {
    className: '',
    textContent: '',
    style: {},
    tagName: tag || '',
    children: children,
    _dataset: dataset,
    _attrs: attrs,
    _parent: null,
    appendChild: function (child) {
      child._parent = this;
      children.push(child);
      return child;
    },
    setAttribute: function (attr, val) {
      attrs[attr] = val;
      if (attr === 'data-id') {
        dataset.dataId = val;
        if (this.className === 'taak-kaart') {
          dom['taak-kaart-' + val] = this;
        }
      } else if (attr === 'data-status') {
        dataset.dataStatus = val;
      }
    },
    getAttribute: function (attr) {
      if (attr === 'data-id') return dataset.dataId || null;
      if (attr === 'data-status') return dataset.dataStatus || null;
      return attrs[attr] !== undefined ? attrs[attr] : el[attr] || null;
    },
    addEventListener: function (evt, fn) {
      // Block DOMContentLoaded so the app doesn't auto-render
      if (evt === 'DOMContentLoaded') return;
    }
  };
  Object.defineProperty(el, 'dataset', {
    get: function () { return dataset; },
    configurable: true
  });
  Object.defineProperty(dataset, 'id', {
    get: function() { return this.dataId; },
    set: function(v) { this.dataId = v; if (v && el.className === 'taak-kaart') dom['taak-kaart-' + v] = el; },
    configurable: true
  });
  Object.defineProperty(dataset, 'status', {
    get: function() { return this.dataStatus; },
    set: function(v) { this.dataStatus = v; },
    configurable: true
  });
  return el;
}

// Helper: set data on context so VM can reach it via 'this'
function injectData(ctx, takenData, filter) {
  ctx.taken = takenData;
  ctx.activeFilter = filter;
}

const context = {
  localStorage: {
    getItem: (key) => {
      if (key === 'verborgen-taken') return dom.__hiddenStore ?? '[]';
      return null;
    },
    setItem: (key, val) => {
      if (key === 'verborgen-taken') dom.__hiddenStore = val;
    }
  },
  document: {
    getElementById: (id) => {
      if (!dom[id]) {
        dom[id] = makeElement('div');
      }
      return dom[id];
    },
    createElement: (tag) => makeElement(tag),
    createElementNS: (ns, tag) => {
      const el = makeElement(tag);
      const _origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function (attr, val) {
        if (attr === 'width') this._width = val;
        else if (attr === 'height') this._height = val;
        else if (attr === 'viewBox') this._viewBox = val;
        else if (attr === 'fill') this._fill = val;
        else if (attr === 'stroke') this._stroke = val;
        else if (attr === 'stroke-width') this._strokeWidth = val;
        else if (attr === 'aria-hidden') this._ariaHidden = val;
        else _origSetAttr(attr, val);
      };
      Object.defineProperty(el, 'innerHTML', {
        set(v) { this._innerHTML = v; },
        get() { return this._innerHTML; }
      });
      return el;
    },
    querySelectorAll: () => [],
    visibilityState: 'visible',
    addEventListener: () => {}
  },
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: false }) },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console,
  dom: dom
};

vm.createContext(context);
vm.runInContext(appCode, context);

// === VM helper: push data into the VM's local 'taken' variable ===
function vmSetData(ctx, takenData) {
  vm.runInContext(`
    taken.length = 0;
    for (var i = 0; i < this.taken.length; i++) {
      taken.push(this.taken[i]);
    }
    activeFilter = this.activeFilter;
  `, ctx);
}

// === Test 1: archiveerknop zichtbaarheid per status ===
const archiveableStatuses = ['klaar', 'mislukt'];
const nonArchiveableStatuses = ['nieuw', 'gepland', 'bezig', 'wacht_op_akkoord', 'geannuleerd'];

const taken = [
  { id: 1,  status: 'klaar',       titel: 'Klaar taak',        agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 2,  status: 'mislukt',     titel: 'Mislukte taak',     agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 3,  status: 'bezig',       titel: 'Bezig taak',        agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 4,  status: 'nieuw',       titel: 'Nieuw taak',        agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 5,  status: 'gepland',     titel: 'Gepland taak',      agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 6,  status: 'wacht_op_akkoord', titel: 'Akkoord taak', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 7,  status: 'geannuleerd', titel: 'Geannuleerd',       agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' }
];

injectData(context, taken, 'alle');
vmSetData(context, taken);
context.renderLijst();

// Check archiveable statuses
for (const s of archiveableStatuses) {
  const taak = taken.find(t => t.status === s);
  if (!taak) throw new Error('Test 1: geen taak gevonden met status ' + s);
  const li = context.dom['taak-kaart-' + taak.id];
  if (!li) throw new Error('Test 1: kaart niet gevonden voor ' + s);
  const acties = li.children.find(c => c.className === 'taak-acties');
  if (!acties) throw new Error('Test 1: geen .taak-acties op kaart voor ' + s);
  const buttons = acties.children.filter(c => c.tagName === 'BUTTON' || c.tagName === 'button');
  if (buttons.length !== 1) throw new Error('Test 1: verwacht 1 knop voor ' + s + ', kreeg ' + buttons.length);
  const btn = buttons[0];
  if (!btn.getAttribute('aria-label').startsWith('Archiveer:')) {
    throw new Error('Test 1: aria-label moet beginnen met "Archiveer:" voor ' + s);
  }
  if (btn.getAttribute('title') !== 'Archiveer') {
    throw new Error('Test 1: title moet "Archiveer" zijn voor ' + s);
  }
}

// Check non-archiveable statuses
for (const s of nonArchiveableStatuses) {
  const taak = taken.find(t => t.status === s);
  if (!taak) throw new Error('Test 2: geen taak gevonden met status ' + s);
  const li = context.dom['taak-kaart-' + taak.id];
  if (!li) throw new Error('Test 2: kaart niet gevonden voor ' + s);
  const acties = li.children.find(c => c.className === 'taak-acties');
  // Either no acties div at all, or no archive button inside
  const buttons = acties ? acties.children.filter(c => c.tagName === 'BUTTON' || c.tagName === 'button') : [];
  const archiveButtons = buttons.filter(b => {
    const lbl = b.getAttribute && b.getAttribute('aria-label');
    return lbl && lbl.startsWith('Archiveer:');
  });
  if (archiveButtons.length !== 0) {
    throw new Error('Test 2: geen archiveerknop voor ' + s + ', kreeg ' + archiveButtons.length);
  }
}

// === Test 2: localStorage helpers ===
dom.__hiddenStore = '[]';
injectData(context, [
  { id: 1, status: 'klaar', titel: 'A', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 2, status: 'mislukt', titel: 'B', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 3, status: 'bezig', titel: 'C', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' }
], 'alle');
vmSetData(context, context.taken);
context.renderLijst();

if (context.verborgenIds().length !== 0) {
  throw new Error('Test 2a: verborgenIds should be empty');
}

context.voegToeAanVerborgen(1);
if (context.verborgenIds().length !== 1) {
  throw new Error('Test 2b: verborgenIds should have 1 entry');
}
if (context.verborgenIds()[0] !== '1') {
  throw new Error('Test 2c: hidden id should be "1", got: ' + context.verborgenIds()[0]);
}

context.voegToeAanVerborgen(2);
if (context.verborgenIds().length !== 2) {
  throw new Error('Test 2d: verborgenIds should have 2 entries');
}

const nowUnhidden = context.toggleVerborgen(1);
if (nowUnhidden) {
  throw new Error('Test 2e: toggleVerborgen(1) should return false');
}
if (context.verborgenIds().length !== 1) {
  throw new Error('Test 2f: verborgenIds should have 1 entry after toggle off');
}

const nowHidden = context.toggleVerborgen(1);
if (!nowHidden) {
  throw new Error('Test 2g: toggleVerborgen(1) should return true');
}
if (context.verborgenIds().length !== 2) {
  throw new Error('Test 2h: verborgenIds should have 2 entries again');
}

// === Test 3: formatDatum nog in orde ===
const resultaat = context.formatDatum('2025-03-15T14:30:00Z');
if (resultaat === '') {
  throw new Error('Test 3: formatDatum should not return empty');
}
const ongeldig = context.formatDatum('onzin');
if (ongeldig !== 'onzin') {
  throw new Error('Test 3b: formatDatum("onzin") should return "onzin"');
}

console.log('All archiveer tests passed!');
