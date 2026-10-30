const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync('app.js', 'utf8');

const dom = {};
const context = {
  document: {
    getElementById: (id) => {
      if (!dom[id]) {
        dom[id] = { textContent: '', hidden: true, style: { display: '' } };
      }
      return dom[id];
    },
    createElement: () => ({ className: '', textContent: '', style: {}, appendChild: ()=>{}, setAttribute: ()=>{}, addEventListener: ()=>{} }),
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
  if (tellerEl.hidden !== true) {
    throw new Error('Test 1 Failed: tellerEl.hidden is not true for N=0');
  }
  
  // Test 2: N > 0
  taken = [{ status: 'wacht_op_akkoord' }, { status: 'wacht_op_akkoord' }, { status: 'bezig' }];
  updateWachtAkkoordTeller();
  if (tellerEl.hidden !== false) {
    throw new Error('Test 2 Failed: tellerEl.hidden should be false for N=2');
  }
  if (tellerEl.textContent !== 'wacht op akkoord: 2') {
    throw new Error('Test 2 Failed: tellerEl.textContent is incorrect, got: ' + tellerEl.textContent);
  }
  
  console.log('All tests passed!');
`;

try {
  vm.runInContext(testCode, context);
} catch (e) {
  console.error(e);
  process.exit(1);
}
