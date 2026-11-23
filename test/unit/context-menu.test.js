const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contextMenuItems } = require('../../context-menu');
const en = require('../../locales/en.json');

const ALL = { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canSelectAll: true };
const params = (p) => ({ isEditable: false, selectionText: '', formControlType: 'none', linkURL: '', mediaType: 'none',
  hasImageContents: false, editFlags: ALL, ...p });
const keys = (items) => items && items.map((i) => i.key ?? '-');
const site = { overlayPage: false, platform: 'linux' };
const overlay = { overlayPage: true, platform: 'linux' };

test('text field: the edit commands, enabled as Chromium says', () => {
  const items = contextMenuItems(params({ isEditable: true, editFlags: { ...ALL, canUndo: false, canPaste: false } }), site);
  assert.deepEqual(keys(items), ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'selectAll']);
  assert.equal(items.find((i) => i.key === 'undo').enabled, false);
  assert.equal(items.find((i) => i.key === 'paste').enabled, false);
  assert.equal(items.find((i) => i.key === 'cut').enabled, true);
  // The same in the overlay page.
  assert.deepEqual(keys(contextMenuItems(params({ isEditable: true }), overlay)), keys(items));
});

test('Redo accelerator: Ctrl+Y on Windows', () => {
  const redo = (platform) => contextMenuItems(params({ isEditable: true }), { overlayPage: false, platform })
    .find((i) => i.key === 'redo').accelerator;
  assert.equal(redo('win32'), 'Ctrl+Y');
  assert.equal(redo('darwin'), 'CmdOrCtrl+Shift+Z');
});

test('text of a site page: Copy and Select All', () => {
  assert.deepEqual(keys(contextMenuItems(params({}), site)), ['copy', 'selectAll']);
});

test('overlay page: only on a read-only field or a selection', () => {
  assert.equal(contextMenuItems(params({}), overlay), null);
  assert.equal(contextMenuItems(params({ formControlType: 'select-one' }), overlay), null);
  assert.deepEqual(keys(contextMenuItems(params({ formControlType: 'input-text' }), overlay)), ['copy', 'selectAll']);
  assert.deepEqual(keys(contextMenuItems(params({ selectionText: 'x' }), overlay)), ['copy', 'selectAll']);
  // Never the link and image items there.
  assert.deepEqual(keys(contextMenuItems(params({ selectionText: 'x', linkURL: 'https://a.example/' }), overlay)), ['copy', 'selectAll']);
});

test('link of a site page: open in new tab (http(s) only) and copy, first', () => {
  const items = contextMenuItems(params({ linkURL: 'https://a.example/x' }), site);
  assert.deepEqual(keys(items), ['openLink', 'copyLink', '-', 'copy', 'selectAll']);
  assert.equal(items[0].url, 'https://a.example/x');
  assert.deepEqual(keys(contextMenuItems(params({ linkURL: 'mailto:a@example.com' }), site)), ['copyLink', '-', 'copy', 'selectAll']);
  // A link in a text field: the edit commands only.
  assert.deepEqual(keys(contextMenuItems(params({ isEditable: true, linkURL: 'https://a.example/' }), site)),
    ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'selectAll']);
});

test('image: copy image, after the link items', () => {
  assert.deepEqual(keys(contextMenuItems(params({ mediaType: 'image', hasImageContents: true }), site)),
    ['copyImage', '-', 'copy', 'selectAll']);
  assert.deepEqual(keys(contextMenuItems(params({ mediaType: 'image', hasImageContents: true, linkURL: 'https://a.example/' }), site)),
    ['openLink', 'copyLink', '-', 'copyImage', '-', 'copy', 'selectAll']);
  // Image not loaded: nothing to copy.
  assert.deepEqual(keys(contextMenuItems(params({ mediaType: 'image', hasImageContents: false }), site)), ['copy', 'selectAll']);
});

test('every item has its label', () => {
  const all = contextMenuItems(params({ isEditable: false, mediaType: 'image', hasImageContents: true, linkURL: 'https://a.example/' }), site)
    .concat(contextMenuItems(params({ isEditable: true }), site));
  for (const i of all) if (i.key) assert.ok(en[`edit.${i.key}`], `edit.${i.key}`);
});
