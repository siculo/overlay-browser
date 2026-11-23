const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SETTINGS, isValidSetting, loadSettings } = require('../../settings');

test('defaults are valid', () => {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) assert.equal(isValidSetting(k, v), true, k);
});

test('isValidSetting: types, ranges and lists', () => {
  const ok = [['opacity', 0.3], ['opacity', 1], ['unloadAfter', 5], ['unloadAfter', 60], ['accent', 'blue'],
    ['fixedTabs', 'icons'], ['searchEngine', 'custom'], ['browseStart', 'https://a.example/'],
    ['searchCustom', 'https://s.example/?q=%s'], ['searchCustom', ''], ['hideOnBlur', false]];
  const bad = [['opacity', 0.29], ['opacity', 1.01], ['opacity', NaN], ['opacity', '0.5'],
    ['unloadAfter', 4], ['unloadAfter', 61], ['unloadAfter', 10.5], ['accent', 'black'],
    ['fixedTabs', 'none'], ['searchEngine', 'yahoo'], ['browseStart', 'ftp://a.example/'],
    ['browseStart', 'example.com'], ['searchCustom', 'https://s.example/?q='], ['searchCustom', 'javascript:%s'],
    ['hideOnBlur', 'yes'], ['unknown', 1], ['__proto__', {}], ['toString', 'x']];
  for (const [k, v] of ok) assert.equal(isValidSetting(k, v), true, `${k}=${v}`);
  for (const [k, v] of bad) assert.equal(isValidSetting(k, v), false, `${k}=${v}`);
});

test('isValidSetting: language checked by the caller', () => {
  const isLanguage = (c) => c === 'system' || c === 'it';
  assert.equal(isValidSetting('language', 'it', isLanguage), true);
  assert.equal(isValidSetting('language', 'xx', isLanguage), false);
});

test('loadSettings: invalid values and unknown keys replaced by the defaults', () => {
  assert.deepEqual(loadSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings('garbage'), DEFAULT_SETTINGS);
  const s = loadSettings({ accent: 'nope', opacity: 0.5, extra: 1, language: 'xx' });
  assert.equal(s.accent, 'amber');
  assert.equal(s.opacity, 0.5);
  assert.equal('extra' in s, false);
  // A language no longer available is kept.
  assert.equal(s.language, 'xx');
});

test('loadSettings: the old unloadCurrentAfter becomes unloadAfter', () => {
  assert.equal(loadSettings({ unloadCurrentAfter: 10, unloadAfter: 50 }).unloadAfter, 10);
});
