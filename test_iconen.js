const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)[1];
const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) =>
  Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]))
);
const expectedLinks = [
  { rel: 'apple-touch-icon', sizes: '180x180', href: 'apple-touch-icon.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: 'icons/favicon-32.png' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: 'icons/favicon-16.png' },
  { rel: 'icon', href: 'favicon.ico', sizes: 'any' },
];

for (const expected of expectedLinks) {
  assert.ok(links.some(link => Object.entries(expected).every(([key, value]) => link[key] === value)),
    `Missing icon link: ${expected.href}`);
  assert.ok(fs.existsSync(expected.href), `Missing icon file: ${expected.href}`);
}

// Read dimensions directly from the PNG IHDR chunk, without image dependencies.
for (const [file, size] of [
  ['apple-touch-icon.png', 180],
  ['icons/icon-180.png', 180],
  ['icons/favicon-32.png', 32],
  ['icons/favicon-16.png', 16],
]) {
  const png = fs.readFileSync(file);
  assert.ok(png.length >= 33, `Truncated PNG: ${file}`);
  assert.deepStrictEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.strictEqual(png.toString('ascii', 12, 16), 'IHDR');
  assert.strictEqual(png.readUInt32BE(16), size, `Wrong width: ${file}`);
  assert.strictEqual(png.readUInt32BE(20), size, `Wrong height: ${file}`);
}

// The ICO directory must contain all three browser sizes.
const ico = fs.readFileSync('favicon.ico');
assert.strictEqual(ico.readUInt16LE(0), 0);
assert.strictEqual(ico.readUInt16LE(2), 1);
assert.strictEqual(ico.readUInt16LE(4), 3);
const sizes = [];
for (let i = 0; i < 3; i++) {
  const offset = 6 + i * 16;
  sizes.push([ico[offset], ico[offset + 1]]);
  assert.ok(ico.readUInt32LE(offset + 8) > 0);
  assert.ok(ico.readUInt32LE(offset + 12) + ico.readUInt32LE(offset + 8) <= ico.length);
}
assert.deepStrictEqual(sizes.sort((a, b) => a[0] - b[0]), [[16, 16], [32, 32], [48, 48]]);
console.log('test_iconen: all tests passed');
