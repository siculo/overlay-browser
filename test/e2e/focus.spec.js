// Hide on blur with the site popups: the overlay and its popups count as
// one window. Needs a window manager that moves the focus: not under xvfb.
const { test, expect } = require('@playwright/test');
const { launch, startServer, site, list } = require('./helpers');

test.skip(!!process.env.CI && process.platform === 'linux', 'no window manager under xvfb');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.close(); });

let o;
test.afterEach(async () => { await o?.close(); o = null; });

const state = (app) => app.evaluate(({ BrowserWindow }) => {
  const [main] = BrowserWindow.getAllWindows().filter((w) => !w.getParentWindow() && !w.testOther);
  const popup = main.getChildWindows()[0];
  return {
    visible: main.isVisible(),
    focused: main.isFocused(),
    popup: popup ? { visible: popup.isVisible(), focused: popup.isFocused() } : null,
  };
});

test('focus moving to a popup and back does not hide the overlay', async () => {
  const a = site(server.url('/Login'), 'Login');
  o = await launch({ prefs: { settings: { hideOnBlur: true }, lists: [list(null, [a], { activeTab: a.id })] } });
  const { app } = o;
  await o.inSite(server.url('/Login'), (d) => d.title);
  // The overlay has the focus, as when the user clicks the login button
  // (started by the test, it may not get it by itself).
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await expect.poll(async () => (await state(app)).focused).toBe(true);

  await o.inSite(server.url('/Login'), () => { window.open('/Popup', 'login', 'width=400,height=300'); });
  await expect.poll(async () => (await state(app)).popup?.focused).toBe(true);
  await new Promise((r) => setTimeout(r, 300));
  expect((await state(app)).visible).toBe(true);

  // The popup closes: the overlay takes the focus back.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getParentWindow())?.close());
  await expect.poll(async () => (await state(app)).focused).toBe(true);
  expect((await state(app)).visible).toBe(true);
});

// On Windows the overlay counts as in the foreground while any window of
// its process is (ownsForeground in platform/win32.js): the test's window
// would not be another application's.
test('another window taking the focus hides the overlay', async () => {
  test.skip(process.platform === 'win32', 'a window of another process would be needed');
  o = await launch({ prefs: { settings: { hideOnBlur: true } } });
  const { app } = o;
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await expect.poll(async () => (await state(app)).focused).toBe(true);
  await app.evaluate(({ BrowserWindow }) => {
    const w = new BrowserWindow({ width: 300, height: 200, alwaysOnTop: true });
    w.testOther = true;
    w.loadURL('about:blank');
    w.focus();
  });
  await expect.poll(async () => (await state(app)).visible).toBe(false);
});
