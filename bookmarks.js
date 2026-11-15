// Bookmarks of the installed browsers and of HTML bookmark files, for the
// import into a site list, and the export of the lists as an HTML bookmark
// file. Nothing is ever written to the browsers' data.
//
// Where the browsers keep their data comes from the platform module
// (bookmarkStores, see platform/index.js); here it is turned into sources,
// one per browser profile, and read:
//   - Chromium browsers (Chrome, Edge, Brave, Vivaldi, Opera...): the
//     Bookmarks JSON file of each profile; the profile names are in the
//     Local State file of the user data folder.
//   - Firefox and its derivatives: the places.sqlite database of each
//     profile (profiles.ini lists them). Firefox keeps it open and writes
//     its recent changes to places.sqlite-wal: both are copied to a
//     temporary folder and the copy is read with node:sqlite (included in
//     Electron), so a running Firefox is neither disturbed nor blocking.
//   - HTML files in the Netscape bookmark format, which every browser
//     exports (also Safari, whose own bookmarks need permissions).
//
// The result is a tree of nodes:
//   folder: { title, children, root? }   root: 'bar', 'menu', 'other' or
//                                        'mobile' for the browser's own
//                                        top folders (named by the page)
//   bookmark: { title, url }
// Only http(s) bookmarks are kept, and folders that end up empty are dropped.

const fs = require('fs');
const os = require('os');
const path = require('path');

const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const isWebUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url);

// ---------- sources ----------

// Chromium: the profiles of a user data folder that have bookmarks, named
// as in the browser (Local State), the default one first. Older Opera
// versions keep a single profile in the folder itself.
function chromiumProfiles(dir) {
  if (exists(path.join(dir, 'Bookmarks'))) return [{ profile: null, file: path.join(dir, 'Bookmarks') }];
  let info = {};
  try { info = readJson(path.join(dir, 'Local State')).profile?.info_cache ?? {}; } catch { /* no names */ }
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names
    .filter((n) => (n === 'Default' || /^Profile \d+$/.test(n)) && exists(path.join(dir, n, 'Bookmarks')))
    .sort((a, b) => (a === 'Default' ? -1 : b === 'Default' ? 1 : Number(a.slice(8)) - Number(b.slice(8))))
    .map((n) => ({ profile: info[n]?.name || n, file: path.join(dir, n, 'Bookmarks') }));
}

// Firefox: the profiles listed in profiles.ini that have bookmarks.
function firefoxProfiles(dir) {
  let ini;
  try { ini = fs.readFileSync(path.join(dir, 'profiles.ini'), 'utf8'); } catch { return []; }
  const sections = [];
  let cur = null;
  for (const line of ini.split(/\r?\n/)) {
    const head = line.match(/^\s*\[(.+)\]\s*$/);
    if (head) { cur = { section: head[1] }; sections.push(cur); continue; }
    const kv = line.match(/^\s*([^=]+?)\s*=\s*(.*?)\s*$/);
    if (kv && cur) cur[kv[1]] = kv[2];
  }
  return sections
    .filter((s) => /^Profile\d+$/.test(s.section) && s.Path)
    .map((s) => {
      const p = s.IsRelative === '0' ? s.Path : path.join(dir, s.Path);
      return { profile: s.Name || path.basename(p), file: path.join(p, 'places.sqlite') };
    })
    .filter((p) => exists(p.file));
}

// The sources found on this system: { id, browser, profile, engine, file }.
// `profile` is null when the browser has only one profile.
function listSources(stores) {
  const sources = [];
  for (const { browser, engine, dir } of stores) {
    if (!exists(dir)) continue;
    let profiles;
    if (engine === 'chromium') profiles = chromiumProfiles(dir);
    else if (engine === 'firefox') profiles = firefoxProfiles(dir);
    else continue;
    for (const p of profiles) sources.push({ browser, engine, profile: p.profile, file: p.file });
  }
  // In alphabetical order of the browser (sort is stable: each browser's
  // profiles keep their order, the default one first).
  sources.sort((a, b) => a.browser.localeCompare(b.browser, undefined, { sensitivity: 'base' }));
  // The same browser can be installed more than once (e.g. Snap and
  // Flatpak): its profiles are told apart by name only if there are several.
  const count = new Map();
  for (const s of sources) count.set(s.browser, (count.get(s.browser) ?? 0) + 1);
  return sources.map((s, i) => ({
    id: String(i),
    ...s,
    profile: count.get(s.browser) > 1 ? s.profile : null,
  }));
}

// ---------- reading ----------

// Drops what cannot be imported: non-web addresses, empty folders.
function prune(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.children) {
      const children = prune(n.children);
      if (children.length) out.push({ ...n, children });
    } else if (isWebUrl(n.url)) {
      out.push({ title: n.title || '', url: n.url });
    }
  }
  return out;
}

const CHROMIUM_ROOTS = [['bookmark_bar', 'bar'], ['other', 'other'], ['synced', 'mobile']];
// Opera's own top folders (in roots.custom_root), named by Opera itself in
// the user's language; its trash and pinboards are left out.
const OPERA_ROOTS = ['speedDial', 'unsorted', 'userRoot'];

function readChromium(file) {
  const roots = readJson(file).roots ?? {};
  const convert = (n) => (n.type === 'folder'
    ? { title: n.name || '', children: (n.children ?? []).map(convert) }
    : { title: n.name || '', url: n.url });
  const custom = roots.custom_root ?? {};
  return prune([
    ...CHROMIUM_ROOTS.filter(([key]) => roots[key]).map(([key, root]) => ({ ...convert(roots[key]), root })),
    ...OPERA_ROOTS.filter((key) => custom[key]?.type === 'folder').map((key) => convert(custom[key])),
  ]);
}

const FIREFOX_ROOTS = [['toolbar_____', 'bar'], ['menu________', 'menu'], ['unfiled_____', 'other'], ['mobile______', 'mobile']];

function readFirefox(file) {
  const { DatabaseSync } = require('node:sqlite');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-browser-bookmarks-'));
  let db;
  try {
    const copy = path.join(tmp, 'places.sqlite');
    fs.copyFileSync(file, copy);
    if (exists(file + '-wal')) fs.copyFileSync(file + '-wal', copy + '-wal');
    // Not read-only: opening applies the -wal copy to the database.
    db = new DatabaseSync(copy);
    const rows = db.prepare(
      `SELECT b.id, b.type, b.parent, b.title, b.guid, p.url
         FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk
        ORDER BY b.parent, b.position`).all();
    const children = new Map();   // parent id -> rows
    for (const r of rows) {
      if (!children.has(r.parent)) children.set(r.parent, []);
      children.get(r.parent).push(r);
    }
    // type 1: bookmark, 2: folder, 3: separator
    const convert = (r) => (r.type === 2
      ? { title: r.title || '', children: (children.get(r.id) ?? []).map(convert) }
      : { title: r.title || '', url: r.type === 1 ? r.url : null });
    const byGuid = new Map(rows.map((r) => [r.guid, r]));
    return prune(FIREFOX_ROOTS
      .filter(([guid]) => byGuid.has(guid))
      .map(([guid, root]) => ({ ...convert(byGuid.get(guid)), root })));
  } finally {
    try { db?.close(); } catch { /* already closed */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function readSource(source) {
  return source.engine === 'firefox' ? readFirefox(source.file) : readChromium(source.file);
}

// ---------- HTML files ----------
//
// Netscape bookmark format: <DT><H3>folder</H3> followed by its <DL> ...
// </DL>, <DT><A HREF="...">bookmark</A>. Browsers write it loosely (tags
// left open), so it is scanned for these tags only.

function decodeEntities(s) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (k[0] === '#') {
        const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        try { return String.fromCodePoint(code); } catch { return m; }
      }
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[k];
    })
    .trim();
}

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3]) : null;
};

function parseHtml(text) {
  const top = { children: [] };
  const stack = [top];
  let pending = null;   // folder whose <DL> has not been seen yet
  const re = /<h3\b([^>]*)>([\s\S]*?)<\/h3>|<a\b([^>]*)>([\s\S]*?)<\/a>|<(\/?)dl\b[^>]*>/gi;
  let m;
  while ((m = re.exec(text))) {
    const parent = stack[stack.length - 1];
    if (m[2] !== undefined) {
      const folder = { title: decodeEntities(m[2]), children: [] };
      if (/\bPERSONAL_TOOLBAR_FOLDER\s*=\s*"?true/i.test(m[1])) folder.root = 'bar';
      parent.children.push(folder);
      pending = folder;
    } else if (m[4] !== undefined) {
      parent.children.push({ title: decodeEntities(m[4]), url: attr(m[3], 'href') });
      pending = null;
    } else if (m[5] === '/') {
      if (stack.length > 1) stack.pop();
    } else {
      // A <DL> opens the folder just named; any other (the file's outermost
      // one) keeps adding to the current folder, until its </DL>.
      stack.push(pending ?? parent);
      pending = null;
    }
  }
  return prune(top.children);
}

function readHtmlFile(file) {
  return parseHtml(fs.readFileSync(file, 'utf8'));
}

// The export: one folder per site list, [{ title, sites: [{ title, url }] }]
// (from the page: anything else is skipped), in the same format. Returns
// null if there is nothing to export.
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function toHtml(folders) {
  if (!Array.isArray(folders)) return null;
  const now = Math.floor(Date.now() / 1000);
  const lines = [];
  for (const f of folders) {
    const sites = (Array.isArray(f?.sites) ? f.sites : []).filter((s) => isWebUrl(s?.url));
    if (!sites.length) continue;
    lines.push(`    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${escapeHtml(f.title ?? '')}</H3>`, '    <DL><p>');
    for (const s of sites) lines.push(`        <DT><A HREF="${escapeHtml(s.url)}" ADD_DATE="${now}">${escapeHtml(s.title || s.url)}</A>`);
    lines.push('    </DL><p>');
  }
  if (!lines.length) return null;
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...lines,
    '</DL><p>',
    '',
  ].join('\n');
}

module.exports = { listSources, readSource, readHtmlFile, parseHtml, toHtml };
