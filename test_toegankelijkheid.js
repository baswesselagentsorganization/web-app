// Accessibility tests for the task menu, using a small DOM fake and Node's vm.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const dom = {};
let activeElement = null;

function makeElement(tag) {
  const attrs = {};
  const children = [];
  const listeners = {};
  const classes = new Set();
  const el = {
    tagName: tag.toUpperCase(), type: '', id: '', style: { setProperty() {} }, dataset: {}, children,
    _attrs: attrs, _listeners: listeners, _parent: null,
    className: '',
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name) || el.className.split(/\s+/).includes(name); }
    },
    appendChild(child) { child._parent = this; children.push(child); return child; },
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name] ?? null; },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    focus() { activeElement = this; },
    click() { for (const fn of listeners.click || []) fn({ stopPropagation() {} }); },
    querySelector(selector) {
      const needle = selector.slice(1);
      for (const child of children) {
        if (child.className.includes(needle)) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    },
    contains(target) { return this === target || children.some(child => child.contains(target)); },
    getBoundingClientRect() { return { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 }; }
  };
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get() { return text + children.map(child => child.textContent).join(''); },
    set(value) { text = String(value); children.length = 0; }
  });
  return el;
}

const list = makeElement('ul');
dom['taak-lijst'] = list;
const document = {
  get activeElement() { return activeElement; },
  documentElement: { clientHeight: 800, clientWidth: 1000 },
  getElementById(id) { return dom[id] || (dom[id] = makeElement('div')); },
  createElement: makeElement,
  createElementNS: (_ns, tag) => makeElement(tag),
  addEventListener() {},
  querySelectorAll(selector) {
    const found = [];
    function walk(node) {
      for (const child of node.children) {
        const matches = selector === '.taak-dropdown.open'
          ? child.className.includes('taak-dropdown') && child.classList.contains('open')
          : selector === '.taak-dropdown'
            ? child.className.includes('taak-dropdown')
            : selector === '.taak-menu'
              ? child.className.includes('taak-menu')
              : false;
        if (matches) found.push(child);
        walk(child);
      }
    }
    walk(list);
    return found;
  }
};
const context = {
  document, window: { innerHeight: 800, innerWidth: 1000, matchMedia: () => ({ matches: false }), addEventListener() {} },
  navigator: {}, localStorage: { getItem: () => null, setItem() {} },
  setInterval() {}, fetch: () => Promise.resolve({ ok: true }), alert() {}, console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
const tasks = [
  { id: 1, status: 'bezig', titel: 'Actieve taak', agent: 'test', bijgewerkt: '2025-01-01T00:00:00Z', akkoord: { id: 5 } },
  { id: 2, status: 'klaar', titel: 'Afgeronde taak', agent: 'test', bijgewerkt: '2025-01-01T00:00:00Z' }
];
vm.runInContext(`taken = ${JSON.stringify(tasks)}; activeFilter = 'alle';`, context);
context.renderLijst();

function card(id) { return list.children.find(child => child.dataset.id === id); }
function menuParts(id) {
  const actions = card(id).children.find(child => child.className === 'taak-acties');
  const menu = actions.children.find(child => child.className.includes('taak-menu'));
  return { menu, button: menu.children[0], dropdown: menu.children[1], item: menu.children[1].children[0] };
}
function key(target, value) {
  let prevented = false;
  let current = target;
  while (current) {
    for (const fn of current._listeners.keydown || []) {
      fn({ key: value, preventDefault() { prevented = true; }, stopPropagation() {} });
    }
    current = current._parent;
  }
  return prevented;
}

const active = menuParts(1);
assert.equal(active.button.getAttribute('aria-label'), 'Meer opties');
assert.equal(active.button.getAttribute('aria-haspopup'), 'menu');
assert.equal(active.button.getAttribute('aria-expanded'), 'false');
assert.equal(active.button.getAttribute('aria-controls'), active.dropdown.id);
assert.equal(active.dropdown.getAttribute('role'), 'menu');
assert.equal(active.item.tagName, 'BUTTON');
assert.equal(active.item.getAttribute('role'), 'menuitem');

assert(key(active.button, 'Enter'));
assert.equal(active.button.getAttribute('aria-expanded'), 'true');
assert(active.dropdown.classList.contains('open'));
assert.equal(document.activeElement, active.item);
assert(key(active.item, 'ArrowDown'));
assert.equal(document.activeElement, active.item, 'single item wraps on ArrowDown');
assert(key(active.item, 'ArrowUp'));
assert.equal(document.activeElement, active.item, 'single item wraps on ArrowUp');
assert(key(active.item, 'Home'));
assert(key(active.item, 'End'));
assert(key(active.item, 'Escape'));
assert.equal(active.button.getAttribute('aria-expanded'), 'false');
assert.equal(document.activeElement, active.button);

key(active.button, ' ');
assert.equal(active.button.getAttribute('aria-expanded'), 'true');
key(active.dropdown, 'Tab');
assert.equal(active.button.getAttribute('aria-expanded'), 'false');

let cancelCalls = 0;
context.stuurAnnuleren = id => { assert.equal(id, 1); cancelCalls++; };
key(active.button, 'ArrowDown');
key(active.item, 'Enter');
assert.equal(cancelCalls, 1, 'Enter activates Annuleren');
key(active.button, 'ArrowDown');
active.item.click();
assert.equal(cancelCalls, 2, 'click activates Annuleren');

const inactive = menuParts(2);
assert.equal(inactive.item.textContent, 'Geen acties');
assert.equal(inactive.item.getAttribute('aria-disabled'), 'true');
key(inactive.button, 'Enter');
inactive.item.click();
assert.equal(cancelCalls, 2, 'disabled item does not activate');

function checkButtons(node) {
  if (node.tagName === 'BUTTON' && node.textContent.trim() === '') {
    assert(node.getAttribute('aria-label'), `button without visible text lacks aria-label (${node.className})`);
  }
  for (const child of node.children) checkButtons(child);
}
for (const id of [1, 2]) checkButtons(card(id));
console.log('Accessibility menu tests passed');
