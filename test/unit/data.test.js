// Checks of the data files shipped with the app: translations and
// predefined lists.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(root, ...p), 'utf8'));
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// ---------- locales ----------

const codes = fs.readdirSync(path.join(root, 'locales')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const en = readJson('locales', 'en.json');

test('locales: English is there', () => assert.ok(codes.includes('en')));

for (const code of codes.filter((c) => c !== 'en')) {
  test(`locales: ${code} has the same keys and placeholders as en`, () => {
    const msgs = readJson('locales', `${code}.json`);
    assert.deepEqual(Object.keys(msgs).filter((k) => !(k in en)), [], 'keys not in en');
    assert.deepEqual(Object.keys(en).filter((k) => !(k in msgs)), [], 'keys missing');
    for (const [k, v] of Object.entries(msgs)) {
      assert.equal(typeof v, 'string', k);
      assert.ok(v.trim(), `${k} is empty`);
      assert.deepEqual(placeholders(v), placeholders(en[k]), `placeholders of ${k}`);
    }
  });
}

test('locales: the keys used by the code exist', () => {
  const used = new Set();
  for (const file of ['main.js', 'index.html']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([\w.]*\w)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-[\w-]+)?="([\w.]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 50, `only ${used.size} keys found: has the code changed?`);
  assert.deepEqual([...used].filter((k) => !(k in en)).sort(), []);
});

// ---------- predefined lists (lists/README.md) ----------

test('lists: index.json and its files are valid', () => {
  const index = readJson('lists', 'index.json');
  assert.ok(Array.isArray(index.lists));
  const seenExe = new Set();
  for (const entry of index.lists) {
    assert.match(entry.file, /^[\w-]+\.json$/);
    assert.ok(Array.isArray(entry.exe) && entry.exe.length, `${entry.file}: exe`);
    for (const exe of entry.exe) {
      assert.equal(exe, exe.toLowerCase(), `${exe}: lowercase`);
      assert.doesNotMatch(exe, /\.exe$/, `${exe}: without .exe`);
      assert.ok(!seenExe.has(exe), `${exe}: in more than one list`);
      seenExe.add(exe);
    }
    const list = readJson('lists', entry.file);
    assert.ok(typeof list.name === 'string' && list.name.trim(), `${entry.file}: name`);
    assert.ok(Array.isArray(list.sites) && list.sites.length, `${entry.file}: sites`);
    const urls = new Set();
    for (const s of list.sites) {
      assert.match(s.url, /^https?:\/\//, `${entry.file}: ${s.url}`);
      assert.doesNotThrow(() => new URL(s.url));
      assert.ok(!urls.has(new URL(s.url).href), `${entry.file}: ${s.url} twice`);
      urls.add(new URL(s.url).href);
      if ('title' in s) assert.equal(typeof s.title, 'string');
    }
  }
  const files = fs.readdirSync(path.join(root, 'lists')).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.deepEqual(files.filter((f) => !index.lists.some((e) => e.file === f)), [], 'list files not in index.json');
});
