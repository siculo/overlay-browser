const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseVersion, compareVersions, newestRelease } = require('../../versions');

test('parseVersion', () => {
  assert.deepEqual(parseVersion('v1.0.0-beta.5'), { core: [1, 0, 0], pre: ['beta', 5] });
  assert.deepEqual(parseVersion('1.2.3'), { core: [1, 2, 3], pre: [] });
  assert.deepEqual(parseVersion(' 1.2.3+build.7 '), { core: [1, 2, 3], pre: [] });
  for (const bad of ['', '1.2', 'v1', 'latest', null, undefined, '1.2.3-']) assert.equal(parseVersion(bad), null, String(bad));
});

test('compareVersions: semantic versioning order', () => {
  const order = ['0.9.9', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.9',
    '1.0.0-beta.10', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0'];
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) {
      const c = Math.sign(compareVersions(parseVersion(order[i]), parseVersion(order[j])));
      assert.equal(c, Math.sign(i - j), `${order[i]} vs ${order[j]}`);
    }
  }
});

const PAGE = 'https://github.com/owner/repo/releases/';
const rel = (tag, extra = {}) => ({ tag_name: tag, draft: false, prerelease: /-/.test(tag), html_url: `${PAGE}tag/${tag}`, ...extra });

test('newestRelease: from a stable version, stable releases only', () => {
  const releases = [rel('v1.1.0-beta.1'), rel('v1.0.1'), rel('v1.0.0'), rel('v0.9.0')];
  assert.deepEqual(newestRelease(releases, '1.0.0', PAGE), { version: '1.0.1', url: `${PAGE}tag/v1.0.1` });
  assert.equal(newestRelease(releases, '1.0.1', PAGE), null);
});

test('newestRelease: from a beta, prereleases too', () => {
  const releases = [rel('v1.0.0-beta.10'), rel('v1.0.0-beta.9'), rel('v1.0.0-beta.8')];
  assert.equal(newestRelease(releases, '1.0.0-beta.8', PAGE).version, '1.0.0-beta.10');
  // The stable version of the beta in use is newer.
  assert.equal(newestRelease([rel('v1.0.0'), ...releases], '1.0.0-beta.10', PAGE).version, '1.0.0');
});

test('newestRelease: drafts, bad tags and foreign addresses', () => {
  const releases = [rel('v9.0.0', { draft: true }), rel('nightly'), { tag_name: 7 }, null,
    rel('v2.0.0', { html_url: 'https://evil.example/' })];
  assert.deepEqual(newestRelease(releases, '1.0.0', PAGE), { version: '2.0.0', url: PAGE });
  assert.equal(newestRelease('not a list', '1.0.0', PAGE), null);
  assert.equal(newestRelease([rel('v2.0.0')], 'dev', PAGE), null);
});
