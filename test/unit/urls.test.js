const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, addressOrSearch, pageKey, samePage, cookieDomain } = require('../../urls');

// Node's URL parser refuses spaces in a host, Chromium's takes them
// (escaped): the case of "not an address" in the page is in the UI tests
// (sites.spec.js).
test('normalizeUrl: https added, only http(s) with a valid host', () => {
  assert.equal(normalizeUrl('example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('  http://Example.com/a b  '), 'http://example.com/a%20b');
  assert.equal(normalizeUrl('localhost:8080/x'), 'https://localhost:8080/x');
  assert.equal(normalizeUrl('wiki.example.com/page?q=1#top'), 'https://wiki.example.com/page?q=1#top');
  assert.equal(normalizeUrl('münchen.de'), 'https://xn--mnchen-3ya.de/');
  for (const bad of ['', '   ', 'ftp://example.com', 'javascript:alert(1)', 'file:///etc/passwd',
    'not an address', 'two words.com', 'https://a b/', 'http://']) {
    assert.equal(normalizeUrl(bad), null, bad);
  }
});

test('addressOrSearch: addresses opened, other text searched', () => {
  const tpl = 'https://search.example/?q=%s';
  assert.equal(addressOrSearch('example.com', tpl), 'https://example.com/');
  assert.equal(addressOrSearch('http://localhost:3000', tpl), 'http://localhost:3000/');
  assert.equal(addressOrSearch('localhost:3000/x', tpl), 'https://localhost:3000/x');
  assert.equal(addressOrSearch('192.168.1.1', tpl), 'https://192.168.1.1/');
  assert.equal(addressOrSearch('[::1]:8080', tpl), 'https://[::1]:8080/');
  assert.equal(addressOrSearch('wiki of my game', tpl), 'https://search.example/?q=wiki%20of%20my%20game');
  assert.equal(addressOrSearch('starcitizen', tpl), 'https://search.example/?q=starcitizen');
  assert.equal(addressOrSearch('c++ & rust?', tpl), 'https://search.example/?q=c%2B%2B%20%26%20rust%3F');
  assert.equal(addressOrSearch('example.com and more', tpl), 'https://search.example/?q=example.com%20and%20more');
  assert.equal(addressOrSearch('   ', tpl), null);
  assert.equal(addressOrSearch('ftp://example.com', tpl), null);
  // %s more than once
  assert.equal(addressOrSearch('a b', 'https://s.example/%s?x=%s'), 'https://s.example/a%20b?x=a%20b');
});

test('pageKey / samePage: http(s), www., final / and fragment ignored', () => {
  assert.equal(pageKey('http://www.example.com/a/'), pageKey('https://example.com/a#x'));
  assert.notEqual(pageKey('https://example.com/a?x=1'), pageKey('https://example.com/a'));
  assert.equal(pageKey('https://example.com/a?x=1', false), pageKey('https://example.com/a', false));
  assert.notEqual(pageKey('https://example.com/a'), pageKey('https://sub.example.com/a'));
  assert.equal(pageKey(''), null);
  assert.equal(pageKey(undefined), null);
  assert.equal(pageKey('about:blank'), null);

  assert.equal(samePage('https://docs.example.com/d/1/edit?tab=t.0', 'https://docs.example.com/d/1/edit'), true);
  assert.equal(samePage('https://www.example.com/', 'http://example.com'), true);
  assert.equal(samePage('https://example.com/a', 'https://example.com/b'), false);
  assert.equal(samePage('', ''), false);
});

test('cookieDomain: host without www., empty for other schemes', () => {
  assert.equal(cookieDomain('https://www.example.com/x'), 'example.com');
  assert.equal(cookieDomain('http://sub.example.com'), 'sub.example.com');
  assert.equal(cookieDomain('https://www2.example.com'), 'www2.example.com');
  assert.equal(cookieDomain('about:blank'), '');
  assert.equal(cookieDomain('file:///x'), '');
  assert.equal(cookieDomain('garbage'), '');
});
