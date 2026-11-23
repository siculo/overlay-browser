// Options of the Settings page (prefs.settings): defaults and validation.
// Used by main.js; the page has the names of the accents and search
// engines with their colors and addresses (index.html).

// Key -> default.
const DEFAULT_SETTINGS = {
  hideOnBlur: true,     // hide the overlay when it loses focus
  language: 'system',   // 'system' or the code of one of the files in locales/
  opacity: 0.95,        // window opacity, from OPACITY_RANGE.min (most transparent) to 1 (opaque)
  accent: 'amber',      // accent color of the interface, one of ACCENTS
  unloadAfter: 30,      // minutes after which the pages not in use (all but the active tab) are closed, UNLOAD_RANGE
  browseStart: '',      // start page of the free browsing tab: an http(s) address, '' = none
  searchEngine: 'google', // search engine of the free browsing tab, one of SEARCH_ENGINES
  searchCustom: '',     // address of the 'custom' search engine, with %s in place of the text; '' = none
  fixedTabs: 'labels',  // fixed tabs (Home, Browse, Settings): 'labels' (icon and name) or 'icons' (icon only)
  checkUpdates: true,   // look for a newer version on GitHub (see 'new versions' in main.js); not in the Store version
  verboseLog: false,   // overlay.log: also what happens (shows, focus...), not only errors and crashes
};
const UNLOAD_RANGE = { min: 5, max: 60 };
// Names of the search engines; their addresses are defined by the page (index.html).
const SEARCH_ENGINES = ['google', 'bing', 'duckduckgo', 'brave', 'ecosia', 'startpage', 'custom'];
// Names of the predefined accent colors; the colors themselves are defined by the page (index.html).
const ACCENTS = ['amber', 'orange', 'red', 'pink', 'purple', 'blue', 'cyan', 'green'];
// Below the minimum the window would be too hard to read.
const OPACITY_RANGE = { min: 0.3, max: 1 };

function isHttpUrl(value) {
  try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; }
}

// Validity of a setting value beyond its type. `isLanguage(code)`: whether
// a language setting is available ('system' or a file in locales/).
function isValidSetting(key, value, isLanguage = () => true) {
  if (!Object.hasOwn(DEFAULT_SETTINGS, key) || typeof value !== typeof DEFAULT_SETTINGS[key]) return false;
  if (key === 'language') return isLanguage(value);
  if (key === 'opacity') return Number.isFinite(value) && value >= OPACITY_RANGE.min && value <= OPACITY_RANGE.max;
  if (key === 'accent') return ACCENTS.includes(value);
  if (key === 'browseStart') return value === '' || isHttpUrl(value);
  if (key === 'fixedTabs') return value === 'labels' || value === 'icons';
  if (key === 'searchEngine') return SEARCH_ENGINES.includes(value);
  if (key === 'searchCustom') return value === '' || (value.includes('%s') && isHttpUrl(value.replaceAll('%s', 'x')));
  if (key === 'unloadAfter') {
    return Number.isInteger(value) && value >= UNLOAD_RANGE.min && value <= UNLOAD_RANGE.max;
  }
  return true;
}

// The saved settings: known keys with a valid value, the others get the
// default. A language no longer available is kept: it counts as the system
// one (see currentLanguage in main.js) and comes back if its file is
// restored.
function loadSettings(saved) {
  const settings = { ...DEFAULT_SETTINGS };
  // Up to 1.0 there were two delays, one for the current list's pages
  // (`unloadCurrentAfter`) and one for the other lists' (`unloadAfter`): the
  // single delay keeps the first one.
  if (saved && typeof saved === 'object' && 'unloadCurrentAfter' in saved) {
    saved = { ...saved, unloadAfter: saved.unloadCurrentAfter };
  }
  if (saved && typeof saved === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const value = saved[key];
      const ok = key === 'language' ? typeof value === 'string' : isValidSetting(key, value);
      if (ok) settings[key] = value;
    }
  }
  return settings;
}

module.exports = { DEFAULT_SETTINGS, UNLOAD_RANGE, SEARCH_ENGINES, ACCENTS, OPACITY_RANGE, isValidSetting, loadSettings };
