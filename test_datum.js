const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync('app.js', 'utf8');

const dom = {};
const context = {
  document: {
    getElementById: (id) => {
      if (!dom[id]) {
        dom[id] = { textContent: '', style: { display: '' } };
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
  // Test 1: geldige ISO-datum
  const resultaat = formatDatum('2025-03-15T14:30:00Z');
  if (resultaat === '') {
    throw new Error('Test 1 Failed: result should not be empty');
  }
  if (resultaat === '2025-03-15T14:30:00Z') {
    throw new Error('Test 1 Failed: result should differ from input');
  }

  // Test 2: ongeldige waarde ('onzin')
  const ongeldig = formatDatum('onzin');
  if (ongeldig !== 'onzin') {
    throw new Error('Test 2 Failed: formatDatum("onzin") should return "onzin", got: ' + ongeldig);
  }

  console.log('All tests passed!');
`;

try {
  vm.runInContext(testCode, context);
} catch (e) {
  console.error(e);
  process.exit(1);
}
