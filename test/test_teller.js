const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync(__dirname + '/../app.js', 'utf8');

function createMockElement(tag, id) {
  const el = {
    tag,
    id,
    className: '',
    style: { display: '' },
    children: [],
    dataset: {},
    appendChild: function(child) { this.children.push(child); },
    setAttribute: ()=>{},
    addEventListener: ()=>{}
  };
  let _textContent = '';
  Object.defineProperty(el, 'textContent', {
    get: () => _textContent,
    set: (val) => {
      _textContent = val;
      if (val === '') {
        el.children = [];
      }
    }
  });
  return el;
}

const dom = {};
const context = {
  document: {
    getElementById: (id) => {
      if (!dom[id]) {
        dom[id] = createMockElement('div', id);
      }
      return dom[id];
    },
    createElement: (tag) => createMockElement(tag),
    querySelectorAll: () => [],
    visibilityState: 'visible',
    addEventListener: () => {}
  },
  window: { addEventListener: ()=>{} },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console
};

vm.createContext(context);

// Run the app.js code
vm.runInContext(appCode, context);

// Test script
const testCode = `
  const tellerEl = document.getElementById('wacht-akkoord-teller');
  
  // Test 1: N = 0
  taken = [{ status: 'bezig' }, { status: 'klaar' }];
  updateWachtAkkoordTeller();
  if (tellerEl.style.display !== 'none') {
    throw new Error('Test 1 Failed: tellerEl.style.display is not "none" for N=0');
  }
  
  // Test 2: N > 0
  taken = [{ status: 'wacht_op_akkoord' }, { status: 'wacht_op_akkoord' }, { status: 'bezig' }];
  updateWachtAkkoordTeller();
  if (tellerEl.style.display === 'none') {
    throw new Error('Test 2 Failed: tellerEl.style.display should not be "none" for N=2');
  }
  if (tellerEl.textContent !== 'wacht op jouw akkoord: 2') {
    throw new Error('Test 2 Failed: tellerEl.textContent is incorrect, got: ' + tellerEl.textContent);
  }
  
  // Test 3: Verbergen van afgeronde taken (klaar / geannuleerd) by default
  const lijstEl = document.getElementById('taak-lijst');
  taken = [
    { status: 'bezig', titel: 'T1' }, 
    { status: 'klaar', titel: 'T2' }, 
    { status: 'geannuleerd', titel: 'T3' },
    { status: 'mislukt', titel: 'T4' }
  ];
  toonAfgerond = false; // default
  activeFilter = 'alle';
  renderLijst();
  
  if (lijstEl.children.length !== 2) {
    throw new Error('Test 3 Failed: expected 2 children (bezig, mislukt) when afgerond is hidden, got ' + lijstEl.children.length);
  }
  
  // Test 4: Tonen van afgeronde taken na toggle
  toonAfgerond = true;
  renderLijst();
  if (lijstEl.children.length !== 4) {
    throw new Error('Test 4 Failed: expected 4 children when afgerond is shown, got ' + lijstEl.children.length);
  }
  
  console.log('All tests passed!');
`;

try {
  vm.runInContext(testCode, context);
} catch (e) {
  console.error(e);
  process.exit(1);
}
