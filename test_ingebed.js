const vm = require('vm');
const fs = require('fs');

const appCode = fs.readFileSync('app.js', 'utf8');

/**
 * Create a fresh vm context.
 * @param {{ self: any, top: any }} win
 * @returns {{ context: object, htmlEl: object }}
 */
function makeContext(win) {
  const htmlEl = {
    tagName: 'HTML',
    className: '',
    classList: {
      add(c) { this[c] = true; },
      remove(c) { delete this[c]; },
      contains(c) { return !!this[c] }
    }
  };

  const ctx = vm.createContext({
    document: {
      documentElement: htmlEl,
      getElementById: () => null,
      createElement: () => ({}),
      querySelectorAll: () => [],
      addEventListener: () => {},
      visibilityState: 'visible'
    },
    window: win,
    navigator: {},
    setInterval: () => {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ taken: [], eigenaar: 'test' }) }),
    console: console,
    localStorage: { getItem: () => null, setItem: () => {} }
  });

  return { context: ctx, htmlEl };
}

// === Test 1: window.self !== window.top → class 'ingebed' wordt gezet ===
{
  const selfObj = {};
  const topObj = {};
  const win = { self: selfObj, top: topObj, addEventListener: () => {} };

  const { context } = makeContext(win);
  vm.runInContext(appCode, context);

  // Roep de functie direct aan (zoals de andere tests ook functies direct aanroepen)
  context.ingebedClassZetten();

  if (!context.document.documentElement.classList.contains('ingebed')) {
    throw new Error('Test 1 Failed: html moet class "ingebed" krijgen als self !== top');
  }
}

// === Test 2: window.self === window.top → class 'ingebed' wordt NIET gezet ===
{
  const sameWin = { self: {}, top: {}, addEventListener: () => {} };
  sameWin.self = sameWin;
  sameWin.top = sameWin;

  const { context, htmlEl } = makeContext(sameWin);
  vm.runInContext(appCode, context);

  context.ingebedClassZetten();

  if (context.document.documentElement.classList.contains('ingebed')) {
    throw new Error('Test 2 Failed: html mag geen class "ingebed" krijgen als self === top');
  }
}

console.log('All ingebed tests passed!');
