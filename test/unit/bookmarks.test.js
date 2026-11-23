const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { listSources, readSource, readHtmlFile, parseHtml, toHtml } = require('../../bookmarks');

const tmpDir = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};

// ---------- HTML ----------

const NETSCAPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Toolbar</H3>
    <DL><p>
        <DT><A HREF="https://wiki.example.com/" ADD_DATE="1">Wiki &amp; more</A>
        <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
        <DT><H3>Nested</H3>
        <DL><p>
            <DT><A HREF='http://calc.example.org/x?a=1&amp;b=2'>Calc</A>
        </DL><p>
        <DT><H3>Empty</H3>
        <DL><p>
            <DT><A HREF="file:///etc/passwd">Local</A>
        </DL><p>
    </DL><p>
    <DT><A HREF=https://loose.example.net>&#x4E2D;&#25991; &lt;b&gt;</A>
</DL><p>
`;

test('parseHtml: folders, toolbar root, entities, only web addresses, empty folders dropped', () => {
  assert.deepEqual(parseHtml(NETSCAPE), [
    {
      title: 'Toolbar', root: 'bar', children: [
        { title: 'Wiki & more', url: 'https://wiki.example.com/' },
        { title: 'Nested', children: [{ title: 'Calc', url: 'http://calc.example.org/x?a=1&b=2' }] },
      ],
    },
    { title: '中文 <b>', url: 'https://loose.example.net' },
  ]);
});

test('parseHtml: garbage gives an empty tree', () => {
  assert.deepEqual(parseHtml(''), []);
  assert.deepEqual(parseHtml('<html><body>no bookmarks</body></html>'), []);
  assert.deepEqual(parseHtml('</DL></DL><A HREF="https://a.example">A</A>'), [{ title: 'A', url: 'https://a.example' }]);
});

test('toHtml: null when there is nothing to export', () => {
  assert.equal(toHtml(null), null);
  assert.equal(toHtml([]), null);
  assert.equal(toHtml([{ title: 'L', sites: [{ title: 'x', url: 'ftp://x' }] }]), null);
});

test('toHtml -> parseHtml round trip, escaping, non-web sites skipped', () => {
  const html = toHtml([
    { title: 'General', sites: [{ title: 'A "quoted" <site>', url: 'https://a.example/?q=1&r=2' }, { title: '', url: 'http://b.example/' }] },
    { title: 'Empty', sites: [] },
    { title: 'Game & Co', sites: [{ title: 'Bad', url: 'javascript:0' }, { title: 'Wiki', url: 'https://w.example/' }] },
    null,
  ]);
  assert.match(html, /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.deepEqual(parseHtml(html), [
    {
      title: 'General', children: [
        { title: 'A "quoted" <site>', url: 'https://a.example/?q=1&r=2' },
        { title: 'http://b.example/', url: 'http://b.example/' },
      ],
    },
    { title: 'Game & Co', children: [{ title: 'Wiki', url: 'https://w.example/' }] },
  ]);
});

test('readHtmlFile reads a file from disk', (t) => {
  const file = path.join(tmpDir(t), 'b.html');
  write(file, NETSCAPE);
  assert.deepEqual(readHtmlFile(file), parseHtml(NETSCAPE));
});

// ---------- Chromium ----------

const chromiumBookmarks = (name) => ({
  roots: {
    bookmark_bar: { type: 'folder', name: 'Bar', children: [{ type: 'url', name: name, url: 'https://bar.example/' }] },
    other: { type: 'folder', name: 'Other', children: [
      { type: 'folder', name: 'Sub', children: [{ type: 'url', name: 'S', url: 'https://sub.example/' }] },
      { type: 'url', name: 'Chrome page', url: 'chrome://settings' },
    ] },
    synced: { type: 'folder', name: 'Mobile', children: [] },
    custom_root: {
      speedDial: { type: 'folder', name: 'Speed Dials', children: [{ type: 'url', name: 'Dial', url: 'https://dial.example/' }] },
      trash: { type: 'folder', name: 'Trash', children: [{ type: 'url', name: 'T', url: 'https://trash.example/' }] },
    },
  },
});

test('Chromium: profiles named from Local State, Default first, bookmarks read', (t) => {
  const dir = tmpDir(t);
  const chrome = path.join(dir, 'chrome');
  write(path.join(chrome, 'Local State'), { profile: { info_cache: { Default: { name: 'Personal' }, 'Profile 2': { name: 'Work' } } } });
  write(path.join(chrome, 'Profile 10', 'Bookmarks'), chromiumBookmarks('p10'));
  write(path.join(chrome, 'Profile 2', 'Bookmarks'), chromiumBookmarks('p2'));
  write(path.join(chrome, 'Default', 'Bookmarks'), chromiumBookmarks('def'));
  fs.mkdirSync(path.join(chrome, 'Profile 3'));            // no bookmarks: skipped
  write(path.join(chrome, 'System Profile', 'Bookmarks'), chromiumBookmarks('sys')); // not a user profile

  const { sources, denied } = listSources([
    { browser: 'Chrome', engine: 'chromium', dir: chrome },
    { browser: 'Missing', engine: 'chromium', dir: path.join(dir, 'nope') },
  ]);
  assert.deepEqual(denied, []);
  assert.deepEqual(sources.map((s) => [s.id, s.browser, s.profile]), [
    ['0', 'Chrome', 'Personal'], ['1', 'Chrome', 'Work'], ['2', 'Chrome', 'Profile 10'],
  ]);
  assert.deepEqual(readSource(sources[0]), [
    { title: 'Bar', root: 'bar', children: [{ title: 'def', url: 'https://bar.example/' }] },
    { title: 'Other', root: 'other', children: [{ title: 'Sub', children: [{ title: 'S', url: 'https://sub.example/' }] }] },
    { title: 'Speed Dials', children: [{ title: 'Dial', url: 'https://dial.example/' }] },
  ]);
});

test('Chromium: single-profile folder (old Opera), one profile has no name', (t) => {
  const dir = tmpDir(t);
  write(path.join(dir, 'opera', 'Bookmarks'), chromiumBookmarks('o'));
  const { sources } = listSources([{ browser: 'Opera', engine: 'chromium', dir: path.join(dir, 'opera') }]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].profile, null);
});

test('listSources: browsers sorted by name, unknown engines ignored', (t) => {
  const dir = tmpDir(t);
  for (const b of ['vivaldi', 'brave', 'edge']) write(path.join(dir, b, 'Default', 'Bookmarks'), chromiumBookmarks(b));
  const { sources } = listSources([
    { browser: 'Vivaldi', engine: 'chromium', dir: path.join(dir, 'vivaldi') },
    { browser: 'brave', engine: 'chromium', dir: path.join(dir, 'brave') },
    { browser: 'Edge', engine: 'chromium', dir: path.join(dir, 'edge') },
    { browser: 'Other', engine: 'safari', dir },
  ]);
  assert.deepEqual(sources.map((s) => s.browser), ['brave', 'Edge', 'Vivaldi']);
});

// ---------- Firefox ----------

function makePlaces(file) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT);
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, position INTEGER, title TEXT, guid TEXT);
    INSERT INTO moz_places VALUES (1, 'https://fx-bar.example/'), (2, 'https://fx-menu.example/'), (3, 'place:sort=8'), (4, 'https://fx-sub.example/');
    INSERT INTO moz_bookmarks VALUES
      (1, 2, NULL, 0, 0, '', 'root________'),
      (2, 2, NULL, 1, 0, 'menu', 'menu________'),
      (3, 2, NULL, 1, 1, 'toolbar', 'toolbar_____'),
      (4, 2, NULL, 1, 2, 'unfiled', 'unfiled_____'),
      (10, 1, 1, 3, 1, 'Bar site', 'a1'),
      (11, 3, NULL, 3, 0, NULL, 'a2'),
      (12, 2, NULL, 3, 2, 'Folder', 'a3'),
      (13, 1, 4, 12, 0, 'Sub site', 'a4'),
      (14, 1, 2, 2, 0, 'Menu site', 'a5'),
      (15, 1, 3, 4, 0, 'Smart', 'a6');
  `);
  db.close();
}

test('Firefox: profiles.ini, relative and absolute paths, places.sqlite read', (t) => {
  const dir = tmpDir(t);
  const ff = path.join(dir, 'firefox');
  const abs = path.join(dir, 'elsewhere', 'abs.profile');
  makePlaces(path.join(ff, 'Profiles', 'rel.default', 'places.sqlite'));
  makePlaces(path.join(abs, 'places.sqlite'));
  write(path.join(ff, 'profiles.ini'), [
    '[General]', 'StartWithLastProfile=1', '',
    '[Profile0]', 'Name=default', 'IsRelative=1', 'Path=Profiles/rel.default', '',
    '[Profile1]', 'Name=other', 'IsRelative=0', `Path=${abs}`, '',
    '[Profile2]', 'Name=gone', 'IsRelative=1', 'Path=Profiles/missing', '',
    '[Install123]', 'Default=Profiles/rel.default', '',
  ].join('\r\n'));

  const { sources } = listSources([{ browser: 'Firefox', engine: 'firefox', dir: ff }]);
  assert.deepEqual(sources.map((s) => s.profile), ['default', 'other']);
  const expected = [
    { title: 'toolbar', root: 'bar', children: [
      { title: 'Bar site', url: 'https://fx-bar.example/' },
      { title: 'Folder', children: [{ title: 'Sub site', url: 'https://fx-sub.example/' }] },
    ] },
    { title: 'menu', root: 'menu', children: [{ title: 'Menu site', url: 'https://fx-menu.example/' }] },
  ];
  assert.deepEqual(readSource(sources[0]), expected);
  assert.deepEqual(readSource(sources[1]), expected);
});
