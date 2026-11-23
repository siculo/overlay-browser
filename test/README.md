# Tests

```sh
npm test            # all
npm run test:unit   # unit tests only (a second)
npm run test:e2e    # UI tests only (the real app, ~20 s)
```

They also run on Windows, Linux and macOS on GitHub at every push
(`.github/workflows/test.yml`); when a UI test fails there, the
`test-results-<OS>` artifact of the run has a screenshot and a Playwright
trace (`npx playwright show-trace trace.zip`) of the failure.

## Unit tests (`test/unit/`)

`node:test`, no dependencies: the modules that do not need Electron
(`urls.js`, `settings.js`, `versions.js`, `accelerator.js`, `bookmarks.js`,
`platform/hosted.js`) and the data shipped with the app
(locales: same keys and placeholders as `en.json`, keys used by the code
present; predefined lists valid as described in `lists/README.md`).

## UI tests (`test/e2e/`)

Playwright starts the real app (`_electron.launch`) and drives its window
like a web page. `helpers.js`:

- `launch({ prefs, foregroundApp, show })`: the app on a new temporary data
  folder (`OVERLAY_TEST_DIR`, see `main.js`) with a `prefs.json` built from
  `prefs` (English, no hide on blur, no update checks unless given):
  the user's preferences, sessions and log are never touched, and the app
  can run while the real one is open. `launch({ dir })` restarts on the
  same folder (persistence). In test mode `main.js` starts no keyboard hook
  and no update check, and exposes `global.overlayTest` to the test.
- `o.show(app)` / `o.hide()`: shows and hides the overlay as the shortcut
  does; `app` (`{ exe, name, title }`, null = none) is the application it
  is opened over, which chooses the current list.
- `o.inSite(urlPrefix, fn)`: runs `fn(document)` in a site's `<webview>`
  (reached from the main process: Playwright does not see webviews as pages).
- `o.savedPrefs()`: `prefs.json` as on disk.
- `o.close({ keepDir })`: closes the app (and removes its folder unless
  `keepDir`); a JavaScript error in the overlay page fails the test there.
- `startServer()`: local web server with test pages (`/<name>` has the
  title `<name>`, `?blank=` a `target=_blank` link, `?open=` a
  `window.open` button, a favicon): tests never use the network, except
  the predefined list test, whose sites are real.
- System dialogs (file open/save) are replaced from the main process
  (`app.evaluate(({ dialog }) => ...)`, see `bookmarks.spec.js`).

Not covered (needs a real system): the global shortcut and the keyboard
hook in a game, focus given back to the game, the foreground app detection
itself (`platform/*`), edge snapping, the tray icon, the Google login.
