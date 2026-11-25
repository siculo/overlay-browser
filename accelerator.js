// Electron accelerators ("Ctrl+Shift+O") as the keyboard hook sees them
// (see 'low-level keyboard hook' in main.js), and as the user reads them.
// Shared by main.js and the unit tests (require) and the page (index.html,
// loaded with a <script>: window.OverlayAccelerator).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OverlayAccelerator = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  const MODIFIER_NAMES = {
    ctrl: 'ctrl', control: 'ctrl', commandorcontrol: 'ctrl', cmdorctrl: 'ctrl',
    alt: 'alt', option: 'alt', altgr: 'alt',
    shift: 'shift',
    super: 'meta', meta: 'meta', cmd: 'meta', command: 'meta',
  };
  // Accelerator key -> name of the key in uiohook-napi's UiohookKey.
  const ACCEL_KEYS = {
    space: 'Space', tab: 'Tab', enter: 'Enter', return: 'Enter', backspace: 'Backspace',
    insert: 'Insert', delete: 'Delete', home: 'Home', end: 'End',
    pageup: 'PageUp', pagedown: 'PageDown', escape: 'Escape', esc: 'Escape',
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
    ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash', '`': 'Backquote',
    numadd: 'NumpadAdd', numsub: 'NumpadSubtract', nummult: 'NumpadMultiply',
    numdiv: 'NumpadDivide', numdec: 'NumpadDecimal',
  };

  // The UiohookKey name of an accelerator's key ("F10" -> 'F10', "=" -> 'Equal'), or null.
  function keyName(part) {
    const p = part.trim().toLowerCase();
    if (ACCEL_KEYS[p]) return ACCEL_KEYS[p];
    if (/^[a-z0-9]$/.test(p)) return p.toUpperCase();
    if (/^f([1-9]|1\d|2[0-4])$/.test(p)) return p.toUpperCase();
    if (/^num\d$/.test(p)) return 'Numpad' + p.slice(3);
    return null;
  }

  // Converts an accelerator into { keycode, ctrl, alt, shift, meta }, with
  // the key codes of `keys` (uiohook-napi's UiohookKey); null without a key
  // the hook knows.
  function parseAccelerator(accelerator, keys) {
    const combo = { keycode: null, ctrl: false, alt: false, shift: false, meta: false };
    for (const part of accelerator.split('+')) {
      const p = part.trim().toLowerCase();
      if (MODIFIER_NAMES[p]) { combo[MODIFIER_NAMES[p]] = true; continue; }
      combo.keycode = keys[keyName(p)] ?? null;
    }
    return combo.keycode === null ? null : combo;
  }

  // Name of the Super/Meta key on each OS (process.platform): the key with
  // the Windows logo is "Win", the Command key "Cmd".
  function metaKeyName(os) {
    return os === 'win32' ? 'Win' : os === 'darwin' ? 'Cmd' : 'Super';
  }

  // The accelerator as shown to the user on `os`: only the Super/Meta key's
  // name changes ("Super+F10" -> "Win+F10" on Windows); the saved value stays
  // the accelerator Electron understands.
  function acceleratorLabel(accelerator, os) {
    if (!accelerator) return accelerator;
    return accelerator.split('+').map((part) =>
      MODIFIER_NAMES[part.trim().toLowerCase()] === 'meta' ? metaKeyName(os) : part).join('+');
  }

  return { ACCEL_KEYS, keyName, parseAccelerator, metaKeyName, acceleratorLabel };
}));
