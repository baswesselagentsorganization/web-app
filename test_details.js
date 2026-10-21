// Approval details tests with a small DOM fake and Node's vm.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const elements = {};
function makeElement(tag) {
  const listeners = {};
  const attrs = {};
  const el = {
    tagName: tag.toUpperCase(), className: '', type: '', id: '', dataset: {}, style: { setProperty() {} },
    children: [], hidden: false,
    appendChild(child) { child._parent = this; this.children.push(child); return child; },
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name] ?? null; },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
    click() { for (const fn of listeners.click || []) fn({ stopPropagation() {} }); },
    _listeners: listeners
  };
  let ownText = '';
  Object.defineProperty(el, 'textContent', {
    get() { return ownText + el.children.map(child => child.textContent).join(''); },
    set(value) { ownText = String(value); el.children = []; }
  });
  return el;
}
const list = makeElement('ul');
elements['taak-lijst'] = list;
const parentWindow = { location: { hash: '' } };
const document = {
  getElementById(id) { return elements[id] || (elements[id] = makeElement('div')); },
  createElement: makeElement,
  createElementNS: (_ns, tag) => makeElement(tag),
  querySelectorAll: () => [],
  addEventListener() {},
  documentElement: { clientHeight: 800, clientWidth: 1000 }
};
const context = {
  document,
  window: { parent: parentWindow, confirm: () => false, addEventListener() {}, matchMedia: () => ({ matches: false }) },
  navigator: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setInterval() {}, fetch: () => Promise.resolve({ ok: true }), alert() {}, console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const detailText = 'Eerste regel\nTweede regel <script>niet uitvoeren</script>';
const tasks = [
  { id: 'met-details', status: 'wacht_op_akkoord', titel: 'Taak met details', agent: 'test', bijgewerkt: '2025-01-01', akkoord: { id: 1, details: detailText } },
  { id: 'zonder-details', status: 'wacht_op_akkoord', titel: 'Taak zonder details', agent: 'test', bijgewerkt: '2025-01-01', akkoord: { id: 2 } },
  { id: 'lege-details', status: 'wacht_op_akkoord', titel: 'Taak met lege details', agent: 'test', bijgewerkt: '2025-01-01', akkoord: { id: 3, details: '  ' } },
  { id: 'mislukt-met-details', status: 'mislukt', titel: 'Mislukte taak', agent: 'test', bijgewerkt: '2025-01-01', details: detailText, herstart_van: 42, plan: 'nachtplan' },
  { id: 'mislukt-zonder-details', status: 'mislukt', titel: 'Oude API taak', agent: 'test', bijgewerkt: '2025-01-01' }
];
vm.runInContext(`taken = ${JSON.stringify(tasks)}; activeFilter = 'alle';`, context);
function find(node, className) {
  if (node.className === className) return node;
  for (const child of node.children) {
    const found = find(child, className);
    if (found) return found;
  }
  return null;
}
function card(id) { return list.children.find(node => node.dataset.id === id); }
function detailButton(taskId) { return find(card(taskId), 'btn btn-details'); }

context.renderLijst();
let button = detailButton('met-details');
let details = find(card('met-details'), 'taak-details');
assert(details, 'details block is present in its card');
assert.equal(button.getAttribute('aria-controls'), 'taak-details-met-details');
assert.equal(details.id, button.getAttribute('aria-controls'));
assert.equal(button.getAttribute('aria-expanded'), 'false');
assert.equal(details.hidden, true);
button.click();
assert.equal(button.getAttribute('aria-expanded'), 'true');
assert.equal(details.hidden, false);
assert.equal(details.textContent, detailText, 'API text is assigned as textContent, including markup-like text');
assert.equal(details.innerHTML, undefined, 'details are not constructed through innerHTML');
button.click();
assert.equal(button.getAttribute('aria-expanded'), 'false');
assert.equal(details.hidden, true);
button.click();
context.renderLijst();
button = detailButton('met-details');
details = find(card('met-details'), 'taak-details');
assert.equal(button.getAttribute('aria-expanded'), 'true', 'expanded state survives list rendering');
assert.equal(details.hidden, false);

const failedButton = detailButton('mislukt-met-details');
let failedDetails = find(card('mislukt-met-details'), 'taak-details');
assert(failedButton, 'failed task with details has a Details button');
assert(failedDetails, 'failed task details block is present');
assert.equal(failedButton.getAttribute('aria-expanded'), 'false');
failedButton.click();
assert.equal(failedButton.getAttribute('aria-expanded'), 'true');
assert.equal(failedDetails.hidden, false);
assert.equal(failedDetails.textContent, detailText);
assert(find(card('mislukt-met-details'), 'taak-submeta').textContent.includes('opnieuw gestart uit taak 42'));
assert(find(card('mislukt-met-details'), 'taak-submeta').textContent.includes('plan: nachtplan'));
context.renderLijst();
assert.equal(detailButton('mislukt-met-details').getAttribute('aria-expanded'), 'true', 'task detail state survives list rendering');
assert.equal(detailButton('mislukt-zonder-details'), null, 'task without details has no Details button');

assert.equal(detailButton('zonder-details'), null, 'approval without details has no Details button');
assert.equal(detailButton('lege-details'), null, 'approval with whitespace-only details has no Details button');
assert.equal(parentWindow.location.hash, '', 'missing approval details do not redirect to chat');
console.log('Details tests passed');
