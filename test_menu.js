// Tests for the three-dot menu on every task card
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
      if (attr === 'aria-label') return attrs['aria-label'] || el._ariaLabel || null;
      return attrs[attr] !== undefined ? attrs[attr] : el[attr] || null;
    },
    querySelector: function (selector) {
      function find(el) {
        for (const c of el.children) {
          if (c.className && c.className.includes(selector.replace('.', ''))) return c;
          const found = find(c);
          if (found) return found;
        }
        return null;
      }
      return find(this);
    },
    querySelectorAll: function (selector) {
      if (selector === '.taak-dropdown.open') {
        return children.filter(c =>
          c.className && c.className.includes('taak-dropdown') &&
          c.classList && c.classList.contains && c.classList.contains('open')
        );
      }
      return [];
    },
    addEventListener: function (evt, fn) {
      if (evt === 'DOMContentLoaded') return;
      if (!this._listeners) this._listeners = {};
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    }
  };
  // classList for CSS class toggling
  const classList = {
    _classes: new Set(),
    add: function (cls) { this._classes.add(cls); },
    remove: function (cls) { this._classes.delete(cls); },
    contains: function (cls) { return this._classes.has(cls); }
  };
  Object.defineProperty(el, 'classList', { get: function () { return classList; } });

  Object.defineProperty(el, 'dataset', {
    get: function () { return dataset; },
    configurable: true
  });
  Object.defineProperty(dataset, 'id', {
    get: function () { return this.dataId; },
    set: function (v) { this.dataId = v; if (v && el.className === 'taak-kaart') dom['taak-kaart-' + v] = el; },
    configurable: true
  });
  Object.defineProperty(dataset, 'status', {
    get: function () { return this.dataStatus; },
    configurable: true
  });
  return el;
}

const context = {
  localStorage: {
    getItem: () => '[]',
    setItem: () => {}
  },
  document: {
    getElementById: (id) => {
      if (!dom[id]) dom[id] = makeElement('div');
      return dom[id];
    },
    createElement: (tag) => makeElement(tag),
    createElementNS: (ns, tag) => makeElement(tag),
    querySelectorAll: function(selector) {
      const result = [];
      const classes = selector.replace('.', '').split('.');
      function hasClass(c) {
        // Check className for non-'open' classes, and classList for 'open'
        const nonOpen = classes.filter(cls => cls !== 'open');
        const hasBase = nonOpen.length === 0 || nonOpen.every(cls => c.className && c.className.includes(cls));
        const hasOpen = !classes.includes('open') || (c.classList && c.classList.contains && c.classList.contains('open'));
        return hasBase && hasOpen;
      }
      function search(el) {
        for (const c of (el.children || [])) {
          if (c.className && hasClass(c)) result.push(c);
          search(c);
        }
      }
      for (const key of Object.keys(dom)) {
        search(dom[key]);
      }
      return result;
    },
    addEventListener: () => {}
  },
  window: { addEventListener: () => {} },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console,
  dom: dom
};

vm.createContext(context);
vm.runInContext(appCode, context);

// Helper: inject data into the VM
function vmSetData(ctx, takenData) {
  vm.runInContext(`
    taken.length = 0;
    for (var i = 0; i < this.taken.length; i++) {
      taken.push(this.taken[i]);
    }
  `, ctx);
}

// Test data
const taken = [
  { id: 1, status: 'bezig', titel: 'Test taak', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 2, status: 'klaar', titel: 'Gemaakte taak', agent: 'b', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 10 } },
  { id: 3, status: 'mislukt', titel: 'Mislukte taak', agent: 'c', bijgewerkt: '2025-01-01T00:00:00Z' }
];

context.taken = taken;
context.activeFilter = 'alle';
vmSetData(context, taken);
context.renderLijst();

// === Test 1: every card has a menu button with correct aria-label ===
for (const taak of taken) {
  const li = context.dom['taak-kaart-' + taak.id];
  if (!li) throw new Error('Test 1: kaart niet gevonden voor taak ' + taak.id);

  const acties = li.children.find(c => c.className === 'taak-acties');
  if (!acties) throw new Error('Test 1: geen .taak-acties op kaart ' + taak.id);

  const menu = acties.children.find(c => c.className && c.className.includes('taak-menu'));
  if (!menu) throw new Error('Test 1: geen .taak-menu op kaart ' + taak.id);

  const btn = menu.children.find(c => c.className && c.className.includes('taak-menu-btn'));
  if (!btn) throw new Error('Test 1: geen menuknop op kaart ' + taak.id);
  if (btn.getAttribute('aria-label') !== 'Meer opties') {
    throw new Error('Test 1: aria-label is "' + btn.getAttribute('aria-label') + '", verwacht "Meer opties"');
  }
}

// === Test 2: dropdown has exactly 3 options with correct labels ===
for (const taak of taken) {
  const li = context.dom['taak-kaart-' + taak.id];
  const acties = li.children.find(c => c.className === 'taak-acties');
  const menu = acties.children.find(c => c.className && c.className.includes('taak-menu'));
  const dropdown = menu.children.find(c => c.className && c.className.includes('taak-dropdown'));

  if (dropdown.children.length !== 3) {
    throw new Error('Test 2: dropdown heeft ' + dropdown.children.length + ' items, verwacht 3');
  }

  const labels = dropdown.children.map(c => c.textContent);
  if (labels[0] !== 'Optie 1') throw new Error('Test 2: optie 1 is "' + labels[0] + '"');
  if (labels[1] !== 'Optie 2') throw new Error('Test 2: optie 2 is "' + labels[1] + '"');
  if (labels[2] !== 'Optie 3') throw new Error('Test 2: optie 3 is "' + labels[2] + '"');
}

// === Test 3: toggleMenu opens a menu ===
const card1 = context.dom['taak-kaart-1'];
const dd1 = card1.querySelector('.taak-dropdown');
if (dd1.classList.contains('open')) throw new Error('Test 3: dropdown should not be open initially');

context.toggleMenu(card1.querySelector('.taak-menu'));
if (!dd1.classList.contains('open')) {
  throw new Error('Test 3: toggleMenu should add .open class');
}

// === Test 4: opening a second menu closes the first ===
const card2 = context.dom['taak-kaart-2'];
const dd2 = card2.querySelector('.taak-dropdown');

context.toggleMenu(card2.querySelector('.taak-menu'));
if (!dd2.classList.contains('open')) throw new Error('Test 4: dd2 should be open');
if (dd1.classList.contains('open')) throw new Error('Test 4: dd1 should be closed (only one open at a time)');

// === Test 5: closeAllMenus closes all ===
context.closeAllMenus();
for (const taak of taken) {
  const dd = context.dom['taak-kaart-' + taak.id].querySelector('.taak-dropdown');
  if (dd.classList.contains('open')) {
    throw new Error('Test 5: closeAllMenus did not close all menus');
  }
}

console.log('All menu tests passed!');
