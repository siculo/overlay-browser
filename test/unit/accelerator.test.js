const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ACCEL_KEYS, keyName, parseAccelerator } = require('../../accelerator');
const platform = require('../../platform');

// uiohook-napi connects to the display when loaded: without one (Linux
// runner without xvfb) the tests that need its key codes are skipped.
let UiohookKey = null, noHook = false;
try { ({ UiohookKey } = require('uiohook-napi')); } catch (err) { noHook = `uiohook-napi not loaded: ${err.message}`; }

test('every key name exists in uiohook-napi', { skip: noHook }, () => {
  for (const name of new Set(Object.values(ACCEL_KEYS))) assert.ok(name in UiohookKey, name);
  for (const k of ['A', 'Z', '0', '9', 'F1', 'F24', 'Numpad0', 'Numpad9']) assert.ok(k in UiohookKey, k);
});

test('keyName', () => {
  assert.equal(keyName('F10'), 'F10');
  assert.equal(keyName(' f24 '), 'F24');
  assert.equal(keyName('F25'), null);
  assert.equal(keyName('o'), 'O');
  assert.equal(keyName('='), 'Equal');
  assert.equal(keyName('Esc'), 'Escape');
  assert.equal(keyName('num5'), 'Numpad5');
  assert.equal(keyName('VolumeUp'), null);
});

test('parseAccelerator: modifiers and key', { skip: noHook }, () => {
  assert.deepEqual(parseAccelerator('Super+F10', UiohookKey),
    { keycode: UiohookKey.F10, ctrl: false, alt: false, shift: false, meta: true });
  assert.deepEqual(parseAccelerator('CommandOrControl+Shift+Space', UiohookKey),
    { keycode: UiohookKey.Space, ctrl: true, alt: false, shift: true, meta: false });
  assert.deepEqual(parseAccelerator('Alt+AltGr+Option+Num0', UiohookKey),
    { keycode: UiohookKey.Numpad0, ctrl: false, alt: true, shift: false, meta: false });
  assert.equal(parseAccelerator('Ctrl+Shift', UiohookKey), null);
  assert.equal(parseAccelerator('Ctrl+VolumeUp', UiohookKey), null);
  assert.equal(parseAccelerator('', UiohookKey), null);
});

test('the default shortcut of this platform is recognized', { skip: noHook }, () => {
  assert.ok(parseAccelerator(platform.defaultShortcut, UiohookKey), platform.defaultShortcut);
});

test('parseAccelerator with a table of key codes (no hook needed)', () => {
  const keys = { F10: 68, Space: 57, Equal: 13 };
  assert.deepEqual(parseAccelerator('Super+F10', keys), { keycode: 68, ctrl: false, alt: false, shift: false, meta: true });
  assert.deepEqual(parseAccelerator('Cmd+Shift+Space', keys), { keycode: 57, ctrl: false, alt: false, shift: true, meta: true });
  assert.deepEqual(parseAccelerator('Ctrl+=', keys), { keycode: 13, ctrl: true, alt: false, shift: false, meta: false });
  assert.equal(parseAccelerator('Ctrl+F11', keys), null);
});
