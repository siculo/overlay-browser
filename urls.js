// Addresses typed or visited, shared by the page (index.html, loaded with
// a <script>: window.OverlayUrls) and the unit tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OverlayUrls = factory();
}(this, () => {
  // A site's address from what the user typed: https:// added when there is
  // no scheme; null unless http(s) with a valid host.
  function normalizeUrl(raw) {
    let s = raw.trim();
    if (!s) return null;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      // Chromium takes spaces and other characters a host cannot have,
      // escaped ("not an address" -> https://not%20an%20address/).
      if (!/^https?:$/.test(u.protocol) || !u.hostname || u.hostname.includes('%')) return null;
      return u.href;
    } catch {
      return null;
    }
  }

  // Text of the free browsing tab's address field: an address when it has a
  // scheme or starts with a host ("example.com", "localhost", an IP, no
  // spaces), otherwise a search with `template` (an address with %s).
  function addressOrSearch(raw, template) {
    const text = raw.trim();
    if (!text) return null;
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) return normalizeUrl(text);
    const host = /^([^\s/?#:]+|\[[\da-f:.]+\])(:\d+)?([/?#]\S*)?$/i.exec(text)?.[1];
    const isHost = host && (host === 'localhost' || host.startsWith('[') ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      /^([\p{L}\p{N}-]+\.)+\p{L}[\p{L}\p{N}-]*$/iu.test(host));
    if (isHost) { const url = normalizeUrl(text); if (url) return url; }
    return template.replaceAll('%s', encodeURIComponent(text));
  }

  // Key of a page for telling whether it is a site's address (pageMatch):
  // ignores http/https, "www.", the final "/" of the path and the fragment;
  // `withQuery` false also ignores the query. null if not an address.
  function pageKey(url, withQuery = true) {
    const n = normalizeUrl(url ?? '');
    if (!n) return null;
    const { host, pathname, search } = new URL(n);
    return host.replace(/^www\./, '') + pathname.replace(/\/+$/, '') + (withQuery ? search : '');
  }

  // true if a and b are the same page: same host (ignoring "www.") and path
  // (ignoring the final "/"), whatever the query and the fragment, which the
  // page may change by itself (e.g. Google Docs adds ?tab=...). The site's
  // name and icon follow its page only then.
  function samePage(a, b) {
    const ka = pageKey(a, false);
    return !!ka && ka === pageKey(b, false);
  }

  // Domain whose cookies are removed for a page: its host without "www.",
  // '' for other than http(s); main.js removes the cookies of that domain,
  // of its subdomains and of the parent domains (cookies:clear).
  function cookieDomain(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : '';
    } catch { return ''; }
  }

  return { normalizeUrl, addressOrSearch, pageKey, samePage, cookieDomain };
}));
