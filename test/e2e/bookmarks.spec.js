// Bookmark import from an HTML file and export of the lists. The system
// file dialogs are replaced from the main process.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { parseHtml } = require('../../bookmarks');
const { launch, site, list } = require('./helpers');

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const BOOKMARKS = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Games</H3>
  <DL><p>
    <DT><A HREF="https://wiki.example.com/">Wiki</A>
    <DT><A HREF="https://calc.example.com/">Calculator</A>
    <DT><A HREF="https://already.example.com/">Already there</A>
  </DL><p>
</DL><p>`;

const replaceDialog = (app, name, result) =>
  app.evaluate(({ dialog }, { name, result }) => { dialog[name] = async () => result; }, { name, result });

test('import from an HTML file into a list, skipping the addresses it has', async () => {
  o = await launch({ prefs: { lists: [list(null, [site('https://already.example.com/', 'Already')])] } });
  const { page, app } = o;
  const file = path.join(o.dir, 'bookmarks.html');
  fs.writeFileSync(file, BOOKMARKS);
  await replaceDialog(app, 'showOpenDialog', { canceled: false, filePaths: [file] });

  await page.locator('#import-btn').click();
  await expect(page.locator('#add-dialog')).toBeVisible();
  await page.locator('#bm-file').click();
  await expect(page.locator('#bm-tree')).toContainText('Calculator');
  await page.locator('#bm-all').check();
  await expect(page.locator('#add-ok')).toBeEnabled();
  await page.locator('#add-ok').click();
  await expect(page.locator('#add-dialog')).toBeHidden();

  await expect.poll(() => o.savedPrefs().lists[0].sites.map((s) => s.url)).toEqual([
    'https://already.example.com/', 'https://wiki.example.com/', 'https://calc.example.com/',
  ]);
});

// The current list was missing from "To the list" (empty choice) while it
// was still a new one: currentList() makes a new object at each call.
test('the import from the Home shows a new current list as the target, and creates it', async () => {
  o = await launch({ foregroundApp: { exe: 'MyGame.exe', name: 'My Game', title: 'My Game' } });
  const { page, app } = o;
  const file = path.join(o.dir, 'bookmarks.html');
  fs.writeFileSync(file, BOOKMARKS);
  await replaceDialog(app, 'showOpenDialog', { canceled: false, filePaths: [file] });

  await page.locator('#import-btn').click();
  await expect(page.locator('#add-list option:checked')).toHaveText('My Game (new)');
  await page.locator('#bm-file').click();
  await expect(page.locator('#bm-tree')).toContainText('Wiki');
  await page.locator('#bm-all').check();
  await page.locator('#add-ok').click();
  await expect(page.locator('#add-dialog')).toBeHidden();

  await expect.poll(() => o.savedPrefs().lists.find((l) => l.match?.exe)?.sites.map((s) => s.url)).toEqual([
    'https://wiki.example.com/', 'https://calc.example.com/', 'https://already.example.com/',
  ]);
});

// Browser data folders with one profile each (see bookmark-stores.json in
// main.js), whose bookmark bar holds a bookmark named after the browser.
function writeStores(dir, browsers) {
  const stores = browsers.map((browser) => {
    const store = path.join(dir, 'browsers', browser);
    fs.mkdirSync(path.join(store, 'Default'), { recursive: true });
    fs.writeFileSync(path.join(store, 'Default', 'Bookmarks'), JSON.stringify({ roots: {
      bookmark_bar: { type: 'folder', name: 'Bar', children: [
        { type: 'url', name: `${browser} bookmark`, url: `https://${browser.toLowerCase()}.example.com/` },
      ] },
    } }));
    return { browser, engine: 'chromium', dir: store };
  });
  fs.writeFileSync(path.join(dir, 'bookmark-stores.json'), JSON.stringify(stores));
}

test('the import shows again the browser chosen last, also after a restart', async () => {
  test.skip(process.platform === 'darwin', 'macOS: bookmarks are imported from a file only');
  o = await launch();
  writeStores(o.dir, ['Alpha', 'Beta']);
  const { page } = o;
  const source = page.locator('#bm-source');

  await page.locator('#import-btn').click();
  await expect(page.locator('#bm-tree')).toContainText('Alpha bookmark');
  await source.selectOption({ label: 'Beta' });
  await expect(page.locator('#bm-tree')).toContainText('Beta bookmark');
  await page.locator('#add-cancel').click();
  await expect(page.locator('#add-dialog')).toBeHidden();

  // A browser installed meanwhile comes first in the list: the one chosen
  // is found by its data, not by its position.
  await o.close({ keepDir: true });
  writeStores(o.dir, ['Aaa', 'Alpha', 'Beta']);
  o = await launch({ dir: o.dir });
  await o.page.locator('#import-btn').click();
  await expect(o.page.locator('#bm-tree')).toContainText('Beta bookmark');
  await expect(o.page.locator('#bm-source option:checked')).toHaveText('Beta');
});

test('export of the lists as an HTML bookmark file', async () => {
  o = await launch({
    prefs: {
      lists: [
        list(null, [site('https://general.example.com/', 'General site')]),
        list({ exe: 'mygame' }, [site('https://game.example.com/', 'Game wiki')], { name: 'My Game' }),
      ],
    },
  });
  const { page, app } = o;
  const file = path.join(o.dir, 'export.html');
  await replaceDialog(app, 'showSaveDialog', { canceled: false, filePath: file });

  await page.locator('#export-btn').click();
  await expect(page.locator('#export-dialog')).toBeVisible();
  await expect(page.locator('#ex-all')).toBeChecked();
  await page.locator('#export-ok').click();
  await expect(page.locator('#export-dialog')).toBeHidden();

  await expect.poll(() => fs.existsSync(file)).toBe(true);
  const tree = parseHtml(fs.readFileSync(file, 'utf8'));
  expect(tree.map((f) => f.title)).toHaveLength(2);
  expect(tree.flatMap((f) => f.children.map((b) => b.url))).toEqual([
    'https://general.example.com/', 'https://game.example.com/',
  ]);
  expect(tree[1].title).toBe('My Game');
});
