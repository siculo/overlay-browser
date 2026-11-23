// Versions of the app (semantic versioning) and the check for a newer one
// among the GitHub releases (see 'new versions' in main.js).

// 'v1.0.0-beta.5' -> { core: [1, 0, 0], pre: ['beta', 5] }; null if not a version.
function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(text).trim());
  if (!m) return null;
  const pre = m[4] ? m[4].split('.').map((id) => (/^\d+$/.test(id) ? Number(id) : id)) : [];
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre };
}

// Semantic versioning order: > 0 if a is newer than b.
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  // Same numbers: the version without prerelease is the newer one.
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i];
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;   // numbers come before names
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return a.pre.length - b.pre.length;
}

// The newest release newer than the running version `current` (text), as
// { version, url }, or null. `releases`: the GitHub API's list (tag_name,
// draft, prerelease, html_url); drafts never count, prereleases only when
// the running version is one. `releasePage`: the releases' address, used
// when a release's own is not under it.
function newestRelease(releases, current, releasePage) {
  const cur = parseVersion(current);
  if (!cur) return null;
  let best = null;
  for (const r of Array.isArray(releases) ? releases : []) {
    const v = parseVersion(r?.tag_name);
    if (!v || r.draft || (r.prerelease && !cur.pre.length)) continue;
    if (compareVersions(v, cur) <= 0 || (best && compareVersions(v, best.v) <= 0)) continue;
    const url = typeof r.html_url === 'string' && r.html_url.startsWith(releasePage) ? r.html_url : releasePage;
    best = { v, version: r.tag_name.replace(/^v/, ''), url };
  }
  return best && { version: best.version, url: best.url };
}

module.exports = { parseVersion, compareVersions, newestRelease };
