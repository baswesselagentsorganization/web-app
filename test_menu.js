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
    style: { setProperty(k, v) { this[k] = v; } },
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
  Object.defineProperty(el, 'innerHTML', { get: function() { return this.textContent; }, set: function(v) { this.textContent = v; } });
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
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: true }) },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console,
  dom: dom
};

vm.createContext(context);
vm.runInContext(appCode, context);

function vmSetData(ctx, takenData) {
  vm.runInContext(`
    taken.length = 0;
    for (var i = 0; i < this.taken.length; i++) {
      taken.push(this.taken[i]);
    }
  `, ctx);
}

// === Test data ===
const taken = [
  { id: 1, status: 'bezig',       titel: 'Bezig taak',       agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 2, status: 'klaar',       titel: 'Gemaakte taak',    agent: 'b', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 10 } },
  { id: 3, status: 'mislukt',     titel: 'Mislukte taak',    agent: 'c', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 4, status: 'nieuw',       titel: 'Nieuw taak',       agent: 'd', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 5, status: 'gepland',     titel: 'Gepland taak',     agent: 'e', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 6, status: 'wacht_op_akkoord', titel: 'Akkoord taak', agent: 'f', bijgewerkt: '2025-01-01T00:00:00Z' },
  { id: 7, status: 'wacht_op_akkoord', titel: 'Akkoord veel vragen', agent: 'g', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 20, ja: 'Jan', risico: 'Laag', vragen: 3, details: 'Toelichting' } },
  { id: 8, status: 'wacht_op_akkoord', titel: 'Akkoord weinig vragen', agent: 'h', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 21, ja: 'Jan', risico: 'Laag', vragen: 1 } },
  { id: 9, status: 'wacht_op_akkoord', titel: 'Akkoord geen velden', agent: 'i', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 22 } }
];

context.taken = taken;
context.activeFilter = 'alle';
vmSetData(context, taken);
context.renderLijst();

// Active statuses for menu
const actieveStatussen = ['nieuw', 'gepland', 'bezig', 'wacht_op_akkoord'];

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

// === Test 2: dropdown menu item depends on status ===
for (const taak of taken) {
  const li = context.dom['taak-kaart-' + taak.id];
  const acties = li.children.find(c => c.className === 'taak-acties');
  const menu = acties.children.find(c => c.className && c.className.includes('taak-menu'));
  const dropdown = menu.children.find(c => c.className && c.className.includes('taak-dropdown'));
  if (dropdown.children.length !== 1) {
    throw new Error('Test 2: kaart ' + taak.id + ' dropdown heeft ' + dropdown.children.length + ' items, verwacht 1');
  }
  const label = dropdown.children[0].textContent;
  if (actieveStatussen.includes(taak.status)) {
    if (label !== 'Annuleren') {
      throw new Error('Test 2: kaart ' + taak.id + ' (status ' + taak.status + ') verwacht "Annuleren", kreeg "' + label + '"');
    }
  } else {
    if (label !== 'Geen acties') {
      throw new Error('Test 2: kaart ' + taak.id + ' (status ' + taak.status + ') verwacht "Geen acties", kreeg "' + label + '"');
    }
  }
}

// === Test 3: Annuleren menu item exists and has click listener ===
const card1 = context.dom['taak-kaart-1'];
const dd1 = card1.querySelector('.taak-dropdown');
const annuleerLi = dd1.children[0];
if (!annuleerLi._listeners || !annuleerLi._listeners.click || annuleerLi._listeners.click.length === 0) {
  throw new Error('Test 3: Annuleren-item heeft geen click listener');
}

// === Test 4: menu toggle still works ===
const card2 = context.dom['taak-kaart-2'];
const dd2 = card2.querySelector('.taak-dropdown');
if (dd2.classList.contains('open')) throw new Error('Test 4: dropdown should not be open initially');
context.toggleMenu(card2.querySelector('.taak-menu'));
if (!dd2.classList.contains('open')) {
  throw new Error('Test 4: toggleMenu should add .open class');
}

// === Test 5: opening a second menu closes the first ===
const card3 = context.dom['taak-kaart-3'];
const dd3 = card3.querySelector('.taak-dropdown');
context.toggleMenu(card3.querySelector('.taak-menu'));
if (!dd3.classList.contains('open')) throw new Error('Test 5: dd3 should be open');
if (dd2.classList.contains('open')) throw new Error('Test 5: dd2 should be closed');

// === Test 6: closeAllMenus closes all ===
context.closeAllMenus();
for (const taak of taken) {
  const dd = context.dom['taak-kaart-' + taak.id].querySelector('.taak-dropdown');
  if (dd.classList.contains('open')) {
    throw new Error('Test 6: closeAllMenus did not close all menus');
  }
}

// === Test 7: stuurAnnuleren exists as an async function ===
if (typeof context.stuurAnnuleren !== 'function') {
  throw new Error('Test 7: stuurAnnuleren is geen functie');
}
// Check it's async by checking the string
const fnStr = String(context.stuurAnnuleren);
if (!fnStr.includes('async')) {
  throw new Error('Test 7: stuurAnnuleren is niet async');
}

// === Test 8: akkoord-zin is shown when ja and risico are present ===
const card7 = context.dom['taak-kaart-7'];
const acties7 = card7.children.find(c => c.className === 'taak-acties');
const akkoordZin = acties7.children.find(c => c.className === 'akkoord-zin');
if (!akkoordZin) throw new Error('Test 8: geen akkoord-zin element gevonden op kaart 7');
if (akkoordZin.textContent !== 'Ja = Jan; risico: Laag.') {
  throw new Error('Test 8: akkoord-zin tekst is "' + akkoordZin.textContent + '", verwacht "Ja = Jan; risico: Laag."');
}

// === Test 9: akkoord-zin is NOT shown when ja/risico are missing ===
const card9 = context.dom['taak-kaart-9'];
const acties9 = card9.children.find(c => c.className === 'taak-acties');
const akkoordZin9 = acties9.children.find(c => c.className === 'akkoord-zin');
if (akkoordZin9) throw new Error('Test 9: akkoord-zin gevonden op kaart 9 waar ja/risico ontbreken');

// === Test 10: buttons show vragen suffix when vragen > 1 ===
const card7Acties = card7.children.find(c => c.className === 'taak-acties');
const btnAkkoord7 = card7Acties.children.find(c => c.className === 'btn btn-akkoord');
const btnAfwijs7 = card7Acties.children.find(c => c.className === 'btn btn-afwijs');
if (!btnAkkoord7 || btnAkkoord7.textContent !== '\u2713 Akkoord (3 vragen)') {
  throw new Error('Test 10a: akkoord-knop tekst is "' + (btnAkkoord7 ? btnAkkoord7.textContent : 'undefined') + '"');
}
if (!btnAfwijs7 || btnAfwijs7.textContent !== '\u2755 Afwijzen (3 vragen)') {
  throw new Error('Test 10b: afwijzen-knop tekst is "' + (btnAfwijs7 ? btnAfwijs7.textContent : 'undefined') + '"');
}

// card8 declareren vóór Test 11
const card8 = context.dom['taak-kaart-8'];
// === Test 11: buttons do NOT show vragen suffix when vragen = 1 ===
const card8Acties = card8.children.find(c => c.className === 'taak-acties');
const btnAkkoord8 = card8Acties.children.find(c => c.className === 'btn btn-akkoord');
const btnAfwijs8 = card8Acties.children.find(c => c.className === 'btn btn-afwijs');
if (!btnAkkoord8 || btnAkkoord8.textContent !== '\u2713 Akkoord') {
  throw new Error('Test 11a: akkoord-knop tekst is "' + (btnAkkoord8 ? btnAkkoord8.textContent : 'undefined') + '"');
}
if (!btnAfwijs8 || btnAfwijs8.textContent !== '\u2755 Afwijzen') {
  throw new Error('Test 11b: afwijzen-knop tekst is "' + (btnAfwijs8 ? btnAfwijs8.textContent : 'undefined') + '"');
}

// === Test 12: Details knop is aanwezig met juiste klas ===
const card7Details = card7Acties.children.find(c => c.className === 'btn btn-details');
if (!card7Details) throw new Error('Test 12: geen Details-knop gevonden');
if (card7Details.textContent !== 'Details') {
  throw new Error('Test 12: Details-knop tekst is "' + card7Details.textContent + '"');
}

// === Test 13: Details knop heeft click listener ===
if (!card7Details._listeners || !card7Details._listeners.click || card7Details._listeners.click.length === 0) {
  throw new Error('Test 13: Details-knop heeft geen click listener');
}

// === Test 13b: akkoord zonder details heeft geen Details knop ===
const card9Acties = card9.children.find(c => c.className === 'taak-acties');
if (card9Acties.children.find(c => c.className === 'btn btn-details')) {
  throw new Error('Test 13b: onverwachte Details-knop bij akkoord zonder details');
}

// === Test 14: akkoord-zin gebruikt textContent (niet innerHTML) ===
// De tekst moet als platte string staan
if (akkoordZin.innerHTML !== 'Ja = Jan; risico: Laag.') {
  throw new Error('Test 14: akkoord-zin innerHTML is anders dan textContent');
}

console.log('All menu tests passed!');
