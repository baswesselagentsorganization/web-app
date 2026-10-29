const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('style.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// Color literals belong only in token declarations, including the light-theme token block.
const outsideTokens = css
  .replace(/:root\s*\{[^}]*\}/g, '')
  .replace(/@media\s*\(prefers-color-scheme:\s*light\)\s*\{\s*:root\s*\{[^}]*\}\s*\}/g, '');
assert.ok(!/(#[\da-f]{3,8}\b|\b(?:rgb|rgba)\s*\()/i.test(outsideTokens), 'kleurwaarden buiten thema-tokens');
assert.ok(!/style\s*=\s*"[^"]*\bcolor\s*:/i.test(html), 'geen inline kleurstijl in index.html');
assert.ok(!/\.style\s*\.\s*(?:color|backgroundColor|borderColor)\s*=|\.style\.setProperty\s*\(\s*["'][^"']*(?:color|kleur)/i.test(app), 'app.js zet geen inline kleurstijl');
console.log('test_huisstijl: all tests passed');
