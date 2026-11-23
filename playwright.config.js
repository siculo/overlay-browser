// UI tests (test/e2e): the real app, started by Playwright with a data
// folder of its own for each test (see test/e2e/helpers.js).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'test/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  // One app at a time: the overlay is always on top and takes the focus.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
