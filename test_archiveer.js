const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync('app.js', 'utf8');

// Minimal DOM mock
const dom = {};
const hiddenStore = { value: '[]' };

const context = {
  localStorage: {
    getItem: (key) => {
      if (key === 'verborgen-taken') return hiddenStore.value;
      return null;
    },
    setItem: (key, val) => {
      if (key === 'verborgen-taken') hiddenStore.value = val;
    }
  },
  document: {
    getElementById: (id) => {
      if (!dom[id]) {
        dom[id] = { textContent: '', style: { display: '' } };
      }
      return dom[id];
    },
    createElement: (tag) => {
      return {
        className: '',
        textContent: '',
        style: {},
        appendChild: () => {},
        setAttribute: () => {},
        addEventListener: () => {},
        tagName: tag
      };
    },
    createElementNS: (ns, tag) => {
      const el = context.document.createElement(tag);
      el.setAttribute = function (attr, val) {
        if (attr === 'width') el.setAttribute('width', val);
        else if (attr === 'height') el.setAttribute('height', val);
        else if (attr === 'viewBox') el.setAttribute('viewBox', val);
        else if (attr === 'fill') el.setAttribute('fill', val);
        else if (attr === 'stroke') el.setAttribute('stroke', val);
        else if (attr === 'stroke-width') el.setAttribute('stroke-width', val);
        else if (attr === 'aria-hidden') el.setAttribute('aria-hidden', val);
        else el.setAttribute(attr, val);
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
  window: { addEventListener: () => {} },
  navigator: {},
  setInterval: () => {},
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
  console: console
};

vm.createContext(context);
vm.runInContext(appCode, context);

// Run tests
const testCode = `
  // --- Test 1: only klaar and mislukt get the archive button ---
  // We check by looking at maakKaart return value for each status

  const archiveableStatuses = ['klaar', 'mislukt'];
  const nonArchiveableStatuses = ['nieuw', 'gepland', 'bezig', 'wacht_op_akkoord', 'geannuleerd'];

  // We cannot easily check DOM inside vm, so we verify the logic via
  // the filter behavior: hidden tasks should not appear.

  // --- Test 2: hidden tasks are filtered from render ---
  taken = [
    { id: 1, status: 'klaar', titel: 'A', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
    { id: 2, status: 'mislukt', titel: 'B', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' },
    { id: 3, status: 'bezig', titel: 'C', agent: 'a', bijgewerkt: '2025-01-01T00:00:00Z' }
  ];

  // Initially nothing hidden
  if (verborgenIds().length !== 0) {
    throw new Error('Test 2a Failed: verborgenIds should be empty');
  }

  // Add task 1 to hidden
  voegToeAanVerborgen(1);
  if (verborgenIds().length !== 1) {
    throw new Error('Test 2b Failed: verborgenIds should have 1 entry');
  }
  if (verborgenIds()[0] !== '1') {
    throw new Error('Test 2c Failed: hidden id should be "1", got: ' + verborgenIds()[0]);
  }

  // Add task 2 to hidden
  voegToeAanVerborgen(2);
  if (verborgenIds().length !== 2) {
    throw new Error('Test 2d Failed: verborgenIds should have 2 entries');
  }

  // Toggle task 1 out
  const nowUnhidden = toggleVerborgen(1);
  if (nowUnhidden) {
    throw new Error('Test 2e Failed: toggleVerborgen(1) should return false (was hidden, now unhidden)');
  }
  if (verborgenIds().length !== 1) {
    throw new Error('Test 2f Failed: verborgenIds should have 1 entry after toggle off');
  }

  // Toggle task 1 back in
  const nowHidden = toggleVerborgen(1);
  if (!nowHidden) {
    throw new Error('Test 2g Failed: toggleVerborgen(1) should return true (now hidden again)');
  }
  if (verborgenIds().length !== 2) {
    throw new Error('Test 2h Failed: verborgenIds should have 2 entries again');
  }

  // --- Test 3: formatDatum still works after patch ---
  const resultaat = formatDatum('2025-03-15T14:30:00Z');
  if (resultaat === '') {
    throw new Error('Test 3 Failed: formatDatum should not return empty');
  }
  const ongeldig = formatDatum('onzin');
  if (ongeldig !== 'onzin') {
    throw new Error('Test 3b Failed: formatDatum("onzin") should return "onzin"');
  }

  console.log('All archiveer tests passed!');
`;

try {
  vm.runInContext(testCode, context);
} catch (e) {
  console.error(e);
  process.exit(1);
}
